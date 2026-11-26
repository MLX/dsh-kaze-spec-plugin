/** Task-surface guard regression test: only an executing spec denies mirroring. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerKazeGuards, surfaceDenial } from '../src/host/guard.js'
import { clearWorkspaceRuntimeCache } from '../src/host/spec-runtime.js'

const workspace = await mkdtemp(join(tmpdir(), 'kaze-guard-'))
const root = join(workspace, '.kaze')
const feature = 'guard-spec'
try {
  // No `.kaze` directory: nothing is denied.
  clearWorkspaceRuntimeCache()
  assert.equal(surfaceDenial('todo_write', workspace), undefined)

  await mkdir(join(root, feature), { recursive: true })
  await writeFile(join(root, feature, 'state.json'), `${JSON.stringify({ phase: 'tasks' })}\n`)
  clearWorkspaceRuntimeCache()
  assert.equal(surfaceDenial('todo_write', workspace), undefined, 'planning phases keep todo_write')

  await writeFile(join(root, feature, 'state.json'), `${JSON.stringify({ phase: 'execute' })}\n`)
  clearWorkspaceRuntimeCache()
  for (const name of ['todo_write', 'team_task_create', 'team_task_update']) {
    const denial = surfaceDenial(name, workspace)
    assert.equal(typeof denial, 'string', `${name} must be denied while a spec executes`)
    assert.match(denial as string, new RegExp(feature))
    assert.match(denial as string, /kaze_spec_task/)
  }
  assert.equal(surfaceDenial('team_task_list', workspace), undefined, 'read-only Team tools stay available')
  assert.equal(surfaceDenial('read', workspace), undefined, 'unrelated tools are untouched')
  assert.equal(surfaceDenial('todo_write', undefined), undefined, 'a call without a session is not denied')

  // The registration path uses the native guard seam.
  let guard: ((exec: unknown) => string | undefined) | undefined
  const ctx = {
    tools: {
      guard(candidate: (exec: unknown) => string | undefined) {
        guard = candidate
        return () => undefined
      },
    },
  }
  registerKazeGuards(ctx as never)
  assert.equal(typeof guard, 'function', 'the tool guard was not registered')
  assert.match(
    guard!({ name: 'todo_write', agent: { session: { header: { cwd: workspace } } } }) ?? '',
    /execute phase/,
  )
  assert.equal(guard!({ name: 'read', agent: { session: { header: { cwd: workspace } } } }), undefined)
} finally {
  clearWorkspaceRuntimeCache()
  await rm(workspace, { recursive: true, force: true })
}

console.log('task surface guard OK')
