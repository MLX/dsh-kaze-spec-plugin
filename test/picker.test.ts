/**
 * Spec picker regression: a directory under `.kaze` is only a spec when it has
 * state.json (or spec documents that need repair).
 *
 * Regression for `.kaze/wishes`: the `/spec-wish` flow writes refined wishes
 * there, and the picker listed it as a damaged spec. Selecting it made every
 * action fail with "Completion is unavailable. The Host Remote may be offline."
 */
import assert from 'node:assert/strict'
import { createFace } from '../src/client/face.js'
import { featureIdProblem } from '../src/shared/spec-dirs.js'

const cwd = '/workspace'
const root = `${cwd}/.kaze`

const files = new Map<string, string>([
  [`${root}/real/state.json`, JSON.stringify({
    schema: 2,
    feature: 'real',
    specType: 'feature',
    scope: 'greenfield',
    workflow: 'requirements-first',
    designDetail: 'high',
    phase: 'requirements',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    tasks: {},
    history: [],
  })],
  [`${root}/real/requirements.md`, '# Requirements Document\n'],
  // A directory with documents but no state.json: a spec that needs repair.
  [`${root}/stray/requirements.md`, '# Requirements Document\n'],
  // The wish store: refined wishes, never a spec.
  [`${root}/wishes/demo-wish.md`, '# Refined wish\n'],
])

const directories = new Map<string, readonly string[]>([
  [root, ['real', 'stray', 'wishes', 'empty']],
  [`${root}/real`, ['state.json', 'requirements.md']],
  [`${root}/stray`, ['requirements.md']],
  [`${root}/wishes`, ['demo-wish.md']],
  [`${root}/empty`, []],
])

const remote = {
  workspaceFiles: {
    async list(_scope: unknown, path: string) {
      const names = directories.get(path)
      if (names === undefined) {
        return { ok: false as const, error: { code: 'workspace-file/not-found', message: `not found: ${path}` } }
      }
      return {
        ok: true as const,
        value: {
          path,
          truncated: false,
          entries: names.map((name) => ({
            name,
            type: files.has(`${path}/${name}`) ? ('file' as const) : ('directory' as const),
          })),
        },
      }
    },
    async read(_scope: unknown, path: string) {
      const text = files.get(path)
      if (text === undefined) {
        return { ok: false as const, error: { code: 'workspace-file/not-found', message: `not found: ${path}` } }
      }
      return {
        ok: true as const,
        value: { offset: 1, lines: text.split('\n').length, eof: true, text, version: 'v1', absolutePath: path },
      }
    },
    async *changes() {
      // No live frames are needed for a listing test.
    },
  },
}

const ctx = {
  remote,
  sessions: { list: { getSnapshot: () => ({ byId: { s1: { cwd } } }) } },
  get: () => undefined,
}

const face = createFace(ctx as never, 's1')
const listed = await face.listSpecs(new AbortController().signal)
assert.deepEqual(listed.specs.map((spec) => spec.feature).sort(), ['real', 'stray'])
assert.equal(listed.specs.find((spec) => spec.feature === 'real')?.phase, 'requirements')
assert.equal(listed.specs.find((spec) => spec.feature === 'real')?.docs.includes('requirements'), true)
// A damaged spec stays visible instead of vanishing.
assert.equal(listed.specs.find((spec) => spec.feature === 'stray')?.error !== undefined, true)

// The creation form and the engine agree on the portable feature-id form, so a
// typed name always names the directory the agent is told to write.
assert.equal(featureIdProblem('user-auth'), undefined)
assert.equal(featureIdProblem('v2'), undefined)
assert.equal(featureIdProblem('My.Spec'), 'format')
assert.equal(featureIdProblem('trailing-'), 'format')
assert.equal(featureIdProblem('-leading'), 'format')
assert.equal(featureIdProblem(''), 'format')
assert.equal(featureIdProblem('a'.repeat(82)), 'format')
assert.equal(featureIdProblem('a'.repeat(81)), undefined)
for (const name of ['archive', 'specs', 'batch', 'steering', 'wishes']) {
  assert.equal(featureIdProblem(name), 'reserved', `${name} must be a reserved name`)
}

console.log('picker OK')
