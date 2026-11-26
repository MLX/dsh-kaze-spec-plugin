/** Regression tests for the closure fixes: reserved dirs, queue lifecycle, merge gating, approval freshness. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { archiveSpec, listArchived } from '../src/host/spec/archive.js'
import { gateErrors, initSpec, listSpecs, recordPbt, renameSpec } from '../src/host/spec/state.js'
import { recordGate } from '../src/host/spec/delivery.js'
import { idleMutate, readIdleQueue } from '../src/host/spec/idle.js'
import { mergeRequirements } from '../src/host/spec/living.js'

const cleanRoot = async (name: string): Promise<string> => {
  const root = join(await mkdtemp(join(tmpdir(), `kaze-${name}-`)), '.kaze')
  await mkdir(root, { recursive: true })
  return root
}

const REQUIREMENTS = `# Requirements Document
## Introduction
Demo.
## Glossary
- **Thing**: a thing.
## Requirements
### Requirement 1: Work
**User Story:** As a user, I want work, so that value.
#### Acceptance Criteria
1. WHEN asked, THE system SHALL work.
`

const DESIGN = `# Design Document
## Overview
Overview.
## Architecture
Architecture.
## Components and Interfaces
Components.
## Data Models
Data.
## Correctness Properties
### Property 1: Idempotent
**Validates: Requirements 1.1**
## Error Handling
Errors.
## Trade-offs
One viable path; no alternative worth recording.
## Testing Strategy
Tests.
`

// 1. Bookkeeping directories are not specs.
{
  const root = await cleanRoot('reserved')
  await initSpec(root, { feature: 'real-spec', scope: 'greenfield' })
  for (const name of ['archive', 'specs', 'batch', 'steering', 'wishes']) {
    await mkdir(join(root, name), { recursive: true })
    await writeFile(join(root, name, 'note.md'), '# note\n')
  }
  // `/spec-wish` stores refined wishes under `.kaze/wishes/<slug>.md` before a
  // spec exists; that directory must never be listed as a spec.
  await writeFile(join(root, 'wishes', 'demo-wish.md'), '# Refined wish\n')
  await mkdir(join(root, 'specs', 'auth'), { recursive: true })
  await writeFile(join(root, 'specs', 'auth', 'spec.md'), '# auth Specification\n')
  // A stray directory with no state.json and no documents is not a spec; one
  // that kept its documents but lost state.json is a spec that needs repair.
  await mkdir(join(root, 'stray'), { recursive: true })
  await writeFile(join(root, 'stray', 'notes.json'), '{}\n')
  await mkdir(join(root, 'damaged'), { recursive: true })
  await writeFile(join(root, 'damaged', 'requirements.md'), REQUIREMENTS)
  const listed = await listSpecs(root)
  assert.deepEqual(listed.map((entry) => entry.feature), ['damaged', 'real-spec'])
  assert.equal(listed.find((entry) => entry.feature === 'damaged')?.error !== undefined, true)
  assert.equal(listed.find((entry) => entry.feature === 'real-spec')?.error, undefined)
}

// 1b. A spec can never take a bookkeeping directory's name; it would be hidden.
{
  const root = await cleanRoot('reserved-names')
  for (const name of ['archive', 'specs', 'batch', 'steering', 'wishes']) {
    await assert.rejects(
      () => initSpec(root, { feature: name, scope: 'greenfield' }),
      /reserved/,
      `feature id "${name}" must be rejected`,
    )
  }
  const created = await initSpec(root, { feature: 'wish-list', scope: 'greenfield' })
  assert.equal(created.state.feature, 'wish-list')
}

// 1c. A stray directory under `.kaze/archive` is not an archived spec.
{
  const root = await cleanRoot('archive-stray')
  await initSpec(root, { feature: 'archived-spec', scope: 'greenfield' })
  await archiveSpec(root, 'archived-spec', { force: true })
  await mkdir(join(root, 'archive', 'notes'), { recursive: true })
  await writeFile(join(root, 'archive', 'notes', 'readme.md'), '# stray\n')
  const listed = await listArchived(root)
  assert.deepEqual(listed.map((entry) => entry.feature), ['archived-spec'])
}

// 2. Rename and archive reconcile the idle queue; prune recovers orphans.
{
  const root = await cleanRoot('queue')
  const created = await initSpec(root, { feature: 'q-spec', scope: 'greenfield' })
  const dir = join(root, 'q-spec')
  await writeFile(join(dir, 'tasks.md'), `# Implementation Plan
## Tasks
- [ ] 1. Required task
  - _Requirements: 1.1_
- [ ]* 2. Optional follow-up
  - _Requirements: 1.1_
- [ ] 3. Checkpoint
  - _Requirements: 1.1_
## Task Dependency Graph
\`\`\`json
{"waves":[{"id":0,"tasks":["1"]},{"id":1,"tasks":["2","3"]}]}
\`\`\`
`)
  const deferred = await idleMutate(root, 'defer', { feature: 'q-spec' })
  assert.equal((deferred.result as { added: string[] }).added.length, 1)
  assert.equal((await readIdleQueue(root)).entries.length, 1)

  await renameSpec(root, 'q-spec', 'q-renamed')
  const afterRename = await readIdleQueue(root)
  assert.equal(afterRename.entries.length, 1)
  assert.equal(afterRename.entries[0]!.feature, 'q-renamed')

  const archived = await archiveSpec(root, 'q-renamed', { force: true })
  assert.equal(archived.idlePruned, 1)
  assert.equal((await readIdleQueue(root)).entries.length, 0)
  assert.equal(created.state.feature, 'q-spec')

  // An orphaned entry (spec no longer exists) is removable by prune.
  await writeFile(join(root, 'idle-queue.json'), JSON.stringify({
    schema: 1,
    entries: [
      { id: 'idle-orphan', feature: 'gone-spec', taskId: '1', status: 'queued' },
    ],
  }))
  const pruned = await idleMutate(root, 'prune', {})
  assert.equal((pruned.result as { removed: string[] }).removed.length, 1)
  assert.equal((await readIdleQueue(root)).entries.length, 0)
}

// 3. A capability only accepts behavior after the task plan and execution.
{
  const root = await cleanRoot('merge')
  await initSpec(root, { feature: 'merge-spec', scope: 'greenfield', capability: 'auth' })
  const dir = join(root, 'merge-spec')
  await writeFile(join(dir, 'requirements.md'), REQUIREMENTS)
  await writeFile(join(dir, 'design.md'), DESIGN)
  await writeFile(join(dir, 'tasks.md'), `# Implementation Plan
## Tasks
- [ ] 1. Build it
  - _Requirements: 1.1_
## Task Dependency Graph
\`\`\`json
{"waves":[{"id":0,"tasks":["1"]}]}
\`\`\`
`)
  await assert.rejects(mergeRequirements(root, 'merge-spec'), /phase=initial/)
}

// 4. An approval stops covering the documents once they change.
{
  const root = await cleanRoot('fresh')
  await initSpec(root, { feature: 'fresh-spec', scope: 'greenfield' })
  const dir = join(root, 'fresh-spec')
  await writeFile(join(dir, 'requirements.md'), REQUIREMENTS)
  await writeFile(join(dir, 'design.md'), DESIGN)
  await writeFile(join(dir, 'tasks.md'), `# Implementation Plan
## Tasks
- [x] 1. Build it
  - _Requirements: 1.1_
## Task Dependency Graph
\`\`\`json
{"waves":[{"id":0,"tasks":["1"]}]}
\`\`\`
`)
  await writeFile(join(dir, 'acceptance.md'), `# Acceptance
## Goal
Works.
## Success Criteria
- [x] The command prints ok.
`)
  await writeFile(join(dir, 'verification.md'), `# Verification
## Method
manual
## Result
PASS
`)
  await recordGate(root, 'fresh-spec', { gate: 'acceptance', status: 'approved', details: 'checked' })
  await recordGate(root, 'fresh-spec', { gate: 'fta', status: 'approved', details: 'PASS' })
  const fresh = await gateErrors(root, 'fresh-spec', 'done')
  assert.equal(fresh.errors.some((message) => message.includes('changed after')), false, fresh.errors.join('\n'))

  await writeFile(join(dir, 'design.md'), `${DESIGN}\nChanged after approval.\n`)
  const stale = await gateErrors(root, 'fresh-spec', 'done')
  assert.equal(stale.ok, false)
  assert.equal(stale.errors.some((message) => message.includes('changed after')), true, stale.errors.join('\n'))

  // A final failed PBT record blocks done until the property is re-run to green.
  await recordPbt(root, 'fresh-spec', '1', 'failed', 'counterexample: empty input')
  const pbtFailed = await gateErrors(root, 'fresh-spec', 'done')
  assert.equal(pbtFailed.ok, false)
  assert.equal(
    pbtFailed.errors.some((message) => message.includes('property test(s) recorded failed: Property 1')),
    true,
    pbtFailed.errors.join('\n'),
  )
  await recordPbt(root, 'fresh-spec', '1', 'passed')
  const pbtRecovered = await gateErrors(root, 'fresh-spec', 'done')
  assert.equal(pbtRecovered.errors.some((message) => message.includes('property test(s) recorded failed')), false)
}

console.log('closure.test ok')
