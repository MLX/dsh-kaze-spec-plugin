/** Brownfield survey, preservation, marker, and migration regression test. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gateErrors, initSpec } from '../src/host/spec/state.js'
import { validateDirectory, validateDocument } from '../src/host/spec/validator.js'

const root = await mkdtemp(join(tmpdir(), 'kaze-brownfield-'))
const specsRoot = join(root, '.kaze')
const specDir = join(specsRoot, 'brown-demo')

const requirements = (survey: string, clauses: string): string =>
  [
    '# Requirements Document',
    '',
    '## Introduction',
    'Keeps the old contract while adding the new one.',
    '',
    '## Glossary',
    '- **Store**: the persisted record.',
    '',
    '## Requirements',
    '',
    '### Requirement 1: add the field',
    '',
    '**User Story:** As a user, I want the new field, so that I can read it.',
    '',
    '#### Acceptance Criteria',
    '',
    '1.1 WHEN the record is saved, THE Store SHALL include the new field.',
    '',
    '## Existing System Survey',
    survey,
    '',
    '### Requirement 2: preserve the old format',
    '',
    '**User Story:** As a caller, I want my reads to keep working, so that I do not break.',
    '',
    '#### Acceptance Criteria',
    '',
    clauses,
    '',
  ].join('\n')

const tasksDoc = (migration: string): string =>
  [
    '# Implementation Plan: brown-demo',
    '',
    '## Tasks',
    '',
    `- [ ] 1. ${migration}`,
    '  - _Requirements: 1.1_',
    '',
    '- [ ] 2. Checkpoint — run the existing suite and confirm no regression',
    '  - _Requirements: 2.1_',
    '',
    '## Task Dependency Graph',
    '',
    '```json',
    '{"waves":[{"id":0,"tasks":["1"]},{"id":1,"tasks":["2"]}]}',
    '```',
    '',
  ].join('\n')

try {
  await initSpec(specsRoot, { feature: 'brown-demo', type: 'feature', scope: 'brownfield' })
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'src', 'store.ts'), 'export const store = {}\n', 'utf8')

  // Two survey bullets, one existing path + one missing path, one preservation clause.
  await writeFile(
    join(specDir, 'requirements.md'),
    requirements(
      '- `src/store.ts:1-2` — the persisted shape and its callers\n- src/missing.ts:1 — a contract that does not exist',
      '2.1 WHEN an old record is read, THE Store SHALL CONTINUE TO return the previous shape.',
    ),
    'utf8',
  )
  const survey = await validateDirectory(specDir, 'feature')
  assert.ok(
    survey.errors.some((issue) => issue.message.includes('survey path does not exist: src/missing.ts')),
    'a survey bullet with a missing file is not reported',
  )
  assert.ok(
    survey.warnings.some((issue) => issue.message.includes('contract bullet(s) but 1 preservation clause(s)')),
    'survey bullet count and preservation clause count are not compared',
  )

  // A bullet with no path at all is a warning, not silence.
  await writeFile(
    join(specDir, 'requirements.md'),
    requirements('- a contract described in prose only', '2.1 WHEN an old record is read, THE Store SHALL CONTINUE TO return the previous shape.'),
    'utf8',
  )
  const noPath = await validateDirectory(specDir, 'feature')
  assert.ok(noPath.warnings.some((issue) => issue.message.includes('survey bullet has no file path')))

  // A marker that contradicts state.json is an error.
  await writeFile(
    join(specDir, 'requirements.md'),
    `<!-- scope: greenfield -->\n${requirements('- src/store.ts:1-2 — shape', '2.1 WHEN an old record is read, THE Store SHALL CONTINUE TO return the previous shape.')}`,
    'utf8',
  )
  const conflict = await validateDirectory(specDir, 'feature')
  assert.ok(conflict.errors.some((issue) => issue.message.includes('conflicts with state.json scope')))

  // A marker applies when the state scope is unknown (copied document).
  const standalone = validateDocument(
    `<!-- scope: brownfield -->\n${requirements('- src/store.ts:1-2 — shape', '2.1 WHEN an old record is read, THE Store SHALL CONTINUE TO return the previous shape.')}`,
    'requirements',
    'feature',
    'unknown',
  )
  assert.ok(!standalone.errors.some((issue) => issue.message.includes('Missing required brownfield section')))

  // Unknown scope is a gate warning so strict mode can fail it.
  await writeFile(
    join(specDir, 'state.json'),
    `${JSON.stringify({ schema: 1, feature: 'brown-demo', specType: 'feature', scope: 'unknown', workflow: 'requirements-first', phase: 'initial' })}\n`,
    'utf8',
  )
  const gate = await gateErrors(specsRoot, 'brown-demo', 'requirements')
  assert.ok(gate.warnings.some((message) => message.includes('scope is unknown')))

  // A migration task that only names the new writer gets a warning.
  const writerOnly = validateDocument(tasksDoc('Migration: write the new format'), 'tasks', 'feature', 'brownfield')
  assert.ok(writerOnly.warnings.some((issue) => issue.message.includes('should name the old reader')))
  const readerNamed = validateDocument(
    tasksDoc('Migration: update the reader and parser of the old format'),
    'tasks',
    'feature',
    'brownfield',
  )
  assert.ok(!readerNamed.warnings.some((issue) => issue.message.includes('should name the old reader')))

  console.log('brownfield survey checks OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
