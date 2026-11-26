/** Traceability regression test: task annotations, unknown ids, uncovered criteria. */
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gateErrors, initSpec } from '../src/host/spec/state.js'
import { validateDirectory } from '../src/host/spec/validator.js'

const root = join(await mkdtemp(join(tmpdir(), 'kaze-trace-')), '.kaze')
const dir = join(root, 'trace-demo')

try {
  await initSpec(root, { feature: 'trace-demo', type: 'feature', scope: 'greenfield' })
  await writeFile(
    join(dir, 'requirements.md'),
    [
      '# Requirements Document',
      '',
      '## Introduction',
      'Trace.',
      '',
      '## Glossary',
      '- **Thing**: a thing.',
      '',
      '## Requirements',
      '',
      '### Requirement 1: First',
      '',
      '**User Story:** As a user, I want one, so that value.',
      '',
      '#### Acceptance Criteria',
      '',
      '1.1 WHEN asked, THE Thing SHALL answer.',
      '1.2 WHEN asked twice, THE Thing SHALL answer twice.',
      '',
      '### Requirement 2: Second',
      '',
      '**User Story:** As a user, I want two, so that value.',
      '',
      '#### Acceptance Criteria',
      '',
      '2.1 WHEN idle, THE Thing SHALL rest.',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    join(dir, 'tasks.md'),
    [
      '# Implementation Plan: trace-demo',
      '',
      '## Tasks',
      '',
      '- [ ] 1. First task',
      '  - _Requirements: 1.1_',
      '',
      '- [ ] 2. Second task',
      '  - _Requirements: 9.9_',
      '',
      '- [ ] 3. Unannotated task',
      '',
      '## Task Dependency Graph',
      '',
      '```json',
      '{"waves":[{"id":0,"tasks":["1"]},{"id":1,"tasks":["2"]},{"id":2,"tasks":["3"]}]}',
      '```',
      '',
    ].join('\n'),
    'utf8',
  )
  const report = await validateDirectory(dir, 'feature')
  assert.ok(report.errors.some((issue) => issue.message.includes('unknown requirement 9.9')))
  assert.ok(report.errors.some((issue) => issue.message.includes('task is missing _Requirements: X.Y_')))
  assert.ok(report.errors.some((issue) => issue.message.includes('not covered by any task')))

  // Property mapping: 2.1 is neither a property nor example-based.
  await writeFile(
    join(dir, 'design.md'),
    [
      '# Design Document',
      '',
      '## Overview',
      'x',
      '',
      '## Correctness Properties',
      '',
      '### Property 1: Idempotent',
      '',
      '_For any_ input, normalizing twice equals once.',
      '',
      '**Validates: Requirements 1.1**',
      '',
      '## Example-based Criteria',
      '',
      '- 1.2 — UI state, not a universal claim.',
      '',
    ].join('\n'),
    'utf8',
  )
  const mapped = await validateDirectory(dir, 'feature')
  assert.ok(mapped.warnings.some((issue) => issue.message.includes('without a property or Example-based entry') && issue.message.includes('2.1')))

  // A criterion whose only covering task is optional stays advisory in the
  // default mode and fails the tasks gate under strict mode.
  const optRoot = join(await mkdtemp(join(tmpdir(), 'kaze-trace-opt-')), '.kaze')
  try {
    await initSpec(optRoot, { feature: 'opt-cover', type: 'feature', scope: 'greenfield' })
    await writeFile(
      join(optRoot, 'opt-cover', 'requirements.md'),
      [
        '# Requirements Document',
        '',
        '## Introduction',
        'Opt.',
        '',
        '## Glossary',
        '- **Thing**: a thing.',
        '',
        '## Requirements',
        '',
        '### Requirement 1: First',
        '',
        '**User Story:** As a user, I want one, so that value.',
        '',
        '#### Acceptance Criteria',
        '',
        '1.1 WHEN asked, THE Thing SHALL answer.',
        '',
      ].join('\n'),
      'utf8',
    )
    await writeFile(
      join(optRoot, 'opt-cover', 'tasks.md'),
      [
        '# Implementation Plan: opt-cover',
        '',
        '## Tasks',
        '',
        '- [ ]* 1. Optional work',
        '  - _Requirements: 1.1_',
        '',
        '## Task Dependency Graph',
        '',
        '```json',
        '{"waves":[{"id":0,"tasks":["1"]}]}',
        '```',
        '',
      ].join('\n'),
      'utf8',
    )
    const optionalCover = await validateDirectory(join(optRoot, 'opt-cover'), 'feature')
    assert.ok(optionalCover.warnings.some((issue) => issue.message.includes('covered only by optional tasks') && issue.message.includes('1.1')))
    assert.ok(!optionalCover.errors.some((issue) => issue.message.includes('not covered by any task')))
    const lenient = await gateErrors(optRoot, 'opt-cover', 'tasks')
    assert.equal(lenient.ok, true, lenient.errors.join('\n'))
    assert.ok(lenient.warnings.some((message) => message.includes('covered only by optional tasks')))
    const strict = await gateErrors(optRoot, 'opt-cover', 'tasks', true)
    assert.equal(strict.ok, false)
    assert.ok(strict.errors.some((message) => message.includes('covered only by optional tasks')))
  } finally {
    await rm(optRoot, { recursive: true, force: true })
  }
  console.log('traceability checks OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
