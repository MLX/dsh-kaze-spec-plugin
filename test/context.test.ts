/** Runtime-context regression test: workspace settings reach the prompt block. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cachePreferences, DEFAULT_PREFERENCES } from '../src/host/preferences.js'
import { registerKazeContext, specContextText, KAZE_CONTEXT_NAME } from '../src/host/spec-context.js'
import { clearWorkspaceRuntimeCache, workspaceRuntime } from '../src/host/spec-runtime.js'

const workspace = await mkdtemp(join(tmpdir(), 'kaze-context-'))
const root = join(workspace, '.kaze')
try {
  // Without `.kaze` the block is omitted: a non-Kaze workspace stays clean.
  clearWorkspaceRuntimeCache()
  assert.equal(specContextText(workspace, false, 'zh-CN', 3), '')

  await mkdir(join(root, 'ctx-spec'), { recursive: true })
  await writeFile(join(root, 'spec-config.json'), `${JSON.stringify({ schema: 1, language: 'en', maxParallel: 5 })}\n`)
  await writeFile(join(root, 'ctx-spec', 'state.json'), `${JSON.stringify({ phase: 'execute' })}\n`)

  clearWorkspaceRuntimeCache()
  const block = specContextText(workspace, true, 'zh-CN', 3)
  assert.match(block, /<kaze_spec_context>/)
  assert.match(block, /language: en/)
  assert.match(block, /maxParallel: 5/)
  assert.match(block, /one execution wave runs at most 5 independent tasks/)
  assert.match(block, /strict: on/)

  const lenient = specContextText(workspace, false, 'zh-CN', 3)
  assert.match(lenient, /strict: off/)

  // A workspace without a config file falls back to the profile values.
  await rm(join(root, 'spec-config.json'), { force: true })
  clearWorkspaceRuntimeCache()
  const fallback = specContextText(workspace, false, 'zh-CN', 4)
  assert.match(fallback, /language: zh-CN/)
  assert.match(fallback, /maxParallel: 4/)

  const runtime = workspaceRuntime(workspace)
  assert.equal(runtime.exists, true)
  assert.deepEqual([...runtime.executing], ['ctx-spec'])

  // Registration is a native prompt-context provider, scoped by the agent's cwd.
  cachePreferences({ ...DEFAULT_PREFERENCES, language: 'en', maxParallel: 2, strict: false })
  clearWorkspaceRuntimeCache()
  let provider: ((context: unknown) => string) | undefined
  const ctx = {
    inject(deps: string[], callback: (child: unknown) => void) {
      assert.deepEqual(deps, ['systemPrompt'])
      callback({
        systemPrompt: {
          context(entry: { name: string; text: (context: unknown) => string }) {
            assert.equal(entry.name, KAZE_CONTEXT_NAME)
            provider = entry.text
            return () => undefined
          },
        },
      })
    },
  }
  registerKazeContext(ctx as never)
  assert.equal(typeof provider, 'function', 'the prompt context was not registered')
  const text = provider!({ agent: { session: { header: { cwd: workspace } } } })
  assert.match(text, /maxParallel: 2/)
  assert.equal(provider!({}), '', 'no agent means no context')
} finally {
  cachePreferences(DEFAULT_PREFERENCES)
  clearWorkspaceRuntimeCache()
  await rm(workspace, { recursive: true, force: true })
}

console.log('runtime context OK')
