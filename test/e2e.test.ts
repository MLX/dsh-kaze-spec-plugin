/** Headless end-to-end: clarify → requirements → design → tasks → done → delivery → archive. */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { advanceSpec, gateErrors, initSpec, updateTask } from '../src/host/spec/state.js'
import { recordGate } from '../src/host/spec/delivery.js'
import { archiveSpec } from '../src/host/spec/archive.js'
import { assertSpecRoot } from '../src/host/spec/paths.js'
import { SPEC_ROOT_NAME } from '../src/shared/spec-root.js'

const workspace = await mkdtemp(join(tmpdir(), 'kaze-e2e-'))
const root = join(workspace, SPEC_ROOT_NAME)
const dir = join(root, 'e2e-demo')
try {
  await initSpec(root, { feature: 'e2e-demo', type: 'feature', scope: 'greenfield' })
  await writeFile(join(dir, 'clarify.md'), [
    '# Clarification Ledger',
    '',
    '## Decisions',
    '- D1 scope — source: round 1 Q1',
    '',
    '## Assumptions',
    '- None.',
    '',
    '## Open',
    '- none',
    '',
    '## Rounds',
    '- Round 1: 1 asked, 1 answered',
    '',
  ].join('\n'), 'utf8')
  await writeFile(join(dir, 'requirements.md'), [
    '# Requirements Document',
    '',
    '## Introduction',
    'A demo.',
    '',
    '## Glossary',
    '- **System**: the demo.',
    '',
    '## Requirements',
    '',
    '### Requirement 1: Work',
    '',
    '**User Story:** As a user, I want work, so that value.',
    '',
    '#### Acceptance Criteria',
    '',
    '1.1 WHEN asked, THE System SHALL work.',
    '',
  ].join('\n'), 'utf8')
  await writeFile(join(dir, 'design.md'), [
    '# Design Document',
    '',
    '## Overview',
    'One component.',
    '',
    '## Architecture',
    'A single module.',
    '',
    '## Components and Interfaces',
    '`work(): void`.',
    '',
    '## Data Models',
    'None.',
    '',
    '## Error Handling',
    'Typed errors.',
    '',
    '## Trade-offs',
    'One viable path.',

    '## Testing Strategy',
    'Unit test for work.',
    '',
  ].join('\n'), 'utf8')
  await writeFile(join(dir, 'tasks.md'), [
    '# Implementation Plan: e2e-demo',
    '',
    '## Tasks',
    '',
    '- [ ] 1. Implement work',
    '  - _Requirements: 1.1_',
    '',
    '## Task Dependency Graph',
    '',
    '```json',
    '{"waves":[{"id":0,"tasks":["1"]}]}',
    '```',
    '',
  ].join('\n'), 'utf8')
  await writeFile(join(dir, 'verification.md'), '# Verification\n\n## Method\n\nmanual check\n\n## Result\n\nPASS\n', 'utf8')
  await mkdir(join(dir, 'exec', 'evidence'), { recursive: true })
  await writeFile(join(dir, 'exec', 'evidence', '1.json'), `${JSON.stringify({
    task: '1',
    executor: 'test',
    files: [],
    commands: ['node --test'],
    result: 'passed',
    at: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8')

  const planned = await advanceSpec(root, 'e2e-demo', 'tasks')
  assert.equal(planned.ok, true, planned.errors.join('\n'))
  await updateTask(root, 'e2e-demo', '1', 'completed')
  assert.equal((await gateErrors(root, 'e2e-demo', 'execute')).ok, true)
  await recordGate(root, 'e2e-demo', { gate: 'acceptance', status: 'skipped', reason: 'demo: acceptance absent' })
  await recordGate(root, 'e2e-demo', { gate: 'fta', status: 'approved', details: 'Verdict: PASS', evidence: 'read the diff' })
  const done = await advanceSpec(root, 'e2e-demo', 'done')
  assert.equal(done.ok, true, done.errors.join('\n'))
  assert.ok(existsSync(join(dir, 'delivery.md')), 'delivery.md was not built')

  // Archiving moves the spec inside the same root; no second directory appears.
  const archived = await archiveSpec(root, 'e2e-demo')
  assert.ok(existsSync(archived.path), 'the archived spec directory is missing')
  assert.equal(
    archived.path.startsWith(join(root, 'archive')),
    true,
    `archive landed outside the spec root: ${archived.path}`,
  )
  assert.equal(existsSync(dir), false, 'archiving left the active spec directory behind')

  // The whole lifecycle creates one spec root and never the legacy directory.
  assert.equal(await countDirectory(workspace, SPEC_ROOT_NAME), 1, 'the lifecycle must create exactly one spec root')
  assert.equal(await countDirectory(workspace, '.specs'), 0, 'the lifecycle created a legacy .specs directory')
  // A path that still names the old root is rejected rather than silently used.
  assert.throws(() => assertSpecRoot(join(workspace, '.specs')), /\.kaze/)

  console.log('headless e2e OK')
} finally {
  await rm(workspace, { recursive: true, force: true })
}

/** Count directories with one name anywhere under `base`. */
async function countDirectory(base: string, name: string): Promise<number> {
  let count = 0
  const walk = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (entry.name === name) count += 1
      await walk(join(current, entry.name))
    }
  }
  await walk(base)
  return count
}
