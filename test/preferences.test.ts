/** Profile preference normalization: defaults, clamping, and legacy keys. */
import assert from 'node:assert/strict'
import {
  DEFAULT_PREFERENCES,
  STEER_LIMIT_MAX,
  STEER_LIMIT_MIN,
  normalizePreferences,
} from '../src/host/preferences.js'

assert.deepEqual(normalizePreferences(undefined), DEFAULT_PREFERENCES)

// An empty row inherits every default.
assert.deepEqual(normalizePreferences({}), DEFAULT_PREFERENCES)

// The legacy `defaultLanguage` key still selects the language.
assert.equal(normalizePreferences({ defaultLanguage: 'en' }).language, 'en')
assert.equal(normalizePreferences({ language: 'zh-CN' }).language, 'zh-CN')

// Values are clamped into the accepted ranges.
assert.equal(normalizePreferences({ maxParallel: 99 }).maxParallel, 8)
assert.equal(normalizePreferences({ maxParallel: 0 }).maxParallel, 1)
assert.equal(normalizePreferences({ steerLimit: 99 }).steerLimit, STEER_LIMIT_MAX)
assert.equal(normalizePreferences({ steerLimit: 0 }).steerLimit, STEER_LIMIT_MIN)
assert.equal(normalizePreferences({ steerLimit: '7' }).steerLimit, 7)
assert.equal(normalizePreferences({ steerLimit: 'nope' }).steerLimit, DEFAULT_PREFERENCES.steerLimit)

// Booleans are only accepted as booleans; anything else keeps the default.
assert.equal(normalizePreferences({ strict: true }).strict, true)
assert.equal(normalizePreferences({ strict: 'yes' }).strict, false)
assert.equal(normalizePreferences({ timeline: false }).timeline, false)
assert.equal(normalizePreferences({ autoArchive: true }).autoArchive, true)
assert.equal(normalizePreferences({ validateOnWrite: false }).validateOnWrite, false)
assert.equal(normalizePreferences({ validateOnTurnEnd: false }).validateOnTurnEnd, false)

// Answer style: human by default, standard when chosen, junk falls back.
assert.equal(normalizePreferences(undefined).outputStyle, 'human')
assert.equal(normalizePreferences({ outputStyle: 'standard' }).outputStyle, 'standard')
assert.equal(normalizePreferences({ outputStyle: 'human' }).outputStyle, 'human')
assert.equal(normalizePreferences({ outputStyle: 'funny' }).outputStyle, 'human')

// Unknown enum values fall back instead of failing activation.
assert.equal(normalizePreferences({ defaultSpecType: 'nope' }).defaultSpecType, 'feature')
assert.equal(normalizePreferences({ defaultSpecType: 'bugfix' }).defaultSpecType, 'bugfix')
assert.equal(normalizePreferences({ defaultSpecScope: 'nope' }).defaultSpecScope, 'brownfield')
assert.equal(normalizePreferences({ defaultSpecScope: 'greenfield' }).defaultSpecScope, 'greenfield')
assert.equal(normalizePreferences({ defaultSpecWorkflow: 'nope' }).defaultSpecWorkflow, 'requirements-first')
assert.equal(normalizePreferences({ defaultSpecWorkflow: 'bugfix' }).defaultSpecWorkflow, 'bugfix')

console.log('preferences OK')
