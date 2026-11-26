/** Hooks regression test: event payloads drive lint and turn-end steering. */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerKazeHooks } from '../src/host/hooks.js'
import { initSpec } from '../src/host/spec/state.js'

const workspace = await mkdtemp(join(tmpdir(), 'kaze-hooks-'))
const root = join(workspace, '.kaze')
try {
  await initSpec(root, { feature: 'hook-spec', scope: 'greenfield' })
  const dir = join(root, 'hook-spec')
  // Deliberately incomplete requirements document: lint must catch it.
  await writeFile(join(dir, 'requirements.md'), '# Requirements\n\nThis has no glossary or requirements.\n')

  const handlers = new Map<string, ((...args: unknown[]) => unknown)[]>()
  const injected: unknown[] = []
  const steers: unknown[] = []
  const agent = {
    session: { id: 'hooks-session', header: { cwd: workspace } },
    steer(message: unknown) { steers.push(message) },
    inject(message: unknown) { injected.push(message) },
  }
  const ctx = {
    on(name: string, listener: (...args: unknown[]) => unknown) {
      const list = handlers.get(name) ?? []
      list.push(listener)
      handlers.set(name, list)
      return () => undefined
    },
    get(name: string) {
      if (name !== 'agents') return undefined
      return { get: (id: string) => (id === agent.session.id ? agent : undefined) }
    },
  }
  registerKazeHooks(ctx as never)

  const post = handlers.get('tools/post-execute')?.[0]
  assert.equal(typeof post, 'function', 'tools/post-execute handler was not registered')
  const decision = await post!(
    { name: 'edit', arguments: { file_path: join(dir, 'requirements.md') }, agent, signal: new AbortController().signal },
    { isError: false, content: [] },
    async () => ({ kind: 'accept', content: [] }),
  ) as { kind: string; content?: { type: string; text?: string }[] }
  assert.equal(decision.kind, 'accept')
  assert.match(JSON.stringify(decision.content ?? []), /Kaze spec check found/)

  const stop = handlers.get('agent/turn-stopping')?.[0]
  assert.equal(typeof stop, 'function', 'agent/turn-stopping handler was not registered')
  // A bookkeeping directory from the wish flow is not a spec: it must not be
  // validated, must not receive a `kaze/` trace, and must not steer the agent.
  await mkdir(join(root, 'wishes'), { recursive: true })
  await writeFile(join(root, 'wishes', 'demo-wish.md'), '# Refined wish\n')
  await stop!({ agent, turn: 1 })
  assert.equal(steers.length, 1, 'an invalid spec should steer once at turn end')
  assert.match(JSON.stringify(steers[0]), /hook-spec/)
  assert.equal(
    steers.some((message) => JSON.stringify(message).includes('wishes')),
    false,
    '.kaze/wishes is a wish store, not a spec to validate',
  )
  assert.equal(
    existsSync(join(root, 'wishes', 'kaze')),
    false,
    'the turn check must not write a kaze/ trace inside .kaze/wishes',
  )

  // Compaction state reaches the model through agent.inject(), not a pre-step
  // rewrite; a subagent keeps its own context and gets nothing.
  const waitFor = async (check: () => boolean): Promise<void> => {
    const started = Date.now()
    while (!check() && Date.now() - started < 2000) await new Promise((resolve) => setTimeout(resolve, 10))
  }
  const event = handlers.get('session/event')?.[0]
  assert.equal(typeof event, 'function', 'session/event handler was not registered')
  await event!(agent.session, { type: 'compaction/end' })
  await waitFor(() => injected.length === 1)
  assert.equal(injected.length, 1, 'compaction must inject the spec state once')
  assert.match(JSON.stringify(injected[0]), /Kaze spec state after context compaction/)
  assert.match(JSON.stringify(injected[0]), /hook-spec/)
  await event!({ id: 'sub', header: { cwd: workspace, origin: 'subagent' } }, { type: 'compaction/end' })
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(injected.length, 1, 'a subagent session must not receive the notice')
} finally {
  await rm(workspace, { recursive: true, force: true })
}
console.log('hooks OK')
