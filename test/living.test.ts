/** Living capability spec regression test: merge, idempotence, conflict, force. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { advanceSpec, initSpec, repairSpec, updateTask } from '../src/host/spec/state.js'
import { recordGate } from '../src/host/spec/delivery.js'
import { listCapabilities, mergeRequirements } from '../src/host/spec/living.js'

const root = join(await mkdtemp(join(tmpdir(), 'kaze-living-')), '.kaze')
const dir = join(root, 'add-oauth')
const requirements = (first: string, extra = ''): string =>
  [
    '# Requirements Document',
    '',
    '## Introduction',
    'Auth work.',
    '',
    '## Requirements',
    '',
    '### Requirement 1: Login',
    '',
    '**User Story:** As a user, I want to log in, so that I can use the app.',
    '',
    '#### Acceptance Criteria',
    '',
    `1.1 WHEN credentials are valid, THE Auth SHALL ${first}.`,
    '',
    '### Requirement 2: Logout',
    '',
    '**User Story:** As a user, I want to log out, so that my session ends.',
    '',
    '#### Acceptance Criteria',
    '',
    '2.1 WHEN the user logs out, THE Auth SHALL end the session.',
    '',
    extra,
    '',
  ].join('\n')

try {
  await initSpec(root, {
    feature: 'add-oauth',
    type: 'feature',
    scope: 'greenfield',
    capability: 'auth',
  })
  await writeFile(join(dir, 'requirements.md'), requirements('issue a token'), 'utf8')
  await writeFile(join(dir, 'clarify.md'), `# Clarification Ledger

## Decisions

- D1: test.

## Assumptions

- None.

## Rounds

1.

## Open

- None.
`, 'utf8')
  await writeFile(join(dir, 'design.md'), [
    '# Design Document', '', '## Overview', 'x', '', '## Architecture', 'x', '',
    '## Components and Interfaces', 'x', '', '## Data Models', 'x', '',
    '## Error Handling', 'x', '', '## Trade-offs', 'One viable path.', '',
    '## Testing Strategy', 'x', '',
  ].join('\n'), 'utf8')
  await writeFile(join(dir, 'tasks.md'), [
    '# Implementation Plan: add-oauth', '', '## Tasks', '',
    '- [ ] 1. Login', '  - _Requirements: 1.1_', '',
    '- [ ] 2. Logout', '  - _Requirements: 2.1_', '',
    '## Task Dependency Graph', '', '```json',
    '{"waves":[{"id":0,"tasks":["1"]},{"id":1,"tasks":["2"]}]}', '```', '',
  ].join('\n'), 'utf8')
  const plan = await advanceSpec(root, 'add-oauth', 'tasks')
  assert.equal(plan.ok, true, plan.errors.join('\n'))
  await updateTask(root, 'add-oauth', '1', 'completed')
  await updateTask(root, 'add-oauth', '2', 'completed')
  await recordGate(root, 'add-oauth', { gate: 'acceptance', status: 'skipped', reason: 'test: no acceptance file' })
  await recordGate(root, 'add-oauth', { gate: 'fta', status: 'skipped', reason: 'test: skipped' })

  const first = await mergeRequirements(root, 'add-oauth')
  assert.equal(first.capability, 'auth')
  assert.deepEqual(first.added, ['Login', 'Logout'])
  const specPath = join(root, 'specs', 'auth', 'spec.md')
  const spec = await readFile(specPath, 'utf8')
  assert.match(spec, /### Requirement: Login/)
  assert.match(spec, /### Requirement: Logout/)
  assert.match(spec, /\| \d{4}-\d{2}-\d{2} \| add-oauth \|/)

  // Re-merging the same document is a no-op.
  const second = await mergeRequirements(root, 'add-oauth')
  assert.deepEqual(second.added, [])
  assert.deepEqual(second.unchanged, ['Login', 'Logout'])

  // A change since the feature's baseline is a safe update when the capability
  // itself did not change in the meantime.
  await writeFile(join(dir, 'requirements.md'), requirements('issue a token plus a refresh token'), 'utf8')
  const updated = await mergeRequirements(root, 'add-oauth')
  assert.deepEqual(updated.updated, ['Login'])

  // A new requirement is appended.
  await writeFile(
    join(dir, 'requirements.md'),
    requirements(
      'issue a token plus a refresh token',
      '### Requirement 3: Refresh\n\n**User Story:** As a user, I want a refresh, so that I stay signed in.\n\n#### Acceptance Criteria\n\n3.1 WHEN the token expires, THE Auth SHALL refresh it.',
    ),
    'utf8',
  )
  const third = await mergeRequirements(root, 'add-oauth')
  assert.deepEqual(third.added, ['Refresh'])

  // An explicit Removed Requirements section deletes a capability requirement.
  await writeFile(
    join(dir, 'requirements.md'),
    `${requirements('issue a token plus a refresh token')}\n## Removed Requirements\n\n- Logout\n`,
    'utf8',
  )
  const fourth = await mergeRequirements(root, 'add-oauth')
  assert.deepEqual(fourth.removed, ['Logout'])
  assert.ok(!(await readFile(specPath, 'utf8')).includes('### Requirement: Logout'))

  // Another spec changing the same requirement after this feature's baseline conflicts.
  const currentSpec = await readFile(specPath, 'utf8')
  await writeFile(specPath, currentSpec.replace('issue a token plus a refresh token', 'an external change'), 'utf8')
  let conflict = ''
  try {
    const result = await mergeRequirements(root, 'add-oauth')
    conflict = `no conflict: ${JSON.stringify(result)}`
  } catch (error) {
    conflict = (error as Error).message
  }
  assert.match(conflict, /merge conflicts: .*Login/)

  // The capability index reports what the merges produced.
  const capabilities = await listCapabilities(root)
  assert.equal(capabilities.length, 1)
  assert.equal(capabilities[0]?.capability, 'auth')
  assert.equal(capabilities[0]?.requirements, 2)
  assert.deepEqual(capabilities[0]?.duplicates, [])
  assert.match(capabilities[0]?.lastChange ?? '', /^\d{4}-\d{2}-\d{2}$/)

  // A hand-edited capability with structural defects is reported by the index.
  await mkdir(join(root, 'specs', 'bad'), { recursive: true })
  await writeFile(join(root, 'specs', 'bad', 'spec.md'), '# Bad\n\n## Requirements\n\n### Requirement: Empty\n', 'utf8')
  const withBad = await listCapabilities(root)
  const bad = withBad.find((row) => row.capability === 'bad')
  assert.ok(bad !== undefined && bad.issues.some((issue) => issue.message.includes('empty body')))

  // A damaged state is reported, not repaired silently.
  await writeFile(join(dir, 'state.json'), '{not json', 'utf8')
  const repaired = await repairSpec(root, 'add-oauth')
  assert.equal(repaired.ok, false)
  assert.ok(repaired.issues.some((issue) => issue.severity === 'error'))

  // A spec without a capability cannot merge.
  await initSpec(root, { feature: 'no-cap', type: 'feature', scope: 'greenfield' })
  await writeFile(join(root, 'no-cap', 'requirements.md'), requirements('do something'), 'utf8')
  await assert.rejects(() => mergeRequirements(root, 'no-cap'), /no capability/)

  console.log('living spec merge OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
