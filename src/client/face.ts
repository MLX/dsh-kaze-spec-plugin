/**
 * Host data access for the tab.
 *
 * Everything here rides DSH's existing `workspaceFiles` Remote: there is no
 * custom server and the client never touches `node:fs`. The same Remote's
 * change feed keeps the open document live while an agent edits it.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { DOCS, type ArchivedSpec, type CompletionSummary, type DocName, type DocumentText, type IdleStatus, type NativeChange, type ReviewComment, type SpecSummary } from './types'
import { isDocName, parseComments, parseState } from './model'
import { isReservedSpecDir } from '../shared/spec-dirs.js'
import { SPEC_ROOT_NAME } from '../shared/spec-root.js'

interface RemoteFailure {
  readonly code?: string
  readonly message?: string
}

type RemoteResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RemoteFailure }

interface DirectoryEntry {
  readonly name: string
  readonly type: 'file' | 'directory' | 'other'
  readonly size?: number
}

interface DirectoryListing {
  readonly path: string
  readonly entries: readonly DirectoryEntry[]
  readonly truncated: boolean
}

interface FileText {
  readonly offset: number
  readonly lines: number
  readonly eof: boolean
  readonly text: string
  readonly version: string
  readonly absolutePath: string
}

/** The complete text assembled across pages, with the first page's identity. */
interface ReadText {
  readonly text: string
  readonly path: string
  readonly version: string
  readonly absolutePath: string
}

interface WatchFrame {
  readonly kind: 'ready' | 'change'
  readonly change?: { readonly absolutePath: string; readonly version?: string; readonly absent?: true }
}

interface WorkspaceFilesRemote {
  list(scope: SessionId, path: string, signal: AbortSignal): Promise<RemoteResult<DirectoryListing>>
  read(scope: SessionId, path: string, range: { offset?: number; limit?: number }, signal: AbortSignal): Promise<RemoteResult<FileText>>
  changes(scope: SessionId, path: string, signal: AbortSignal): AsyncIterable<WatchFrame>
}

interface EngineRemote {
  readReview(path: string, signal: AbortSignal): Promise<RemoteResult<string>>
  writeReview(path: string, content: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specList(root: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specStatus(root: string, feature: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specValidate(root: string, feature: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specSync(root: string, feature: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specTask(root: string, feature: string, id: string, status: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specInit(root: string, feature: string, type: string, scope: string, workflow: string, designDetail: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specRename(root: string, feature: string, to: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specReview(root: string, feature: string, file: string, comments: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specGate(root: string, feature: string, phase: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specAdvance(root: string, feature: string, phase: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specTimeline(root: string, feature: string, sessionId: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specArchived(root: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specArchive(root: string, feature: string, reason: string, force: boolean, signal: AbortSignal): Promise<RemoteResult<string>>
  specRestore(root: string, query: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specCompletion(root: string, feature: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specDelivery(root: string, feature: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specIdle(root: string, action: string, payload: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specCapabilities(root: string, signal: AbortSignal): Promise<RemoteResult<string>>
  specConfig(root: string, action: string, payload: string, signal: AbortSignal): Promise<RemoteResult<string>>
  refineWish(sessionId: string, wish: string, signal: AbortSignal): Promise<RemoteResult<string>>
}

export interface EngineAdvance {
  readonly ok: boolean
  readonly advanced?: boolean
  readonly from?: string
  readonly to?: string
  readonly phase: string
  readonly steps?: readonly string[]
  readonly failedAt?: string
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

export interface EngineValidation {
  readonly ok: boolean
  readonly errors: readonly { readonly file: string; readonly message: string }[]
  readonly warnings: readonly { readonly file: string; readonly message: string }[]
  readonly text: string
}

interface SkillsRemote {
  list(request: { sessionId: string }, signal: AbortSignal): Promise<RemoteResult<{ skills: readonly { name: string; userInvocable?: boolean }[] }>>
}

interface SessionEventsRemote {
  events(
    request: { address: { kind: 'session'; sessionId: string }; maxMessages?: number },
    signal: AbortSignal,
  ): Promise<RemoteResult<{ records: readonly { event: { type: string; seq: number; data: unknown } }[] }>>
}

interface SidebarRightRemote {
  openResourceIn(sessionId: string, address: string, options?: unknown): void
  openTabIn(sessionId: string, kind: string): void
}

interface SidebarRightTabsRemote {
  get(kind: string): unknown
}

interface ClientRemote {
  readonly workspaceFiles: WorkspaceFilesRemote
  readonly kazeSpec?: EngineRemote
  readonly skills?: SkillsRemote
  $stream<Item>(options: {
    name: string
    open: (signal: AbortSignal) => AsyncIterable<Item>
    ended: (accepted: boolean) => Error
  }): AsyncIterable<{ readonly value: Item; accept(): void }> & { dispose(): Promise<void> }
}

export interface SpecFace {
  readonly cwd: string | undefined
  readonly hasDiskReview: boolean
  readonly hasEngine: boolean
  validate(feature: string, signal: AbortSignal): Promise<EngineValidation>
  sync(feature: string, signal: AbortSignal): Promise<void>
  init(feature: string, type: 'feature' | 'bugfix', scope: string, workflow: string, designDetail: string, signal: AbortSignal): Promise<void>
  rename(feature: string, to: string, signal: AbortSignal): Promise<void>
  advance(feature: string, target: string, signal: AbortSignal): Promise<EngineAdvance>
  timeline(feature: string, signal: AbortSignal): Promise<unknown>
  listArchived(signal: AbortSignal): Promise<ArchivedSpec[]>
  archive(feature: string, reason: string, force: boolean, signal: AbortSignal): Promise<void>
  restore(query: string, signal: AbortSignal): Promise<void>
  completion(feature: string, signal: AbortSignal): Promise<CompletionSummary>
  buildDelivery(feature: string, signal: AbortSignal): Promise<void>
  idle(action: string, payload: Record<string, unknown>, signal: AbortSignal): Promise<IdleStatus>
  specConfig(action: string, payload: Record<string, unknown>, signal: AbortSignal): Promise<{ language: 'zh-CN' | 'en' }>
  refineWish(wish: string, signal: AbortSignal): Promise<string>
  listSpecs(signal: AbortSignal): Promise<{ specs: SpecSummary[]; truncated: boolean }>
  specSummary(feature: string, signal: AbortSignal): Promise<SpecSummary | undefined>
  readDoc(feature: string, doc: DocName, signal: AbortSignal): Promise<DocumentText>
  watchDoc(feature: string, doc: DocName, onChange: () => void): () => void
  watchRoot(onChange: (paths?: readonly string[]) => void): () => void
  docPath(feature: string, doc: DocName): string
  reviewPath(feature: string, doc: DocName): string
  readReview(feature: string, doc: DocName, signal: AbortSignal): Promise<ReviewComment[] | null>
  writeReview(feature: string, doc: DocName, comments: readonly ReviewComment[], signal: AbortSignal): Promise<{ path: string; savedAt: string }>
  watchReviews(feature: string, onChange: () => void): () => void
  listSkills(signal: AbortSignal): Promise<string[]>
  findNativeChange(docPath: string, signal: AbortSignal): Promise<NativeChange | null>
  openNativeChange(change: NativeChange): void
  openNativeFile(feature: string, doc: DocName): void
  hasTimeline(): boolean
  openTimeline(): void
}

function trimRoot(cwd: string): string {
  return cwd.replace(/[\\/]+$/, '')
}

function joinPath(...parts: readonly string[]): string {
  return parts
    .map((part, index) => (index === 0 ? part.replace(/[\\/]+$/, '') : part.replace(/^[\\/]+/, '')))
    .filter((part) => part !== '')
    .join('/')
}

function failureText(error: RemoteFailure | undefined): string {
  if (error === undefined) return 'unknown Host failure'
  return [error.code, error.message].filter((part) => part !== undefined && part !== '').join(': ') || 'unknown Host failure'
}

/** Known read size: a large page keeps round trips low without risking the cap. */
const PAGE_LINES = 400
const MAX_PAGES = 200

interface FaceContext {
  readonly remote: ClientRemote
  readonly sessions: {
    readonly list: { getSnapshot(): { byId: Record<string, { cwd?: string } | undefined> } }
  }
}

export function createFace(ctx: Context, sessionId: string): SpecFace {
  const { remote, sessions } = ctx as unknown as FaceContext
  /**
   * Resolve a service through the registry. Reading `remote.<name>` directly
   * throws when that namespace is not in this plugin's inject list, so a gated
   * property must never sit on the `??` path.
   */
  const service = (name: string): unknown => {
    try {
      return (ctx as unknown as { get(service: string): unknown }).get(name)
    } catch {
      return undefined
    }
  }
  // The Host Remote mounts after this UI registers, so resolve it at call time
  // instead of freezing an absent namespace into the face.
  const kazeRemote = (): EngineRemote | undefined => service('remote.kazeSpec') as EngineRemote | undefined
  const skillsRemote = service('remote.skills') as SkillsRemote | undefined
  const sessionRemote = service('remote.session') as SessionEventsRemote | undefined
  const sidebarRight = service('sidebarRight') as SidebarRightRemote | undefined
  const sidebarRightTabs = service('sidebarRightTabs') as SidebarRightTabsRemote | undefined
  const scope = sessionId as SessionId

  const cwdOf = (): string | undefined => sessions.list.getSnapshot().byId[sessionId]?.cwd
  const specRoot = (): string | undefined => {
    const cwd = cwdOf()
    return cwd === undefined || cwd === '' ? undefined : joinPath(trimRoot(cwd), SPEC_ROOT_NAME)
  }
  const docPath = (feature: string, doc: DocName): string => joinPath(specRoot() ?? SPEC_ROOT_NAME, feature, `${doc}.md`)
  const reviewPath = (feature: string, doc: DocName): string =>
    joinPath(specRoot() ?? SPEC_ROOT_NAME, feature, 'reviews', `${doc}.json`)

  async function readText(path: string, signal: AbortSignal): Promise<ReadText> {
    const parts: string[] = []
    let offset = 1
    let version = ''
    let absolutePath = path
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await remote.workspaceFiles.read(scope, path, { offset, limit: PAGE_LINES }, signal)
      if (!result.ok) throw new Error(failureText(result.error))
      const value = result.value
      if (page === 0) {
        version = value.version
        absolutePath = value.absolutePath
      }
      if (value.lines === 0) break
      parts.push(value.text)
      if (value.eof) break
      offset += value.lines
    }
    return { text: parts.join('\n'), path, version, absolutePath }
  }

  /** Read one feature's summary; `truncated` reports a cut listing. */
  async function readSpecSummary(feature: string, signal: AbortSignal): Promise<{ summary?: SpecSummary; truncated: boolean }> {
    const root = specRoot()
    if (root === undefined) return { truncated: false }
    // Bookkeeping directories have no state.json; without this guard they show
    // up as damaged specs in the picker.
    if (isReservedSpecDir(feature)) return { truncated: false }
    const featureRoot = joinPath(root, feature)
    const files = await remote.workspaceFiles.list(scope, featureRoot, signal)
    if (!files.ok) return { truncated: false }
    const docs: DocName[] = files.value.entries
      .filter((file) => file.type === 'file' && file.name.endsWith('.md'))
      .map((file) => file.name.slice(0, -3))
      .filter(isDocName)
      .sort((a, b) => DOCS.indexOf(a) - DOCS.indexOf(b))
    let state = { phase: '', specType: '', workflow: '', designDetail: '', capability: '', updatedAt: '' }
    let hasState = false
    let stateError: string | undefined
    // The listing already says whether state.json exists, so a missing file is
    // not a read failure: it distinguishes a bookkeeping directory from a spec.
    const hasStateFile = files.value.entries.some((file) => file.type === 'file' && file.name === 'state.json')
    if (hasStateFile) {
      try {
        const raw = await readText(joinPath(featureRoot, 'state.json'), signal)
        state = parseState(raw.text)
        hasState = true
      } catch (error) {
        // A damaged state.json keeps the spec listed as "needs repair".
        stateError = error instanceof Error ? error.message : String(error)
      }
    }
    if (!hasStateFile) {
      // Not a spec (for example `.kaze/wishes`, which holds refined wishes).
      // Only a directory that already contains spec documents is reported as a
      // spec that needs repair, so a stray bookkeeping directory never offers
      // itself as a selectable spec whose actions all fail.
      if (docs.length === 0) return { truncated: files.value.truncated }
      stateError = 'state.json is missing'
    }
    // A freshly initialized spec has state.json but no documents yet. It must
    // stay selectable, otherwise "New spec" appears to do nothing until the
    // agent writes the first document.
    if (docs.length === 0 && !hasState && stateError === undefined) return { truncated: files.value.truncated }
    return {
      summary: {
        feature,
        docs,
        ...state,
        analysis: files.value.entries.some((file) => file.type === 'file' && file.name === 'analysis.md'),
        ...(stateError === undefined ? {} : { error: stateError }),
      },
      truncated: files.value.truncated,
    }
  }

  /** Refresh one feature after a watched change, without rescanning `.kaze`. */
  async function specSummary(feature: string, signal: AbortSignal): Promise<SpecSummary | undefined> {
    return (await readSpecSummary(feature, signal)).summary
  }

  async function listSpecs(signal: AbortSignal): Promise<{ specs: SpecSummary[]; truncated: boolean }> {
    const root = specRoot()
    if (root === undefined) return { specs: [], truncated: false }
    const listed = await remote.workspaceFiles.list(scope, root, signal)
    if (!listed.ok) {
      // An absent `.kaze` is a normal empty state, not an error.
      if (listed.error.code === 'workspace-file/not-found') return { specs: [], truncated: false }
      throw new Error(failureText(listed.error))
    }
    let truncated = listed.value.truncated

    const directories = listed.value.entries.filter((entry) => entry.type === 'directory' && !isReservedSpecDir(entry.name))
    const specs = await Promise.all(
      directories.map(async (entry): Promise<SpecSummary | undefined> => {
        const read = await readSpecSummary(entry.name, signal)
        if (read.truncated) truncated = true
        return read.summary
      }),
    )

    return {
      specs: specs
        .filter((spec): spec is SpecSummary => spec !== undefined)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.feature.localeCompare(b.feature)),
      truncated,
    }
  }

  async function readDoc(feature: string, doc: DocName, signal: AbortSignal): Promise<DocumentText> {
    const path = docPath(feature, doc)
    const value = await readText(path, signal)
    return { text: value.text, path, version: value.version }
  }

  /** Shared debounced watcher: a document, or the `.kaze` directory itself. */
  function watchPath(path: string, onChange: (paths?: readonly string[]) => void): () => void {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let stream: (AsyncIterable<{ readonly value: WatchFrame; accept(): void }> & { dispose(): Promise<void> }) | undefined
    const pending = new Set<string>()

    const notify = (changed?: string): void => {
      if (disposed) return
      if (changed !== undefined) pending.add(changed)
      if (timer !== undefined) clearTimeout(timer)
      // A write can surface several frames; one reload per burst is enough.
      timer = setTimeout(() => {
        timer = undefined
        if (disposed) return
        const paths = [...pending]
        pending.clear()
        onChange(paths)
      }, 200)
    }

    try {
      stream = remote.$stream<WatchFrame>({
        name: `kaze spec watch ${path}`,
        open: (signal) => remote.workspaceFiles.changes(scope, path, signal),
        ended: () => new Error(`Kaze spec watch ended for ${path}`),
      })
    } catch {
      return () => undefined
    }

    void (async () => {
      try {
        for await (const item of stream!) {
          if (disposed) break
          if (item.value.kind === 'ready') {
            item.accept()
            continue
          }
          notify(item.value.change?.absolutePath)
        }
      } catch {
        // Watches are an enhancement: a refused or ended watch leaves the
        // manual Refresh and the turn-end refresh in charge.
      }
    })()

    return () => {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
      void stream?.dispose().catch(() => undefined)
    }
  }

  function watchDoc(feature: string, doc: DocName, onChange: () => void): () => void {
    return watchPath(docPath(feature, doc), onChange)
  }

  function watchRoot(onChange: (paths?: readonly string[]) => void): () => void {
    const root = specRoot()
    if (root === undefined) return () => undefined
    return watchPath(root, onChange)
  }

  async function readReview(feature: string, doc: DocName, signal: AbortSignal): Promise<ReviewComment[] | null> {
    const remoteReview = kazeRemote()
    if (remoteReview === undefined) return null
    const result = await remoteReview.readReview(reviewPath(feature, doc), signal)
    if (!result.ok) {
      if (result.error.code === 'kaze-spec/not-found') return null
      throw new Error(failureText(result.error))
    }
    if (result.value === '') return null
    const parsed: unknown = JSON.parse(result.value)
    const list = Array.isArray(parsed) ? parsed : (parsed as { comments?: unknown }).comments
    return parseComments(list)
  }

  async function writeReview(
    feature: string,
    doc: DocName,
    comments: readonly ReviewComment[],
    signal: AbortSignal,
  ): Promise<{ path: string; savedAt: string }> {
    const remoteReview = kazeRemote()
    const path = reviewPath(feature, doc)
    if (remoteReview === undefined) throw new Error('disk review persistence is unavailable')
    const payload = {
      schema: 1,
      feature,
      document: doc,
      updatedAt: new Date().toISOString(),
      comments: comments.map((comment) => ({
        id: comment.id,
        quotedSource: comment.quotedSource,
        section: comment.section,
        sourceLines: comment.sourceLines,
        reviewerNote: comment.reviewerNote,
        createdAt: comment.createdAt,
        ...(comment.stale === true ? { stale: true } : {}),
        ...(comment.resolved === true ? { resolved: true } : {}),
      })),
    }
    const result = await remoteReview.writeReview(path, JSON.stringify(payload, null, 2), signal)
    if (!result.ok) throw new Error(failureText(result.error))
    let savedAt = new Date().toISOString()
    try {
      const status: unknown = JSON.parse(result.value)
      if (typeof status === 'object' && status !== null && typeof (status as { updatedAt?: unknown }).updatedAt === 'string') {
        savedAt = (status as { updatedAt: string }).updatedAt
      }
    } catch {
      // A plain status string still means the write succeeded.
    }
    return { path, savedAt }
  }

  function watchReviews(feature: string, onChange: () => void): () => void {
    const root = specRoot()
    if (root === undefined) return () => undefined
    return watchPath(joinPath(root, feature, 'reviews'), onChange)
  }

  const normalize = (value: string): string => value.replace(/\\/g, '/').replace(/\/{2,}/g, '/')

  function samePath(filePath: string, cwd: string, target: string): boolean {
    const file = normalize(filePath)
    const root = normalize(cwd).replace(/\/+$/, '')
    const candidate = /^(?:[A-Za-z]:\/|\/)/.test(file) ? file : `${root}/${file}`
    const left = normalize(candidate)
    const right = normalize(target)
    return /^[A-Za-z]:\//.test(left) ? left.toLowerCase() === right.toLowerCase() : left === right
  }

  async function findNativeChange(docPath: string, signal: AbortSignal): Promise<NativeChange | null> {
    if (sessionRemote === undefined) return null
    const page = await sessionRemote.events(
      { address: { kind: 'session', sessionId }, maxMessages: 40 },
      signal,
    )
    if (!page.ok) return null
    const events = page.value.records
      .map((record) => record.event)
      .filter((event) => event.type === 'workspace/changes')
      .sort((left, right) => right.seq - left.seq)
      .slice(0, 12)
    for (const event of events) {
      signal.throwIfAborted()
      const url = new URL(
        `api/changes.summary?sessionId=${encodeURIComponent(sessionId)}&seq=${event.seq}`,
        document.baseURI,
      )
      const response = await fetch(url, { signal, credentials: 'same-origin' })
      if (!response.ok) continue
      const summary: unknown = await response.json()
      if (typeof summary !== 'object' || summary === null) continue
      const value = summary as { turn?: unknown; cwd?: unknown; files?: unknown; total?: unknown }
      if (typeof value.cwd !== 'string' || !Array.isArray(value.files)) continue
      const index = value.files.findIndex((file) => {
        if (typeof file !== 'object' || file === null) return false
        const path = (file as { path?: unknown }).path
        return typeof path === 'string' && samePath(path, value.cwd as string, docPath)
      })
      if (index >= 0) {
        return {
          seq: event.seq,
          turn: typeof value.turn === 'number' ? value.turn : 0,
          index,
          total: typeof value.total === 'number' ? value.total : value.files.length,
        }
      }
    }
    return null
  }

  function openNativeChange(change: NativeChange): void {
    if (sidebarRight === undefined) return
    const address = `dsh-resource://changes-review/session/${encodeURIComponent(sessionId)}/${change.seq}/${change.turn}`
    sidebarRight.openResourceIn(sessionId, address, { params: { index: change.index } })
  }

  function openNativeFile(feature: string, doc: DocName): void {
    if (sidebarRight === undefined) return
    const relative = `.kaze/${feature}/${doc}.md`
    const address = `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${relative
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')}`
    sidebarRight.openResourceIn(sessionId, address)
  }

  function hasTimeline(): boolean {
    return sidebarRightTabs?.get('timeline') !== undefined
  }

  function openTimeline(): void {
    if (sidebarRight === undefined || !hasTimeline()) return
    try {
      sidebarRight.openTabIn(sessionId, 'timeline')
    } catch {
      // The Timeline tab type is optional; a missing surface must not stop
      // execution from being sent to the agent.
    }
  }

  async function engineCall<T>(
    call: (api: EngineRemote, root: string) => Promise<RemoteResult<string>>,
  ): Promise<T> {
    const api = kazeRemote()
    const root = specRoot()
    if (api === undefined || root === undefined) throw new Error('native Kaze engine is unavailable')
    const result = await call(api, root)
    if (!result.ok) throw new Error(failureText(result.error))
    return JSON.parse(result.value) as T
  }

  async function validate(feature: string, signal: AbortSignal): Promise<EngineValidation> {
    return engineCall((api, root) => api.specValidate(root, feature, signal))
  }

  async function sync(feature: string, signal: AbortSignal): Promise<void> {
    await engineCall((api, root) => api.specSync(root, feature, signal))
  }

  async function init(
    feature: string,
    type: 'feature' | 'bugfix',
    scope: string,
    workflow: string,
    designDetail: string,
    signal: AbortSignal,
  ): Promise<void> {
    await engineCall((api, root) => api.specInit(root, feature, type, scope, workflow, designDetail, signal))
  }

  async function rename(feature: string, to: string, signal: AbortSignal): Promise<void> {
    await engineCall((api, root) => api.specRename(root, feature, to, signal))
  }

  async function advance(feature: string, target: string, signal: AbortSignal): Promise<EngineAdvance> {
    return engineCall((api, root) => api.specAdvance(root, feature, target, signal))
  }

  async function timeline(feature: string, signal: AbortSignal): Promise<unknown> {
    return engineCall((api, root) => api.specTimeline(root, feature, sessionId, signal))
  }

  async function listArchived(signal: AbortSignal): Promise<ArchivedSpec[]> {
    return engineCall((api, root) => api.specArchived(root, signal))
  }

  async function archive(feature: string, reason: string, force: boolean, signal: AbortSignal): Promise<void> {
    await engineCall((api, root) => api.specArchive(root, feature, reason, force, signal))
  }

  async function restore(query: string, signal: AbortSignal): Promise<void> {
    await engineCall((api, root) => api.specRestore(root, query, signal))
  }

  async function completion(feature: string, signal: AbortSignal): Promise<CompletionSummary> {
    return engineCall((api, root) => api.specCompletion(root, feature, signal))
  }

  async function buildDelivery(feature: string, signal: AbortSignal): Promise<void> {
    await engineCall((api, root) => api.specDelivery(root, feature, signal))
  }

  async function idle(action: string, payload: Record<string, unknown>, signal: AbortSignal): Promise<IdleStatus> {
    return engineCall((api, root) => api.specIdle(root, action, JSON.stringify(payload), signal))
  }

  async function specConfig(action: string, payload: Record<string, unknown>, signal: AbortSignal): Promise<{ language: 'zh-CN' | 'en' }> {
    return engineCall((api, root) => api.specConfig(root, action, JSON.stringify(payload), signal))
  }

  async function refineWish(wish: string, signal: AbortSignal): Promise<string> {
    const api = kazeRemote()
    if (api === undefined) throw new Error('native Kaze engine is unavailable')
    const result = await api.refineWish(sessionId, wish, signal)
    if (!result.ok) throw new Error(failureText(result.error))
    return result.value
  }

  async function listSkills(signal: AbortSignal): Promise<string[]> {
    const skills = skillsRemote
    if (skills === undefined) return []
    try {
      const result = await skills.list({ sessionId }, signal)
      if (!result.ok) return []
      return result.value.skills
        .filter((skill) => skill.userInvocable !== false)
        .map((skill) => skill.name)
    } catch {
      return []
    }
  }

  return {
    cwd: cwdOf(),
    get hasDiskReview(): boolean {
      return kazeRemote() !== undefined
    },
    get hasEngine(): boolean {
      return kazeRemote() !== undefined
    },
    validate,
    sync,
    init,
    rename,
    advance,
    timeline,
    listArchived,
    archive,
    restore,
    completion,
    buildDelivery,
    idle,
    specConfig,
    refineWish,
    listSpecs,
    specSummary,
    readDoc,
    watchDoc,
    watchRoot,
    docPath,
    reviewPath,
    readReview,
    writeReview,
    watchReviews,
    listSkills,
    findNativeChange,
    openNativeChange,
    openNativeFile,
    hasTimeline,
    openTimeline,
  }
}




