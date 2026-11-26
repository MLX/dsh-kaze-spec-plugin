/**
 * Host half of the Kaze Spec Remote.
 *
 * The tab persists review comments under `.kaze/<feature>/reviews/<doc>.json`
 * so the same data is available to the agent and to slash commands. Only the
 * review area is writable: every path is resolved and checked to stay inside a
 * `.kaze/.../reviews/` directory, and writes are atomic.
 */
import { randomBytes } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Remote } from '@deepseek-ai/dsh-typert-protocol'
import { TypertRemoteService } from './typert-compat.js'
import { SpecError } from './spec/errors.js'
import { registerKazeContext } from './spec-context.js'
import { registerKazeGuards } from './guard.js'
import { invalidateWorkspaceRuntime } from './spec-runtime.js'
import { SKILL_ENVELOPE_DSH_VERSION, ensureNativeSkillRenderer } from './skill-content.js'
import { registerKazeHooks } from './hooks.js'
import { registerKazeSkillInjection } from './skill-injection.js'
import { assertSpecRoot, featureDir, type DesignDetail, type Phase, type SpecScope, type SpecType, type TaskStatus, type Workflow } from './spec/paths.js'
import { SPEC_ROOT_MARKER, SPEC_ROOT_NAME } from '../shared/spec-root.js'
import { listCapabilities } from './spec/living.js'
import { listArchived, restoreSpec } from './spec/archive.js'
import { archiveWithTimeline } from './spec/archive-timeline.js'
import { buildDelivery, completionSummary } from './spec/delivery.js'
import { idleMutate } from './spec/idle.js'
import {
  DEFAULT_MAX_PARALLEL,
  normalizeLanguage,
  normalizeMaxParallel,
  readSpecConfig,
  writeSpecConfig,
  type SpecLanguage,
} from './spec/settings.js'
import {
  cachePreferences,
  mainEntryOf,
  normalizePreferences,
  preferencesOf,
  type KazePreferences,
} from './preferences.js'
import { buildReview } from './spec/review.js'
import {
  advanceSpec,
  gateErrors,
  initSpec,
  listSpecs,
  projectOverview,
  recordEvent,
  renameSpec,
  specStatus,
  syncSpec,
  updateTask,
} from './spec/state.js'
import { appendRetiredTimelineTree, buildRetiredTimelineTrees, syncSpecToTimeline, type TimelineService } from './spec/timeline.js'
import { validateDirectory, validationText } from './spec/validator.js'
import { registerKazeTools } from './tools.js'

const MAX_REVIEW_BYTES = 4 * 1024 * 1024

function portable(path: string): string {
  return path.split(sep).join('/')
}

/** Case-folded absolute path used for workspace containment checks. */
function canonical(path: string): string {
  const resolved = portable(normalize(resolve(path)))
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

/**
 * Resolve one review file and refuse anything outside
 * `<workspace>/.kaze/<feature>/reviews/`.
 */
function reviewPath(input: string): string {
  if (typeof input !== 'string' || input === '' || !isAbsolute(input)) {
    throw new Error('review path must be an absolute .kaze/<feature>/reviews/*.json path')
  }
  const resolved = normalize(resolve(input))
  const text = portable(resolved)
  if (text.includes('\0') || !text.includes(SPEC_ROOT_MARKER) || !text.includes('/reviews/') || !text.endsWith('.json')) {
    throw new Error('review path must stay inside .kaze/<feature>/reviews/*.json')
  }
  return resolved
}

async function assertRealParent(path: string): Promise<void> {
  const parent = await realpath(dirname(path))
  const text = portable(parent)
  if (!text.includes(SPEC_ROOT_MARKER) || !text.includes('/reviews')) {
    throw new Error('review directory resolves outside .kaze')
  }
}

export default class KazeSpecHost extends TypertRemoteService {
  static inject = ['tools', 'loader']

  constructor(ctx: Context) {
    super(ctx, 'kazeSpec', { namespace: 'kazeSpec' })
    registerKazeTools(ctx)
    registerKazeHooks(ctx)
    registerKazeSkillInjection(ctx)
    // Native seams added on top of the tools: a runtime context provider and
    // the task-surface guard. Each registers through `ctx.inject`, so a profile
    // without the service keeps the rest.
    registerKazeContext(ctx)
    registerKazeGuards(ctx)
    // One activation probe, reported once: after a restart this line says
    // whether `<skill_content>` comes from the running DSH package or from the
    // pinned fallback.
    void ensureNativeSkillRenderer().then((native) => {
      const line = native
        ? '[kaze-spec] skill renderer: native @deepseek-ai/dsh-skill'
        : `[kaze-spec] skill renderer: pinned fallback ${SKILL_ENVELOPE_DSH_VERSION}`
      try {
        const logger = (ctx as unknown as { logger?: { info?(message: string): void } }).logger
        if (typeof logger?.info === 'function') logger.info(line)
        else console.info(line)
      } catch {
        // Diagnostics never decide activation.
      }
    }).catch(() => undefined)
  }

  /** Every live workspace's `.kaze` directory, canonicalized. */
  private workspaceRoots(): string[] {
    const get = (this.ctx as unknown as { get?(name: string): unknown }).get
    if (typeof get !== 'function') return []
    const roots: string[] = []
    const sessions = get.call(this.ctx, 'sessions') as {
      list?(): readonly { readonly header?: { readonly cwd?: string } }[]
    } | undefined
    const rows = sessions?.list?.() ?? []
    for (const row of rows) {
      const cwd = row.header?.cwd
      if (typeof cwd === 'string' && cwd !== '') roots.push(canonical(join(cwd, SPEC_ROOT_NAME)))
    }
    const registry = get.call(this.ctx, 'workspaceRegistry') as {
      list?(): readonly { readonly path?: string }[]
    } | undefined
    for (const workspace of registry?.list?.() ?? []) {
      if (typeof workspace.path === 'string' && workspace.path !== '') {
        roots.push(canonical(join(workspace.path, SPEC_ROOT_NAME)))
      }
    }
    return [...new Set(roots)]
  }

  /** The main Kaze plugin row that owns global, non-volatile preferences. */
  private mainEntry(): { readonly options: { readonly id: string; readonly config?: Record<string, unknown> } } | undefined {
    return mainEntryOf(this.ctx)
  }

  /** Current profile defaults, including language and parallel task limit. */
  private preferences(): KazePreferences {
    return preferencesOf(this.ctx)
  }

  /** Global default language for workspaces without `.kaze/spec-config.json`. */
  private defaultLanguage(): SpecLanguage {
    return normalizeLanguage(this.preferences().language)
  }

  /** Global default parallel task limit for workspaces without their own value. */
  private defaultMaxParallel(): number {
    return normalizeMaxParallel(this.preferences().maxParallel, DEFAULT_MAX_PARALLEL)
  }

  /** Bound the Remote surface to one live workspace's real `.kaze` directory. */
  private root(value: string): string {
    const resolved = assertSpecRoot(value)
    const roots = this.workspaceRoots()
    if (roots.length > 0 && !roots.includes(canonical(resolved))) {
      throw new SpecError('root must be the .kaze directory of a live workspace', 'KAZE_SPEC_ROOT')
    }
    return resolved
  }

  /**
   * Resolve one review file. The structural rule is the guarantee: the path
   * must stay inside a `.kaze/.../reviews/` directory. Session liveness is not
   * re-checked here — a Remote call carries no session identity, and a stale
   * workspace registry must not make a legitimate session's comments unwritable.
   */
  private reviewFile(value: string): string {
    return reviewPath(value)
  }

  /** List specs for the tab. */
  @Remote
  async specList(root: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await listSpecs(this.root(root)))
  }

  /** Status for one spec. */
  @Remote
  async specStatus(root: string, feature: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await specStatus(this.root(root), feature))
  }

  /** Structural validation for one spec. */
  @Remote
  async specValidate(root: string, feature: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const base = this.root(root)
    const report = await validateDirectory(featureDir(base, feature))
    return JSON.stringify({ ...report, text: validationText(report) })
  }

  /** Synchronize state and return the refreshed status. */
  @Remote
  async specSync(root: string, feature: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await syncSpec(this.root(root), feature, signal, this.preferences().strict))
  }

  /** Update one task marker and refresh the Timeline of sessions bound to this workspace. */
  @Remote
  async specTask(root: string, feature: string, id: string, status: TaskStatus, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const base = this.root(root)
    const result = await updateTask(base, feature, id, status, signal)
    await this.projectTimeline(base, feature)
    return JSON.stringify(result)
  }

  /** Project tasks into the native Timeline for every live session in this workspace. */
  private async projectTimeline(root: string, feature: string): Promise<void> {
    if (!this.preferences().timeline) return
    const get = (this.ctx as unknown as { get?(name: string): unknown }).get
    if (typeof get !== 'function') return
    const timeline = get.call(this.ctx, 'timeline') as TimelineService | undefined
    if (timeline === undefined) return
    const sessions = get.call(this.ctx, 'sessions') as {
      list?(): readonly { readonly id: string; readonly header?: { readonly cwd?: string } }[]
      flush?(session: unknown): Promise<boolean>
    } | undefined
    const rows = sessions?.list?.() ?? []
    for (const session of rows) {
      const cwd = session.header?.cwd
      if (typeof cwd !== 'string' || cwd === '') continue
      if (canonical(join(cwd, SPEC_ROOT_NAME)) !== canonical(root)) continue
      try {
        if (sessions?.flush !== undefined) await sessions.flush(session)
        await syncSpecToTimeline(root, feature, session, timeline)
      } catch {
        // Timeline is an enhancement; a projection failure must not fail the task write.
      }
    }
  }

  /** List living capability specs for the settings page. */
  @Remote
  async specCapabilities(root: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await listCapabilities(this.root(root)))
  }

  /** Project-level rules/steering/analysis/PBT status for the settings page. */
  @Remote
  async specOverview(root: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await projectOverview(this.root(root)))
  }

  /** Create a spec directory. */
  @Remote
  async specInit(
    root: string,
    feature: string,
    type: SpecType,
    scope: SpecScope,
    workflow: Workflow,
    designDetail: DesignDetail | undefined,
    signal: AbortSignal,
  ): Promise<string> {
    signal?.throwIfAborted()
    const prefs = this.preferences()
    const specRoot = this.root(root)
    const created = await initSpec(specRoot, {
      feature,
      type: type ?? prefs.defaultSpecType,
      scope: scope ?? prefs.defaultSpecScope,
      workflow: workflow ?? prefs.defaultSpecWorkflow,
      designDetail: designDetail ?? prefs.defaultDesignDetail,
    }, signal)
    // A new spec changes the runtime context and the execute-phase guard.
    invalidateWorkspaceRuntime(dirname(specRoot))
    return JSON.stringify(created)
  }

  /** Rename a spec and its own references. */
  @Remote
  async specRename(root: string, feature: string, to: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const specRoot = this.root(root)
    const get = (this.ctx as unknown as { get?(name: string): unknown }).get
    const timeline = typeof get === 'function' ? (get.call(this.ctx, 'timeline') as TimelineService | undefined) : undefined
    const sessions = typeof get === 'function'
      ? (get.call(this.ctx, 'sessions') as { list(): readonly { readonly id: string }[] } | undefined)
      : undefined
    const retired = await buildRetiredTimelineTrees(feature, sessions?.list() ?? [], timeline)
    const renamed = await renameSpec(specRoot, feature, to, signal)
    for (const item of retired) {
      await appendRetiredTimelineTree(item.session, timeline, item.tree).catch(() => undefined)
    }
    await this.projectTimeline(specRoot, renamed.to)
    return JSON.stringify({ ...renamed, timelineRetired: retired.length > 0 })
  }

  /** List archived specs. */
  @Remote
  async specArchived(root: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await listArchived(this.root(root)))
  }

  /** Archive one completed spec. */
  @Remote
  async specArchive(
    root: string,
    feature: string,
    reason: string,
    force: boolean,
    signal: AbortSignal,
  ): Promise<string> {
    signal?.throwIfAborted()
    const result = await archiveWithTimeline(this.ctx, this.root(root), feature, { reason, force }, signal)
    return JSON.stringify(result)
  }

  /** Restore one archived spec. */
  @Remote
  async specRestore(root: string, query: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const specRoot = this.root(root)
    const restored = await restoreSpec(specRoot, query, signal)
    // Archive retired this spec's Timeline tree; project it again on restore.
    await this.projectTimeline(specRoot, restored.feature)
    return JSON.stringify(restored)
  }

  /** Build the Markdown review brief from persisted comments. */
  @Remote
  async specReview(
    root: string,
    feature: string,
    file: string,
    comments: string,
    signal: AbortSignal,
  ): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await buildReview(this.root(root), feature, file, comments === '' ? undefined : comments))
  }

  /** Check one phase gate. */
  @Remote
  async specGate(root: string, feature: string, phase: Phase, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await gateErrors(this.root(root), feature, phase, this.preferences().strict))
  }

  /** Advance a phase after its gate passes; archive it when that option is on. */
  @Remote
  async specAdvance(root: string, feature: string, phase: Phase, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const specRoot = this.root(root)
    const prefs = this.preferences()
    const result = await advanceSpec(specRoot, feature, phase, signal, prefs.strict)
    // Entering or leaving execute changes the guard and the runtime context.
    if (result.ok) invalidateWorkspaceRuntime(dirname(specRoot))
    if (!result.ok || phase !== 'done' || !prefs.autoArchive) return JSON.stringify(result)
    try {
      const archived = await archiveWithTimeline(this.ctx, specRoot, feature, { reason: 'auto: advanced to done' }, signal)
      return JSON.stringify({ ...result, autoArchive: { archived: true, result: archived } })
    } catch (error) {
      // The advance already succeeded; report the archive failure and keep it
      // in the spec history instead of hiding it.
      const reason = (error as Error).message
      await recordEvent(specRoot, feature, 'auto-archive-failed', { reason }, signal).catch(() => undefined)
      return JSON.stringify({ ...result, autoArchive: { archived: false, reason } })
    }
  }

  /** Completion snapshot for one spec: acceptance, FTA, delivery, gates, next actions. */
  @Remote
  async specCompletion(root: string, feature: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await completionSummary(this.root(root), feature))
  }

  /** Rebuild delivery.md and return the build result. */
  @Remote
  async specDelivery(root: string, feature: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await buildDelivery(this.root(root), feature, '', signal))
  }

  /** Read or set the workspace spec-content language and parallel task limit. */
  @Remote
  async specConfig(
    root: string,
    action: string,
    payload: string,
    signal: AbortSignal,
  ): Promise<string> {
    signal?.throwIfAborted()
    const specRoot = this.root(root)
    const current = await readSpecConfig(specRoot, this.defaultLanguage(), this.defaultMaxParallel())
    if (action === 'set') {
      const value = JSON.parse(payload) as { language?: unknown; maxParallel?: unknown }
      const language = value.language === undefined ? current.language : normalizeLanguage(value.language)
      const maxParallel = value.maxParallel === undefined
        ? current.maxParallel
        : normalizeMaxParallel(value.maxParallel, current.maxParallel)
      const written = await writeSpecConfig(specRoot, language, maxParallel)
      invalidateWorkspaceRuntime(dirname(specRoot))
      return JSON.stringify(written)
    }
    return JSON.stringify(current)
  }

  /** Read or set the global defaults for new or unconfigured workspaces. */
  @Remote
  async specPreferences(action: string, payload: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    if (action === 'set') {
      const entry = this.mainEntry()
      const editor = (this.ctx as unknown as { get?(name: string): unknown }).get?.('configEditor') as {
        edit(entry: unknown, change: (current: Record<string, unknown>) => Record<string, unknown>): Promise<void>
      } | undefined
      if (entry === undefined || editor === undefined) {
        throw new Error('Kaze preferences cannot be saved in this profile')
      }
      const value = JSON.parse(payload) as Record<string, unknown>
      const next: Record<string, unknown> = {}
      const language = value.language ?? value.defaultLanguage
      if (language !== undefined) next.defaultLanguage = normalizeLanguage(language)
      for (const key of [
        'maxParallel',
        'strict',
        'validateOnWrite',
        'validateOnTurnEnd',
        'steerLimit',
        'timeline',
        'autoArchive',
        'defaultSpecType',
        'defaultSpecScope',
        'defaultSpecWorkflow',
        'defaultDesignDetail',
        'defaultCapability',
        'steering',
        'outputStyle',
      ] as const) {
        if (value[key] !== undefined) next[key] = value[key]
      }
      if (Object.keys(next).length > 0) {
        // Validate the merged candidate before touching the profile.
        const merged = normalizePreferences({ ...(entry.options.config ?? {}), ...next })
        const normalized: Record<string, unknown> = {
          defaultLanguage: merged.language,
          maxParallel: merged.maxParallel,
          strict: merged.strict,
          validateOnWrite: merged.validateOnWrite,
          validateOnTurnEnd: merged.validateOnTurnEnd,
          steerLimit: merged.steerLimit,
          timeline: merged.timeline,
          autoArchive: merged.autoArchive,
          defaultSpecType: merged.defaultSpecType,
          defaultSpecScope: merged.defaultSpecScope,
          defaultSpecWorkflow: merged.defaultSpecWorkflow,
          defaultDesignDetail: merged.defaultDesignDetail,
          defaultCapability: merged.defaultCapability,
          steering: merged.steering,
          outputStyle: merged.outputStyle,
        }
        await editor.edit(entry, (current) => ({ ...current, ...normalized }))
        // Apply immediately for the Host half, tools, and hooks without a restart.
        cachePreferences(merged)
      }
    }
    const prefs = this.preferences()
    return JSON.stringify({
      defaultLanguage: prefs.language,
      language: prefs.language,
      maxParallel: prefs.maxParallel,
      strict: prefs.strict,
      validateOnWrite: prefs.validateOnWrite,
      validateOnTurnEnd: prefs.validateOnTurnEnd,
      steerLimit: prefs.steerLimit,
      timeline: prefs.timeline,
      autoArchive: prefs.autoArchive,
      defaultSpecType: prefs.defaultSpecType,
      defaultSpecScope: prefs.defaultSpecScope,
      defaultSpecWorkflow: prefs.defaultSpecWorkflow,
      defaultDesignDetail: prefs.defaultDesignDetail,
      defaultCapability: prefs.defaultCapability,
      steering: prefs.steering,
      outputStyle: prefs.outputStyle,
    })
  }

  /**
   * Refine a wish into an executable prompt with a spawned Kaze subagent.
   *
   * The child is a logged DSH Agent under the parent's preset, so its
   * model-visible input stays reconstructable; the caller receives only the
   * final assistant text to place in the chat composer.
   */
  @Remote
  async refineWish(sessionId: string, wish: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const text = typeof wish === 'string' ? wish.trim() : ''
    if (text === '') throw new Error('wish must not be empty')
    if (text.length > 8000) throw new Error('wish is too long (max 8000 characters)')
    const get = (this.ctx as unknown as { get?(name: string): unknown }).get
    if (typeof get !== 'function') throw new Error('Kaze wish refinement is unavailable')
    const agents = get.call(this.ctx, 'agents') as { get?(id: string): unknown } | undefined
    const parent = typeof agents?.get === 'function' ? agents.get(sessionId) : undefined
    const subagents = get.call(this.ctx, 'subagents') as {
      startActivation?(spec: {
        provider: string
        label: string
        prompt: readonly { readonly type: 'text'; readonly text: string }[]
        parent: unknown
        signal: AbortSignal
        delivery: 'caller'
      }): Promise<{
        result: Promise<{
          readonly output: readonly { readonly type: string; readonly text?: string }[]
          readonly stopReason: string
          readonly diagnostic?: string
        }>
        dispose(): Promise<void>
      }>
    } | undefined
    if (parent === undefined || typeof subagents?.startActivation !== 'function') {
      throw new Error('Kaze wish refinement is unavailable in this profile')
    }
    const prompt = [
      `/spec-wish ${text}`,
      '',
      'Return only the refined prompt in one fenced block. Do not add commentary, a plan, or code.',
      'If the spec-wish skill instructions are not already present, load the "spec-wish" skill first.',
    ].join('\n')
    const activation = await subagents.startActivation({
      provider: 'spawn',
      label: 'Kaze wish refinement',
      prompt: [{ type: 'text', text: prompt }],
      parent,
      signal,
      delivery: 'caller',
    })
    try {
      const result = await activation.result
      if (result.stopReason !== 'completed') {
        throw new Error(result.diagnostic ?? `wish refinement ended: ${result.stopReason}`)
      }
      const output = result.output
        .filter((block) => block.type === 'text' && typeof block.text === 'string' && block.text !== '')
        .map((block) => block.text as string)
        .join('\n')
        .trim()
      if (output === '') throw new Error('wish refinement returned no text')
      const fenced = /```(?:[A-Za-z0-9_-]+)?\s*\n([\s\S]*?)\n```/u.exec(output)
      return (fenced?.[1] ?? output).trim()
    } finally {
      await activation.dispose().catch(() => undefined)
    }
  }

  /** Read or mutate the idle-time queue. */
  @Remote
  async specIdle(
    root: string,
    action: string,
    payload: string,
    signal: AbortSignal,
  ): Promise<string> {
    signal?.throwIfAborted()
    return JSON.stringify(await idleMutate(this.root(root), action, payload, signal))
  }

  /** Project one spec into the native Timeline for a live session. */
  @Remote
  async specTimeline(
    root: string,
    feature: string,
    sessionId: string,
    signal: AbortSignal,
  ): Promise<string> {
    signal?.throwIfAborted()
    const get = (this.ctx as unknown as { get?(name: string): unknown }).get
    const timeline = typeof get === 'function' ? (get.call(this.ctx, 'timeline') as TimelineService | undefined) : undefined
    const sessions = typeof get === 'function'
      ? (get.call(this.ctx, 'sessions') as { get(id: string): unknown } | undefined)
      : undefined
    const session = sessions?.get(sessionId) as { readonly id: string; readonly header?: { readonly cwd?: string } } | undefined
    if (session === undefined) return JSON.stringify({ available: false, reason: 'Session is not live' })
    if (timeline !== undefined) {
      const flush = (this.ctx as unknown as { get(name: string): { flush(session: unknown): Promise<boolean> } }).get('sessions')
      await flush.flush(session)
    }
    return JSON.stringify(await syncSpecToTimeline(this.root(root), feature, session, timeline))
  }

  /** Read one persisted review file; an absent file reads as an empty string. */
  @Remote
  async readReview(path: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const target = this.reviewFile(path)
    try {
      const info = await stat(target)
      if (!info.isFile()) throw new Error('review path is not a regular file')
      if (info.size > MAX_REVIEW_BYTES) throw new Error('review file is too large')
      await assertRealParent(target)
      signal?.throwIfAborted()
      return await readFile(target, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return ''
      throw error
    }
  }

  /** Atomically replace one persisted review file and return its status JSON. */
  @Remote
  async writeReview(path: string, content: string, signal: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    if (typeof content !== 'string') throw new Error('review content must be a string')
    if (Buffer.byteLength(content, 'utf8') > MAX_REVIEW_BYTES) throw new Error('review content is too large')
    try {
      const parsed: unknown = JSON.parse(content)
      if (typeof parsed !== 'object' || parsed === null) throw new Error('review content must be a JSON object')
    } catch (error) {
      throw new Error(`review content is not valid JSON: ${(error as Error).message}`)
    }

    const target = this.reviewFile(path)
    await mkdir(dirname(target), { recursive: true })
    await assertRealParent(target)
    try {
      const current = await lstat(target)
      if (current.isSymbolicLink() || !current.isFile()) throw new Error('review path is not a regular file')
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
    }

    const temporary = `${dirname(target)}/.${basename(target)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
    signal?.throwIfAborted()
    try {
      await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600 })
      signal?.throwIfAborted()
      await rename(temporary, target)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') {
        await rm(temporary, { force: true })
        throw error
      }
      // Windows cannot always replace an existing file in one rename. Move the
      // current file aside first and restore it when the replacement fails, so a
      // conflict never loses the persisted comments.
      const backup = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.bak`
      let moved = false
      try {
        await rename(target, backup)
        moved = true
      } catch (moveError) {
        if ((moveError as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          await rm(temporary, { force: true })
          throw error
        }
      }
      try {
        await rename(temporary, target)
      } catch (retryError) {
        if (moved) await rename(backup, target).catch(() => undefined)
        await rm(temporary, { force: true })
        throw retryError
      }
      if (moved) await rm(backup, { force: true })
    }

    return JSON.stringify({
      path: target,
      bytes: Buffer.byteLength(content, 'utf8'),
      updatedAt: new Date().toISOString(),
    })
  }
}

