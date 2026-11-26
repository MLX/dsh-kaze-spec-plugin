/**
 * Hooks Lite for Kaze spec work.
 *
 * Two native DSH seams, no background daemon:
 *   - `tools/post-execute` lints a spec document right after write/edit/apply_patch.
 *   - `agent/turn-stopping` records a turn check and, only when the spec still
 *     has validation errors, steers one corrective step.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, normalize } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { detectDoc, exists, featureDir, readJson, SPEC_ROOT_NAME, type DocName } from './spec/paths.js'
import { isReservedSpecDir } from '../shared/spec-dirs.js'
import { listSpecs, recordDocCreated, specStatus } from './spec/state.js'
import { syncSpecToTimeline, type TimelineService } from './spec/timeline.js'
import { validateDocument, validateDirectory, validationText } from './spec/validator.js'
import { preferencesOf } from './preferences.js'

interface ContentBlock {
  type: 'text'
  text: string
}

interface HookSession {
  readonly id: string
  readonly header?: { readonly cwd?: string; readonly origin?: 'subagent' }
}

interface HookAgent {
  readonly session: HookSession
  steer(message: unknown): void
  inject(message: unknown): void
}

interface HookExec {
  readonly name: string
  readonly arguments: unknown
  readonly agent?: HookAgent
  readonly signal?: AbortSignal
}

interface HookResult {
  readonly isError: boolean
  readonly content: readonly ContentBlock[]
}

interface PostDecision {
  readonly kind: 'accept' | 'block'
  readonly content?: ContentBlock[]
  readonly [key: string]: unknown
}

const edited = new Map<string, Set<string>>()
/** Session id → corrective steers already sent in this process. */
const steered = new Map<string, number>()
/** Session id → last turn-stopping scan time, so non-write tools are still checked. */
const scanned = new Map<string, number>()

function changedPaths(exec: HookExec): string[] {
  if (typeof exec.arguments !== 'object' || exec.arguments === null) return []
  const args = exec.arguments as Record<string, unknown>
  if (exec.name === 'write' || exec.name === 'edit') {
    return typeof args.file_path === 'string' ? [args.file_path] : []
  }
  if (exec.name === 'apply_patch' && typeof args.input === 'string') {
    const paths: string[] = []
    for (const line of args.input.split(/\r?\n/)) {
      const match = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/.exec(line) ?? /^\*\*\* Move to: (.+)$/.exec(line)
      if (match !== null) paths.push(match[1]!.trim())
    }
    return paths
  }
  return []
}

function specTarget(cwd: string, file: string): { feature: string; doc: DocName; path: string } | null {
  const absolute = isAbsolute(file) ? normalize(file) : normalize(join(cwd, file))
  const text = absolute.split('\\').join('/')
  const marker = `/${SPEC_ROOT_NAME}/`
  const index = text.lastIndexOf(marker)
  if (index < 0) return null
  const rest = text.slice(index + marker.length)
  const [feature, name] = rest.split('/')
  if (feature === undefined || name === undefined) return null
  const doc = detectDoc(name)
  if (doc === null) return null
  return { feature, doc, path: absolute }
}

async function stateHints(root: string, feature: string): Promise<{ specType: string | null; scope: string }> {
  try {
    const value = await readJson(join(featureDir(root, feature), 'state.json'))
    if (typeof value === 'object' && value !== null) {
      const record = value as { specType?: unknown; scope?: unknown }
      return {
        specType: typeof record.specType === 'string' ? record.specType : null,
        scope: record.scope === 'brownfield' || record.scope === 'greenfield' ? record.scope : 'unknown',
      }
    }
  } catch {
    // A spec without state still gets structural linting.
  }
  return { specType: null, scope: 'unknown' }
}

function diagnostic(text: string, limit = 1800): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}\n…`
}

async function lintEdited(exec: HookExec): Promise<string | null> {
  const cwd = exec.agent?.session.header?.cwd
  if (cwd === undefined || cwd === '') return null
  const tracked = edited.get(exec.agent!.session.id) ?? new Set<string>()
  const messages: string[] = []
  for (const file of changedPaths(exec)) {
    const target = specTarget(cwd, file)
    if (target === null) continue
    tracked.add(target.feature)
    let markdown: string
    try {
      markdown = await readFile(target.path, 'utf8')
    } catch {
      continue
    }
    const hints = await stateHints(join(cwd, SPEC_ROOT_NAME), target.feature)
    // Remember when a phase document first appeared so design-first order is a
    // recorded fact, not a birth-time guess.
    await recordDocCreated(join(cwd, SPEC_ROOT_NAME), target.feature, target.doc).catch(() => undefined)
    const report = validateDocument(markdown, target.doc, hints.specType, hints.scope)
    if (!report.ok) {
      messages.push(`Kaze spec check found ${report.errors.length} error(s) in ${target.doc}.md:\n${diagnostic(validationText(report))}`)
    }
  }
  edited.set(exec.agent!.session.id, tracked)
  return messages.length === 0 ? null : messages.join('\n\n')
}

function tasksTarget(exec: HookExec): { root: string; feature: string } | null {
  const cwd = exec.agent?.session.header?.cwd
  if (cwd === undefined || cwd === '') return null
  for (const file of changedPaths(exec)) {
    const target = specTarget(cwd, file)
    if (target !== null && target.doc === 'tasks') {
      return { root: join(cwd, SPEC_ROOT_NAME), feature: target.feature }
    }
  }
  return null
}

async function projectTasks(ctx: Context, session: HookSession, root: string, feature: string, enabled: boolean): Promise<void> {
  if (!enabled) return
  const get = (ctx as unknown as { get?(name: string): unknown }).get
  if (typeof get !== 'function') return
  const timeline = get.call(ctx, 'timeline') as TimelineService | undefined
  if (timeline === undefined) return
  const sessions = get.call(ctx, 'sessions') as { flush(session: unknown): Promise<boolean> } | undefined
  if (sessions !== undefined) await sessions.flush(session)
  await syncSpecToTimeline(root, feature, session, timeline)
}

async function onTurnStopping(agent: HookAgent, turn: number, steerLimit: number): Promise<void> {
  const sessionId = agent.session.id
  const touched = edited.get(sessionId)
  edited.delete(sessionId)
  const cwd = agent.session.header?.cwd
  if (cwd === undefined || cwd === '') return
  const root = join(cwd, SPEC_ROOT_NAME)
  // write/edit/apply_patch record exact specs; any other tool may still have
  // changed `.kaze` (pwsh, subagent, MCP), so also pick up recently modified
  // spec directories since the previous turn.
  const features = new Set(touched ?? [])
  const since = scanned.get(sessionId) ?? 0
  scanned.set(sessionId, Date.now())
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      // Bookkeeping directories (archive, specs, batch, steering, wishes) are
      // not specs: validating one reports a missing state.json and its
      // `kaze/last-turn.json` would create a fake feature directory.
      if (!entry.isDirectory() || isReservedSpecDir(entry.name)) continue
      try {
        const info = await stat(join(root, entry.name))
        if (info.mtimeMs > since) features.add(entry.name)
      } catch {
        // A concurrent rename can remove the directory between readdir and stat.
      }
    }
  } catch {
    // No `.kaze` directory: nothing to validate.
  }
  if (features.size === 0) return
  const failures: string[] = []
  for (const feature of features) {
    const dir = featureDir(root, feature)
    // A rename earlier in the turn moves the directory; do not recreate the old one.
    if (!(await exists(dir))) continue
    const report = await validateDirectory(dir)
    if (!report.ok) failures.push(`${feature}: ${report.errors.length} error(s)`)
    try {
      const path = join(dir, 'kaze', 'last-turn.json')
      await mkdir(join(dir, 'kaze'), { recursive: true })
      await writeFile(
        path,
        `${JSON.stringify({
          at: new Date().toISOString(),
          turn,
          feature,
          ok: report.ok,
          errors: report.errors.length,
          warnings: report.warnings.length,
        }, null, 2)}\n`,
        'utf8',
      )
    } catch {
      // The check is advisory; a read-only spec directory must not break the turn.
    }
  }
  if (failures.length === 0) return
  const sent = steered.get(sessionId) ?? 0
  if (sent >= steerLimit) return
  steered.set(sessionId, sent + 1)
  const text = [
    'Kaze spec check after this turn:',
    ...failures.map((line) => `- ${line}`),
    '',
    'Fix the failing spec documents with `kaze_spec_validate` and `kaze_spec_gate` before treating the phase as complete.',
  ].join('\n')
  agent.steer({
    id: randomUUID(),
    role: 'user',
    source: { kind: 'user' },
    content: [{ type: 'text', text }],
  })
}

async function compactionNotice(cwd: string): Promise<string | null> {
  const root = join(cwd, SPEC_ROOT_NAME)
  try {
    const specs = await listSpecs(root)
    if (specs.length === 0) return null
    const latest = [...specs].sort((left, right) => (right.updatedAt || '').localeCompare(left.updatedAt || ''))[0]!
    const status = await specStatus(root, latest.feature)
    return [
      'Kaze spec state after context compaction:',
      `- feature: ${status.feature}`,
      `- scope: ${status.scope}`,
      `- phase: ${status.phase}`,
      `- tasks: ${status.tasks.completed}/${status.tasks.total} completed, ${status.tasks.ready} ready`,
      `Continue from .kaze/${status.feature}/; use kaze_spec_* tools and keep state.json authoritative.`,
    ].join('\n')
  } catch {
    return null
  }
}

/** Install the spec hooks. */
export function registerKazeHooks(ctx: Context): void {
  const bus = ctx as unknown as {
    on(name: string, listener: (...args: any[]) => unknown): unknown
  }

  bus.on('tools/post-execute', async (exec: HookExec, result: HookResult, next: () => Promise<PostDecision>) => {
    const decision = await next()
    if (result.isError || decision.kind !== 'accept') return decision
    const prefs = preferencesOf(ctx)
    const target = tasksTarget(exec)
    if (target !== null && exec.agent !== undefined) {
      try {
        await projectTasks(ctx, exec.agent.session, target.root, target.feature, prefs.timeline)
      } catch {
        // A missing Timeline or a non-durable session must not fail the edit.
      }
    }
    if (!prefs.validateOnWrite) return decision
    const warning = await lintEdited(exec)
    if (warning === null) return decision
    if (decision.content === undefined && 'value' in decision) return decision
    const content = [...(decision.content ?? result.content), { type: 'text' as const, text: warning }]
    return { ...decision, content }
  })

  bus.on('agent/turn-stopping', async (payload: { agent: HookAgent; turn: number }) => {
    const prefs = preferencesOf(ctx)
    if (!prefs.validateOnTurnEnd) {
      // Drop the tracking entry so a disabled hook cannot grow the map.
      edited.delete(payload.agent.session.id)
      return
    }
    await onTurnStopping(payload.agent, payload.turn, prefs.steerLimit)
  })

  // After compaction the model loses the spec picture. `agent.inject()` is the
  // native seam for plugin-provided context: it enters the next admitted step
  // and is logged as an inbox splice, so resume and replay keep the notice.
  bus.on('session/event', (session: HookSession, event: { type?: string }) => {
    if (event.type !== 'compaction/end') return
    if (session.header?.origin === 'subagent') return
    const cwd = session.header?.cwd
    if (cwd === undefined || cwd === '') return
    const get = (ctx as unknown as { get?(name: string): unknown }).get
    const agents = typeof get === 'function'
      ? (get.call(ctx, 'agents') as { get(id: string): HookAgent | undefined } | undefined)
      : undefined
    const agent = agents?.get(session.id)
    if (agent === undefined || typeof agent.inject !== 'function') return
    void (async () => {
      const notice = await compactionNotice(cwd)
      if (notice === null) return
      agent.inject({
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: notice }],
        source: { kind: 'user' },
      })
    })().catch(() => undefined)
  })

  // Per-session bookkeeping must not outlive its session.
  bus.on('session/disposed', (session: { id?: unknown }) => {
    if (typeof session?.id !== 'string') return
    edited.delete(session.id)
    steered.delete(session.id)
    scanned.delete(session.id)
  })
}

