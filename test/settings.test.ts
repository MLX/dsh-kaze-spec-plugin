/**
 * Spec config round-trips: language and parallel task limit live together in
 * `.kaze/spec-config.json`, and every writer must keep both fields.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_MAX_PARALLEL,
  MAX_MAX_PARALLEL,
  MIN_MAX_PARALLEL,
  normalizeLanguage,
  normalizeMaxParallel,
  readSpecConfig,
  writeSpecConfig,
} from '../src/host/spec/settings.js'

const root = await mkdtemp(join(tmpdir(), 'kaze-settings-'))
try {
  // An absent file inherits both profile defaults.
  const fallback = await readSpecConfig(root, 'en', 4)
  assert.equal(fallback.language, 'en')
  assert.equal(fallback.maxParallel, 4)

  // Writing persists both fields, so saving one never drops the other.
  const written = await writeSpecConfig(root, 'en', 5)
  assert.equal(written.language, 'en')
  assert.equal(written.maxParallel, 5)
  const stored = JSON.parse(await readFile(join(root, 'spec-config.json'), 'utf8')) as Record<string, unknown>
  assert.equal(stored.language, 'en')
  assert.equal(stored.maxParallel, 5)

  // A later language-only change keeps the workspace's parallelism.
  const again = await writeSpecConfig(root, 'zh-CN', stored.maxParallel as number)
  assert.equal(again.language, 'zh-CN')
  assert.equal(again.maxParallel, 5)

  // A legacy file without maxParallel falls back instead of producing NaN.
  await writeFile(
    join(root, 'spec-config.json'),
    `${JSON.stringify({ schema: 1, language: 'en', updatedAt: '2026-01-01T00:00:00Z' })}\n`,
    'utf8',
  )
  const legacy = await readSpecConfig(root, 'zh-CN', 2)
  assert.equal(legacy.language, 'en')
  assert.equal(legacy.maxParallel, 2)

  // Values are coerced into 1..8 with the profile default as the fallback.
  assert.equal(normalizeMaxParallel(99), MAX_MAX_PARALLEL)
  assert.equal(normalizeMaxParallel(0), MIN_MAX_PARALLEL)
  assert.equal(normalizeMaxParallel('4'), 4)
  assert.equal(normalizeMaxParallel('nope'), DEFAULT_MAX_PARALLEL)
  assert.equal(normalizeMaxParallel(undefined, 6), 6)
  assert.equal(normalizeLanguage('xx', 'en'), 'en')
  assert.equal(normalizeLanguage('en'), 'en')

  console.log('spec settings OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
