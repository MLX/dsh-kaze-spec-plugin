/** Native engine regression test; run through test-engine.sh. */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import {
  advanceSpec,
  gateErrors,
  initSpec,
  listSpecs,
  recordPbt,
  renameSpec,
  specStatus,
  syncSpec,
  updateTask,
} from '../src/host/spec/state.js'
import { archiveSpec, listArchived, restoreSpec } from '../src/host/spec/archive.js'
import { buildDelivery, completionSummary, recordGate } from '../src/host/spec/delivery.js'
import { buildReview } from '../src/host/spec/review.js'
import { appendRetiredTimelineTree, buildRetiredTimelineTree, syncSpecToTimeline, type TimelineService, type TimelineTree } from '../src/host/spec/timeline.js'
import { validateDirectory } from '../src/host/spec/validator.js'

const root = join(await mkdtemp(join(tmpdir(), 'kaze-native-')), '.kaze')
const created = await initSpec(root, { feature: 'Demo Spec', type: 'feature', scope: 'greenfield', workflow: 'requirements-first' })
assert.equal(created.created, true)
assert.equal(created.state.feature, 'demo-spec')
assert.match(await readFile(join(root, 'demo-spec', 'config.json'), 'utf8'), /"specId"/)

const dir = join(root, 'demo-spec')
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
const VERIFICATION = `# Verification

## Method

manual test command

## Result

PASS
`
const writeClarify = async (feature: string): Promise<void> => {
  await mkdir(join(root, feature), { recursive: true })
  await writeFile(join(root, feature, 'clarify.md'), CLARIFY)
}
const writeEvidence = async (feature: string, id: string): Promise<void> => {
  await mkdir(join(root, feature, 'exec', 'evidence'), { recursive: true })
  await writeFile(join(root, feature, 'exec', 'evidence', `${id}.json`), `${JSON.stringify({
    task: id,
    executor: 'test',
    files: [],
    commands: ['node --test'],
    result: 'passed',
    at: new Date().toISOString(),
  }, null, 2)}\n`)
}
await writeClarify('demo-spec')
await writeFile(join(dir, 'requirements.md'), `# Requirements Document
## Introduction
Demo.
## Glossary
- **Thing**: a thing.
## Requirements
### Requirement 1: Work
**User Story:** As a user, I want work, so that value.
#### Acceptance Criteria
1.1 WHEN asked, THE system SHALL work.
1.2 WHEN asked twice, THE system SHALL work twice.
`)
await writeFile(join(dir, 'design.md'), `# Design Document
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
## Example-based Criteria
- 1.2 — exercise the repeated call.
`)
await writeFile(join(dir, 'tasks.md'), `# Implementation Plan
## Overview
Plan.
## Tasks
- [ ] 1. Build the thing
  - _Requirements: 1.1_
  - [ ] 1.1 Write the module
    - _Requirements: 1.1_
  - [ ] 1.2 Test the module
    - _Requirements: 1.2_
## Notes
None.
## Task Dependency Graph
\`\`\`json
{"waves":[{"id":0,"tasks":["1.1"]},{"id":1,"tasks":["1.2"]}]}
\`\`\`
`)

const validation = await validateDirectory(dir)
assert.equal(validation.ok, true, validation.errors.map((issue) => issue.message).join('\n'))
assert.equal((await gateErrors(root, 'demo-spec', 'requirements')).ok, true)
assert.equal((await gateErrors(root, 'demo-spec', 'tasks')).ok, true)
assert.equal((await advanceSpec(root, 'demo-spec', 'requirements')).ok, true)
assert.equal((await updateTask(root, 'demo-spec', '1.1', 'completed')).status, 'completed')
assert.equal((await recordPbt(root, 'demo-spec', '1', 'passed', 'ok')).status, 'passed')
const synced = await syncSpec(root, 'demo-spec')
assert.equal(synced.tasks.completed, 1)
const status = await specStatus(root, 'demo-spec')
assert.equal(status.tasks.ready, 1)

// Phase contract: gates cannot be skipped, failures never move the phase, and
// sync never regresses or jumps more than one gated step.
const syncRoot = join(root, 'sync-spec')
await initSpec(root, { feature: 'sync-spec', scope: 'greenfield' })
await writeClarify('sync-spec')
for (const name of ['requirements.md', 'design.md', 'tasks.md']) {
  await writeFile(join(syncRoot, name), await readFile(join(dir, name), 'utf8'))
}
const firstSync = await syncSpec(root, 'sync-spec')
assert.equal(firstSync.advanced, true)
assert.equal(firstSync.phase, 'requirements')
// Files suggest tasks already, but each sync moves one gated step at most.
assert.equal((await syncSpec(root, 'sync-spec')).phase, 'design')
assert.equal((await syncSpec(root, 'sync-spec')).phase, 'tasks')
// A regression is rejected instead of silently rewriting the phase.
await assert.rejects(advanceSpec(root, 'demo-spec', 'initial'), /phases only move forward/)
// A gate failure reports the blocking phase and keeps the current one.
const blocked = await advanceSpec(root, 'sync-spec', 'done')
assert.equal(blocked.ok, false)
assert.equal(blocked.advanced, false)
assert.equal(blocked.phase, 'tasks')
assert.equal(blocked.failedAt, 'execute')
assert.ok(blocked.errors.some((message) => message.startsWith('execute: ')))

await mkdir(join(dir, 'reviews'), { recursive: true })
await writeFile(join(dir, 'reviews', 'tasks.json'), JSON.stringify({
  comments: [{
    section: 'Tasks',
    sourceLines: { start: 5, end: 5 },
    quotedPassage: '- [ ] 1. Build the thing',
    reviewerNote: 'Make it concrete.',
  }],
}))
const review = await buildReview(root, 'demo-spec', join(dir, 'tasks.md'))
assert.match(review.prompt, /### Comment 1/)
assert.doesNotMatch(review.prompt, /<untrusted-review-data>/)
assert.match(review.prompt, /===== REVIEW DATA/)
assert.match(review.prompt, /===== END REVIEW DATA =====/)
// Reviewer data is bounded so one file cannot flood the prompt.
await writeFile(join(dir, 'reviews', 'design.json'), JSON.stringify({
  comments: [{ section: 'Design', sourceLines: { start: 1, end: 1 }, reviewerNote: 'x'.repeat(5000) }],
}))
const longReview = await buildReview(root, 'demo-spec', join(dir, 'design.md'))
assert.match(longReview.prompt, /truncated 1000 chars/)

let tree: TimelineTree | undefined
const timeline: TimelineService = {
  available: () => true,
  stateOf: () => ({ view: { trees: tree === undefined ? [] : [tree], activeTreeId: null } }),
  append: async (_session, _type, change) => {
    tree = change.tree
  },
}
const projected = await syncSpecToTimeline(root, 'demo-spec', { id: 'session-test' }, timeline)
assert.equal(projected.available, true)
assert.equal(tree?.id, 'kaze-demo-spec')
assert.equal(tree?.tasks.length, 3)
assert.deepEqual(tree?.tasks.find((task) => task.id === '1.1')?.done, [1, 1])
assert.equal(tree?.tasks.find((task) => task.id === '1.1')?.status, 'done')

const retired = await buildRetiredTimelineTree('demo-spec', { id: 'session-test' }, timeline)
assert.equal(retired?.tasks.every((task) => task.status === 'retired'), true)
await appendRetiredTimelineTree({ id: 'session-test' }, timeline, retired!)
assert.equal(tree?.tasks.every((task) => task.status === 'retired'), true)

const renamed = await renameSpec(root, 'demo-spec', 'demo-renamed')
assert.equal(renamed.to, 'demo-renamed')
assert.equal((await specStatus(root, 'demo-renamed')).feature, 'demo-renamed')
await assert.rejects(readFile(join(root, 'demo-renamed', 'kaze.lock'), 'utf8'), { code: 'ENOENT' })

await updateTask(root, 'demo-renamed', '1.2', 'completed')
await writeEvidence('demo-renamed', '1.1')
await writeEvidence('demo-renamed', '1.2')

// Completion is a host contract: done requires an FTA decision and, when the
// spec declares acceptance criteria, an approved acceptance gate.
const noFta = await gateErrors(root, 'demo-renamed', 'done')
assert.equal(noFta.ok, false)
assert.match(noFta.errors.join('\n'), /fta gate/)

const acceptanceFile = join(root, 'demo-renamed', 'acceptance.md')
await writeFile(acceptanceFile, `# Acceptance
## Goal
Demo works.
## Success Criteria
- [ ] First criterion.
- [x] Second criterion.
## Verification
Run the demo.
`)
await assert.rejects(
  recordGate(root, 'demo-renamed', { gate: 'acceptance', status: 'approved', details: 'criteria observed' }),
  /unchecked criterion/,
)

await writeFile(acceptanceFile, `# Acceptance
## Goal
Demo works.
## Success Criteria
- [x] First criterion.
- [x] Second criterion.
## Verification
Run the demo.
`)

await assert.rejects(
  recordGate(root, 'demo-renamed', { gate: 'fta', status: 'approved' }),
  /details or evidence/,
)
await assert.rejects(
  recordGate(root, 'demo-renamed', { gate: 'fta', status: 'skipped' }),
  /non-empty reason/,
)
await assert.rejects(
  recordGate(root, 'demo-renamed', { gate: 'fta', status: 'failed', details: 'Verdict: FAIL' }),
  /non-empty reason/,
)

const acceptanceRecord = await recordGate(root, 'demo-renamed', {
  gate: 'acceptance',
  status: 'approved',
  details: 'Both criteria observed.',
  evidence: 'node bin/demo --check',
})
assert.equal(acceptanceRecord.evidence, 'node bin/demo --check')

const missingFta = await gateErrors(root, 'demo-renamed', 'done')
assert.equal(missingFta.ok, false)
assert.match(missingFta.errors.join('\n'), /fta gate/)

await recordGate(root, 'demo-renamed', {
  gate: 'fta',
  status: 'approved',
  details: 'Verdict: PASS',
  evidence: 'FTA report, blocker count 0',
})

const beforeDone = await gateErrors(root, 'demo-renamed', 'done')
assert.equal(beforeDone.ok, true)
assert.match(beforeDone.warnings.join('\n'), /verification\.md/)
await writeFile(join(root, 'demo-renamed', 'verification.md'), VERIFICATION)
const afterDone = await gateErrors(root, 'demo-renamed', 'done')
assert.equal(afterDone.ok, true)
// Review comments and acceptance references are advisory in this fixture.
assert.deepEqual(
  afterDone.warnings.filter((message) => !/(unresolved review comment|acceptance criterion does not cite|completed tasks without exec\/evidence)/.test(message)),
  [],
)

// A gate approved earlier must not hide a criterion added afterwards.
await writeFile(acceptanceFile, `# Acceptance
## Goal
Demo works.
## Success Criteria
- [x] First criterion.
- [x] Second criterion.
- [ ] Added after approval.
## Verification
Run the demo.
`)
const driftedAcceptance = await gateErrors(root, 'demo-renamed', 'done')
assert.equal(driftedAcceptance.ok, false)
assert.match(driftedAcceptance.errors.join('\n'), /1 unchecked criterion/)
await writeFile(acceptanceFile, `# Acceptance
## Goal
Demo works.
## Success Criteria
- [x] First criterion.
- [x] Second criterion.
## Verification
Run the demo.
`)

assert.equal((await advanceSpec(root, 'demo-renamed', 'done')).ok, true)
assert.equal((await specStatus(root, 'demo-renamed')).phase, 'done')
// Advancing to done builds delivery.md as part of the phase transition.
assert.match(await readFile(join(root, 'demo-renamed', 'delivery.md'), 'utf8'), /# Delivery — demo-renamed/)

// A brand-new spec has no task contract; 0 required tasks must not compare
// equal to 0 completed tasks and slip through the done gate.
const emptyRoot = join(await mkdtemp(join(tmpdir(), 'kaze-empty-')), '.kaze')
await initSpec(emptyRoot, { feature: 'empty-spec', type: 'feature', scope: 'greenfield', workflow: 'requirements-first' })
await recordGate(emptyRoot, 'empty-spec', {
  gate: 'fta',
  status: 'approved',
  details: 'Verdict: PASS',
  evidence: 'reviewed the diff',
})
const noTasks = await gateErrors(emptyRoot, 'empty-spec', 'done')
assert.equal(noTasks.ok, false)
assert.match(noTasks.errors.join('\n'), /missing tasks\.md/)
assert.match(noTasks.errors.join('\n'), /missing requirements\.md/)
assert.match(noTasks.errors.join('\n'), /missing design\.md/)
assert.match(noTasks.errors.join('\n'), /missing acceptance decision/)
const emptyNext = await completionSummary(emptyRoot, 'empty-spec')
assert.deepEqual(emptyNext.next.map((action) => action.id), ['requirements'])
assert.equal(emptyNext.next[0]?.command, '/spec-requirements feature=empty-spec')
await writeFile(join(emptyRoot, 'empty-spec', 'tasks.md'), `# Implementation Plan
## Tasks
- [ ] * 1. Optional cleanup
`)
const optionalOnly = await gateErrors(emptyRoot, 'empty-spec', 'done')
assert.equal(optionalOnly.ok, false)
assert.match(optionalOnly.errors.join('\n'), /no required tasks/)
await rm(emptyRoot, { recursive: true, force: true })

const brown = await initSpec(root, { feature: 'brown-check', type: 'feature', scope: 'brownfield', workflow: 'requirements-first' })
await writeClarify('brown-check')
// The survey path must exist on disk; the validator resolves it from the workspace root.
await mkdir(join(dirname(root), 'src'), { recursive: true })
await writeFile(join(dirname(root), 'src', 'index.ts'), 'export {}\n')
await writeFile(join(brown.state.feature ? join(root, brown.state.feature) : root, 'requirements.md'), `# Requirements Document
## Introduction
Brownfield.
## Glossary
- **Thing**: a thing.
## Requirements
### Requirement 1: Work
**User Story:** As a user, I want work, so that value.
#### Acceptance Criteria
1.1 WHEN asked, THE system SHALL work.
`)
const brownDir = join(root, 'brown-check')
assert.equal((await validateDirectory(brownDir)).ok, false)
await writeFile(join(brownDir, 'requirements.md'), `# Requirements Document
## Introduction
Brownfield.
## Glossary
- **Thing**: a thing.
## Existing System Survey
- src/index.ts owns the current contract.
## Requirements
### Requirement 1: Work
**User Story:** As a user, I want work, so that value.
#### Acceptance Criteria
1.1 WHEN asked, THE system SHALL work.
1.2 WHEN the old API is called, THE system SHALL CONTINUE TO return the old shape.
`)
await writeFile(join(brownDir, 'design.md'), `# Design Document
## Overview
Overview.
## Architecture
Architecture.
## Components and Interfaces
Components.
## Data Models
Data.
## Correctness Properties
### Property 1: Preservation
**Validates: Requirements 1.2**
## Error Handling
Errors.
## Trade-offs
One viable path; no alternative worth recording.
## Testing Strategy
Tests.
## Impact on Existing System
src/index.ts callers keep working.
## Migration and Backward Compatibility
Old data remains readable.
`)
await writeFile(join(brownDir, 'tasks.md'), `# Implementation Plan
## Overview
Plan.
## Tasks
- [ ] 1. Build
  - [ ] 1.1 Implement
    - _Requirements: 1.1_
- [ ] 2. Migration compatibility for old data
  - _Requirements: 1.2_
- [ ] 3. Run existing test suite and confirm no regression
  - _Requirements: 1.2_
## Notes
None.
## Task Dependency Graph
\`\`\`json
{"waves":[{"id":0,"tasks":["1.1"]},{"id":1,"tasks":["2"]},{"id":2,"tasks":["3"]}]}
\`\`\`
`)
assert.equal((await validateDirectory(brownDir)).ok, true)

// Brownfield completion must carry a verification record, not just a green
// task list and gates.
await updateTask(root, 'brown-check', '1.1', 'completed')
await updateTask(root, 'brown-check', '2', 'completed')
await updateTask(root, 'brown-check', '3', 'completed')
for (const id of ['1.1', '2', '3']) await writeEvidence('brown-check', id)
await recordGate(root, 'brown-check', {
  gate: 'acceptance',
  status: 'skipped',
  reason: 'acceptance.md absent; acceptance explicitly skipped',
})
await recordGate(root, 'brown-check', { gate: 'fta', status: 'approved', details: 'Verdict: PASS', evidence: 'diff reviewed' })
const brownNoVerification = await gateErrors(root, 'brown-check', 'done')
assert.equal(brownNoVerification.ok, false)
assert.match(brownNoVerification.errors.join('\n'), /missing verification\.md/)
const brownNext = await completionSummary(root, 'brown-check')
assert.deepEqual(brownNext.next.map((action) => action.id), ['verification'])
assert.equal(brownNext.next[0]?.command, '/spec-complete feature=brown-check')
await writeFile(join(brownDir, 'verification.md'), VERIFICATION)
const brownComplete = await gateErrors(root, 'brown-check', 'done')
assert.equal(brownComplete.ok, true)

const delivery = await buildDelivery(root, 'demo-renamed')
assert.match(await readFile(delivery.path, 'utf8'), /## Gate history/)
assert.match(await readFile(delivery.path, 'utf8'), /acceptance \| approved/)
assert.match(await readFile(delivery.path, 'utf8'), /fta \| approved/)
assert.match(await readFile(delivery.path, 'utf8'), /## Assumptions/)
assert.match(await readFile(delivery.path, 'utf8'), /## Unverified claims/)
assert.match(await readFile(delivery.path, 'utf8'), /## Skipped decisions/)

const summary = await completionSummary(root, 'demo-renamed')
assert.equal(summary.feature, 'demo-renamed')
assert.equal(summary.phase, 'done')
assert.equal(summary.scope, 'greenfield')
assert.deepEqual(summary.tasks, { total: 2, completed: 2, in_progress: 0, ready: 0 })
assert.deepEqual(summary.acceptance, { present: true, approved: true, status: 'approved', checked: 2, total: 2, stale: false })
assert.equal(summary.fta.status, 'approved')
assert.equal(summary.fta.details, 'Verdict: PASS')
assert.equal(typeof summary.fta.at, 'string')
assert.equal(summary.delivery.present, true)
assert.equal(summary.delivery.fresh, true)
assert.equal(summary.delivery.path, delivery.path)
assert.deepEqual(summary.verification, { present: true })
assert.equal(summary.gates.find((gate) => gate.gate === 'acceptance')?.evidence, 'node bin/demo --check')
assert.deepEqual(summary.next.map((action) => action.id), ['archive', 'delivery'])
assert.equal(summary.next[0]?.kind, 'host')

// A report generated before the latest gate is stale, even if the file exists.
const staleText = (await readFile(delivery.path, 'utf8'))
  .replace(/^Generated: .*$/m, 'Generated: 2000-01-01T00:00:00Z')
  .replace(/^Docs-Hash: .*$/m, '')
await writeFile(delivery.path, staleText)
const stale = await completionSummary(root, 'demo-renamed')
assert.equal(stale.delivery.present, true)
assert.equal(stale.delivery.fresh, false)
await buildDelivery(root, 'demo-renamed')

const nextSpec = await initSpec(root, { feature: 'completion-next', type: 'feature', scope: 'greenfield', workflow: 'requirements-first' })
assert.equal(nextSpec.created, true)
await writeFile(join(root, 'completion-next', 'requirements.md'), `# Requirements Document
## Introduction
Next.
## Glossary
- **Thing**: a thing.
## Requirements
### Requirement 1: Work
**User Story:** As a user, I want work, so that value.
#### Acceptance Criteria
1.1 WHEN asked, THE system SHALL work.
`)
await writeFile(join(root, 'completion-next', 'design.md'), `# Design Document
## Overview
Next.
## Architecture
Next.
## Components and Interfaces
Next.
## Data Models
Next.
## Correctness Properties
### Property 1: Work
**Validates: Requirements 1.1**
## Error Handling
Next.
## Trade-offs
One viable path; no alternative worth recording.
## Testing Strategy
Next.
`)
await writeFile(join(root, 'completion-next', 'tasks.md'), `# Implementation Plan
## Overview
Plan.
## Tasks
- [ ] 1. Build
  - [ ] 1.1 Implement
    - _Requirements: 1.1_
## Notes
None.
## Task Dependency Graph
\`\`\`json
{"waves":[{"id":0,"tasks":["1.1"]}]}
\`\`\`
`)
const pending = await completionSummary(root, 'completion-next')
assert.equal(pending.phase, 'initial')
assert.deepEqual(pending.tasks, { total: 1, completed: 0, in_progress: 0, ready: 1 })
assert.deepEqual(pending.acceptance, { present: false, approved: false, status: 'none', checked: 0, total: 0, stale: false })
assert.equal(pending.fta.status, 'none')
assert.equal(pending.fta.at, null)
assert.equal(pending.delivery.present, false)
assert.equal(pending.delivery.fresh, false)
assert.deepEqual(pending.verification, { present: false })
assert.deepEqual(pending.next.map((action) => action.id), ['apply'])
assert.equal(pending.next[0]?.kind, 'agent')
assert.equal(pending.next[0]?.command, '/spec-apply feature=completion-next')

await updateTask(root, 'completion-next', '1.1', 'completed')
await recordGate(root, 'completion-next', { gate: 'fta', status: 'failed', details: 'Verdict: FAIL', reason: 'one blocker' })
const ftaFailed = await completionSummary(root, 'completion-next')
assert.deepEqual(ftaFailed.next.map((action) => action.id), ['rework'])
assert.match(ftaFailed.next[0]?.command ?? '', /FTA blockers/)

await recordGate(root, 'completion-next', { gate: 'fta', status: 'approved', details: 'Verdict: PASS', evidence: 'reviewed diff' })
const readyToComplete = await completionSummary(root, 'completion-next')
assert.deepEqual(readyToComplete.next.map((action) => action.id), ['acceptance'])
assert.equal(readyToComplete.next[0]?.command, '/spec-complete feature=completion-next')

await recordGate(root, 'completion-next', {
  gate: 'acceptance',
  status: 'skipped',
  reason: 'acceptance.md absent; acceptance explicitly skipped',
})
const readyToDone = await completionSummary(root, 'completion-next')
assert.deepEqual(readyToDone.next.map((action) => action.id), ['done'])
assert.equal(readyToDone.next[0]?.kind, 'host')
assert.equal(readyToDone.next[0]?.command, 'kaze_spec_advance')
assert.equal(readyToDone.acceptance.status, 'skipped')

const acceptanceDir = join(root, 'acceptance-check')
await mkdir(acceptanceDir, { recursive: true })
await writeFile(join(acceptanceDir, 'acceptance.md'), '# Acceptance\n\n## Success Criteria\n- [ ] One.\n')
assert.equal((await validateDirectory(acceptanceDir)).ok, false)
await writeFile(join(acceptanceDir, 'acceptance.md'), '# Acceptance\n\n## Goal\nOne outcome.\n\n## Success Criteria\n- [ ] One.\n\n## Verification\nCheck it.\n')
assert.equal((await validateDirectory(acceptanceDir)).ok, true)

// Chinese headings and EARS are first-class, not just translated prose.
const zh = await initSpec(root, { feature: 'zh-spec', type: 'feature', scope: 'greenfield', workflow: 'requirements-first' })
await writeClarify('zh-spec')
const zhDir = join(root, 'zh-spec')
await writeFile(join(zhDir, 'requirements.md'), `# 需求文档
## 引言
中文需求。
## 术语表
- **系统**：被测系统。
## 需求
### 需求 1: 工作
**用户故事：** 作为用户，我希望系统工作，从而获得价值。
#### 验收标准
1.1 当收到请求时，系统应返回结果。
1.2 如果输入无效，则系统应返回错误。
`)
await writeFile(join(zhDir, 'design.md'), `# 设计文档
## 概述
中文设计。
## 架构
分层。
## 组件与接口
组件。
## 数据模型
数据。
## 正确性属性
### 属性 1：保持
**验证：需求 1.1**
## 错误处理
错误。
## 权衡
只有一条可行路径。
## 测试策略
测试。
`)
await writeFile(join(zhDir, 'tasks.md'), `# 实施计划
## 概述
计划。
## 任务
- [ ] 1. 构建
  - _Requirements: 1.1_
- [ ] 2. 处理错误
  - _Requirements: 1.2_
## 备注
无。
## 任务依赖图
\`\`\`json
{"waves":[{"id":0,"tasks":["1"]},{"id":1,"tasks":["2"]}]}
\`\`\`
`)
await writeFile(join(zhDir, 'acceptance.md'), `# 验收
## 目标
系统工作。
## 成功标准
- [x] 返回结果。
## 验证
运行命令。
`)
const zhReport = await validateDirectory(zhDir)
assert.equal(zhReport.ok, true, zhReport.errors.map((issue) => issue.message).join('\n'))
assert.equal((await gateErrors(root, 'zh-spec', 'requirements')).ok, true)
assert.equal((await gateErrors(root, 'zh-spec', 'design')).ok, true)
assert.equal((await gateErrors(root, 'zh-spec', 'tasks')).ok, true)

const researchDir = join(root, 'research-check')
await mkdir(researchDir, { recursive: true })
await writeFile(join(researchDir, 'research.md'), '# Research\n\n## Decision\nUse X.\n')
assert.equal((await validateDirectory(researchDir)).ok, false)
await writeFile(join(researchDir, 'research.md'), '# Research\n\n## Decision\nUse X.\n\n## Rationale\nBecause.\n\n## Alternatives considered\nY.\n\n## Unresolved unknowns\nNone.\n')
assert.equal((await validateDirectory(researchDir)).ok, true)

// Archive refreshes delivery.md before moving the directory.
await rm(join(root, 'demo-renamed', 'delivery.md'))
await assert.rejects(readFile(join(root, 'demo-renamed', 'delivery.md'), 'utf8'), { code: 'ENOENT' })
await recordGate(root, 'demo-renamed', { gate: 'archive', status: 'failed', reason: 'not yet' })
await assert.rejects(
  archiveSpec(root, 'demo-renamed', { reason: 'test' }),
  /archive gate is failed/,
)
await recordGate(root, 'demo-renamed', { gate: 'archive', status: 'approved', details: 'ready' })
const archived = await archiveSpec(root, 'demo-renamed', { reason: 'test' })
assert.match(await readFile(join(archived.path, 'delivery.md'), 'utf8'), /# Delivery — demo-renamed/)
assert.match(archived.archiveId, /^\d{4}-\d{2}-\d{2}-demo-renamed$/)
assert.equal((await listSpecs(root)).some((entry) => entry.feature === 'demo-renamed'), false)
const archivedRows = await listArchived(root)
assert.equal(archivedRows.length, 1)
assert.equal(archivedRows[0]?.feature, 'demo-renamed')
assert.equal(JSON.parse(await readFile(join(archived.path, 'archive.json'), 'utf8')).reason, 'test')
assert.equal((await restoreSpec(root, archived.archiveId)).feature, 'demo-renamed')
assert.equal((await specStatus(root, 'demo-renamed')).phase, 'done')
assert.equal((await listArchived(root)).length, 0)

// An unknown phase is a repair case, not a silent reset to initial.
await initSpec(root, { feature: 'broken-phase', scope: 'greenfield' })
const brokenStatePath = join(root, 'broken-phase', 'state.json')
const brokenState = JSON.parse(await readFile(brokenStatePath, 'utf8'))
brokenState.phase = 'Done'
await writeFile(brokenStatePath, JSON.stringify(brokenState, null, 2))
const listedBroken = (await listSpecs(root)).find((entry) => entry.feature === 'broken-phase')
assert.equal(listedBroken?.error !== undefined, true)
await assert.rejects(specStatus(root, 'broken-phase'), /invalid spec phase/)
// Failed tasks round-trip through the checkbox and stay writable before done.
await initSpec(root, { feature: 'task-check', scope: 'greenfield' })
await writeFile(join(root, 'task-check', 'tasks.md'), '# Implementation Plan\n\n## Tasks\n\n- [ ] 1.2 Check\n  - _Requirements: 1.1_\n')
const failedTask = await updateTask(root, 'task-check', '1.2', 'failed')
assert.equal(failedTask.status, 'failed')
assert.match(await readFile(join(root, 'task-check', 'tasks.md'), 'utf8'), /- \[!\] 1\.2\./)
assert.equal((await updateTask(root, 'task-check', '1.2', 'completed')).status, 'completed')
// Done is terminal: task changes are rejected after completion.
await assert.rejects(updateTask(root, 'demo-renamed', '1.2', 'completed'), /done/)

// The DAG must list every required leaf task.
await writeFile(join(syncRoot, 'tasks.md'), (await readFile(join(syncRoot, 'tasks.md'), 'utf8'))
  .replace('## Notes', '- [ ] 1.3 Uncovered task\n## Notes'))
const uncoveredGate = await gateErrors(root, 'sync-spec', 'tasks')
assert.equal(uncoveredGate.ok, false)
assert.match(uncoveredGate.errors.join('\n'), /does not cover: 1\.3/)

// A rename rewrites only the exact feature segment, never a longer sibling id.
await initSpec(root, { feature: 'alpha', scope: 'greenfield' })
await writeFile(join(root, 'alpha', 'requirements.md'), 'See .kaze/alpha/x.md and .kaze/alpha-2/y.md.\n')
await renameSpec(root, 'alpha', 'alpha-new')
const renamedText = await readFile(join(root, 'alpha-new', 'requirements.md'), 'utf8')
assert.match(renamedText, /\.kaze\/alpha-new\/x\.md/)
assert.match(renamedText, /\.kaze\/alpha-2\/y\.md/)

// Without a DAG every required task is ready instead of only the first one.
await initSpec(root, { feature: 'no-dag', type: 'bugfix', scope: 'greenfield' })
await writeFile(join(root, 'no-dag', 'bugfix.md'), '# Bugfix\n\n## Reproduction\nx\n\n## Root Cause\ny\n\n## Fix\nz\n\n## Verification\nw\n')
await writeFile(join(root, 'no-dag', 'tasks.md'), '# Tasks\n\n- [ ] 1. First\n- [ ] 1.1 One\n- [ ] 1.2 Two\n')
assert.equal((await specStatus(root, 'no-dag')).tasks.ready, 3)

// Strict mode turns advisory warnings into gate errors; the same spec passes otherwise.
const strictRoot = join(await mkdtemp(join(tmpdir(), 'kaze-strict-')), '.kaze')
await initSpec(strictRoot, { feature: 'strict-demo', type: 'feature', scope: 'greenfield' })
await mkdir(join(strictRoot, 'strict-demo'), { recursive: true })
await writeFile(join(strictRoot, 'strict-demo', 'clarify.md'), CLARIFY)
await writeFile(join(strictRoot, 'strict-demo', 'requirements.md'), `# Requirements Document
## Introduction
Demo.
## Requirements
### Requirement 1: Work
**User Story:** As a user, I want work, so that value.
#### Acceptance Criteria
1.1 WHEN asked, THE system SHALL work.
`)
const lenient = await gateErrors(strictRoot, 'strict-demo', 'requirements')
assert.equal(lenient.ok, true, lenient.errors.join('\n'))
assert.ok(lenient.warnings.length > 0, 'expected an advisory warning without a glossary')
const strictGate = await gateErrors(strictRoot, 'strict-demo', 'requirements', true)
assert.equal(strictGate.ok, false)
assert.ok(strictGate.errors.some((message) => message.startsWith('strict mode:')))
assert.equal(strictGate.strict, true)

console.log('native engine OK')

