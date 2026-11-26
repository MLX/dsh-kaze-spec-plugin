/** External-fact research protocol: UNVERIFIED claims are surfaced by the validator. */
import assert from 'node:assert/strict'
import { validateDocument } from '../src/host/spec/validator.js'

const base = (claim: string): string =>
  [
    '# Requirements Document',
    '',
    '## Introduction',
    'External fact handling.',
    '',
    '## Glossary',
    '- **System**: the product.',
    '',
    '## Requirements',
    '',
    '### Requirement 1: Retention',
    '',
    '**User Story:** As an operator, I want a retention rule, so that data is not kept forever.',
    '',
    '#### Acceptance Criteria',
    '',
    `1.1 WHEN a record ages, THE System SHALL ${claim}.`,
    '',
  ].join('\n')

const unverified = validateDocument(base('delete it after 180 days (UNVERIFIED)'), 'requirements', 'feature', 'greenfield')
assert.ok(unverified.warnings.some((issue) => issue.message.includes('UNVERIFIED external claims')))

const cited = validateDocument(base('delete it after 180 days per research.md'), 'requirements', 'feature', 'greenfield')
assert.ok(!cited.warnings.some((issue) => issue.message.includes('UNVERIFIED external claims')))

console.log('research claims OK')
