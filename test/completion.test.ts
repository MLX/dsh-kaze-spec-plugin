/** Closure regression tests: content gates, done terminal state, evidence, capability. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  advanceSpec,
  gateErrors,
  initSpec,
  recordVerification,
  renameSpec,
  repairSpec,
  setScope,
  updateTask,
} from '../src/host/spec/state.js'
import { archiveSpec } from '../src/host/spec/archive.js'
import { completionSummary, recordGate } from '../src/host/spec/delivery.js'
import { mergeRequirements } from '../src/host/spec/living.js'

const root = join(await mkdtemp(join(tmpdir(), 'kaze-completion-')), '.kaze')

const CLARIFY = `# Clarification Ledger

## Decisions

- D1: test decision.

## Assumptions

- None.

## Rounds

1.

## Open

- None.
`
const REQUIREMENTS = `# Requirements Document

## Introduction

Demo.

## Glossary

- **Thing**: a thing.

## Requirements

### Requirement 1: Work

**User Story:** As a user, I want work, so that value.

#### Acceptance Criteria

1.1 WHEN asked, THE Thing SHALL work.
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

_For any_ input, work twice equals once.

**Validates: Requirements 1.1**

## Error Handling

Errors.

## Trade-offs
One viable path; no alternative worth recording.
## Testing Strategy

Tests.
`
const TASKS = `# Implementation Plan

## Overview

Probe.

## Tasks

- [ ] 1. Build it
  - _Requirements: 1.1_

## Task Dependency Graph

\`\`\`json
{"waves":[{"id":0,"tasks":["1"]}]}
\`\`\`
`
const VERIFICATION = `# Verification

## Method

manual test command

## Result

PASS
`
const ACCEPTANCE = `# Acceptance

## Goal

Works.

## Success Criteria

- [x] It works (Requirements 1.1)

## Verification

Observed.
`

const write = async (feature: string, name: string, text: string): Promise<void> => {
  const path = join(root, feature, name)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text, 'utf8')
}
const evidence = async (feature: string, id: string): Promise<void> => {
  await mkdir(join(root, feature, 'exec', 'evidence'), { recursive: true })
  await writeFile(join(root, feature, 'exec', 'evidence', `${id}.json`), `${JSON.stringify({
    task: id,
    executor: 'test',
    files: [],
    commands: ['node --test'],
    result: 'passed',
    at: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8')
}

async function complete(feature: string, capability?: string): Promise<void> {
  await initSpec(root, { feature, type: 'feature', scope: 'greenfield', ...(capability === undefined ? {} : { capability }) })
  await write(feature, 'clarify.md', CLARIFY)
  await write(feature, 'requirements.md', REQUIREMENTS)
  await write(feature, 'design.md', DESIGN)
  await write(feature, 'tasks.md', TASKS)
  await write(feature, 'verification.md', VERIFICATION)
  await write(feature, 'acceptance.md', ACCEPTANCE)
  await callAdvance(feature, 'tasks')
  await updateTask(root, feature, '1', 'completed')
  await evidence(feature, '1')
  await callAdvance(feature, 'execute')
  await recordGate(root, feature, { gate: 'acceptance', status: 'approved', details: 'verified', evidence: 'probe' })
  await recordGate(root, feature, { gate: 'fta', status: 'approved', details: 'Verdict: PASS\nBlockers: 0, Concerns: 0, Notes: 0', evidence: 'probe' })
  if (capability !== undefined) await mergeRequirements(root, feature)
  const done = await advanceSpec(root, feature, 'done')
  assert.equal(done.ok, true, done.errors.join('\n'))
}
async function callAdvance(feature: string, to: 'requirements' | 'design' | 'tasks' | 'execute'): Promise<void> {
  const result = await advanceSpec(root, feature, to)
  assert.equal(result.ok, true, result.errors.join('\n'))
}

try {
  await mkdir(join(dirname(root), 'src'), { recursive: true })
  await writeFile(join(dirname(root), 'src', 'store.ts'), 'export const store = {}\n', 'utf8')

  // A requirement with no acceptance criterion is a gate error, even in strict mode.
  await initSpec(root, { feature: 'hollow', scope: 'greenfield' })
  await write('hollow', 'clarify.md', CLARIFY)
  await write('hollow', 'requirements.md', REQUIREMENTS.replace('1.1 WHEN asked, THE Thing SHALL work.', ''))
  const hollow = await gateErrors(root, 'hollow', 'requirements', true)
  assert.equal(hollow.ok, false)
  assert.match(hollow.errors.join('\n'), /no acceptance criteria/)

  // Clarification open questions block the requirements gate.
  await initSpec(root, { feature: 'open-question', scope: 'greenfield' })
  await write('open-question', 'clarify.md', CLARIFY.replace('## Open\n\n- None.', '## Open\n\n- Which database?'))
  await write('open-question', 'requirements.md', REQUIREMENTS)
  const open = await gateErrors(root, 'open-question', 'requirements')
  assert.equal(open.ok, false)
  assert.match(open.errors.join('\n'), /open question/)

  // Malformed evidence blocks execute.
  await initSpec(root, { feature: 'bad-evidence', scope: 'greenfield' })
  await write('bad-evidence', 'clarify.md', CLARIFY)
  await write('bad-evidence', 'requirements.md', REQUIREMENTS)
  await write('bad-evidence', 'design.md', DESIGN)
  await write('bad-evidence', 'tasks.md', TASKS)
  await callAdvance('bad-evidence', 'tasks')
  await updateTask(root, 'bad-evidence', '1', 'completed')
  await write('bad-evidence', 'exec/evidence/1.json', '{}\n')
  const badExecute = await gateErrors(root, 'bad-evidence', 'execute')
  assert.equal(badExecute.ok, false)
  assert.match(badExecute.errors.join('\n'), /invalid evidence|evidence "task"/)

  // Malformed verification blocks done for a brownfield feature.
  await initSpec(root, { feature: 'bad-verification', scope: 'brownfield' })
  await write('bad-verification', 'clarify.md', CLARIFY)
  await write('bad-verification', 'requirements.md', `# Requirements Document

## Introduction

Brownfield.

## Glossary

- **Thing**: a thing.

## Requirements

### Requirement 1: Work

**User Story:** As a user, I want work, so that value.

#### Acceptance Criteria

1.1 WHEN asked, THE Thing SHALL work.
1.2 WHEN old data is read, THE Thing SHALL CONTINUE TO work.

## Existing System Survey

- \`src/store.ts:1\` — the persisted shape and its callers
`)
  await write('bad-verification', 'design.md', `${DESIGN}\n## Impact on Existing System\nCallers.\n\n## Migration and Backward Compatibility\nOld readers.\n\nPreservation: old reads stay.\n`)
  await write('bad-verification', 'tasks.md', `# Implementation Plan

## Tasks

- [ ] 1. Migration: update the reader and parser
  - _Requirements: 1.1_
- [ ] 2. Run the existing suite and confirm no regression
  - _Requirements: 1.2_

## Task Dependency Graph

\`\`\`json
{"waves":[{"id":0,"tasks":["1"]},{"id":1,"tasks":["2"]}]}
\`\`\`
`)
  await callAdvance('bad-verification', 'tasks')
  await updateTask(root, 'bad-verification', '1', 'completed')
  await updateTask(root, 'bad-verification', '2', 'completed')
  await evidence('bad-verification', '1')
  await evidence('bad-verification', '2')
  await callAdvance('bad-verification', 'execute')
  await recordGate(root, 'bad-verification', { gate: 'acceptance', status: 'skipped', reason: 'probe' })
  await recordGate(root, 'bad-verification', { gate: 'fta', status: 'skipped', reason: 'probe' })
  await write('bad-verification', 'verification.md', '')
  const badVerification = await gateErrors(root, 'bad-verification', 'done')
  assert.equal(badVerification.ok, false)
  assert.match(badVerification.errors.join('\n'), /## Method/)

  // Done is terminal and archive re-checks it.
  await complete('done-terminal')
  await assert.rejects(updateTask(root, 'done-terminal', '1', 'completed'), /done/)
  await assert.rejects(setScope(root, 'done-terminal', 'brownfield'), /done/)
  await assert.rejects(renameSpec(root, 'done-terminal', 'renamed'), /phase=done|done/)
  await assert.rejects(repairSpec(root, 'done-terminal', { resetPhase: 'tasks' }), /done/)
  await write('done-terminal', 'requirements.md', `${REQUIREMENTS}\nChanged after done.\n`)
  const staleDone = await gateErrors(root, 'done-terminal', 'done')
  assert.equal(staleDone.ok, false)
  assert.match(staleDone.errors.join('\n'), /changed after/)
  await assert.rejects(archiveSpec(root, 'done-terminal', { reason: 'stale' }), /done gate no longer passes/)
  const staleSummary = await completionSummary(root, 'done-terminal')
  assert.equal(staleSummary.acceptance.stale, true)
  assert.equal(staleSummary.fta.stale, true)
  assert.deepEqual(staleSummary.next.map((action) => action.id), ['reapprove'])

  // A capability cannot publish before acceptance/FTA, and done requires its merge.
  await initSpec(root, { feature: 'cap-block', scope: 'greenfield', capability: 'cap-probe' })
  await write('cap-block', 'clarify.md', CLARIFY)
  await write('cap-block', 'requirements.md', REQUIREMENTS)
  await write('cap-block', 'design.md', DESIGN)
  await write('cap-block', 'tasks.md', TASKS)
  await callAdvance('cap-block', 'tasks')
  await updateTask(root, 'cap-block', '1', 'completed')
  await evidence('cap-block', '1')
  await assert.rejects(mergeRequirements(root, 'cap-block'), /acceptance and FTA/)
  await recordGate(root, 'cap-block', { gate: 'acceptance', status: 'skipped', reason: 'probe: no acceptance file' })
  await assert.rejects(mergeRequirements(root, 'cap-block'), /acceptance and FTA/)
  await recordGate(root, 'cap-block', { gate: 'fta', status: 'approved', details: 'Verdict: PASS', evidence: 'probe' })
  const merged = await mergeRequirements(root, 'cap-block')
  assert.deepEqual(merged.added, ['Work'])

  // Bugfix completion requires a verification record.
  await initSpec(root, { feature: 'bug-done', type: 'bugfix' })
  await write('bug-done', 'clarify.md', CLARIFY)
  await write('bug-done', 'bugfix.md', `# Bugfix — bug-done

## Introduction

A defect.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN clicked, THE app crashes.

### Expected Behavior (Correct)

2.1 WHEN clicked, THE app SHALL not crash.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN another button is clicked, THE app SHALL CONTINUE TO work.
`)
  await write('bug-done', 'design.md', `# Design Document

## Overview

Fix it.

## Bug Details

Crash.

## Expected Behavior

No crash.

## Hypothesized Root Cause

Null handler.

## Correctness Properties

### Property 1: Preservation

**Validates: Requirements 3.1**

## Fix Implementation

Guard it.

## Trade-offs
One viable path; no alternative worth recording.
## Testing Strategy

Regression.
`)
  await write('bug-done', 'tasks.md', `# Implementation Plan

## Tasks

- [ ] 1. Exploration test fails on unfixed code
  - _Requirements: 2.1_
- [ ] 2. Fix and preserve unchanged behavior
  - _Requirements: 2.1_
- [ ] 3. Run the regression suite
  - _Requirements: 3.1_

## Task Dependency Graph

\`\`\`json
{"waves":[{"id":0,"tasks":["1"]},{"id":1,"tasks":["2"]},{"id":2,"tasks":["3"]}]}
\`\`\`
`)
  await callAdvance('bug-done', 'tasks')
  for (const id of ['1', '2', '3']) {
    await updateTask(root, 'bug-done', id, 'completed')
    await evidence('bug-done', id)
  }
  await callAdvance('bug-done', 'execute')
  await recordGate(root, 'bug-done', { gate: 'acceptance', status: 'skipped', reason: 'probe' })
  await recordGate(root, 'bug-done', { gate: 'fta', status: 'skipped', reason: 'probe' })
  const bugDone = await gateErrors(root, 'bug-done', 'done')
  assert.equal(bugDone.ok, false)
  assert.match(bugDone.errors.join('\n'), /verification\.md/)

  // Property targets are resolved, not just formatted.
  await initSpec(root, { feature: 'phantom-property', scope: 'greenfield' })
  await write('phantom-property', 'clarify.md', CLARIFY)
  await write('phantom-property', 'requirements.md', REQUIREMENTS)
  await write('phantom-property', 'design.md', DESIGN.replace('Requirements 1.1', 'Requirements 9.9'))
  await write('phantom-property', 'tasks.md', TASKS)
  const phantom = await gateErrors(root, 'phantom-property', 'tasks')
  assert.equal(phantom.ok, false)
  assert.match(phantom.errors.join('\n'), /unknown acceptance criterion 9\.9/)

  // An explicit repair reset is the sanctioned recovery for a damaged phase.
  await initSpec(root, { feature: 'repair-phase', scope: 'greenfield' })
  await write('repair-phase', 'clarify.md', CLARIFY)
  await write('repair-phase', 'requirements.md', REQUIREMENTS)
  await callAdvance('repair-phase', 'requirements')
  await repairSpec(root, 'repair-phase', { resetPhase: 'initial' })
  const repaired = await gateErrors(root, 'repair-phase', 'requirements')
  assert.equal(repaired.ok, true, repaired.errors.join('\n'))

  // The verify-first model is structurally preflighted; a named assertion must
  // cover each criterion, and a manual check must say so in both Method/Result.
  await initSpec(root, { feature: 'model-preflight', scope: 'greenfield', workflow: 'verify-first' })
  await write('model-preflight', 'clarify.md', CLARIFY)
  await write('model-preflight', 'requirements.md', REQUIREMENTS)
  await write('model-preflight', 'model.smt2', '(assert true)\n')
  await assert.rejects(recordVerification(root, 'model-preflight'), /check-sat/)
  await write('model-preflight', 'model.smt2', '(declare-sort State 0)\n(assert (! true :named req_1_1))\n(check-sat)\n')
  const recorded = await recordVerification(root, 'model-preflight')
  assert.equal(recorded.hash.length, 64)
  await write('model-preflight', 'model.smt2', '(declare-sort State 0)\n(assert (! true :named req_9_9))\n(check-sat)\n')
  await assert.rejects(recordVerification(root, 'model-preflight'), /no named assertion covers acceptance criterion 1\.1/)
  await write('model-preflight', 'model.smt2', '(declare-sort State 0)\n(assert (! true :named req_1_1))\n(check-sat)\n')
  await write('model-preflight', 'verification.md', '# Verification\n\n## Method\n\nmanual review\n\n## Result\n\nPASS\n\n## Assertion Map\n\n| req_1_1 | 1.1 | true |\n')
  const manualUnmarked = await gateErrors(root, 'model-preflight', 'requirements')
  assert.equal(manualUnmarked.ok, false)
  assert.match(manualUnmarked.errors.join('\n'), /manual verification must mark/)
  await write('model-preflight', 'verification.md', '# Verification\n\n## Method\n\nmanual review\n\n## Result\n\nPASS (manual)\n\n## Assertion Map\n\n| req_1_1 | 1.1 | true |\n')
  const manual = await gateErrors(root, 'model-preflight', 'requirements')
  assert.equal(manual.ok, true, manual.errors.join('\n'))

  console.log('completion closure OK')
  assert.equal((await readFile(join(root, 'done-terminal', 'tasks.md'), 'utf8')).includes('_Requirements: 1.1_'), true)
} finally {
  await rm(join(root, '..'), { recursive: true, force: true })
}
