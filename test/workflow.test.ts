/** Workflow route and design depth regression test; run through test-engine.sh. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { advanceSpec, gateErrors, initSpec, loadState, recordDocCreated, recordVerification, setWorkflow, specStatus } from '../src/host/spec/state.js'
import { recordGate } from '../src/host/spec/delivery.js'
import { featureDir } from '../src/host/spec/paths.js'

const root = await mkdtemp(join(tmpdir(), 'kaze-workflow-'))
try {
  // init records the route and the design depth.
  const created = await initSpec(root, {
    feature: 'design-route',
    type: 'feature',
    scope: 'greenfield',
    workflow: 'design-first',
    designDetail: 'high',
  })
  assert.equal(created.state.workflow, 'design-first')
  assert.equal(created.state.designDetail, 'high')
  const status = await specStatus(root, 'design-route')
  assert.equal(status.workflow, 'design-first')
  assert.equal(status.designDetail, 'high')

  // A legacy state without designDetail normalizes to comprehensive.
  const legacy = await initSpec(root, { feature: 'legacy-route', type: 'feature', scope: 'greenfield' })
  assert.equal(legacy.state.designDetail, 'comprehensive')

  // bugfix keeps its workflow and accepts only a depth change.
  const bug = await initSpec(root, { feature: 'bugfix-route', type: 'bugfix' })
  assert.equal(bug.state.workflow, 'bugfix')
  await assert.rejects(
    () => setWorkflow(root, 'bugfix-route', { workflow: 'verify-first' }),
    /bugfix spec keeps the bugfix workflow/,
  )
  const depthOnly = await setWorkflow(root, 'bugfix-route', { designDetail: 'low' })
  assert.equal(depthOnly.workflow, 'bugfix')
  assert.equal(depthOnly.designDetail, 'low')

  // setWorkflow records the change and rejects unknown values.
  const switched = await setWorkflow(root, 'legacy-route', { workflow: 'verify-first', designDetail: 'low' })
  assert.equal(switched.workflow, 'verify-first')
  assert.equal(switched.designDetail, 'low')
  const loaded = await loadState(root, 'legacy-route')
  const last = loaded.history.at(-1) as Record<string, unknown>
  assert.equal(last.event, 'workflow')
  await assert.rejects(() => setWorkflow(root, 'legacy-route', { workflow: 'nope' }), /unknown feature workflow/)
  await assert.rejects(() => setWorkflow(root, 'legacy-route', { designDetail: 'huge' }), /unknown design detail/)

  // design-first blocks the requirements gate until design.md exists.
  await writeFile(join(featureDir(root, 'design-route'), 'requirements.md'), '# Requirements\n', 'utf8')
  const noDesign = await gateErrors(root, 'design-route', 'requirements')
  assert.ok(noDesign.errors.some((error) => error.includes('design-first workflow requires design.md')))
  await writeFile(join(featureDir(root, 'design-route'), 'design.md'), '# Design\n', 'utf8')
  const withDesign = await gateErrors(root, 'design-route', 'requirements')
  assert.ok(!withDesign.errors.some((error) => error.includes('design-first workflow requires design.md')))

  // verify-first blocks until model.smt2 (with an assert) and verification.md exist.
  const verifyDir = featureDir(root, 'legacy-route')
  const req = await gateErrors(root, 'legacy-route', 'requirements')
  assert.ok(req.errors.some((error) => error.includes('requires model.smt2')))
  assert.ok(req.errors.some((error) => error.includes('requires verification.md')))
  await writeFile(join(verifyDir, 'model.smt2'), '; no assertions yet\n', 'utf8')
  await writeFile(join(verifyDir, 'verification.md'), '\n', 'utf8')
  const emptyModel = await gateErrors(root, 'legacy-route', 'requirements')
  assert.ok(emptyModel.errors.some((error) => error.includes('no (assert ...) constraint')))
  assert.ok(emptyModel.errors.some((error) => error.includes('## Method')))
  await writeFile(join(verifyDir, 'model.smt2'), '(declare-sort State 0)\n(assert (! true :named req_1_1))\n(check-sat)\n', 'utf8')
  await writeFile(
    join(verifyDir, 'verification.md'),
    '# Verification\n\n## Method\n\nmanual review (z3 unavailable)\n\n## Result\n\nPASS (manual)\n\n## Assertion Map\n\n| req_1_1 | 1.1 | true |\n',
    'utf8',
  )
  const verified = await gateErrors(root, 'legacy-route', 'requirements')
  assert.ok(!verified.errors.some((error) => error.includes('model.smt2')))
  assert.ok(!verified.errors.some((error) => error.includes('verification.md')))

  // A recorded FAIL is a contradiction between the model and the requirements:
  // the requirements gate refuses it instead of waving it through.
  await writeFile(
    join(verifyDir, 'verification.md'),
    '# Verification\n\n## Method\n\nz3 -smt2 model.smt2\n\n## Result\n\nFAIL\n\n## Assertion Map\n\n| req_1_1 | 1.1 | false |\n',
    'utf8',
  )
  const failedCheck = await gateErrors(root, 'legacy-route', 'requirements')
  assert.equal(failedCheck.ok, false)
  assert.ok(failedCheck.errors.some((error) => error.includes('Result must start with PASS')), failedCheck.errors.join('\n'))
  assert.ok(failedCheck.errors.some((error) => error.includes('re-run the model check')))

  // verify-first records the method and result, not a bare "PASS".
  await writeFile(join(verifyDir, 'verification.md'), '# Verification\n\nPASS\n', 'utf8')
  const thin = await gateErrors(root, 'legacy-route', 'requirements')
  assert.ok(thin.errors.some((error) => error.includes('## Method')))
  assert.ok(thin.errors.some((error) => error.includes('## Result')))

  // design-first warns when the design was created after the requirements.
  const orderRoot = join(await mkdtemp(join(tmpdir(), 'kaze-order-')), '.kaze')
  await initSpec(orderRoot, { feature: 'order-demo', type: 'feature', scope: 'greenfield', workflow: 'design-first' })
  const orderDir = join(orderRoot, 'order-demo')
  await writeFile(join(orderDir, 'requirements.md'), '# Requirements Document\n', 'utf8')
  await new Promise((resolve) => setTimeout(resolve, 1100))
  await writeFile(join(orderDir, 'design.md'), '# Design Document\n', 'utf8')
  const order = await gateErrors(orderRoot, 'order-demo', 'requirements')
  assert.ok(order.warnings.some((message) => message.includes('design.md was created after requirements.md')))
  // Once the write hook recorded the order, a wrong design-first order is an error.
  await recordDocCreated(orderRoot, 'order-demo', 'requirements')
  await recordDocCreated(orderRoot, 'order-demo', 'design')
  const recordedOrder = await gateErrors(orderRoot, 'order-demo', 'requirements')
  assert.ok(recordedOrder.errors.some((message) => message.includes('design.md was recorded after requirements.md')))
  await rm(orderRoot, { recursive: true, force: true })

  // Verify-first records a baseline and detects a later model change.
  const verifyRoot = join(await mkdtemp(join(tmpdir(), 'kaze-verify-')), '.kaze')
  await initSpec(verifyRoot, { feature: 'verify-demo', type: 'feature', scope: 'greenfield', workflow: 'verify-first' })
  const verifyDemoDir = join(verifyRoot, 'verify-demo')
  await writeFile(join(verifyDemoDir, 'requirements.md'), '# Requirements Document\n', 'utf8')
  await writeFile(join(verifyDemoDir, 'model.smt2'), '(declare-sort State 0)\n(assert (! true :named req_1_1))\n(check-sat)\n', 'utf8')
  await writeFile(join(verifyDemoDir, 'verification.md'), '# Verification\n\n## Method\n\nz3 -smt2 model.smt2\n\n## Result\n\nPASS\n\n## Assertion Map\n\n| req_1_1 | 1.1 | true |\n', 'utf8')
  await recordVerification(verifyRoot, 'verify-demo')
  assert.equal((await loadState(verifyRoot, 'verify-demo')).verificationHash?.length, 64)
  await writeFile(join(verifyDemoDir, 'model.smt2'), '(declare-sort State 0)\n(assert (! false :named req_1_1))\n(check-sat)\n', 'utf8')
  const stale = await gateErrors(verifyRoot, 'verify-demo', 'design')
  assert.ok(stale.warnings.some((message) => message.includes('changed after the verification record')))
  await rm(join(verifyRoot, '..'), { recursive: true, force: true })

  // Project Rules require a Rules Check in the design gate.
  const rulesRoot = join(await mkdtemp(join(tmpdir(), 'kaze-rules-')), '.kaze')
  await writeFile(join(rulesRoot, '..', 'AGENTS.md'), '# AGENTS\n\n## Project Rules\n\n- R1: Keep public APIs compatible.\n', 'utf8')
  await initSpec(rulesRoot, { feature: 'rules-demo', type: 'feature', scope: 'greenfield' })
  await writeFile(join(rulesRoot, 'rules-demo', 'design.md'), '# Design Document\n\n## Overview\n\nx\n', 'utf8')
  const missingRules = await gateErrors(rulesRoot, 'rules-demo', 'design')
  assert.ok(missingRules.errors.some((message) => message.includes('## Rules Check')))
  await writeFile(join(rulesRoot, 'rules-demo', 'design.md'), '# Design Document\n\n## Overview\n\nx\n\n## Rules Check\n\n- R1: compliant — contract test.\n', 'utf8')
  const withRules = await gateErrors(rulesRoot, 'rules-demo', 'design')
  assert.ok(!withRules.errors.some((message) => message.includes('## Rules Check')))
  await rm(join(rulesRoot, '..'), { recursive: true, force: true })

  // The 工程红线 heading alias triggers the same design gate.
  const aliasRoot = join(await mkdtemp(join(tmpdir(), 'kaze-rules-alias-')), '.kaze')
  await writeFile(join(aliasRoot, '..', 'AGENTS.md'), '# AGENTS\n\n## 工程红线\n\n- R1: Keep public APIs compatible.\n', 'utf8')
  await initSpec(aliasRoot, { feature: 'alias-demo', type: 'feature', scope: 'greenfield' })
  await writeFile(join(aliasRoot, 'alias-demo', 'design.md'), '# Design Document\n\n## Overview\n\nx\n', 'utf8')
  const aliasGate = await gateErrors(aliasRoot, 'alias-demo', 'design')
  assert.ok(aliasGate.errors.some((message) => message.includes('## Rules Check')))
  await rm(join(aliasRoot, '..'), { recursive: true, force: true })

  // The route is frozen once the spec leaves initial, so design-first cannot be
  // switched on after requirements were written.
  await initSpec(root, { feature: 'route-frozen', type: 'feature', scope: 'greenfield' })
  await writeFile(join(featureDir(root, 'route-frozen'), 'clarify.md'), `# Clarification Ledger

## Decisions

- D1: test.

## Assumptions

- None.

## Rounds

1.

## Open

- None.
`, 'utf8')
  await writeFile(join(featureDir(root, 'route-frozen'), 'requirements.md'), '# Requirements Document\n\n## Introduction\n\nX.\n\n## Glossary\n\n- **Thing**: x.\n\n## Requirements\n\n### Requirement 1: Work\n\n**User Story:** As a user, I want work.\n\n#### Acceptance Criteria\n\n1.1 WHEN asked, THE Thing SHALL work.\n', 'utf8')
  await advanceSpec(root, 'route-frozen', 'requirements')
  await assert.rejects(
    () => setWorkflow(root, 'route-frozen', { workflow: 'design-first' }),
    /only change at phase=initial/,
  )

  // Even at phase=initial the route is frozen once any phase document exists;
  // a depth-only change stays allowed.
  await initSpec(root, { feature: 'docs-frozen', type: 'feature', scope: 'greenfield' })
  await writeFile(join(featureDir(root, 'docs-frozen'), 'requirements.md'), '# Requirements\n', 'utf8')
  const depthOnlyChange = await setWorkflow(root, 'docs-frozen', { designDetail: 'low' })
  assert.equal(depthOnlyChange.designDetail, 'low')
  await assert.rejects(
    () => setWorkflow(root, 'docs-frozen', { workflow: 'verify-first' }),
    /workflow route is frozen once a spec document exists/,
  )
  await assert.rejects(
    () => setWorkflow(root, 'docs-frozen', { workflow: 'verify-first' }),
    (error: Error) => (error as { code?: string }).code === 'KAZE_SPEC_WORKFLOW_DOCS',
  )

  // Verify-first evidence also gates done: a FAIL result cannot reach completion.
  const doneRoot = join(await mkdtemp(join(tmpdir(), 'kaze-verify-done-')), '.kaze')
  await initSpec(doneRoot, { feature: 'verify-done', type: 'feature', scope: 'greenfield', workflow: 'verify-first' })
  const doneDir = join(doneRoot, 'verify-done')
  await writeFile(join(doneDir, 'clarify.md'), `# Clarification Ledger

## Decisions

- D1: test.

## Assumptions

- None.

## Rounds

1.

## Open

- None.
`, 'utf8')
  await writeFile(join(doneDir, 'requirements.md'), `# Requirements Document

## Introduction

Verify.

## Glossary

- **Thing**: a thing.

## Requirements

### Requirement 1: Work

**User Story:** As a user, I want work, so that value.

#### Acceptance Criteria

1.1 WHEN asked, THE Thing SHALL work.
`, 'utf8')
  await writeFile(join(doneDir, 'model.smt2'), '(declare-sort State 0)\n(assert (! true :named req_1_1))\n(check-sat)\n', 'utf8')
  await writeFile(join(doneDir, 'design.md'), `# Design Document

## Overview

x

## Architecture

y

## Components and Interfaces

z

## Data Models

w

## Trade-offs
One viable path; no alternative worth recording.
## Testing Strategy

t
`, 'utf8')
  await writeFile(join(doneDir, 'tasks.md'), `# Implementation Plan

## Overview

Plan.

## Tasks

- [x] 1. Build it
  - _Requirements: 1.1_

## Notes

None.

## Task Dependency Graph

\`\`\`json
{"waves":[{"id":0,"tasks":["1"]}]}
\`\`\`
`, 'utf8')
  await mkdir(join(doneDir, 'exec', 'evidence'), { recursive: true })
  await writeFile(join(doneDir, 'exec', 'evidence', '1.json'), `${JSON.stringify({
    task: '1',
    executor: 'test',
    files: [],
    commands: ['node --test'],
    result: 'passed',
    at: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8')
  const verificationWith = (result: string): string =>
    `# Verification\n\n## Method\n\nz3 -smt2 model.smt2\n\n## Result\n\n${result}\n\n## Assertion Map\n\n| req_1_1 | 1.1 | true |\n`
  await writeFile(join(doneDir, 'verification.md'), verificationWith('PASS'), 'utf8')
  await recordGate(doneRoot, 'verify-done', { gate: 'acceptance', status: 'skipped', reason: 'probe' })
  await recordGate(doneRoot, 'verify-done', { gate: 'fta', status: 'approved', details: 'Verdict: PASS', evidence: 'reviewed' })
  const donePass = await gateErrors(doneRoot, 'verify-done', 'done')
  assert.equal(donePass.ok, true, donePass.errors.join('\n'))
  await writeFile(join(doneDir, 'verification.md'), verificationWith('FAIL'), 'utf8')
  const doneFail = await gateErrors(doneRoot, 'verify-done', 'done')
  assert.equal(doneFail.ok, false)
  assert.ok(doneFail.errors.some((error) => error.includes('Result must start with PASS')), doneFail.errors.join('\n'))
  const failAtRequirements = await gateErrors(doneRoot, 'verify-done', 'requirements')
  assert.ok(failAtRequirements.errors.some((error) => error.includes('Result must start with PASS')))
  await rm(join(doneRoot, '..'), { recursive: true, force: true })

  console.log('workflow routes OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
