/**
 * The native Kaze Spec tab.
 *
 * Native DSH right-sidebar surface: pick a spec, move between documents, read
 * preview or source, find, review with anchored comments, validate/sync/run
 * through native tools, and send the review brief into the conversation.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import {
  actionPrompt,
  adjacentDoc,
  buildReviewPrompt,
  commentId,
  commentsKey,
  diffLines,
  docAvailability,
  findMatches,
  lineAtOffset,
  loadComments,
  isDocName,
  parseBlocks,
  phaseTone,
  resolveQuote,
  saveComments,
  sectionAt,
  taskProgress,
} from './model'
import { kazeCommandLanguage, syncKazeCommandLanguage } from './command-menu'
import { featureIdProblem } from '../shared/spec-dirs.js'
import { SPEC_ROOT_MARKER, SPEC_ROOT_PATTERN } from '../shared/spec-root.js'
import { kazeToastsEnabled } from './toasts'
import { actionText, dateText, detailText, docShortText, docText as docNameText, gateName, lineText, notificationText, phaseText, relativeText, scopeText, statusText, tr, workflowText } from './i18n'
import { MarkdownView } from './markdown'
import {
  Archive,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Close,
  Comment,
  Copy,
  Doc,
  Edit,
  Play,
  Plus,
  Refresh,
  Search,
  Send,
  Shield,
  Spark,
  Sync,
  Trash,
} from './icons'
import { DOC_LABEL, DOCS, type Anchor, type ArchivedSpec, type CompletionSummary, type DocName, type DocumentText, type IdleEntryView, type IdleStatus, type MarkdownBlock, type NativeChange, type ReviewComment, type SpecSummary, type TaskNode, type TaskProgress, type ViewMode } from './types'
import type { EngineAdvance, EngineValidation } from './face'

/** The spec lifecycle, in order; the tab renders it as a phase timeline. */
const SPEC_PHASES = ['initial', 'requirements', 'design', 'tasks', 'execute', 'done'] as const

/**
 * Routes a refined wish may take.
 *
 * The wish entry itself always converges on `/spec`; these three are the only
 * branches offered afterwards, so a wish never lands in one of the phase
 * commands (`/spec-requirements`, `/spec-bugfix`) directly.
 */
const WISH_ROUTES = [
  {
    id: 'spec',
    title: 'Step-by-step review',
    description: 'Clarify first, then write one document per phase.',
    badge: '/spec',
  },
  {
    id: 'spec-quick',
    title: 'Quick Spec',
    description: 'One idea, smallest flow to a working spec.',
    badge: '/spec-quick',
  },
  {
    id: 'spec-flow',
    title: 'One-shot Spec',
    description: 'Clarify once, then requirements, design, and tasks in one turn.',
    badge: '/spec-flow',
  },
] as const

/**
 * Slash token for one Kaze menu command.
 *
 * Every bundled Kaze skill is `user-invocable: false`, so the session skill
 * catalog never lists it and the catalog check in `commandLine` would always
 * fall back to prose. The Host `agent/pre-step` hook resolves the token to the
 * bundled `SKILL.md` regardless, so the wish flow inserts it directly.
 * @param id - stable Kaze command id.
 * @param args - optional argument text appended after one space.
 * @returns the slash token plus its arguments.
 */
function kazeSlash(id: string, args = ''): string {
  return `/${id}${args === '' ? '' : ` ${args}`}`
}

export interface InputActions {
  setDraft(text: string): void
  submit(): void
}

export interface SessionStore {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => boolean
  readonly getCwd: () => string | undefined
}

export interface InjectedFace {
  readonly cwd: string | undefined
  readonly sessionId: string
  readonly sessionStore: SessionStore
  readonly hasDiskReview: boolean
  readonly hasEngine: boolean
  readonly validate: (feature: string, signal: AbortSignal) => Promise<EngineValidation>
  readonly sync: (feature: string, signal: AbortSignal) => Promise<void>
  readonly init: (feature: string, type: 'feature' | 'bugfix', scope: string, workflow: string, designDetail: string, signal: AbortSignal) => Promise<void>
  readonly rename: (feature: string, to: string, signal: AbortSignal) => Promise<void>
  readonly advance: (feature: string, target: string, signal: AbortSignal) => Promise<EngineAdvance>
  readonly timeline: (feature: string, signal: AbortSignal) => Promise<unknown>
  readonly listArchived: (signal: AbortSignal) => Promise<ArchivedSpec[]>
  readonly archive: (feature: string, reason: string, force: boolean, signal: AbortSignal) => Promise<void>
  readonly restore: (query: string, signal: AbortSignal) => Promise<void>
  /** Optional so the tab still works when an older Host is connected. */
  readonly completion?: (feature: string, signal: AbortSignal) => Promise<CompletionSummary>
  readonly buildDelivery?: (feature: string, signal: AbortSignal) => Promise<void>
  readonly idle: (action: string, payload: Record<string, unknown>, signal: AbortSignal) => Promise<IdleStatus>
  readonly specConfig: (action: string, payload: Record<string, unknown>, signal: AbortSignal) => Promise<{ language: 'zh-CN' | 'en' }>
  /** Refine a wish with a spawned Kaze subagent; older Hosts omit it. */
  readonly refineWish?: (wish: string, signal: AbortSignal) => Promise<string>
  readonly listSpecs: (signal: AbortSignal) => Promise<{ specs: SpecSummary[]; truncated: boolean }>
  readonly readDoc: (feature: string, doc: DocName, signal: AbortSignal) => Promise<DocumentText>
  readonly watchDoc: (feature: string, doc: DocName, onChange: () => void) => () => void
  readonly watchRoot: (onChange: (paths?: readonly string[]) => void) => () => void
  readonly specSummary: (feature: string, signal: AbortSignal) => Promise<SpecSummary | undefined>
  readonly docPath: (feature: string, doc: DocName) => string
  readonly reviewPath: (feature: string, doc: DocName) => string
  readonly readReview: (feature: string, doc: DocName, signal: AbortSignal) => Promise<ReviewComment[] | null>
  readonly writeReview: (feature: string, doc: DocName, comments: readonly ReviewComment[], signal: AbortSignal) => Promise<{ path: string; savedAt: string }>
  readonly watchReviews: (feature: string, onChange: () => void) => () => void
  readonly listSkills: (signal: AbortSignal) => Promise<string[]>
  readonly findNativeChange: (docPath: string, signal: AbortSignal) => Promise<NativeChange | null>
  readonly openNativeChange: (change: NativeChange) => void
  readonly openNativeFile: (feature: string, doc: DocName) => void
  readonly hasTimeline: () => boolean
  readonly openTimeline: () => void
}

/** A relative `.kaze/<feature>/<doc>.md` link inside rendered Markdown. */
const SPEC_DOC_LINK = new RegExp(`${SPEC_ROOT_PATTERN}\\/([^/]+)\\/([^/]+)\\.md`)

/** Extract the feature segment from a watched `.kaze` path; "" means root-level. */
function featureFromSpecPath(path: string): string {
  const text = path.split('\\').join('/')
  const marker = SPEC_ROOT_MARKER
  const index = text.lastIndexOf(marker)
  if (index < 0) return ''
  const rest = text.slice(index + marker.length)
  if (!rest.includes('/')) return ''
  const feature = rest.slice(0, rest.indexOf('/'))
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(feature) ? feature : ''
}
export type KazeSpecTabProps = InjectedFace & {
  readonly inputActions?: InputActions
  readonly [key: string]: unknown
}

interface ComposerState {
  readonly mode: 'comment' | 'refine'
  readonly anchor: Anchor
  readonly quote: string
  readonly section: string
  readonly note: string
}

interface SelectionPill {
  readonly x: number
  readonly y: number
  readonly quote: string
  readonly anchor?: Anchor
  readonly section: string
}

interface Toast {
  readonly text: string
  readonly tone: 'info' | 'error'
  readonly seq: number
  readonly undo?: () => void
}

function lineTone(line: string): 'heading' | 'list' | 'code' | 'quote' | 'table' | 'rule' | 'task' | undefined {
  if (/^\s*#{1,6}\s+/.test(line)) return 'heading'
  if (/^\s*```/.test(line)) return 'code'
  if (/^\s*>/.test(line)) return 'quote'
  if (/^\s*\|/.test(line)) return 'table'
  if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) return 'rule'
  if (/^\s*[-*+]\s+\[[ xX\-~]\]/.test(line)) return 'task'
  if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) return 'list'
  return undefined
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Localized reason a candidate feature id cannot be used as typed.
 *
 * The engine lowercases and collapses anything outside `[a-z0-9-]`, so accepting
 * `My.Spec` here would tell the agent to write `.kaze/My.Spec/...` while the
 * directory is `.kaze/my-spec/`. Reserved names are rejected too: every list
 * hides them, so such a spec could never be reached.
 */
function featureIdError(value: string): string {
  switch (featureIdProblem(value)) {
    case 'reserved':
      return 'That name is reserved for a Kaze bookkeeping directory.'
    case 'format':
      return 'Feature names use lowercase letters, digits, and dashes; start and end with a letter or digit.'
    default:
      return ''
  }
}

/** File basename of a validation issue mapped to the spec document it lives in. */
function issueDoc(file: string): DocName | undefined {
  const base = file.replace(/\\/g, '/').split('/').pop() ?? ''
  const stem = base.endsWith('.md') ? base.slice(0, -3) : base
  return isDocName(stem) ? stem : undefined
}

/** Specs newest first; the picker order and the default selection share it. */
function sortSpecs(rows: readonly SpecSummary[]): SpecSummary[] {
  return [...rows].sort((left, right) =>
    (Date.parse(right.updatedAt) || 0) - (Date.parse(left.updatedAt) || 0)
    || left.feature.localeCompare(right.feature))
}

/** Archived specs newest first, by archive time with the dated id as fallback. */
function sortArchivedSpecs(rows: readonly ArchivedSpec[]): ArchivedSpec[] {
  return [...rows].sort((left, right) =>
    (Date.parse(right.archivedAt) || 0) - (Date.parse(left.archivedAt) || 0)
    || right.archiveId.localeCompare(left.archiveId))
}

/** Validator messages start with "line N"; accept "<file>.md:N" as a fallback. */
function issueLine(message: string): number | undefined {
  const matched = /\bline\s+(\d{1,7})\b/i.exec(message) ?? /\.md:(\d{1,7})(?::\d{1,7})?/.exec(message)
  if (matched === null) return undefined
  const line = Number(matched[1])
  return Number.isSafeInteger(line) && line > 0 ? line : undefined
}

type BadgeTone = 'info' | 'ok' | 'warn' | 'danger' | undefined

function scopeTone(scope: string): BadgeTone {
  if (scope === 'greenfield') return 'ok'
  if (scope === 'brownfield') return 'info'
  return undefined
}

function gateTone(status: string): BadgeTone {
  if (status === 'approved') return 'ok'
  if (status === 'failed') return 'danger'
  if (status === 'pending') return 'warn'
  return undefined
}

function gateLabel(status: string): string {
  return status === '' ? 'none' : status
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface ReviewStoreOptions {
  readonly key: string
  readonly localKey: string
  readonly feature: string
  readonly doc: DocName
  readonly hasDisk: boolean
  readonly reviewPath: string
  readonly readReview: (feature: string, doc: DocName, signal: AbortSignal) => Promise<ReviewComment[] | null>
  readonly writeReview: (feature: string, doc: DocName, comments: readonly ReviewComment[], signal: AbortSignal) => Promise<{ path: string; savedAt: string }>
  readonly watchReviews: (feature: string, onChange: () => void) => () => void
  readonly notify: (text: string, tone?: 'info' | 'error') => void
}

/**
 * Review fields that belong to the reviewer. Anchors and the stale flag are
 * derived from the document text, so re-anchoring while the agent writes must
 * not look like an unsaved edit.
 */
function persistableComments(comments: readonly ReviewComment[]): string {
  return JSON.stringify(comments.map((comment) => ({
    id: comment.id,
    quotedSource: comment.quotedSource,
    section: comment.section,
    reviewerNote: comment.reviewerNote,
    createdAt: comment.createdAt,
    resolved: comment.resolved === true,
  })))
}

/**
 * Review comments live on disk (`reviews/<doc>.json`) with the local cache as
 * an instant mirror and offline fallback. Every discrete edit is written, and
 * writes are serialized so the newest snapshot always wins.
 */
function useReviewStore(options: ReviewStoreOptions) {
  const { key, localKey, feature, doc, hasDisk, reviewPath, readReview, writeReview, watchReviews, notify } = options
  const [state, setState] = useState<{ key: string; comments: ReviewComment[]; hydrated: boolean }>(() => ({
    key,
    comments: loadComments(localKey),
    hydrated: false,
  }))
  let current = state
  if (state.key !== key) {
    current = { key, comments: loadComments(localKey), hydrated: false }
    setState(current)
  }

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  /** A hydration read failure: distinct from a failed write, and never "Save failed". */
  const [loadError, setLoadError] = useState('')
  const [savedPath, setSavedPath] = useState(reviewPath)
  const skipSave = useRef(false)
  /** Serialized last persisted (or hydrated) snapshot: equal content is not rewritten. */
  const lastSaved = useRef('')
  const queue = useRef<Promise<void>>(Promise.resolve())
  const commentsRef = useRef(current.comments)
  commentsRef.current = current.comments
  const activeKey = useRef(key)
  activeKey.current = key

  const enqueue = useCallback(
    (snapshot: readonly ReviewComment[]): Promise<boolean> => {
      if (!hasDisk) return Promise.resolve(false)
      setSaveState('saving')
      setSaveError('')
      const task = queue.current.then(async () => {
        try {
          const result = await writeReview(feature, doc, snapshot, new AbortController().signal)
          if (activeKey.current === key) {
            lastSaved.current = persistableComments(snapshot)
            setSaveState('saved')
            setSavedPath(result.path)
            setLoadError('')
          }
          return true
        } catch (error) {
          if (activeKey.current === key) {
            setSaveState('error')
            setSaveError(errorText(error))
            notify(`Could not save review comments: ${errorText(error)}`, 'error')
          }
          return false
        }
      })
      queue.current = task.then(() => undefined, () => undefined)
      return task
    },
    [hasDisk, writeReview, feature, doc, key, notify],
  )

  // Load the durable copy once per document, keeping any comment added while
  // the read was in flight.
  useEffect(() => {
    if (key === '') return
    let alive = true
    const controller = new AbortController()
    setSaveState('idle')
    setSaveError('')
    setLoadError('')
    setSavedPath(reviewPath)
    void (async () => {
      let disk: ReviewComment[] | null = null
      let error = ''
      if (hasDisk) {
        try {
          disk = await readReview(feature, doc, controller.signal)
        } catch (failure) {
          error = errorText(failure)
        }
      }
      if (!alive) return
      const local = loadComments(localKey)
      let comments = disk ?? local
      if (commentsRef.current.length > 0) {
        const ids = new Set(comments.map((comment) => comment.id))
        comments = [...comments, ...commentsRef.current.filter((comment) => !ids.has(comment.id))]
      }
      skipSave.current = disk !== null || error !== ''
      // The hydration snapshot is the baseline; a re-anchor that produces the
      // same comments must not rewrite the file while the agent is editing.
      lastSaved.current = persistableComments(comments)
      setState({ key, comments, hydrated: true })
      if (error !== '') {
        // Keep the local comments usable; the review area reports the read
        // failure without claiming a save failed.
        setLoadError(error)
      }
    })()
    return () => {
      alive = false
      controller.abort()
    }
  }, [key, hasDisk, feature, doc, localKey, reviewPath, readReview])

  // Every committed edit is mirrored locally immediately and persisted to disk.
  useEffect(() => {
    if (!state.hydrated || state.key !== key) return
    saveComments(localKey, state.comments)
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    if (!hasDisk) return
    // Re-anchoring after a document edit can produce an equal list; writing it
    // back would fight the agent's own writes and can fail mid-turn.
    if (persistableComments(state.comments) === lastSaved.current) return
    void enqueue(state.comments)
  }, [state.comments, state.hydrated, state.key, key, localKey, hasDisk, enqueue])

  const reloadComments = useCallback(async (): Promise<void> => {
    if (!hasDisk || key === '') return
    try {
      const disk = await readReview(feature, doc, new AbortController().signal)
      if (activeKey.current !== key) return
      setLoadError('')
      if (disk === null) return
      if (JSON.stringify(disk) === JSON.stringify(commentsRef.current)) return
      skipSave.current = true
      lastSaved.current = persistableComments(disk)
      setState({ key, comments: disk, hydrated: true })
      setSaveState('saved')
    } catch {
      // A transient read failure leaves the current comments untouched.
    }
  }, [hasDisk, key, feature, doc, readReview])

  // Commands and other tools write the same file; refresh when it changes.
  useEffect(() => {
    if (!hasDisk || !state.hydrated || key === '') return
    return watchReviews(feature, () => {
      void reloadComments()
    })
  }, [hasDisk, state.hydrated, key, feature, watchReviews, reloadComments])

  const setComments = useCallback(
    (update: readonly ReviewComment[] | ((previous: readonly ReviewComment[]) => readonly ReviewComment[])) => {
      setState((previous) => {
        const next = typeof update === 'function' ? update(previous.comments) : update
        // A re-anchor that resolves nothing new returns the same list; keeping
        // the previous state avoids a needless save and re-render.
        if (next === previous.comments) return previous
        return {
          key: previous.key,
          comments: [...next],
          hydrated: previous.hydrated,
        }
      })
    },
    [],
  )

  const flush = useCallback(async (): Promise<boolean> => {
    if (!hasDisk || !state.hydrated) return !hasDisk
    return enqueue(commentsRef.current)
  }, [hasDisk, state.hydrated, enqueue])

  return {
    comments: current.comments,
    setComments,
    hydrated: current.hydrated,
    saveState,
    saveError,
    loadError,
    savedPath,
    flush,
    reloadComments,
  }
}

function CommentCard(props: {
  readonly comment: ReviewComment
  readonly number: number
  readonly editing: boolean
  readonly draft: string
  readonly onDraft: (value: string) => void
  readonly onEdit: () => void
  readonly onSave: () => void
  readonly onCancel: () => void
  readonly onJump: () => void
  readonly onResolve: () => void
  readonly onDelete: () => void
}) {
  const { comment, number, editing, draft } = props
  const anchor = comment.sourceLines.start === comment.sourceLines.end
    ? `line ${comment.sourceLines.start}`
    : `lines ${comment.sourceLines.start}–${comment.sourceLines.end}`
  return (
    <div className="kaze-comment" data-resolved={comment.resolved || undefined} data-stale={comment.stale || undefined}>
      <div className="kaze-comment-head">
        <span className="kaze-comment-no">{number > 0 ? number : '–'}</span>
        <span className="kaze-comment-section" title={comment.section || anchor}>
          {comment.section || anchor}
        </span>
        {comment.stale && <span className="kaze-badge" data-tone="warn">{tr('anchor moved')}</span>}
        {comment.resolved && <span className="kaze-badge" data-tone="ok">{tr('resolved')}</span>}
      </div>
      {comment.quotedSource !== '' && <div className="kaze-comment-quote">{comment.quotedSource}</div>}
      {editing ? (
        <>
          <textarea
            className="kaze-textarea kaze-comment-edit"
            value={draft}
            autoFocus
            rows={3}
            onChange={(event) => props.onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') props.onCancel()
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) props.onSave()
            }}
          />
          <div className="kaze-comment-actions">
            <button type="button" className="kaze-btn" data-variant="primary" onClick={props.onSave} disabled={draft.trim() === ''}>
              {tr('Save')}
            </button>
            <button type="button" className="kaze-btn" onClick={props.onCancel}>{tr('Cancel')}</button>
          </div>
        </>
      ) : (
        <div className="kaze-comment-note">{comment.reviewerNote}</div>
      )}
      {!editing && (
        <div className="kaze-comment-actions">
          <button type="button" className="kaze-btn" onClick={props.onJump} title={anchor}>
            <ArrowRight size={11} /> {tr('Jump')}
          </button>
          <button type="button" className="kaze-btn" onClick={props.onEdit}>
            <Edit size={11} /> {tr('Edit')}
          </button>
          <button type="button" className="kaze-btn" onClick={props.onResolve}>
            <Check size={11} /> {comment.resolved ? tr('Reopen') : tr('Resolve')}
          </button>
          <button type="button" className="kaze-btn" data-variant="danger" onClick={props.onDelete}>
            <Trash size={11} /> {tr('Delete')}
          </button>
        </div>
      )}
    </div>
  )
}

function TaskPanel(props: {
  readonly progress: TaskProgress
  readonly queuedKeys: ReadonlySet<string>
  readonly onQueue: (task: TaskNode, queued: boolean) => void
  readonly onRun: () => void
  readonly onRunTask: (task: TaskNode) => void
  readonly hasTimeline: boolean
  readonly onTimeline: () => void
  readonly onOpenDoc: () => void
  readonly onOpenIdle: () => void
}) {
  const { progress } = props
  const [open, setOpen] = useState(true)
  const percent = progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100)
  const readyIds = new Set(progress.ready.map((task) => task.id))
  return (
    <div className="kaze-task-panel" data-collapsed={!open || undefined}>
      <div className="kaze-task-head">
        <button
          type="button"
          className="kaze-panel-toggle"
          aria-expanded={open}
          title={open ? tr('Collapse tasks') : tr('Expand tasks')}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown size={11} />
          <strong>{tr('Tasks')}</strong>
        </button>
        <span className="kaze-count">
          {progress.completed}/{progress.total} {tr('required')}
        </span>
        {progress.ready.length > 0 && (
          <span className="kaze-badge" data-tone="info">{progress.ready.length} {tr('ready')}</span>
        )}
        <span className="kaze-spacer" />
        <button type="button" className="kaze-btn" onClick={props.onOpenDoc} title={tr('View tasks.md')}>
          <Doc size={11} /> {tr('View tasks.md')}
        </button>
        <button type="button" className="kaze-btn" data-kind="agent" title={tr('Execute every ready task — sends to the agent')} onClick={props.onRun} disabled={progress.ready.length === 0}>
          <Play size={11} /> {tr('Run all')}
        </button>
        {props.hasTimeline && (
          <button type="button" className="kaze-btn" onClick={props.onTimeline} title={tr('Open DeepSeek Harness Timeline for live agent tasks')}>
            {tr('Timeline')}
          </button>
        )}
      </div>
      <div className="kaze-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${percent}%` }} />
      </div>
      <div className="kaze-task-hint">
        <span>{tr('Tick a task to add it to the idle queue; run the queue during an idle window.')}</span>
        <span className="kaze-spacer" />
        <button type="button" className="kaze-btn" onClick={props.onOpenIdle}>
          <Clock size={10} /> {tr('Idle queue')}{props.queuedKeys.size === 0 ? '' : ` (${props.queuedKeys.size})`}
        </button>
      </div>
      <div className="kaze-task-list" role="list" aria-label={tr('Tasks')}>
        {progress.leaves.map((task) => (
          <div
            key={task.id}
            className="kaze-task-row"
            data-status={task.status}
            data-queued={props.queuedKeys.has(task.id) || undefined}
            title={`${task.id} ${task.title}`}
            role="listitem"
          >
            <span className="kaze-tid">{task.id}</span>
            <span className="kaze-title">{task.title}</span>
            {task.optional && <span className="kaze-star" title={tr('optional')}>*</span>}
            {readyIds.has(task.id) && task.status !== 'completed' && (
              <span className="kaze-badge" data-tone="info">{tr('ready')}</span>
            )}
            <label
              className="kaze-task-queue-label"
              data-queued={props.queuedKeys.has(task.id) || undefined}
              title={props.queuedKeys.has(task.id) ? tr('Remove from the idle queue') : tr('Queue this task for idle time')}
            >
              <input
                type="checkbox"
                className="kaze-task-queue"
                checked={props.queuedKeys.has(task.id)}
                aria-label={`${tr('Idle queue')} · ${task.id}`}
                onChange={(event) => props.onQueue(task, event.target.checked)}
              />
              <Clock size={10} />
              <span>{tr('Idle')}</span>
            </label>
            <button
              type="button"
              className="kaze-task-run"
              data-kind="agent"
              title={`${tr('Execute')} · ${task.id}`}
              aria-label={`${tr('Execute')} · ${task.id}`}
              onClick={(event) => {
                event.stopPropagation()
                props.onRunTask(task)
              }}
            >
              <Play size={10} />
            </button>
          </div>
        ))}
        {progress.leaves.length === 0 && <div className="kaze-empty">{tr('No tasks yet')}</div>}
      </div>
    </div>
  )
}

function formatBeijingWhen(iso: string | null): string {
  if (iso === null || iso === '') return '—'
  const at = new Date(iso)
  if (!Number.isFinite(at.getTime())) return '—'
  return at.toLocaleString('en-GB', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function IdleQueuePanel(props: {
  readonly status: IdleStatus
  readonly onMove: (entry: IdleEntryView, direction: 'up' | 'down') => void
  readonly onRemove: (entry: IdleEntryView) => void
  readonly onEdit: (entry: IdleEntryView, peakCost: number, note: string) => void
  readonly onSort: () => void
  readonly onRefresh: () => void
  readonly onRun: () => void
  readonly onClose: () => void
  readonly onSaveConfig: (json: string) => void
}) {
  const { status } = props
  const [open, setOpen] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [configDraft, setConfigDraft] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editCost, setEditCost] = useState('')
  const [editNote, setEditNote] = useState('')
  const queued = status.queue.filter((entry) => entry.status === 'queued' || entry.status === 'running')
  const canRun = status.idle && queued.length > 0
  const openConfig = (): void => {
    setConfigDraft(`${JSON.stringify(status.config, null, 2)}\n`)
    setConfigOpen(true)
  }
  return (
    <div className="kaze-idle-panel" data-collapsed={!open || undefined} role="region" aria-label={tr('Idle queue')}>
      <div className="kaze-idle-head">
        <button
          type="button"
          className="kaze-panel-toggle"
          aria-expanded={open}
          title={open ? tr('Collapse idle queue') : tr('Expand idle queue')}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown size={11} />
          <strong>{tr('Idle queue')}</strong>
        </button>
        <span className="kaze-badge" data-tone={status.idle ? 'ok' : 'warn'}>{status.idle ? tr('idle now') : tr('peak')}</span>
        <span className="kaze-count" title={tr('Idle cost is this fraction of peak cost')}>{tr('idle ×')}{status.config.idlePriceMultiplier}</span>
        <span className="kaze-count">{queued.length} {tr('queued')}</span>
        <span className="kaze-spacer" />
        <button type="button" className="kaze-btn" onClick={props.onRefresh} title={tr('Refresh')}>{tr('Refresh')}</button>
        <button type="button" className="kaze-btn" onClick={openConfig} title={tr('Settings')}>{tr('Settings')}</button>
        <button type="button" className="kaze-iconbtn" title={tr('Close')} aria-label={tr('Close')} onClick={props.onClose}>
          <Close size={11} />
        </button>
      </div>
      <div className="kaze-idle-when">
        {status.idle ? tr('Idle window is active.') : `${tr('Next idle')}：${formatBeijingWhen(status.nextIdle)}`}
        {' · '}
        {status.idle ? `${tr('Next peak')}：${formatBeijingWhen(status.nextPeak)}` : `${tr('Peak ends')}：${formatBeijingWhen(status.nextIdle)}`}
        {' · '}
        {tr('Beijing time')}
      </div>
      <div className="kaze-idle-note">
        {tr('Ticked tasks wait in this queue; during an idle window, Run queue sends them to the agent as one batch.')}
      </div>
      {status.validation.errors.length > 0 && (
        <div className="kaze-notice" data-tone="error">
          {status.validation.errors.map((error, index) => <div key={index}>{error}</div>)}
        </div>
      )}
      {status.validation.warnings.length > 0 && (
        <div className="kaze-notice">
          {status.validation.warnings.map((warning, index) => <div key={index}>{warning}</div>)}
        </div>
      )}
      <div className="kaze-idle-list">
        {status.queue.length === 0 && <div className="kaze-empty">{tr('No queued tasks. Tick a task in the task panel to defer it.')}</div>}
        {status.queue.map((entry) => {
          const editing = editId === entry.id
          return (
            <div className="kaze-idle-row" key={entry.id} data-status={entry.status}>
              <span className="kaze-idle-index">{entry.index + 1}</span>
              <span className="kaze-idle-name" title={`${entry.feature}:${entry.taskId}`}>
                {entry.feature} · {entry.taskId} {entry.title}
              </span>
              <span className="kaze-badge" data-tone={entry.optional ? 'info' : undefined}>{entry.optional ? tr('optional') : tr('task')}</span>
              <span className="kaze-badge" data-tone={gateTone(entry.status === 'failed' ? 'failed' : entry.status === 'done' ? 'approved' : 'pending')}>{statusText(entry.status)}</span>
              <span className="kaze-idle-cost" title={entry.peakCost === 0 ? tr('Set a peak cost to estimate idle cost') : tr('Peak → idle cost')}>
                {entry.peakCost === 0 ? '—' : `${entry.peakCost} → ${entry.idleCost}`}
              </span>
              {entry.dependsOn.length > 0 && <span className="kaze-idle-dep" title={entry.dependsOn.join(', ')}>{tr('deps')} {entry.dependsOn.length}</span>}
              {editing ? (
                <span className="kaze-idle-edit">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editCost}
                    aria-label={`Peak cost for ${entry.feature} ${entry.taskId}`}
                    onChange={(event) => setEditCost(event.target.value)}
                  />
                  <input
                    value={editNote}
                    aria-label={`Note for ${entry.feature} ${entry.taskId}`}
                    placeholder="note"
                    onChange={(event) => setEditNote(event.target.value)}
                  />
                  <button
                    type="button"
                    className="kaze-btn"
                    onClick={() => {
                      const cost = Number(editCost)
                      if (!Number.isFinite(cost) || cost < 0) return
                      props.onEdit(entry, cost, editNote)
                      setEditId(null)
                    }}
                  >
                    Save
                  </button>
                  <button type="button" className="kaze-btn" onClick={() => setEditId(null)}>{tr('Cancel')}</button>
                </span>
              ) : (
                <span className="kaze-idle-actions">
                  <button type="button" className="kaze-iconbtn" title={tr('Move up')} aria-label={`Move ${entry.feature} ${entry.taskId} up`} onClick={() => props.onMove(entry, 'up')} disabled={entry.index === 0}>↑</button>
                  <button type="button" className="kaze-iconbtn" title={tr('Move down')} aria-label={`Move ${entry.feature} ${entry.taskId} down`} onClick={() => props.onMove(entry, 'down')} disabled={entry.index === status.queue.length - 1}>↓</button>
                  <button
                    type="button"
                    className="kaze-iconbtn"
                    title={tr('Edit cost and note')}
                    aria-label={`Edit ${entry.feature} ${entry.taskId}`}
                    onClick={() => {
                      setEditId(entry.id)
                      setEditCost(String(entry.peakCost))
                      setEditNote(entry.note)
                    }}
                  >
                    <Edit size={10} />
                  </button>
                  <button type="button" className="kaze-iconbtn" title={tr('Remove from queue')} aria-label={`Remove ${entry.feature} ${entry.taskId}`} onClick={() => props.onRemove(entry)}>
                    <Trash size={10} />
                  </button>
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="kaze-actions">
        <button type="button" className="kaze-btn" onClick={props.onSort} disabled={status.queue.length < 2} title={tr('Sort by dependencies')}>{tr('Sort by dependencies')}</button>
        <button
          type="button"
          className="kaze-btn"
          data-kind="agent"
          disabled={!canRun}
          title={canRun ? tr('Run queued tasks now (idle window is active)') : status.idle ? tr('Queue is empty') : `${tr('Idle window starts')} ${formatBeijingWhen(status.nextIdle)}`}
          onClick={props.onRun}
        >
          <Play size={10} /> {tr('Run queue')}
          <span className="kaze-kind" data-kind="agent">{tr('agent')}</span>
        </button>
      </div>
      {configOpen && (
        <div className="kaze-idle-config">
          <div className="kaze-completion-label">{tr('Idle config JSON')}</div>
          <textarea
            value={configDraft}
            aria-label={tr('Idle config JSON')}
            spellCheck={false}
            onChange={(event) => setConfigDraft(event.target.value)}
          />
          <div className="kaze-actions">
            <button
              type="button"
              className="kaze-btn"
              data-variant="primary"
              onClick={() => {
                props.onSaveConfig(configDraft)
                setConfigOpen(false)
              }}
            >
              {tr('Save settings')}
            </button>
            <button type="button" className="kaze-btn" onClick={() => setConfigOpen(false)}>{tr('Cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

type CompletionAction = CompletionSummary['next'][number]

function CompletionPanel(props: {
  readonly summary: CompletionSummary
  readonly open: boolean
  readonly onToggle: () => void
  readonly deliveryKind: 'host' | 'agent'
  readonly onBuildDelivery: () => void
  readonly onAction: (action: CompletionAction) => void
  readonly canArchive: boolean
  readonly onArchive: () => void
  readonly archiveArmed: boolean
  readonly onCancelArchive: () => void
}) {
  const { summary } = props
  const [gatesOpen, setGatesOpen] = useState(false)
  const [expandedGate, setExpandedGate] = useState<string | null>(null)
  const scope = summary.scope === 'brownfield' || summary.scope === 'greenfield' ? summary.scope : 'unknown'
  const tasks = summary.tasks
  const acceptance = summary.acceptance
  const ftaStatus = gateLabel(summary.fta.status)
  const ftaAt = summary.fta.at ?? ''
  const delivery = summary.delivery
  const percent = tasks.total === 0 ? 0 : Math.round((tasks.completed / tasks.total) * 100)
  const gates = [...summary.gates].reverse()
  const shownGates = gatesOpen ? gates : gates.slice(0, 5)
  // The Delivery row owns Build and the next actions own Archive; filtering
  // them keeps the panel from showing the same command twice. Agent next
  // actions already live in the toolbar, so the panel only offers host actions.
  const nextActions = summary.next.filter((action) =>
    action.id !== 'delivery' && action.id !== 'archive' && action.kind === 'host')
  const executed = tasks.total > 0 && tasks.completed === tasks.total
  const acceptanceDone = !acceptance.stale && (acceptance.status === 'approved' || acceptance.status === 'skipped')
  const ftaDone = !summary.fta.stale && (ftaStatus === 'approved' || ftaStatus === 'skipped')
  const verificationDone = summary.verification.present || scope !== 'brownfield'
  const deliveryDone = delivery.present && delivery.fresh
  const activeStep = !executed
    ? 'execute'
    : !acceptanceDone
      ? 'acceptance'
      : !ftaDone
        ? 'fta'
        : !verificationDone
          ? 'verification'
          : !deliveryDone
            ? 'delivery'
            : ''
  const steps = [
    { id: 'execute', label: tr('Execute'), done: executed },
    { id: 'acceptance', label: tr('Acceptance'), done: acceptanceDone },
    { id: 'fta', label: tr('FTA'), done: ftaDone },
    { id: 'verification', label: tr('Verify'), done: verificationDone },
    { id: 'delivery', label: tr('Delivery'), done: deliveryDone },
  ]
  return (
    <div className="kaze-completion" data-collapsed={!props.open || undefined}>
      <div className="kaze-completion-head">
        <button
          type="button"
          className="kaze-completion-toggle"
          aria-expanded={props.open}
          aria-controls="kaze-completion-body"
          title={props.open ? tr('Collapse completion') : tr('Expand completion')}
          onClick={props.onToggle}
        >
          <ChevronDown size={11} />
          <strong>{tr('Completion')}</strong>
        </button>
        <span className="kaze-badge" data-tone={scopeTone(scope)} title={tr('Spec scope')}>{scopeText(scope)}</span>
        <span className="kaze-count" title={`${tasks.completed} completed, ${tasks.in_progress} in progress, ${tasks.ready} ready`}>
          {tasks.completed}/{tasks.total} {tr('Tasks')}
        </span>
        <span className="kaze-spacer" />
      </div>
      {props.open && (
        <div className="kaze-completion-body" id="kaze-completion-body">
          <div className="kaze-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={tr('Completed tasks')}>
            <i style={{ width: `${percent}%` }} />
          </div>
          <div className="kaze-steps" aria-label={tr('Completion stages')}>
            {steps.map((step) => (
              <span
                key={step.id}
                className="kaze-step"
                data-state={step.done ? 'done' : activeStep === step.id ? 'active' : 'pending'}
              >
                {step.label}
              </span>
            ))}
          </div>
          <div className="kaze-completion-grid">
            <div className="kaze-completion-row">
              <span className="kaze-completion-label">{tr('Acceptance')}</span>
              <span className="kaze-completion-value">
                {acceptance.present ? (
                  <>
                    <span>{acceptance.checked}/{acceptance.total} {tr('checked')}</span>
                    <span className="kaze-badge" data-tone={acceptance.stale ? 'warn' : gateTone(acceptance.status)}>
                      {acceptance.stale ? tr('stale') : acceptance.status === 'none' ? tr('none') : statusText(acceptance.status)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="kaze-completion-detail">{tr('Not defined')}</span>
                    {acceptance.status !== 'none' && (
                      <span className="kaze-badge" data-tone={gateTone(acceptance.status)}>{statusText(acceptance.status)}</span>
                    )}
                  </>
                )}
              </span>
            </div>
            <div className="kaze-completion-row">
              <span className="kaze-completion-label">{tr('FTA')}</span>
              <span className="kaze-completion-value">
                <span className="kaze-badge" data-tone={summary.fta.stale ? 'warn' : gateTone(ftaStatus)}>
                  {summary.fta.stale ? tr('stale') : ftaStatus === 'none' ? tr('Not run') : statusText(ftaStatus)}
                </span>
                {summary.fta.details !== '' && (
                  <span className="kaze-completion-detail" title={summary.fta.details}>{summary.fta.details}</span>
                )}
                {ftaAt !== '' && <span className="kaze-completion-when" title={ftaAt}>{relativeText(ftaAt)}</span>}
              </span>
            </div>
            <div className="kaze-completion-row">
              <span className="kaze-completion-label">{tr('Verification')}</span>
              <span className="kaze-completion-value">
                {summary.verification.present ? (
                  <span className="kaze-badge" data-tone="ok">{tr('recorded')}</span>
                ) : scope === 'greenfield' ? (
                  <span className="kaze-badge">{tr('Not required')}</span>
                ) : (
                  <span className="kaze-badge" data-tone="warn" title={tr('Brownfield feature specs must record verification.md before done.')}>
                    {tr('To record')}
                  </span>
                )}
              </span>
            </div>
            <div className="kaze-completion-row">
              <span className="kaze-completion-label">{tr('Delivery')}</span>
              <span className="kaze-completion-value">
                <span
                  className="kaze-badge"
                  data-tone={delivery.present ? (delivery.fresh ? 'ok' : 'warn') : undefined}
                  title={delivery.path === '' ? tr('Not generated') : delivery.path}
                >
                  {delivery.present ? (delivery.fresh ? tr('fresh') : tr('stale')) : tr('Not generated')}
                </span>
                {(executed || delivery.present) && (
                  <button
                    type="button"
                    className="kaze-btn"
                    data-kind={props.deliveryKind}
                    title={props.deliveryKind === 'host'
                      ? 'Build the delivery report now, from this tab'
                      : 'Send the delivery build request to the agent'}
                    onClick={props.onBuildDelivery}
                  >
                    <Sync size={10} /> {tr('Build delivery report')}
                  </button>
                )}
              </span>
            </div>
          </div>
          {gates.length > 0 && (
            <div className="kaze-gate-block">
              <div className="kaze-completion-label">{tr('Gates')}</div>
              <div className="kaze-gates">
                {shownGates.map((gate, index) => {
                  const gateKey = `${gate.gate}-${gate.at}-${index}`
                  const detail = [gate.evidence, gate.reason].find((part) => part !== '') ?? tr('No evidence recorded.')
                  return (
                    <div className="kaze-gate-entry" key={gateKey}>
                      <button
                        type="button"
                        className="kaze-gate-row"
                        aria-expanded={expandedGate === gateKey}
                        title={detail}
                        onClick={() => setExpandedGate((current) => current === gateKey ? null : gateKey)}
                      >
                        <span className="kaze-gate-name">{gateName(gate.gate)}</span>
                        <span className="kaze-badge" data-tone={gateTone(gate.status)}>{statusText(gate.status)}</span>
                        <span className="kaze-gate-at" title={gate.at}>{relativeText(gate.at) || gate.at}</span>
                      </button>
                      {expandedGate === gateKey && (
                        <div className="kaze-gate-detail">{detail}</div>
                      )}
                    </div>
                  )
                })}
              </div>
              {gates.length > 5 && (
                <button type="button" className="kaze-btn kaze-gate-more" onClick={() => setGatesOpen((open) => !open)}>
                  {gatesOpen ? 'Show latest 5' : `Show all ${gates.length}`}
                </button>
              )}
            </div>
          )}
          {nextActions.length > 0 && (
            <div className="kaze-actions">
              {nextActions.map((action, index) => (
                <button
                  key={action.id}
                  type="button"
                  className="kaze-btn"
                  data-kind={action.kind}
                  data-variant={index === 0 ? 'primary' : undefined}
                  title={action.kind === 'host'
                    ? `Runs immediately in this tab${action.command === '' ? '' : ` — ${action.command}`}`
                    : `Sends this request to the agent${action.command === '' ? '' : ` — ${action.command}`}`}
                  onClick={() => props.onAction(action)}
                >
                  {action.kind === 'host' ? <Play size={10} /> : <Send size={10} />}
                  <span className="kaze-action-label">{actionText(action.id, action.label)}</span>
                </button>
              ))}
            </div>
          )}
          {props.canArchive && (
            <div className="kaze-actions">
              <button
                type="button"
                className="kaze-btn"
                data-kind="host"
                data-variant={props.archiveArmed ? 'danger' : undefined}
                title={props.archiveArmed ? 'Archive this spec now' : 'Arm archive; click again to confirm'}
                onClick={props.onArchive}
              >
                <Archive size={10} /> {props.archiveArmed ? tr('Confirm archive') : tr('Archive')}
              </button>
              {props.archiveArmed && (
                <button type="button" className="kaze-btn" onClick={props.onCancelArchive}>
                  {tr('Cancel')}
                </button>
              )}
            </div>
          )}
          {props.archiveArmed && (
            <div className="kaze-completion-detail">{tr('Archive is armed. Click Confirm archive to move this spec; it can be restored later.')}</div>
          )}
        </div>
      )}
    </div>
  )
}

export function KazeSpecTab(props: KazeSpecTabProps) {
  const {
    sessionStore, hasDiskReview, hasEngine, validate, sync, init, rename, advance, timeline,
    listArchived, archive, restore, completion: fetchCompletion, buildDelivery, idle: idleCall, specConfig,
    refineWish,
    listSpecs, specSummary, readDoc, watchDoc, watchRoot, docPath, reviewPath,
    readReview, writeReview, watchReviews, listSkills, findNativeChange, openNativeChange,
    openNativeFile, hasTimeline, openTimeline, inputActions,
  } = props
  const running = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getSnapshot)
  const cwd = useSyncExternalStore(sessionStore.subscribe, sessionStore.getCwd, sessionStore.getCwd)
  /** Folder name of the workspace this tab is bound to; the panel header names the project, not the plugin. */
  const projectName = ((): string => {
    if (cwd === undefined || cwd === '') return ''
    const trimmed = cwd.replace(/[\\/]+$/, '')
    const name = trimmed.split(/[\\/]/).pop() ?? ''
    return name === '' ? trimmed : name
  })()

  const [specs, setSpecs] = useState<readonly SpecSummary[]>([])
  const [specsTruncated, setSpecsTruncated] = useState(false)
  const [archived, setArchived] = useState<readonly ArchivedSpec[]>([])
  const [archivedError, setArchivedError] = useState('')
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [startOpen, setStartOpen] = useState(false)
  const [specsLoading, setSpecsLoading] = useState(true)
  const [specsError, setSpecsError] = useState('')
  const specsRequest = useRef<AbortController | null>(null)

  const [feature, setFeature] = useState('')
  const [doc, setDoc] = useState<DocName>('requirements')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFilter, setPickerFilter] = useState('')
  /** Which start row has its inline create form open. */
  const [inlineCreate, setInlineCreate] = useState<'spec' | 'quick' | 'bugfix' | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameTo, setRenameTo] = useState('')
  const [newFeature, setNewFeature] = useState('')
  const [newType, setNewType] = useState<'feature' | 'bugfix'>('feature')
  const [newScope, setNewScope] = useState<'brownfield' | 'greenfield'>('brownfield')
  const [newWorkflow, setNewWorkflow] = useState<'requirements-first' | 'design-first' | 'verify-first'>('requirements-first')
  const [newDetail, setNewDetail] = useState<'comprehensive' | 'high' | 'low'>('comprehensive')
  const [createError, setCreateError] = useState('')
  const [wishOpen, setWishOpen] = useState(false)
  const [wishText, setWishText] = useState('')
  const [wishBusy, setWishBusy] = useState(false)
  const [wishError, setWishError] = useState('')
  /** Refined wish waiting on the "what next" choice; null while no follow-up is open. */
  const [wishResult, setWishResult] = useState<string | null>(null)
  const [newRequest, setNewRequest] = useState('')
  const [createSkill, setCreateSkill] = useState<'spec-requirements' | 'spec-quick'>('spec-requirements')
  const pickerRef = useRef<HTMLDivElement>(null)

  const [docText, setDocText] = useState<DocumentText | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState('')
  const [docStale, setDocStale] = useState(false)
  const docRequest = useRef<AbortController | null>(null)

  const [mode, setMode] = useState<ViewMode>('preview')
  const [reviewMode, setReviewMode] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findIndex, setFindIndex] = useState(0)
  const [activeLine, setActiveLine] = useState(1)

  const [composer, setComposer] = useState<ComposerState | null>(null)
  const [pill, setPill] = useState<SelectionPill | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clearArmed, setClearArmed] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const busyRef = useRef(false)
  /** Per document/spec comment drafts, restored when the user navigates back. */
  const draftStore = useRef(new Map<string, { composer: ComposerState | null; pill: SelectionPill | null; editDraft: string; editingId: string | null }>())
  const draftKey = useRef('')
  /** Last reversible comment action (clear/delete), used by Cmd/Ctrl+Z. */
  const lastCommentUndo = useRef<(() => void) | null>(null)
  const [skills, setSkills] = useState<readonly string[]>([])
  const [nativeChange, setNativeChange] = useState<NativeChange | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const lightboxRef = useRef<HTMLDivElement>(null)
  const lightboxReturn = useRef<Element | null>(null)
  const [completion, setCompletion] = useState<{ feature: string; summary: CompletionSummary } | null>(null)
  const [completionTick, setCompletionTick] = useState(0)
  const [completionOpen, setCompletionOpen] = useState(true)
  const [completionFailed, setCompletionFailed] = useState(false)
  /** The real failure text, so the notice never blames the Host wrongly. */
  const [completionError, setCompletionError] = useState('')
  const [archiveArmed, setArchiveArmed] = useState(false)
  const [idle, setIdle] = useState<IdleStatus | null>(null)
  const [idleOpen, setIdleOpen] = useState(false)
  const [idleError, setIdleError] = useState('')
  const [specLanguage, setSpecLanguage] = useState<'zh-CN' | 'en'>(kazeCommandLanguage())
  const [validation, setValidation] = useState<{
    feature: string
    errors: readonly { file: string; message: string }[]
    warnings: readonly { file: string; message: string }[]
  } | null>(null)
  const [pickerIndex, setPickerIndex] = useState(-1)

  const docRef = useRef<HTMLDivElement>(null)
  const toastSeq = useRef(0)
  const restoredFor = useRef<string | undefined>(undefined)
  const reloadCommentsRef = useRef<() => void>(() => undefined)
  const pendingScroll = useRef<{ doc: DocName; line: number } | null>(null)
  const lastKey = cwd === undefined ? '' : `kaze-spec:last:${cwd}`

  const notify = useCallback((text: string, tone: 'info' | 'error' = 'info', undo?: () => void) => {
    if (!kazeToastsEnabled()) return
    toastSeq.current += 1
    setToast({ text: notificationText(text), tone, seq: toastSeq.current, ...(undo === undefined ? {} : { undo }) })
  }, [])

  const refreshCompletion = useCallback(() => {
    setCompletionTick((tick) => tick + 1)
  }, [])

  /** Run one engine action at a time; buttons stay disabled until it settles. */
  const runBusy = useCallback((name: string, task: () => Promise<void>): void => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(name)
    void task().finally(() => {
      busyRef.current = false
      setBusy(null)
    })
  }, [])

  /** Spec dialogs share one close path: backdrop, Escape, and the close button. */
  const closeDialogs = useCallback(() => {
    setPickerOpen(false)
    setRenaming(false)
    setStartOpen(false)
    setWishResult(null)
    setInlineCreate(null)
    setCreateError('')
  }, [])

  /** Leave the start dialog and discard a half-filled inline create form. */
  const closeStart = useCallback(() => {
    setStartOpen(false)
    setInlineCreate(null)
    setCreateError('')
  }, [])

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), toast.undo === undefined ? 3200 : 6000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!reviewMode) return
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]') !== null && target !== null) return
      const undo = lastCommentUndo.current
      if (undo === null) return
      event.preventDefault()
      lastCommentUndo.current = null
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reviewMode])

  useEffect(() => {
    if (lightbox === null) return
    lightboxReturn.current = document.activeElement
    lightboxRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const previous = lightboxReturn.current
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [lightbox])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = document.querySelector('.kaze-root')
      const active = document.activeElement
      if (root === null || (active !== null && !root.contains(active) && !root.matches(':hover'))) return
      const command = event.metaKey || event.ctrlKey
      if (command && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        if (mode === 'diff') setMode('source')
        setFindOpen(true)
      } else if (command && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setMode('diff')
      } else if (event.key === 'Escape') {
        if (lightbox !== null) setLightbox(null)
        else if (composer !== null) setComposer(null)
        else if (pill !== null) setPill(null)
        else if (inlineCreate !== null || renaming || pickerOpen || startOpen || wishResult !== null) {
          setInlineCreate(null)
          setCreateError('')
          setRenaming(false)
          setPickerOpen(false)
          setStartOpen(false)
          setWishResult(null)
        } else if (findOpen) setFindOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [mode, lightbox, composer, pill, inlineCreate, renaming, pickerOpen, startOpen, wishResult, findOpen])

  const loadSpecs = useCallback(async () => {
    specsRequest.current?.abort()
    const controller = new AbortController()
    specsRequest.current = controller
    setSpecsLoading(true)
    setSpecsError('')
    try {
      const next = await listSpecs(controller.signal)
      if (!controller.signal.aborted) {
        setSpecs(sortSpecs(next.specs))
        setSpecsTruncated(next.truncated)
      }
    } catch (error) {
      if (!controller.signal.aborted) setSpecsError(errorText(error))
    } finally {
      if (!controller.signal.aborted) setSpecsLoading(false)
    }
  }, [listSpecs])

  useEffect(() => {
    void loadSpecs()
    return () => specsRequest.current?.abort()
  }, [loadSpecs, cwd])

  /** Refresh exactly one feature after a watched change. */
  const refreshSpec = useCallback(async (name: string): Promise<void> => {
    try {
      const summary = await specSummary(name, new AbortController().signal)
      setSpecs((previous) => {
        const next = previous.filter((entry) => entry.feature !== name)
        if (summary !== undefined) next.push(summary)
        return sortSpecs(next)
      })
    } catch {
      // A transient read failure leaves the current list untouched.
    }
  }, [specSummary])

  // New, removed, or re-phased specs appear without a manual Refresh. A path
  // inside one feature refreshes only that feature; root-level changes fall
  // back to a full scan.
  useEffect(() => {
    if (cwd === undefined) return
    return watchRoot((paths) => {
      if (paths === undefined || paths.length === 0) {
        void loadSpecs()
        return
      }
      const features = new Set<string>()
      for (const path of paths) {
        const feature = featureFromSpecPath(path)
        if (feature === '') {
          void loadSpecs()
          return
        }
        features.add(feature)
      }
      for (const feature of features) void refreshSpec(feature)
    })
  }, [watchRoot, loadSpecs, refreshSpec, cwd])

  const loadArchived = useCallback(async () => {
    try {
      setArchived(sortArchivedSpecs(await listArchived(new AbortController().signal)))
      setArchivedError('')
    } catch (error) {
      setArchivedError(errorText(error))
    }
  }, [listArchived])

  useEffect(() => {
    if (pickerOpen) void loadArchived()
  }, [pickerOpen, archivedOpen, loadArchived])

  useEffect(() => {
    const controller = new AbortController()
    void listSkills(controller.signal).then((names) => {
      if (!controller.signal.aborted) setSkills(names)
    })
    return () => controller.abort()
  }, [listSkills, cwd])

  useEffect(() => {
    if (mode !== 'diff' || feature === '') {
      setNativeChange(null)
      return
    }
    const controller = new AbortController()
    void findNativeChange(docPath(feature, doc), controller.signal)
      .then((change) => {
        if (!controller.signal.aborted) setNativeChange(change)
      })
      .catch(() => {
        if (!controller.signal.aborted) setNativeChange(null)
      })
    return () => controller.abort()
  }, [mode, feature, doc, running, docPath, findNativeChange])

  useEffect(() => {
    if (specs.length === 0) {
      if (feature !== '') setFeature('')
      return
    }
    if (!specs.some((spec) => spec.feature === feature)) setFeature(specs[0]!.feature)
  }, [specs, feature])

  // Restore the last spec/document of this workspace once per visit.
  useEffect(() => {
    if (cwd === undefined || lastKey === '' || specs.length === 0 || restoredFor.current === cwd) return
    restoredFor.current = cwd
    try {
      const raw = localStorage.getItem(lastKey)
      if (raw === null || raw === '') return
      const saved = JSON.parse(raw) as { feature?: unknown; doc?: unknown; mode?: unknown }
      const savedSpec = specs.find((entry) => entry.feature === saved.feature)
      if (savedSpec === undefined) return
      setFeature(savedSpec.feature)
      if (typeof saved.doc === 'string' && (DOCS as readonly string[]).includes(saved.doc)) {
        const candidate = saved.doc as DocName
        if (savedSpec.docs.includes(candidate)) setDoc(candidate)
      }
      if (saved.mode === 'source' || saved.mode === 'preview' || saved.mode === 'diff') setMode(saved.mode)
    } catch {
      // A stale or corrupt selection just falls back to the first spec.
    }
  }, [cwd, lastKey, specs])

  useEffect(() => {
    if (cwd === undefined || lastKey === '' || feature === '' || restoredFor.current !== cwd) return
    try {
      localStorage.setItem(lastKey, JSON.stringify({ feature, doc, mode }))
    } catch {
      // Selection memory is optional.
    }
  }, [cwd, lastKey, feature, doc, mode])

  useEffect(() => {
    if (docRef.current !== null) docRef.current.scrollTop = 0
  }, [feature, doc])

  const spec = specs.find((entry) => entry.feature === feature)
  const docAvailable = docAvailability(spec, doc)
  /** Disk review comments only apply once the document exists. */
  const diskReview = hasDiskReview && docAvailable
  const phaseIndex = spec === undefined ? -1 : SPEC_PHASES.indexOf(spec.phase as (typeof SPEC_PHASES)[number])
  const docsKey = spec?.docs.join(',') ?? ''
  const completionSummary = completion !== null && completion.feature === feature ? completion.summary : null
  const queuedKeys = new Set(
    (idle?.queue ?? [])
      .filter((entry) => entry.feature === feature && (entry.status === 'queued' || entry.status === 'running'))
      .map((entry) => entry.taskId),
  )
  const agentNext = completionSummary?.next.find((action) => action.kind === 'agent')
  const validationReport = validation !== null && validation.feature === feature ? validation : null

  useEffect(() => {
    if (spec === undefined) return
    if (!spec.docs.includes(doc)) {
      const first = spec.docs[0]
      if (first !== undefined) setDoc(first)
    }
  }, [spec, docsKey, doc])

  const reloadDoc = useCallback(
    async (options: { quiet?: boolean } = {}) => {
      if (feature === '') return
      docRequest.current?.abort()
      const controller = new AbortController()
      docRequest.current = controller
      if (options.quiet !== true) {
        setDocLoading(true)
        setDocError('')
      }
      try {
        const next = await readDoc(feature, doc, controller.signal)
        if (controller.signal.aborted) return
        setDocText((previous) =>
          previous !== null && previous.text === next.text && previous.path === next.path && previous.version === next.version
            ? previous
            : next,
        )
        setDocError('')
        setDocStale(false)
      } catch (error) {
        if (!controller.signal.aborted) {
          const message = errorText(error)
          // A spec exists before its first document: that is an empty state, not
          // a read failure or a deleted working copy. Quiet reloads run on every
          // agent turn and file change, so a missing document must not raise the
          // stale banner beside "No <doc>.md yet".
          const missing = /not-found|no entry/i.test(message)
          if (missing) {
            setDocStale(false)
            if (options.quiet !== true) setDocError('')
          } else if (options.quiet === true) {
            setDocStale(true)
          } else {
            setDocError(message)
          }
        }
      } finally {
        if (!controller.signal.aborted && options.quiet !== true) setDocLoading(false)
      }
    },
    [feature, doc, readDoc, cwd],
  )

  useEffect(() => {
    setDocText(null)
    setDocStale(false)
    void reloadDoc()
  }, [reloadDoc])

  const reloadRef = useRef(reloadDoc)
  useEffect(() => {
    reloadRef.current = reloadDoc
  }, [reloadDoc])

  useEffect(() => {
    if (feature === '') return
    return watchDoc(feature, doc, () => {
      void reloadRef.current({ quiet: true })
    })
  }, [feature, doc, watchDoc, cwd])

  const wasRunning = useRef(running)
  useEffect(() => {
    if (wasRunning.current && !running) {
      void loadSpecs()
      void reloadRef.current({ quiet: true })
      reloadCommentsRef.current()
      refreshCompletion()
    }
    wasRunning.current = running
  }, [running, loadSpecs, refreshCompletion])

  // Completion is a read-only enhancement: any failure leaves the tab usable.
  useEffect(() => {
    if (feature === '' || fetchCompletion === undefined) {
      setCompletion(null)
      setCompletionFailed(false)
      setCompletionError('')
      return
    }
    const controller = new AbortController()
    let alive = true
    void (async () => {
      try {
        const summary = await fetchCompletion(feature, controller.signal)
        if (alive && !controller.signal.aborted) {
          setCompletion({ feature, summary })
          setCompletionFailed(false)
          setCompletionError('')
        }
      } catch (error) {
        // Keep the failure visible: a missing panel should not look like a
        // spec with nothing to report. The message matters — "the Host is
        // offline" was a wrong diagnosis for a per-spec failure.
        if (alive && !controller.signal.aborted) {
          setCompletion(null)
          setCompletionFailed(true)
          setCompletionError(error instanceof Error ? error.message : String(error))
        }
      }
    })()
    return () => {
      alive = false
      controller.abort()
    }
  }, [feature, fetchCompletion, completionTick])

  // A validation report belongs to one spec and stays visible while the user
  // jumps between the documents it mentions.
  useEffect(() => {
    setValidation(null)
  }, [feature])

  const expectedPath = feature === '' ? '' : docPath(feature, doc)
  const currentDoc = docText !== null && docText.path === expectedPath ? docText : null
  const text = currentDoc?.text ?? ''
  const [baseline, setBaseline] = useState('')
  const baselines = useRef(new Map<string, string>())
  const baselineKey = feature === '' ? '' : `${feature}/${doc}`

  useEffect(() => {
    if (currentDoc === null || baselineKey === '') {
      setBaseline('')
      return
    }
    const existing = baselines.current.get(baselineKey)
    if (existing === undefined) {
      baselines.current.set(baselineKey, currentDoc.text)
      setBaseline(currentDoc.text)
    } else {
      setBaseline(existing)
    }
  }, [currentDoc?.text, baselineKey])

  const diffRows = useMemo(
    () => (mode === 'diff' && currentDoc !== null ? diffLines(baseline, currentDoc.text) : []),
    [mode, baseline, currentDoc?.text],
  )
  const diffAdded = diffRows.filter((row) => row.kind === 'add' || row.kind === 'change').length
  const diffRemoved = diffRows.filter((row) => row.kind === 'remove' || row.kind === 'change').length

  const lines = useMemo(() => text.split('\n'), [text])
  const blocks = useMemo(() => parseBlocks(text), [text])
  const outline = useMemo(
    () => blocks
      .filter((block) => block.kind === 'heading' && (block.text ?? '').trim() !== '')
      .map((block) => ({ start: block.start, level: block.level ?? 1, text: (block.text ?? '').trim() })),
    [blocks],
  )
  const taskInfo = useMemo(() => (doc === 'tasks' && text !== '' ? taskProgress(text) : undefined), [doc, text])

  const key = feature !== '' ? commentsKey(cwd, feature, doc) : ''
  const review = useReviewStore({
    key,
    localKey: key,
    feature,
    doc,
    hasDisk: diskReview,
    reviewPath: feature === '' ? '' : reviewPath(feature, doc),
    readReview,
    writeReview,
    watchReviews,
    notify,
  })
  const { comments, setComments, hydrated: commentsHydrated, saveState, saveError, loadError, savedPath, flush, reloadComments } = review

  useEffect(() => {
    reloadCommentsRef.current = () => { void reloadComments() }
  }, [reloadComments])

  const mutateComments = useCallback(
    (update: readonly ReviewComment[] | ((previous: readonly ReviewComment[]) => readonly ReviewComment[])) => {
      setComments(update)
      setPromptOpen(false)
    },
    [setComments],
  )

  // anchor refresh: relocate quotes after edits and mark stale ones.
  useEffect(() => {
    if (currentDoc === null) return
    setComments((previous) => {
      let changed = false
      const next = previous.map((comment) => {
        if (comment.quotedSource.trim() === '') return comment
        const anchor = resolveQuote(currentDoc.text, comment.quotedSource)
        if (anchor === undefined) {
          if (comment.stale === true) return comment
          changed = true
          return { ...comment, stale: true }
        }
        if (comment.stale !== true && anchor.start === comment.sourceLines.start && anchor.end === comment.sourceLines.end) {
          return comment
        }
        changed = true
        return { ...comment, sourceLines: anchor, stale: false }
      })
      return changed ? next : previous
    })
  }, [currentDoc?.text, setComments])

  const openComments = useMemo(() => comments.filter((comment) => comment.resolved !== true), [comments])
  /** Open-comment ordinal, matching the numbering the review prompt uses. */
  const openOrdinal = useMemo(() => new Map(openComments.map((comment, index) => [comment.id, index + 1])), [openComments])
  const docCounts = useMemo(() => {
    const counts: Partial<Record<DocName, number>> = {}
    for (const candidate of spec?.docs ?? []) {
      const stored = candidate === doc ? comments : loadComments(commentsKey(cwd, feature, candidate))
      const open = stored.filter((comment) => comment.resolved !== true).length
      if (open > 0) counts[candidate] = open
    }
    return counts
  }, [spec?.docs, doc, comments, cwd, feature])
  const promptText = useMemo(() => {
    if (feature === '' || openComments.length === 0) return ''
    return buildReviewPrompt(docPath(feature, doc), doc, openComments)
  }, [feature, doc, openComments, docPath, cwd])

  const matches = useMemo(() => findMatches(text, findQuery), [text, findQuery])
  const matchLines = useMemo(() => matches.map((offset) => lineAtOffset(text, offset)), [matches, text])
  const currentMatchLine = matchLines[Math.min(findIndex, Math.max(0, matchLines.length - 1))]
  const hitLines = useMemo(() => new Set(matchLines), [matchLines])
  const anchoredLines = useMemo(() => {
    const set = new Set<number>()
    for (const comment of openComments) {
      for (let line = comment.sourceLines.start; line <= comment.sourceLines.end; line += 1) set.add(line)
    }
    return set
  }, [openComments])

  useEffect(() => {
    setFindIndex(0)
  }, [findQuery, feature, doc])

  // The tasks tab is a list view; document-only tools and review do not apply there.
  useEffect(() => {
    if (doc !== 'tasks') return
    setFindOpen(false)
    setOutlineOpen(false)
    setReviewMode(false)
    setComposer(null)
    setPill(null)
  }, [doc])

  useEffect(() => {
    if (mode === 'diff') setFindOpen(false)
  }, [mode])

  useEffect(() => {
    if (mode !== 'diff' || diffRows.length === 0) return
    const container = docRef.current
    const first = container?.querySelector<HTMLElement>('.kaze-diff-row[data-kind="change"], .kaze-diff-row[data-kind="add"], .kaze-diff-row[data-kind="remove"]')
    if (container === null || container === undefined || first === null || first === undefined) return
    container.scrollTop = Math.max(0, first.offsetTop - container.clientHeight / 3)
  }, [mode, diffRows.length])

  const scrollToLine = useCallback(
    (line: number) => {      const container = docRef.current
      if (container === null) return
      setActiveLine(line)
      const target = mode === 'source'
        ? container.querySelector<HTMLElement>(`[data-line="${line}"]`)
        : mode === 'diff'
          ? container.querySelector<HTMLElement>(`[data-right-line="${line}"], [data-left-line="${line}"]`)
          : Array.from(container.querySelectorAll<HTMLElement>('[data-src-start]')).find((block) => {
          const start = Number(block.dataset.srcStart)
          const end = Number(block.dataset.srcEnd)
          return line >= start && line <= end
        }) ?? null
      if (target === null) return
      let top = target.offsetTop
      if (mode === 'preview' && target.dataset.srcStart !== undefined) {
        // A Markdown block can span many source lines; scroll to the line's
        // proportional position so repeated Find presses visibly move.
        const start = Number(target.dataset.srcStart)
        const end = Number(target.dataset.srcEnd ?? target.dataset.srcStart)
        const span = Math.max(1, end - start + 1)
        const ratio = Math.min(1, Math.max(0, (line - start) / span))
        top += target.clientHeight * ratio
      }
      top = top - container.clientHeight / 2 + target.clientHeight / 2
      const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      container.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' })
    },
    [mode],
  )

  useEffect(() => {
    if (findOpen && currentMatchLine !== undefined) scrollToLine(currentMatchLine)
  }, [findOpen, currentMatchLine, findQuery, scrollToLine])

  // Keep the keyboard-selected source line visible.
  useEffect(() => {
    if (mode !== 'source') return
    const container = docRef.current
    if (container === null) return
    const target = container.querySelector<HTMLElement>(`[data-line="${activeLine}"]`)
    target?.scrollIntoView({ block: 'nearest' })
  }, [activeLine, mode])

  // A validation issue can point at another document; scroll once it is rendered.
  useEffect(() => {
    const pending = pendingScroll.current
    if (pending === null || doc !== pending.doc || currentDoc === null) return
    pendingScroll.current = null
    scrollToLine(pending.line)
  }, [doc, currentDoc?.text, scrollToLine])

  useEffect(() => {
    pendingScroll.current = null
  }, [feature])

  const focusValidationIssue = useCallback((issue: { file: string; message: string }) => {
    const target = issueDoc(issue.file)
    if (target === undefined || !docAvailability(spec, target)) {
      notify(`${issue.file === '' ? 'This issue' : issue.file} is not in an available spec document.`, 'error')
      return
    }
    const line = issueLine(issue.message)
    if (target === doc) {
      if (line === undefined) return
      if (currentDoc !== null) {
        scrollToLine(line)
      } else {
        pendingScroll.current = { doc: target, line }
      }
      return
    }
    setDoc(target)
    setComposer(null)
    setPill(null)
    setEditingId(null)
    if (line !== undefined) pendingScroll.current = { doc: target, line }
  }, [spec, doc, currentDoc, scrollToLine, notify])

  const sendToChat = useCallback(
    (payload: string, label = 'Sent to chat'): boolean => {
      if (payload.trim() === '') return false
      if (inputActions === undefined) {
        notify('This surface has no chat composer.', 'error')
        return false
      }
      inputActions.setDraft(payload)
      inputActions.submit()
      notify(label)
      return true
    },
    [inputActions, notify],
  )

  const commandLine = (name: string, args: string, fallback: string): string =>
    skills.includes(name) ? `/${name}${args === '' ? '' : ` ${args}`}` : fallback

  const startComment = useCallback(
    (anchor: Anchor, quote?: string) => {
      const max = Math.max(1, lines.length)
      const start = Math.min(Math.max(1, anchor.start), max)
      const end = Math.min(Math.max(start, anchor.end), max)
      const quoted = (quote ?? lines.slice(start - 1, end).join('\n')).trim()
      setComposer({ mode: 'comment', anchor: { start, end }, quote: quoted, section: sectionAt(lines, start), note: '' })
      setPill(null)
      setReviewMode(true)
      setActiveLine(start)
    },
    [lines],
  )

  const startRefine = useCallback(
    (anchor: Anchor, quote?: string) => {
      const max = Math.max(1, lines.length)
      const start = Math.min(Math.max(1, anchor.start), max)
      const end = Math.min(Math.max(start, anchor.end), max)
      const quoted = (quote ?? lines.slice(start - 1, end).join('\n')).trim()
      setComposer({ mode: 'refine', anchor: { start, end }, quote: quoted, section: sectionAt(lines, start), note: '' })
      setPill(null)
      setReviewMode(true)
      setActiveLine(start)
    },
    [lines],
  )

  const handleDocMouseUp = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!reviewMode) return
      const target = event.target as HTMLElement
      if (target.closest('button') !== null) return
      if (target.closest('.kaze-line, .kaze-block') === null) return
      const selection = window.getSelection()
      const quote = selection?.toString().trim() ?? ''
      if (selection === null || quote === '' || selection.rangeCount === 0) {
        setPill(null)
        return
      }
      const container = docRef.current
      if (container === null || selection.anchorNode === null || !container.contains(selection.anchorNode)) return

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const box = container.getBoundingClientRect()
      const block = (selection.anchorNode.nodeType === Node.TEXT_NODE
        ? selection.anchorNode.parentElement
        : (selection.anchorNode as HTMLElement))?.closest<HTMLElement>('[data-src-start]')
      const blockStart = Number(block?.dataset.srcStart ?? 0)
      const blockEnd = Number(block?.dataset.srcEnd ?? blockStart)
      const anchor = resolveQuote(text, quote)
        ?? (blockStart > 0 ? { start: blockStart, end: Math.max(blockStart, blockEnd) } : undefined)
      const section = sectionAt(lines, anchor?.start ?? Math.max(1, blockStart))
      const x = Math.min(Math.max(30, rect.left - box.left + rect.width / 2), box.width - 30)
      const y = rect.bottom - box.top + container.scrollTop
      if (anchor !== undefined) setActiveLine(anchor.start)
      setPill({ x, y, quote, ...(anchor === undefined ? {} : { anchor }), section })
    },
    [reviewMode, text, lines],
  )

  const applyRefine = useCallback(() => {
    if (composer === null || composer.mode !== 'refine') return
    const request = composer.note.trim()
    if (request === '') {
      notify('Describe the refinement first.', 'error')
      return
    }
    if (feature === '') return
    const quoteArg = (value: string): string => (/\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value)
    const fallback = [
      `Refine only the section containing this passage in ${docPath(feature, doc)}:`,
      '',
      `> ${composer.quote.replace(/\n/g, '\n> ')}`,
      '',
      `Request: ${request}`,
      '',
      'Edit only that document. Keep required headings, EARS wording, task status markers, and unrelated sections. Run the validator and report what changed.',
    ].join('\n')
    const args = `feature=${feature} file=${quoteArg(docPath(feature, doc))} section=${quoteArg(composer.section || `line ${composer.anchor.start}`)} request=${request}`
    sendToChat(
      skills.includes('spec-refine') ? `/spec-refine ${args}` : fallback,
      'Refine request sent to chat',
    )
    setComposer(null)
    setPill(null)
    window.getSelection()?.removeAllRanges()
  }, [composer, feature, doc, docPath, sendToChat, notify, skills])

  const addComment = useCallback(() => {
    if (composer === null || composer.mode !== 'comment') return
    if (!commentsHydrated) {
      notify('Saved comments are still loading.', 'error')
      return
    }
    const note = composer.note.trim()
    if (note === '') {
      notify('Write the comment first.', 'error')
      return
    }
    mutateComments((previous) => [
      ...previous,
      {
        id: commentId(),
        quotedSource: composer.quote.slice(0, 4000),
        section: composer.section,
        sourceLines: composer.anchor,
        reviewerNote: note,
        createdAt: Date.now(),
      },
    ])
    setComposer(null)
    setPill(null)
    window.getSelection()?.removeAllRanges()
    notify('Comment added')
  }, [composer, commentsHydrated, mutateComments, notify])

  const saveEdit = useCallback(() => {
    if (editingId === null) return
    const note = editDraft.trim()
    if (note === '') return
    mutateComments((previous) => previous.map((comment) => (comment.id === editingId ? { ...comment, reviewerNote: note } : comment)))
    setEditingId(null)
    setEditDraft('')
  }, [editingId, editDraft, mutateComments])

  const jumpTo = useCallback((comment: ReviewComment) => {
    scrollToLine(comment.sourceLines.start)
  }, [scrollToLine])

  const clearComments = useCallback(() => {
    if (comments.length === 0) return
    if (!clearArmed) {
      setClearArmed(true)
      return
    }
    const snapshot = comments
    mutateComments([])
    setEditingId(null)
    setPromptOpen(false)
    setClearArmed(false)
    const undo = () => {
      setComments(snapshot)
      notify('Comments restored')
    }
    lastCommentUndo.current = undo
    notify('Review comments cleared', 'info', undo)
  }, [comments, clearArmed, mutateComments, notify, setComments])

  useEffect(() => {
    if (!clearArmed) return
    const timer = setTimeout(() => setClearArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [clearArmed])

  useEffect(() => {
    setClearArmed(false)
    const key = `${feature}\u0000${doc}`
    if (draftKey.current === '') {
      draftKey.current = key
      return
    }
    if (draftKey.current === key) return
    // Save the outgoing draft, then restore whatever the target document had.
    draftStore.current.set(draftKey.current, { composer, pill, editDraft, editingId })
    const saved = draftStore.current.get(key)
    draftKey.current = key
    setComposer(saved?.composer ?? null)
    setPill(saved?.pill ?? null)
    setEditDraft(saved?.editDraft ?? '')
    setEditingId(saved?.editingId ?? null)
  }, [doc, feature])

  const canCopy = typeof navigator !== 'undefined' && navigator.clipboard !== undefined
  const copyText = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value)
        notify(label)
      } catch {
        notify('Clipboard unavailable; select the text to copy it.', 'error')
      }
    },
    [notify],
  )

  const docOrder = useMemo<readonly DocName[]>(() => {
    if (spec === undefined) return ['requirements']
    if (spec.specType === 'bugfix') return ['bugfix', 'design', 'tasks']
    return spec.docs.includes('bugfix') ? ['requirements', 'design', 'tasks', 'bugfix'] : ['requirements', 'design', 'tasks']
  }, [spec])

  const nextDoc = useMemo(() => docOrder.find((candidate) => !spec?.docs.includes(candidate)), [docOrder, spec])

  const renameSpec = useCallback(() => {
    const next = renameTo.trim()
    const problem = featureIdError(next)
    if (problem !== '') {
      notify(problem, 'error')
      return
    }
    if (next === feature) {
      notify('That is already the current name.', 'error')
      return
    }
    if (specs.some((entry) => entry.feature === next)) {
      notify(`${next} already exists.`, 'error')
      return
    }
    void (async () => {
      try {
        await rename(feature, next, new AbortController().signal)
        notify(`Renamed ${feature} → ${next}`)
        setFeature(next)
        await loadSpecs()
      } catch (error) {
        notify(`Rename failed: ${errorText(error)}`, 'error')
      }
    })()
    setRenameTo('')
    closeDialogs()
  }, [renameTo, feature, specs, rename, notify, loadSpecs, closeDialogs])

  const archiveCurrent = useCallback(() => {
    if (spec === undefined) return
    if (spec.phase !== 'done') {
      notify('Only done specs can be archived. Advance the spec to done first.', 'error')
      return
    }
    if (!archiveArmed) {
      setArchiveArmed(true)
      notify('Archive armed. Click Archive again to confirm.', 'info')
      return
    }
    setArchiveArmed(false)
    runBusy('archive', async () => {
      try {
        await archive(feature, 'completed', false, new AbortController().signal)
        notify(`Archived ${feature}`)
        setFeature('')
        closeDialogs()
        await loadSpecs()
        await loadArchived()
        refreshCompletion()
      } catch (error) {
        notify(`Archive failed: ${errorText(error)}`, 'error')
      }
    })
  }, [spec, feature, archiveArmed, archive, notify, loadSpecs, loadArchived, refreshCompletion, runBusy, closeDialogs])

  const restoreArchived = useCallback((entry: ArchivedSpec) => {
    void (async () => {
      try {
        await restore(entry.archiveId, new AbortController().signal)
        notify(`Restored ${entry.feature}`)
        setArchivedOpen(false)
        closeDialogs()
        await loadSpecs()
        await loadArchived()
        setFeature(entry.feature)
        refreshCompletion()
      } catch (error) {
        notify(`Restore failed: ${errorText(error)}`, 'error')
      }
    })()
  }, [restore, notify, loadSpecs, loadArchived, refreshCompletion, closeDialogs])

  /**
   * Open one start row's inline create form, mirroring the wish composer.
   * Clicking the row that is already open collapses it.
   */
  const openInlineCreate = useCallback((kind: 'spec' | 'quick' | 'bugfix') => {
    if (inlineCreate === kind) {
      setInlineCreate(null)
      return
    }
    const type = kind === 'bugfix' ? 'bugfix' : 'feature'
    setInlineCreate(kind)
    setNewType(type)
    setNewScope('brownfield')
    setNewWorkflow('requirements-first')
    setNewDetail('comprehensive')
    setCreateSkill(kind === 'quick' || kind === 'bugfix' ? 'spec-quick' : 'spec-requirements')
    setCreateError('')
    setWishOpen(false)
    setWishError('')
    setRenaming(false)
    setArchivedOpen(false)
    setPickerOpen(false)
  }, [inlineCreate])

  const createSpec = useCallback(() => {
    const feature = newFeature.trim()
    const problem = featureIdError(feature)
    if (problem !== '') {
      setCreateError(notificationText(problem))
      return
    }
    if (specs.some((entry) => entry.feature === feature)) {
      setCreateError(notificationText(`${feature} already exists.`))
      return
    }
    setCreateError('')
    const workflow = newType === 'bugfix' ? 'bugfix' : newWorkflow
    const detail = newType === 'bugfix' || newWorkflow !== 'design-first' ? 'comprehensive' : newDetail
    const request = newRequest.trim()
    void (async () => {
      try {
        await init(feature, newType, newType === 'bugfix' ? 'brownfield' : newScope, workflow, detail, new AbortController().signal)
      } catch (error) {
        setCreateError(notificationText(`Could not create ${feature}: ${errorText(error)}`))
        return
      }
      const skill = newType === 'bugfix' ? 'spec-bugfix' : createSkill
      const flow = newType === 'bugfix'
        ? 'Write .kaze/' + feature + '/bugfix.md using the bugfix workflow in core/.'
        : createSkill === 'spec-quick'
          ? 'Write .kaze/' + feature + '/requirements.md using the quick workflow in core/.'
          : 'Write .kaze/' + feature + '/requirements.md using the requirements workflow in core/.'
      const fallback = [
        `The Kaze spec "${feature}" is initialized (type: ${newType}, workflow: ${workflow}, design detail: ${detail}).`,
        flow,
        request === '' ? 'Ask me for the feature request before writing content.' : `Feature request: ${request}`,
        `After writing, call \`kaze_spec_validate\` and \`kaze_spec_gate\` for the requirements phase. Do not skip the phase gate.`,
      ].join('\n')
      const payload = skills.includes(skill)
        ? [`/${skill} feature=${feature}`, request === '' ? '' : `Feature request: ${request}`]
            .filter((line) => line !== '')
            .join('\n')
        : fallback
      // Select the new spec immediately: its state exists even before the
      // first document, so the user sees where the agent is writing.
      setFeature(feature)
      setDoc(newType === 'bugfix' ? 'bugfix' : 'requirements')
      sendToChat(payload, `Create ${feature} sent to chat`)
      closeDialogs()
      setNewFeature('')
      setNewRequest('')
      setCreateError('')
      setCreateSkill('spec-requirements')
      await loadSpecs()
    })()
  }, [newFeature, newType, newScope, newWorkflow, newDetail, newRequest, createSkill, specs, init, skills, sendToChat, loadSpecs, closeDialogs])

  const runWishRefinement = useCallback((): void => {
    const wish = wishText.trim()
    if (wish === '') return
    // Without a refinement service the wish still goes to the conversation as
    // `/spec-wish`, so the agent runs the prompt-only refinement there.
    const fallback = (): void => {
      setWishOpen(false)
      setWishError('')
      setStartOpen(false)
      sendToChat(kazeSlash('spec-wish', wish), 'Wish flow sent to chat')
    }
    if (refineWish === undefined || inputActions === undefined) {
      fallback()
      return
    }
    setWishBusy(true)
    setWishError('')
    void (async () => {
      try {
        const refined = await refineWish(wish, new AbortController().signal)
        // The refined prompt is the request half of the `/spec` command line,
        // so the composer carries the invocation marker the agent needs.
        inputActions.setDraft(kazeSlash('spec', refined))
        setWishOpen(false)
        setStartOpen(false)
        setWishText('')
        setWishResult(refined)
      } catch (error) {
        setWishError(`${tr('Wish refinement failed')}: ${errorText(error)}`)
      } finally {
        setWishBusy(false)
      }
    })()
  }, [wishText, refineWish, inputActions, sendToChat, notify])

  const sendReview = useCallback(async () => {
    if (promptText === '') {
      notify('Add at least one open comment first.', 'error')
      return
    }
    if (diskReview && !commentsHydrated) {
      notify('Saved comments are still loading.', 'error')
      return
    }
    if (diskReview) {
      const saved = await flush()
      if (!saved) {
        notify('Review comments could not be saved; nothing was sent.', 'error')
        return
      }
    }
    const quoteArg = (value: string): string => (/\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value)
    const args = `feature=${feature} file=${quoteArg(docPath(feature, doc))} comments=${quoteArg(reviewPath(feature, doc))}`
    sendToChat(
      skills.includes('spec-comments') ? `/spec-comments ${args}` : promptText,
      `Review sent for ${feature}`,
    )
  }, [
    promptText, diskReview, commentsHydrated, flush, notify, feature, doc, docPath, reviewPath,
    skills, sendToChat,
  ])

  const openTimelineForSpec = useCallback(() => {
    if (!hasTimeline()) return
    if (!hasEngine || feature === '') {
      openTimeline()
      return
    }
    void (async () => {
      try {
        await timeline(feature, new AbortController().signal)
      } catch {
        // The native Timeline still opens and can be filled by the agent.
      }
      openTimeline()
    })()
  }, [hasTimeline, hasEngine, feature, timeline, openTimeline])

  const runAll = useCallback(() => {
    if (taskInfo === undefined || taskInfo.ready.length === 0) {
      notify('No ready tasks; check the dependency graph.', 'error')
      return
    }
    // Execution is tracked in DSH's native Timeline; land there before the
    // agent starts so the user watches the real task tree.
    openTimelineForSpec()
    // Execution belongs to a fresh session; hand off instead of injecting
    // `/spec-apply` into the session that created the spec.
    const fallback = actionPrompt('run', feature, { ready: taskInfo.ready })
    const handoff = [
      'Start a new session in this workspace and run:',
      '',
      `\`/spec-apply feature=${feature}\``,
      '',
      'Execution runs in a fresh session so this creation session stays clean.',
    ].join('\n')
    sendToChat(skills.includes('spec-apply') ? handoff : fallback, 'Execution handoff sent to chat')
  }, [taskInfo, feature, sendToChat, notify, skills, openTimelineForSpec])

  const runValidate = useCallback(() => {
    if (!hasEngine || feature === '') {
      sendToChat(
        `Run the Kaze validator for .kaze/${feature} and report every error and warning. Do not edit files unless the user asks; use kaze_spec_validate when available.`,
        'Validation task sent to chat',
      )
      return
    }
    runBusy('validate', async () => {
      try {
        const report = await validate(feature, new AbortController().signal)
        if (report.ok) {
          setValidation(null)
          notify(`Validation passed for ${feature}`)
        } else {
          setValidation({ feature, errors: report.errors, warnings: report.warnings })
          const first = report.errors[0]
          const detail = first === undefined
            ? 'no errors reported'
            : `${first.file === '' ? '' : `${first.file}: `}${first.message}`
          notify(`Validation failed: ${report.errors.length} error(s), ${report.warnings.length} warning(s); ${detail}`, 'error')
        }
        refreshCompletion()
      } catch (error) {
        notify(`Validation failed: ${errorText(error)}`, 'error')
      }
    })
  }, [hasEngine, feature, validate, sendToChat, skills, notify, refreshCompletion, runBusy])

  const runSync = useCallback(() => {
    if (!hasEngine || feature === '') {
      sendToChat(commandLine('spec-sync', `feature=${feature}`, actionPrompt('sync', feature)), 'Sync task sent to chat')
      return
    }
    runBusy('sync', async () => {
      try {
        await sync(feature, new AbortController().signal)
        await loadSpecs()
        await reloadDoc()
        refreshCompletion()
        notify(`${feature} synced`)
      } catch (error) {
        notify(`Sync failed: ${errorText(error)}`, 'error')
      }
    })
  }, [hasEngine, feature, sync, sendToChat, skills, notify, loadSpecs, reloadDoc, refreshCompletion, runBusy])

  const deliveryKind: 'host' | 'agent' = hasEngine && buildDelivery !== undefined && feature !== '' ? 'host' : 'agent'

  const runDelivery = useCallback(() => {
    if (!hasEngine || buildDelivery === undefined || feature === '') {
      const fallback = [
        `Build the Kaze delivery report for .kaze/${feature}.`,
        `Call \`kaze_spec_delivery\` with feature=${feature}, then summarize the gate history, acceptance criteria, and any residual risks.`,
      ].join('\n')
      sendToChat(
        commandLine('spec-delivery', `feature=${feature}`, fallback),
        'Delivery build sent to chat',
      )
      return
    }
    runBusy('delivery', async () => {
      try {
        await buildDelivery(feature, new AbortController().signal)
        notify(`Delivery report built for ${feature}`)
        refreshCompletion()
      } catch (error) {
        notify(`Delivery build failed: ${errorText(error)}`, 'error')
      }
    })
  }, [hasEngine, buildDelivery, feature, sendToChat, skills, notify, refreshCompletion, runBusy])

  const refreshIdle = useCallback(async (signal?: AbortSignal): Promise<void> => {
    if (!hasEngine) {
      setIdle(null)
      return
    }
    try {
      setIdle(await idleCall('status', {}, signal ?? new AbortController().signal))
      setIdleError('')
    } catch (error) {
      setIdleError(errorText(error))
    }
  }, [hasEngine, idleCall])

  useEffect(() => {
    const controller = new AbortController()
    void refreshIdle(controller.signal)
    return () => controller.abort()
  }, [refreshIdle, feature, cwd])

  useEffect(() => {
    if (!hasEngine) return
    const controller = new AbortController()
    void (async () => {
      try {
        const config = await specConfig('get', {}, controller.signal)
        if (config.language === 'en' || config.language === 'zh-CN') {
          // The Kaze menu's `auto` mode follows the workspace spec language, so
          // record it here as soon as the tab reads the config.
          syncKazeCommandLanguage(config.language)
          setSpecLanguage(config.language)
        }
      } catch {
        // Missing config is the normal zh-CN default.
      }
    })()
    return () => controller.abort()
  }, [hasEngine, specConfig, cwd])

  const changeLanguage = useCallback((next: 'zh-CN' | 'en'): void => {
    setSpecLanguage(next)
    syncKazeCommandLanguage(next)
    if (!hasEngine) return
    void (async () => {
      try {
        await specConfig('set', { language: next }, new AbortController().signal)
        notify(next === 'en' ? 'Spec content language: English' : 'Spec content language: 简体中文')
      } catch (error) {
        notify(`Language update failed: ${errorText(error)}`, 'error')
      }
    })()
  }, [hasEngine, specConfig, notify])

  const queueAction = useCallback((action: string, payload: Record<string, unknown>): void => {
    void (async () => {
      try {
        const next = await idleCall(action, payload, new AbortController().signal)
        setIdle(next)
        setIdleError('')
      } catch (error) {
        notify(`Idle queue: ${errorText(error)}`, 'error')
      }
    })()
  }, [idleCall, notify])

  const queueTask = useCallback((task: TaskNode, queued: boolean): void => {
    if (!hasEngine || feature === '') {
      notify('Idle queue requires the native Kaze engine.', 'error')
      return
    }
    const existing = idle?.queue.find((entry) => entry.feature === feature && entry.taskId === task.id)
    if (queued) {
      if (existing !== undefined) return
      queueAction('add', { feature, taskId: task.id, peakCost: idle?.config.defaultPeakCost ?? 0 })
      notify(`Queued ${task.id} for idle time`)
    } else if (existing !== undefined) {
      queueAction('remove', { entryId: existing.id })
      notify(`Removed ${task.id} from the idle queue`)
    }
  }, [hasEngine, feature, idle, queueAction, notify])

  const runIdleQueue = useCallback((): void => {
    if (idle === null || !idle.idle) {
      notify(`Idle window is not active${idle?.nextIdle === null || idle?.nextIdle === undefined ? '' : `; next: ${formatBeijingWhen(idle.nextIdle)}`}.`, 'error')
      return
    }
    if (idle.queue.every((entry) => entry.status !== 'queued' && entry.status !== 'running')) {
      notify('The idle queue has no runnable entries.', 'error')
      return
    }
    openTimelineForSpec()
    sendToChat('/spec-batch --idle --unattended', 'Idle queue sent to chat')
  }, [idle, notify, sendToChat, openTimelineForSpec])

  const runAdvanceDone = useCallback(() => {
    if (!hasEngine || feature === '') {
      sendToChat(
        `Complete .kaze/${feature}: verify acceptance, run FTA, then call kaze_spec_advance to=done and kaze_spec_delivery.`,
        'Completion task sent to chat',
      )
      return
    }
    runBusy('complete', async () => {
      try {
        const result = await advance(feature, 'done', new AbortController().signal)
        if (!result.ok) {
          const where = result.failedAt === undefined ? '' : ` (${result.failedAt})`
          notify(`Cannot complete ${feature}${where}: ${result.errors.join('; ') || 'gate failed'}`, 'error')
          return
        }
        await loadSpecs()
        refreshCompletion()
        notify(`${feature} advanced to done`)
      } catch (error) {
        notify(`Could not complete ${feature}: ${errorText(error)}`, 'error')
      }
    })
  }, [hasEngine, feature, advance, loadSpecs, refreshCompletion, notify, sendToChat, runBusy])

  const runCompletionAction = useCallback((action: CompletionAction) => {
    const hint = `${action.id} ${action.command}`.toLowerCase()
    if (action.kind === 'host') {
      if (hint.includes('advance') || hint.includes('done')) {
        runAdvanceDone()
        return
      }
      if (hint.includes('delivery')) {
        runDelivery()
        return
      }
      if (hint.includes('archive')) {
        archiveCurrent()
        return
      }
      if (hint.includes('validate')) {
        runValidate()
        return
      }
      if (hint.includes('sync')) {
        runSync()
        return
      }
    }
    if (action.command.trim() !== '') {
      // The completion panel's Apply action is task execution too.
      if (action.id === 'apply') openTimelineForSpec()
      sendToChat(action.command, `${actionText(action.id, action.label)} sent to chat`)
      if (action.kind === 'host') notify(`${action.id} has no tab action; the agent will run it.`)
      return
    }
    notify(`No action available for ${actionText(action.id, action.label)}.`, 'error')
  }, [runDelivery, runAdvanceDone, archiveCurrent, runValidate, runSync, sendToChat, notify, openTimelineForSpec])

  const filteredSpecs = useMemo(() => {
    const needle = pickerFilter.trim().toLowerCase()
    if (needle === '') return specs
    return specs.filter((entry) => entry.feature.toLowerCase().includes(needle))
  }, [specs, pickerFilter])

  const filteredArchived = useMemo(() => {
    const needle = pickerFilter.trim().toLowerCase()
    if (needle === '') return archived
    return archived.filter((entry) =>
      entry.feature.toLowerCase().includes(needle) || entry.archiveId.toLowerCase().includes(needle),
    )
  }, [archived, pickerFilter])

  const selectSpec = useCallback((entry: SpecSummary) => {
    setFeature(entry.feature)
    setDoc(entry.docs.includes(doc) ? doc : entry.docs[0] ?? 'requirements')
    setPromptOpen(false)
    closeDialogs()
  }, [doc, closeDialogs])

  const pickerEntries = useMemo<readonly { key: string; run: () => void }[]>(() => {
    if (!pickerOpen || archivedOpen) return []
    return filteredSpecs.map((entry) => ({ key: entry.feature, run: () => selectSpec(entry) }))
  }, [pickerOpen, archivedOpen, filteredSpecs, selectSpec])

  useEffect(() => {
    setPickerIndex(-1)
  }, [pickerFilter, archivedOpen, pickerOpen])

  // A filter belongs to one picker session; keeping it after a selection hides
  // every other spec the next time the picker opens.
  useEffect(() => {
    if (!pickerOpen) setPickerFilter('')
  }, [pickerOpen])

  useEffect(() => {
    setArchiveArmed(false)
  }, [feature])

  useEffect(() => {
    if (!pickerOpen || pickerIndex < 0) return
    pickerRef.current?.querySelector('[data-picker-active]')?.scrollIntoView({ block: 'nearest' })
  }, [pickerOpen, pickerIndex])

  const handlePickerKey = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    const count = pickerEntries.length
    if (event.key === 'Escape') {
      setPickerOpen(false)
      return
    }
    if (count === 0) return
    if (event.key === 'Enter') {
      event.preventDefault()
      pickerEntries[pickerIndex >= 0 ? Math.min(pickerIndex, count - 1) : 0]?.run()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    setPickerIndex((previous) => {
      if (event.key === 'Home') return 0
      if (event.key === 'End') return count - 1
      if (previous < 0) return event.key === 'ArrowDown' ? 0 : count - 1
      return (previous + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
    })
  }

  const commentsForBlock = useCallback(
    (block: { start: number; end: number }): ReviewComment[] =>
      comments.filter((comment) => comment.sourceLines.start >= block.start && comment.sourceLines.start <= block.end),
    [comments],
  )

  const anchoredIds = useMemo(() => {
    const ids = new Set<string>()
    for (const comment of comments) {
      if (blocks.some((block) => comment.sourceLines.start >= block.start && comment.sourceLines.start <= block.end)) {
        ids.add(comment.id)
      }
    }
    return ids
  }, [comments, blocks])
  const orphanComments = useMemo(() => comments.filter((comment) => !anchoredIds.has(comment.id)), [comments, anchoredIds])

  const renderComment = useCallback(
    (comment: ReviewComment): ReactNode => (
      <CommentCard
        key={comment.id}
        comment={comment}
        number={openOrdinal.get(comment.id) ?? 0}
        editing={editingId === comment.id}
        draft={editDraft}
        onDraft={setEditDraft}
        onEdit={() => {
          setEditingId(comment.id)
          setEditDraft(comment.reviewerNote)
        }}
        onSave={saveEdit}
        onCancel={() => {
          setEditingId(null)
          setEditDraft('')
        }}
        onJump={() => jumpTo(comment)}
        onResolve={() => {
          mutateComments((previous) =>
            previous.map((entry) => (entry.id === comment.id ? { ...entry, resolved: entry.resolved !== true } : entry)),
          )
        }}
        onDelete={() => {
          const index = comments.findIndex((entry) => entry.id === comment.id)
          const removed = comments[index]
          if (removed === undefined) return
          mutateComments((previous) => previous.filter((entry) => entry.id !== comment.id))
          if (editingId === comment.id) setEditingId(null)
          const undo = () => {
            setComments((previous) => {
              const next = [...previous]
              next.splice(Math.min(index, next.length), 0, removed)
              return next
            })
            notify('Comment restored')
          }
          lastCommentUndo.current = undo
          notify('Comment deleted', 'info', undo)
        }}
      />
    ),
    [comments, editingId, editDraft, saveEdit, jumpTo, mutateComments],
  )

  const resolveImage = useCallback((src: string): string | undefined => {
    if (/^(?:https?:|blob:|data:image\/)/i.test(src)) return src
    if (/^[a-zA-Z]:[\\/]/.test(src)) {
      return new URL(`api/file?path=${encodeURIComponent(src.replace(/\\/g, '/'))}`, document.baseURI).href
    }
    if (/^[a-z][\w+.-]*:/i.test(src)) return undefined
    try {
      const baseDirectory = expectedPath.slice(0, expectedPath.lastIndexOf('/'))
      const posix = baseDirectory.replace(/\\/g, '/')
      const base = new URL(`file://${posix.startsWith('/') ? '' : '/'}${posix}/`)
      const resolved = new URL(src, base)
      let path = decodeURIComponent(resolved.pathname)
      if (path.startsWith('/') && !posix.startsWith('/')) path = path.slice(1)
      return new URL(`api/file?path=${encodeURIComponent(path)}`, document.baseURI).href
    } catch {
      return undefined
    }
  }, [expectedPath])

  const commentComposer = composer !== null && (
    <div className="kaze-composer">
      <div className="kaze-composer-head">
        <Comment size={12} />
        <span>
          {composer.mode === 'refine' ? tr('Refine section') : composer.section || tr('Document')}
          <span className="kaze-count">
            {' · '}
            {composer.anchor.start === composer.anchor.end
              ? `line ${composer.anchor.start}`
              : `lines ${composer.anchor.start}–${composer.anchor.end}`}
          </span>
        </span>
      </div>
      {composer.quote !== '' && <div className="kaze-comment-quote">{composer.quote}</div>}
      <textarea
        className="kaze-textarea"
        autoFocus
        rows={3}
        placeholder={composer.mode === 'refine' ? tr('How should this section change?') : tr('What should change here?')}
        value={composer.note}
        onChange={(event) => setComposer({ ...composer, note: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setComposer(null)
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            if (composer.mode === 'refine') applyRefine()
            else addComment()
          }
        }}
      />
      <div className="kaze-composer-actions">
        <button type="button" className="kaze-btn" data-variant="primary" onClick={composer.mode === 'refine' ? applyRefine : addComment} disabled={composer.note.trim() === ''}>
          {composer.mode === 'refine' ? tr('Refine') : tr('Add comment')}
        </button>
        <button type="button" className="kaze-btn" onClick={() => setComposer(null)}>{tr('Cancel')}</button>
        <span className="kaze-hint">⌘/Ctrl+Enter</span>
      </div>
    </div>
  )

  const startCommentForBlock = useCallback((block: MarkdownBlock) => {
    startComment({ start: block.start, end: block.end })
  }, [startComment])
  const isBlockCommented = useCallback(
    (block: MarkdownBlock) => comments.some((comment) => comment.sourceLines.start >= block.start && comment.sourceLines.start <= block.end),
    [comments],
  )
  const openImage = useCallback((src: string, alt: string) => setLightbox({ src, alt }), [])
  const openDocLink = useCallback((href: string) => {
    const docMatch = /(?:^|\/)([A-Za-z0-9._-]+)\.md(?:#.*)?$/.exec(href)
    const targetDoc = docMatch?.[1]
    if (targetDoc !== undefined && isDocName(targetDoc) && spec?.docs.includes(targetDoc)) {
      setDoc(targetDoc)
      return
    }
    const specMatch = SPEC_DOC_LINK.exec(href)
    if (specMatch !== null && isDocName(specMatch[2]!)) {
      const targetSpec = specs.find((entry) => entry.feature === specMatch[1] && entry.docs.includes(specMatch[2] as DocName))
      if (targetSpec !== undefined) {
        setFeature(targetSpec.feature)
        setDoc(specMatch[2] as DocName)
        return
      }
    }
    if (/^https?:/i.test(href)) window.open(href, '_blank', 'noopener')
  }, [spec, specs])

  const renderAfterBlock = useCallback((block: MarkdownBlock) => (
    <>
      {commentsForBlock(block).map(renderComment)}
      {composer !== null && composer.anchor.start >= block.start && composer.anchor.start <= block.end && commentComposer}
    </>
  ), [commentsForBlock, composer, commentComposer, renderComment])

  const preview = (
    <MarkdownView
      blocks={blocks}
      query={findOpen ? findQuery : ''}
      onCommentBlock={reviewMode ? startCommentForBlock : undefined}
      isCommented={isBlockCommented}
      resolveImage={resolveImage}
      onOpenImage={openImage}
      onOpenLink={openDocLink}
      renderAfter={renderAfterBlock}
    />
  )

  const source = (
    <div
      className="kaze-source"
      tabIndex={0}
      role="region"
      aria-label={tr('Document source')}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setActiveLine((line) => Math.min(lines.length, line + 1))
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setActiveLine((line) => Math.max(1, line - 1))
        } else if (event.key === 'Enter' && reviewMode) {
          event.preventDefault()
          startComment({ start: activeLine, end: activeLine })
        }
      }}
    >
      {lines.map((line, index) => {
        const number = index + 1
        const lineComments = comments.filter((comment) => Math.min(comment.sourceLines.end, lines.length) === number)
        return (
          <Fragment key={number}>
            <span
              className="kaze-line"
              data-line={number}
              data-hit={hitLines.has(number) || undefined}
              data-current={number === activeLine || undefined}
              data-anchor={anchoredLines.has(number) || undefined}
              data-tone={lineTone(line)}
              onClick={() => setActiveLine(number)}
            >
              {reviewMode && (
                <button
                  type="button"
                  className="kaze-line-add"
                  title={`${tr('Comment')} · ${lineText(number)}`}
                  aria-label={`${tr('Comment')} · ${lineText(number)}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    startComment({ start: number, end: number })
                  }}
                >
                  +
                </button>
              )}
              <span className="kaze-ln">{number}</span>
              <span>{line === '' ? ' ' : line}</span>
            </span>
            {lineComments.map(renderComment)}
            {composer !== null && composer.anchor.start === number && commentComposer}
          </Fragment>
        )
      })}
    </div>
  )

  const diffView = (
    <div className="kaze-diff">
      <div className="kaze-diff-bar">
        <strong>{tr('Changes since opened')}</strong>
        <span className="kaze-badge" data-tone="ok">+{diffAdded}</span>
        <span className="kaze-badge" data-tone="warn">−{diffRemoved}</span>
        <span className="kaze-spacer" />
        {nativeChange !== null && (
          <button
            type="button"
            className="kaze-btn"
            title={tr("Open DeepSeek Harness's native changed-files review for this turn")}
            onClick={() => openNativeChange(nativeChange)}
          >
            <ArrowRight size={11} /> {tr('Turn')} {nativeChange.turn} · {nativeChange.total} {tr('files')}
          </button>
        )}
        <button
          type="button"
          className="kaze-btn"
          disabled={currentDoc === null || baselineKey === ''}
          onClick={() => {
            if (currentDoc === null || baselineKey === '') return
            baselines.current.set(baselineKey, currentDoc.text)
            setBaseline(currentDoc.text)
            notify('Baseline updated')
          }}
        >
          {tr('Set baseline')}
        </button>
      </div>
      {currentDoc === null ? (
        <div className="kaze-empty">{tr('Loading document…')}</div>
      ) : diffRows.every((row) => row.kind === 'equal') ? (
        <div className="kaze-empty">
          <strong>{tr('No changes')}</strong>
          <span>{tr('The working copy matches the baseline taken when this document was opened.')}</span>
        </div>
      ) : (
        <div className="kaze-diff-grid">
          <div className="kaze-diff-heads">
            <span>{tr('Baseline')}</span>
            <span>{tr('Working copy')}</span>
          </div>
          {diffRows.map((row, index) => (
            <div className="kaze-diff-row" data-kind={row.kind} key={`d${index}`}>
              <div
                className="kaze-diff-cell kaze-diff-left"
                data-left-line={row.left?.no}
                data-kind={row.kind}
              >
                <span className="kaze-diff-no">{row.left?.no ?? ''}</span>
                <span className="kaze-diff-text">{row.left?.text ?? ''}</span>
              </div>
              <div
                className="kaze-diff-cell kaze-diff-right"
                data-right-line={row.right?.no}
                data-kind={row.kind}
              >
                <span className="kaze-diff-no">{row.right?.no ?? ''}</span>
                <span className="kaze-diff-text">{row.right?.text ?? ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderValidationIssue = (
    issue: { readonly file: string; readonly message: string },
    severity: 'error' | 'warning',
    index: number,
  ): ReactNode => {
    const target = issueDoc(issue.file)
    const name = issue.file.replace(/\\/g, '/').split('/').pop() ?? ''
    const body = (
      <>
        <span className="kaze-validation-file" title={issue.file}>{name === '' ? 'spec' : name}</span>
        <span className="kaze-validation-msg">{issue.message}</span>
      </>
    )
    const key = `${severity}-${index}-${issue.file}`
    if (target === undefined || !docAvailability(spec, target)) {
      return <div key={key} className="kaze-validation-item" data-severity={severity}>{body}</div>
    }
    return (
      <button
        key={key}
        type="button"
        className="kaze-validation-item"
        data-severity={severity}
        title={`Open ${docNameText(target)} at this issue`}
        onClick={() => focusValidationIssue(issue)}
      >
        {body}
      </button>
    )
  }

  /** Inline create form for one start row; the row itself decides type and flow. */
  const renderCreateInline = (): ReactNode => (
    <div className="kaze-wish-inline kaze-create-inline">
      <input
        autoFocus
        value={newFeature}
        placeholder="user-auth"
        aria-label={tr('Feature name')}
        onChange={(event) => {
          setNewFeature(event.target.value)
          setCreateError('')
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') createSpec()
        }}
      />
      <textarea
        rows={2}
        value={newRequest}
        placeholder={tr('Optional: describe what this spec builds')}
        aria-label={tr('Feature request (optional)')}
        onChange={(event) => setNewRequest(event.target.value)}
      />
      {newType === 'feature' && (
        <>
          <div className="kaze-choice" role="radiogroup" aria-label={tr('Scope')}>
            <button
              type="button"
              role="radio"
              aria-checked={newScope === 'brownfield'}
              data-selected={newScope === 'brownfield' || undefined}
              onClick={() => setNewScope('brownfield')}
            >
              {scopeText('brownfield')}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={newScope === 'greenfield'}
              data-selected={newScope === 'greenfield' || undefined}
              onClick={() => setNewScope('greenfield')}
            >
              {scopeText('greenfield')}
            </button>
          </div>
          <div className="kaze-choice" role="radiogroup" aria-label={tr('Workflow route')}>
            {(['requirements-first', 'design-first', 'verify-first'] as const).map((route) => (
              <button
                key={route}
                type="button"
                role="radio"
                aria-checked={newWorkflow === route}
                data-selected={newWorkflow === route || undefined}
                onClick={() => setNewWorkflow(route)}
              >
                {workflowText(route)}
              </button>
            ))}
          </div>
          {newWorkflow === 'design-first' && (
            <div className="kaze-choice" role="radiogroup" aria-label={tr('Design detail')}>
              {(['comprehensive', 'high', 'low'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={newDetail === level}
                  data-selected={newDetail === level || undefined}
                  onClick={() => setNewDetail(level)}
                >
                  {detailText(level)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {createError === '' ? null : <p className="kaze-wish-error" role="alert">{createError}</p>}
      <div className="kaze-wish-actions">
        <button
          type="button"
          className="kaze-btn"
          data-variant="ghost"
          onClick={() => {
            setInlineCreate(null)
            setCreateError('')
          }}
        >
          {tr('Cancel')}
        </button>
        <span className="kaze-spacer" />
        <button type="button" className="kaze-btn" data-variant="primary" onClick={createSpec}>
          <Plus size={11} /> {tr('Create')}
        </button>
      </div>
    </div>
  )

  /** The four start choices, shared by the empty start card and the header dialog. */
  const renderQuickStart = (): ReactNode => (
            <div className="kaze-start-list" role="group" aria-label={tr('Start')}>
              <button
                type="button"
                className="kaze-start-row"
                data-open={wishOpen || undefined}
                aria-expanded={wishOpen}
                onClick={() => {
                  setWishOpen((open) => !open)
                  setWishError('')
                  setInlineCreate(null)
                  setCreateError('')
                }}
              >
                <Spark size={14} />
                <span className="kaze-start-text">
                  <span className="kaze-start-title">{tr('Start Wish')}</span>
                  <span className="kaze-start-desc">{tr('Turn a vague wish into a ready-to-use prompt.')}</span>
                </span>
                <span className="kaze-start-badges">{tr('Wish → Prompt')}</span>
              </button>
              {wishOpen && (
                <div className="kaze-wish-inline">
                  <textarea
                    autoFocus
                    rows={3}
                    value={wishText}
                    disabled={wishBusy}
                    placeholder={tr('For example: add a login page with email and password')}
                    aria-label={tr('Describe your wish')}
                    onChange={(event) => { setWishText(event.target.value) }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault()
                        runWishRefinement()
                      }
                    }}
                  />
                  {wishError === '' ? null : <p className="kaze-wish-error" role="alert">{wishError}</p>}
                  <div className="kaze-wish-actions">
                    <button
                      type="button"
                      className="kaze-btn"
                      data-variant="ghost"
                      onClick={() => {
                        setWishOpen(false)
                        setWishError('')
                      }}
                    >
                      {tr('Cancel')}
                    </button>
                    <span className="kaze-spacer" />
                    <button
                      type="button"
                      className="kaze-btn"
                      data-variant="ghost"
                      disabled={wishBusy || wishText.trim() === ''}
                      onClick={() => {
                        setWishOpen(false)
                        setWishError('')
                        setStartOpen(false)
                        // Sending the raw wish runs the prompt-only pass; only a
                        // refined result converges on `/spec`.
                        sendToChat(kazeSlash('spec-wish', wishText.trim()), 'Wish flow sent to chat')
                      }}
                    >
                      {tr('Send to chat')}
                    </button>
                    <button
                      type="button"
                      className="kaze-btn"
                      data-variant="primary"
                      disabled={wishBusy || wishText.trim() === ''}
                      onClick={runWishRefinement}
                    >
                      {wishBusy ? tr('Wishing…') : tr('Wish')}
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="kaze-start-row"
                data-open={inlineCreate === 'spec' || undefined}
                aria-expanded={inlineCreate === 'spec'}
                onClick={() => openInlineCreate('spec')}
              >
                <Doc size={14} />
                <span className="kaze-start-text">
                  <span className="kaze-start-title">{tr('New Spec')}</span>
                  <span className="kaze-start-desc">{tr('Start from requirements and pass each phase gate.')}</span>
                </span>
                <span className="kaze-start-badges">{tr('Requirements → Design → Tasks')}</span>
              </button>
              {inlineCreate === 'spec' && renderCreateInline()}
              <button
                type="button"
                className="kaze-start-row"
                data-open={inlineCreate === 'quick' || undefined}
                aria-expanded={inlineCreate === 'quick'}
                onClick={() => openInlineCreate('quick')}
              >
                <Play size={14} />
                <span className="kaze-start-text">
                  <span className="kaze-start-title">{tr('Quick Spec')}</span>
                  <span className="kaze-start-desc">{tr('One idea, smallest flow to a working spec.')}</span>
                </span>
                <span className="kaze-start-badges">{tr('Idea → Requirements')}</span>
              </button>
              {inlineCreate === 'quick' && renderCreateInline()}
              <button
                type="button"
                className="kaze-start-row"
                data-open={inlineCreate === 'bugfix' || undefined}
                aria-expanded={inlineCreate === 'bugfix'}
                onClick={() => openInlineCreate('bugfix')}
              >
                <Shield size={14} />
                <span className="kaze-start-text">
                  <span className="kaze-start-title">{tr('New Bugfix')}</span>
                  <span className="kaze-start-desc">{tr('Reproduce first, then fix and verify.')}</span>
                </span>
                <span className="kaze-start-badges">{tr('Reproduce → Fix → Verify')}</span>
              </button>
              {inlineCreate === 'bugfix' && renderCreateInline()}
            </div>
  )

  return (
    <div className="kaze-root" data-kaze-spec="root">
      <div className="kaze-head">
        <div className="kaze-head-main">
          <h2 title={cwd}>
            {projectName === '' ? tr('No workspace selected') : projectName}
          </h2>
          <div className="kaze-sub" title={cwd}>
            {spec === undefined
              ? cwd ?? ''
              : `${spec.specType === 'bugfix' ? '缺陷' : 'Spec'} · ${phaseText(spec.phase)} · ${workflowText(spec.workflow)}${spec.designDetail === undefined || spec.designDetail === '' ? '' : ` · ${detailText(spec.designDetail)}`}${spec.capability === undefined || spec.capability === '' ? '' : ` · @${spec.capability}`}${spec.analysis === true ? ` · ${tr('analysis')}` : ''}${completionSummary === null || completionSummary.scope === '' ? '' : ` · ${scopeText(completionSummary.scope)}`}${spec.updatedAt === '' ? '' : ` · ${relativeText(spec.updatedAt)}`}`}
          </div>
        </div>
        {spec !== undefined && (
          <button
            type="button"
            className="kaze-iconbtn"
            title={tr('Start a new spec')}
            aria-label={tr('Start a new spec')}
            onClick={() => {
              setPickerOpen(false)
              setRenaming(false)
              setWishOpen(false)
              setWishError('')
              setInlineCreate(null)
              setCreateError('')
              setStartOpen(true)
            }}
          >
            <Plus size={13} />
          </button>
        )}
        {spec !== undefined && (
          <button
            type="button"
            className="kaze-iconbtn"
            title={tr('Rename this spec')}
            aria-label={tr('Rename this spec')}
            onClick={() => {
              setPickerOpen(false)
              setRenaming(true)
              setRenameTo(spec.feature)
            }}
          >
            <Edit size={12} />
          </button>
        )}
        {spec !== undefined && spec.phase === 'done' && (
          <button
            type="button"
            className="kaze-iconbtn"
            title={tr('Archive this completed spec')}
            aria-label={tr('Archive this completed spec')}
            data-kind="host"
            onClick={archiveCurrent}
          >
            <Archive size={12} />
          </button>
        )}
        <button
          type="button"
          className="kaze-iconbtn"
          data-spin={specsLoading || docLoading || undefined}
          title={tr('Refresh specs and document')}
          aria-label={tr('Refresh')}
          onClick={() => {
            void loadSpecs()
            void reloadDoc({ quiet: true })
            void reloadComments()
          }}
        >
          <Refresh />
        </button>
        <select
          className="kaze-lang"
          value={specLanguage}
          aria-label={tr('Spec content language')}
          title={tr('Spec content language')}
          onChange={(event) => changeLanguage(event.target.value === 'en' ? 'en' : 'zh-CN')}
        >
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
        </select>
      </div>

      {specsError !== '' && (
        <div className="kaze-notice" data-tone="error">
          {tr('Could not read')} <code>.kaze</code>：{specsError}
          <div className="kaze-notice-actions">
            <button type="button" className="kaze-btn" onClick={() => void loadSpecs()}>{tr('Retry')}</button>
          </div>
        </div>
      )}

      {specsTruncated && (
        <div className="kaze-notice" role="status">
          {tr('The spec list is incomplete; too many entries.')}
          <div className="kaze-notice-actions">
            <button type="button" className="kaze-btn" onClick={() => void loadSpecs()}>{tr('Retry')}</button>
          </div>
        </div>
      )}

      <div className="kaze-picker">
        <button
          type="button"
          className="kaze-picker-trigger"
          onClick={() => {
            if (pickerOpen) {
              setPickerOpen(false)
              return
            }
            setArchivedOpen(false)
            setRenaming(false)
            setPickerOpen(true)
          }}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          <Doc size={13} />
          <span className="kaze-name">{feature === '' ? (specsLoading ? tr('Loading specs…') : tr('Select a spec')) : feature}</span>
          {spec !== undefined && spec.phase !== '' && (
            <span className="kaze-badge" data-tone={phaseTone(spec.phase)}>{phaseText(spec.phase)}</span>
          )}
          <span className="kaze-chev"><ChevronDown size={12} /></span>
        </button>
      </div>

      {pickerOpen && (
        <div className="kaze-dialog-layer">
          <div
            className="kaze-dialog-backdrop"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setPickerOpen(false)
            }}
          />
          <div className="kaze-dialog" role="dialog" aria-modal="true" aria-label={archivedOpen ? tr('Archived') : tr('Select a spec')}>
            <div className="kaze-dialog-head">
              {archivedOpen && (
                <button
                  type="button"
                  className="kaze-iconbtn"
                  title={tr('Back to active specs')}
                  aria-label={tr('Back to active specs')}
                  onClick={() => setArchivedOpen(false)}
                >
                  <ChevronLeft size={12} />
                </button>
              )}
              <strong>{archivedOpen ? tr('Archived') : tr('Select a spec')}</strong>
              <span className="kaze-spacer" />
              {!archivedOpen && (
                <button
                  type="button"
                  className="kaze-iconbtn"
                  title={archived.length === 0 ? tr('Archived') : `${tr('Archived')} (${archived.length})`}
                  aria-label={tr('Archived')}
                  onClick={() => setArchivedOpen(true)}
                >
                  <Archive size={12} />
                </button>
              )}
              <button type="button" className="kaze-iconbtn" title={tr('Close')} aria-label={tr('Close')} onClick={() => setPickerOpen(false)}>
                <Close size={12} />
              </button>
            </div>
            <div className="kaze-dialog-body">
              <input
                autoFocus
                value={pickerFilter}
                placeholder={archivedOpen ? tr('Filter archived specs') : tr('Filter specs')}
                aria-label={archivedOpen ? tr('Filter archived specs') : tr('Filter specs')}
                aria-controls="kaze-spec-picker-list"
                onChange={(event) => setPickerFilter(event.target.value)}
                onKeyDown={handlePickerKey}
              />
              <div className="kaze-menu-list" id="kaze-spec-picker-list" role={archivedOpen ? 'list' : 'listbox'} ref={pickerRef}>
                {archivedOpen ? (
                  <>
                    {filteredArchived.length === 0 && (archivedError === ''
                      ? <div className="kaze-dialog-empty">{archived.length === 0 ? tr('No archived specs.') : tr('No matching specs.')}</div>
                      : (
                        <div className="kaze-notice" data-tone="error">
                          {tr('Could not read archived specs.')}
                          <div className="kaze-notice-actions">
                            <button type="button" className="kaze-btn" onClick={() => void loadArchived()}>{tr('Retry')}</button>
                          </div>
                        </div>
                      ))}
                    {filteredArchived.map((entry) => (
                      <div key={entry.archiveId} className="kaze-spec-row" data-archived role="listitem">
                        <span className="kaze-name" title={entry.feature}>{entry.feature}</span>
                        <span className="kaze-spec-date" title={entry.archiveId}>{dateText(entry.archivedAt) || entry.archiveId}</span>
                        <button
                          type="button"
                          className="kaze-btn"
                          title={`${tr('Restore')} ${entry.feature}`}
                          onClick={() => restoreArchived(entry)}
                        >
                          {tr('Restore')}
                        </button>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {filteredSpecs.length === 0 && (
                      <div className="kaze-dialog-empty">{specs.length === 0 ? tr('No specs yet') : tr('No matching specs.')}</div>
                    )}
                    {filteredSpecs.map((entry, index) => (
                      <button
                        key={entry.feature}
                        type="button"
                        role="option"
                        aria-selected={entry.feature === feature}
                        className="kaze-spec-row"
                        data-active={entry.feature === feature || undefined}
                        data-picker-active={index === pickerIndex || undefined}
                        onMouseEnter={() => setPickerIndex(index)}
                        onClick={() => selectSpec(entry)}
                      >
                        <span className="kaze-name">{entry.feature}</span>
                        {entry.error !== undefined && (
                          <span className="kaze-badge" data-tone="danger" title={entry.error}>{tr('needs repair')}</span>
                        )}
                        {entry.updatedAt !== '' && (
                          <span className="kaze-spec-date" title={entry.updatedAt}>{dateText(entry.updatedAt)}</span>
                        )}
                        <span className="kaze-meta">{entry.phase === '' ? `${entry.docs.length} ${tr('docs')}` : phaseText(entry.phase)}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
            {!archivedOpen && (
              <div className="kaze-dialog-foot">
                <span className="kaze-spacer" />
                <button
                  type="button"
                  className="kaze-btn"
                  data-variant="primary"
                  onClick={() => {
                    setPickerOpen(false)
                    setArchivedOpen(false)
                    if (inlineCreate !== 'spec') openInlineCreate('spec')
                    if (feature !== '') setStartOpen(true)
                  }}
                >
                  <Plus size={11} /> {tr('New spec')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {startOpen && (
        <div className="kaze-dialog-layer">
          <div
            className="kaze-dialog-backdrop"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) closeStart()
            }}
          />
          <div className="kaze-dialog" role="dialog" aria-modal="true" aria-label={tr('Start')}>
            <div className="kaze-dialog-head">
              <strong>{tr('Start')}</strong>
              <button type="button" className="kaze-iconbtn" title={tr('Close')} aria-label={tr('Close')} onClick={closeStart}>
                <Close size={12} />
              </button>
            </div>
            <div className="kaze-dialog-body">
              {cwd === undefined
                ? <div className="kaze-notice">{tr('Open a workspace session to use Kaze.')}</div>
                : renderQuickStart()}
            </div>
          </div>
        </div>
      )}

      {wishResult !== null && (
        <div className="kaze-dialog-layer">
          <div
            className="kaze-dialog-backdrop"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setWishResult(null)
            }}
          />
          <div className="kaze-dialog" role="dialog" aria-modal="true" aria-label={tr('Prompt ready')}>
            <div className="kaze-dialog-head">
              <strong>{tr('Prompt ready')}</strong>
              <button type="button" className="kaze-iconbtn" title={tr('Close')} aria-label={tr('Close')} onClick={() => setWishResult(null)}>
                <Close size={12} />
              </button>
            </div>
            <div className="kaze-dialog-body">
              <p className="kaze-dialog-note">{tr('The prompt is filled in as /spec. Pick a route, or keep refining.')}</p>
              <div className="kaze-start-list" role="group" aria-label={tr('Choose a route')}>
                <button
                  type="button"
                  className="kaze-start-row"
                  onClick={() => {
                    const next = wishResult ?? ''
                    setWishResult(null)
                    setWishText(next)
                    setWishError('')
                    setWishOpen(true)
                    if (feature !== '') setStartOpen(true)
                  }}
                >
                  <Edit size={14} />
                  <span className="kaze-start-text">
                    <span className="kaze-start-title">{tr('Keep refining')}</span>
                    <span className="kaze-start-desc">{tr('Add more detail, then refine again.')}</span>
                  </span>
                </button>
                {WISH_ROUTES.map((route) => (
                  <button
                    key={route.id}
                    type="button"
                    className="kaze-start-row"
                    data-route={route.id}
                    onClick={() => {
                      const refined = wishResult ?? ''
                      setWishResult(null)
                      if (refined === '' || inputActions === undefined) return
                      // Swap only the slash token: the refined body stays the
                      // request, so switching route never loses the wording.
                      inputActions.setDraft(kazeSlash(route.id, refined))
                      notify(`Filled ${route.badge} into the chat box`)
                    }}
                  >
                    {route.id === 'spec-quick' ? <Play size={14} /> : route.id === 'spec-flow' ? <ArrowRight size={14} /> : <Doc size={14} />}
                    <span className="kaze-start-text">
                      <span className="kaze-start-title">{tr(route.title)}</span>
                      <span className="kaze-start-desc">{tr(route.description)}</span>
                    </span>
                    <span className="kaze-start-badges">{route.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {renaming && (
        <div className="kaze-dialog-layer">
          <div
            className="kaze-dialog-backdrop"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) closeDialogs()
            }}
          />
          <div className="kaze-dialog" role="dialog" aria-modal="true" aria-label={tr('Rename')}>
            <div className="kaze-dialog-head">
              <strong>{tr('Rename')} {feature}</strong>
              <button type="button" className="kaze-iconbtn" title={tr('Close')} aria-label={tr('Close')} onClick={closeDialogs}>
                <Close size={12} />
              </button>
            </div>
            <div className="kaze-dialog-body kaze-form">
              <label>
                {tr('New feature name')}
                <input
                  autoFocus
                  value={renameTo}
                  placeholder="new-feature-name"
                  aria-label={tr('New feature name')}
                  onChange={(event) => setRenameTo(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') renameSpec()
                  }}
                />
              </label>
              <p className="kaze-dialog-note">
                {tr("The agent moves the directory, updates the spec's own path references, and validates the result.")}
              </p>
            </div>
            <div className="kaze-dialog-foot">
              <button type="button" className="kaze-btn" onClick={closeDialogs}>{tr('Cancel')}</button>
              <button type="button" className="kaze-btn" data-variant="primary" onClick={renameSpec}>
                <Edit size={11} /> {tr('Rename')}
              </button>
            </div>
          </div>
        </div>
      )}

      {spec !== undefined && (
        <div className="kaze-phases" role="list" aria-label={tr('Spec phase')}>
          {SPEC_PHASES.map((phase, index) => {
            const state = index < phaseIndex ? 'done' : index === phaseIndex ? 'current' : 'pending'
            return (
              <div key={phase} className="kaze-phase" role="listitem" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="kaze-phase-dot" />
                <span className="kaze-phase-label">{phaseText(phase)}</span>
              </div>
            )
          })}
        </div>
      )}

      {feature === '' ? (
        <div className="kaze-empty kaze-start">
          <div className="kaze-start-head">
            <strong>{specsLoading ? tr('Looking for specs…') : tr('No specs yet')}</strong>
            <span>
              {cwd === undefined
                ? tr('Open a workspace session to use Kaze.')
                : tr('Pick a way to start, or ask the agent to draft one.')}
            </span>
          </div>
          {!specsLoading && cwd !== undefined && renderQuickStart()}
        </div>
      ) : (
        <>
          <div className="kaze-doc-tabs">
            <div className="kaze-seg" role="tablist" aria-label={tr('Spec documents')}>
              {docOrder.map((candidate) => {
                const available = docAvailability(spec, candidate)
                return (
                  <button
                    key={candidate}
                    id={`kaze-doc-tab-${candidate}`}
                    type="button"
                    role="tab"
                    aria-selected={doc === candidate}
                    aria-controls="kaze-doc-panel"
                    tabIndex={doc === candidate ? 0 : -1}
                    className="kaze-tab"
                    data-active={doc === candidate || undefined}
                    data-missing={!available || undefined}
                    title={available ? DOC_LABEL[candidate] : `${DOC_LABEL[candidate]} — not created yet`}
                    disabled={!available}
                    onClick={() => {
                      setDoc(candidate)
                    }}
                  >
                    {docShortText(candidate)}
                    {(docCounts[candidate] ?? 0) > 0 && <span className="kaze-tab-count">{docCounts[candidate]}</span>}
                  </button>
                )
              })}
            </div>
            <div className="kaze-nav">
              <button
                type="button"
                className="kaze-iconbtn"
                title={tr('Previous document')}
                aria-label={tr('Previous document')}
                onClick={() => {
                  const previous = adjacentDoc(spec?.docs ?? [], doc, -1)
                  if (previous !== undefined) setDoc(previous)
                }}
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                className="kaze-iconbtn"
                title={tr('Next document')}
                aria-label={tr('Next document')}
                onClick={() => {
                  const next = adjacentDoc(spec?.docs ?? [], doc, 1)
                  if (next !== undefined) setDoc(next)
                }}
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          <div className="kaze-bar" hidden={doc === 'tasks' || undefined}>
            <div className="kaze-seg" role="group" aria-label={tr('Document view')}>
              <button
                type="button"
                className="kaze-tab"
                data-active={mode === 'preview' || undefined}
                onClick={() => setMode('preview')}
                title={tr('Rendered Markdown')}
              >
                {tr('Preview')}
              </button>
              <button
                type="button"
                className="kaze-tab"
                data-active={mode === 'source' || undefined}
                onClick={() => setMode('source')}
                title={tr('Show source')}
              >
                {tr('Source')}
              </button>
              <button
                type="button"
                className="kaze-tab"
                data-active={mode === 'diff' || undefined}
                onClick={() => setMode('diff')}
                title={tr('Side-by-side changes since this document was opened')}
              >
                {tr('Diff')}
              </button>
            </div>
            {mode !== 'diff' && (
              <button
                type="button"
                className="kaze-btn"
                data-active={findOpen || undefined}
                onClick={() => setFindOpen((open) => !open)}
                title={tr('Find in document')}
              >
                <Search size={11} /> {tr('Find')}
              </button>
            )}
            {mode === 'preview' && outline.length > 1 && (
              <button
                type="button"
                className="kaze-btn"
                data-active={outlineOpen || undefined}
                aria-expanded={outlineOpen}
                aria-controls="kaze-outline"
                onClick={() => setOutlineOpen((open) => !open)}
                title={tr('Document outline')}
              >
                <Doc size={11} /> {tr('Contents')}
              </button>
            )}
            <button
              type="button"
              className="kaze-btn"
              data-active={reviewMode || undefined}
              aria-pressed={reviewMode}
              onClick={() => {
                setReviewMode((active) => !active)
                setPill(null)
                setComposer(null)
              }}
              title={tr('Review comments')}
            >
              <Comment size={11} /> {tr('Review')}
              {comments.length > 0 && <span className="kaze-count">{openComments.length}</span>}
            </button>
            <span className="kaze-spacer" />
            <button
              type="button"
              className="kaze-btn"
              data-icon
              title={tr('Open in DeepSeek Harness file preview')}
              aria-label={tr('Open in DeepSeek Harness file preview')}
              onClick={() => openNativeFile(feature, doc)}
            >
              <Doc size={12} />
            </button>
            <button
              type="button"
              className="kaze-btn"
              data-icon
              title={tr('Copy the document path')}
              aria-label={tr('Copy the document path')}
              onClick={() => void copyText(docPath(feature, doc), 'Path copied')}
            >
              <Copy size={12} />
            </button>
          </div>

          <div className="kaze-bar">
            <button
              type="button"
              className="kaze-btn"
              data-kind="agent"
              data-variant="primary"
              title={`${agentNext?.label ?? (nextDoc === undefined ? 'Validate the next gate' : `Continue with ${nextDoc}.md`)} — sends to the agent`}
              disabled={(spec?.phase === 'done' || completionSummary?.phase === 'done') && agentNext?.id !== 'reapprove'}
              onClick={() => {
                if (agentNext !== undefined) {
                  runCompletionAction(agentNext)
                  return
                }
                if (nextDoc === undefined) {
                  sendToChat(
                    [
                      'Start a new session in this workspace and run:',
                      '',
                      `\`/spec-complete feature=${feature}\``,
                      '',
                      'Completion runs in a fresh session so this session stays clean.',
                    ].join('\n'),
                    'Completion handoff sent to chat',
                  )
                  return
                }
                const name = nextDoc === 'design' ? 'spec-design' : nextDoc === 'tasks' ? 'spec-tasks' : 'spec-requirements'
                sendToChat(commandLine(name, `feature=${feature}`, actionPrompt('continue', feature, { nextDoc })), 'Continue task sent to chat')
              }}
            >
              <ArrowRight size={11} /> {agentNext !== undefined
                ? actionText(agentNext.id, agentNext.label)
                : nextDoc === 'design'
                  ? actionText('design', 'Write design.md')
                  : nextDoc === 'tasks'
                    ? actionText('tasks', 'Write tasks.md')
                    : tr('Continue')}
            </button>
            <button
              type="button"
              className="kaze-btn"
              data-kind={hasEngine && feature !== '' ? 'host' : 'agent'}
              title={hasEngine ? tr('Sync requirements, design, and tasks now') : tr('Ask the agent to sync requirements, design, and tasks')}
              onClick={runSync}
              disabled={busy !== null}
            >
              <Sync size={11} /> {tr('Sync')}
            </button>
            <button
              type="button"
              className="kaze-btn"
              data-kind={hasEngine && feature !== '' ? 'host' : 'agent'}
              title={hasEngine ? tr('Run the validator now and list every issue') : tr('Ask the agent to run the validator')}
              onClick={runValidate}
              disabled={busy !== null}
            >
              <Shield size={11} /> {tr('Validate')}
            </button>
            {busy !== null && (
              <span className="kaze-count" role="status">{tr('Working…')}</span>
            )}
            {taskInfo !== undefined && taskInfo.ready.length > 0 && (
              <button
                type="button"
                className="kaze-btn"
                data-kind="agent"
                title={tr('Execute every ready task — sends to the agent')}
                onClick={runAll}
              >
                <Play size={11} /> {tr('Run all')}
              </button>
            )}
            {(spec?.phase === 'tasks' || spec?.phase === 'execute' || idleOpen || (idle?.counts.queuedTasks ?? 0) > 0) && (
              <button
                type="button"
                className="kaze-btn"
                data-kind="host"
                title={tr('Open the idle-time queue; tick tasks in the task panel to defer them')}
                onClick={() => setIdleOpen((open) => !open)}
              >
                <Clock size={11} /> {tr('Queue')}
                {(idle?.counts.queuedTasks ?? 0) > 0 && <span className="kaze-count">{idle?.counts.queuedTasks}</span>}
              </button>
            )}
            {canCopy && promptText !== '' && (
              <button
                type="button"
                className="kaze-btn"
                data-icon
                title={tr('Copy review prompt')}
                aria-label={tr('Copy review prompt')}
                onClick={() => void copyText(promptText, 'Review prompt copied')}
              >
                <Copy size={12} />
              </button>
            )}
          </div>

          {findOpen && (
            <div className="kaze-find">
              <Search size={12} />
              <input
                autoFocus
                value={findQuery}
                placeholder={tr('Find in document')}
                aria-label={tr('Find in document')}
                onChange={(event) => setFindQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setFindOpen(false)
                  if (event.key === 'Enter' && matches.length > 0) {
                    setFindIndex((index) => (index + (event.shiftKey ? -1 : 1) + matches.length) % matches.length)
                  }
                }}
              />
              <span className="kaze-hits">{matches.length === 0 ? (findQuery === '' ? '' : '0/0') : `${findIndex + 1}/${matches.length}`}</span>
              <button
                type="button"
                className="kaze-iconbtn"
                title={tr('Previous match')}
                aria-label={tr('Previous match')}
                onClick={() => setFindIndex((index) => (index - 1 + matches.length) % Math.max(1, matches.length))}
                disabled={matches.length === 0}
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                className="kaze-iconbtn"
                title={tr('Next match')}
                aria-label={tr('Next match')}
                onClick={() => setFindIndex((index) => (index + 1) % Math.max(1, matches.length))}
                disabled={matches.length === 0}
              >
                <ChevronRight size={12} />
              </button>
              <button type="button" className="kaze-iconbtn" title={tr('Close find')} aria-label={tr('Close find')} onClick={() => setFindOpen(false)}>
                <Close size={12} />
              </button>
            </div>
          )}

          {validationReport !== null && (
            <div className="kaze-validation" role="region" aria-label={tr('Validation')}>
              <div className="kaze-validation-head">
                <strong>{tr('Validation')}</strong>
                <span className="kaze-count">
                  {validationReport.errors.length} {tr('errors')}
                  {' · '}
                  {validationReport.warnings.length} {tr('warnings')}
                </span>
                <span className="kaze-spacer" />
                <button
                  type="button"
                  className="kaze-iconbtn"
                  title={tr('Dismiss validation report')}
                  aria-label={tr('Dismiss validation report')}
                  onClick={() => setValidation(null)}
                >
                  <Close size={11} />
                </button>
              </div>
              <div className="kaze-validation-list">
                {validationReport.errors.map((issue, index) => renderValidationIssue(issue, 'error', index))}
                {validationReport.warnings.map((issue, index) => renderValidationIssue(issue, 'warning', index))}
              </div>
            </div>
          )}

          {completionFailed && feature !== '' && (
            <div className="kaze-notice" data-tone="error">
              {tr('Completion is unavailable')}：
              {hasEngine
                ? (completionError === '' ? tr('Unknown Host failure') : completionError)
                : tr('The Host Remote may be offline.')}
              <div className="kaze-notice-actions">
                <button type="button" className="kaze-btn" onClick={() => refreshCompletion()}>{tr('Retry')}</button>
              </div>
            </div>
          )}

          {completionSummary !== null && (completionSummary.phase === 'execute' || completionSummary.phase === 'done' || spec?.phase === 'execute' || spec?.phase === 'done') && (
            <CompletionPanel
              summary={completionSummary}
              open={completionOpen}
              onToggle={() => setCompletionOpen((open) => !open)}
              deliveryKind={deliveryKind}
              onBuildDelivery={runDelivery}
              onAction={runCompletionAction}
              canArchive={completionSummary.phase === 'done' || spec?.phase === 'done'}
              onArchive={archiveCurrent}
              archiveArmed={archiveArmed}
              onCancelArchive={() => setArchiveArmed(false)}
            />
          )}

          {idleOpen && idleError !== '' && (
            <div className="kaze-notice" data-tone="error">
              {tr('Idle queue is unavailable')}：{idleError}
              <div className="kaze-notice-actions">
                <button type="button" className="kaze-btn" onClick={() => void refreshIdle()}>{tr('Retry')}</button>
              </div>
            </div>
          )}
          {idleOpen && idle !== null && (
            <IdleQueuePanel
              status={idle}
              onMove={(entry, direction) => queueAction('move', { entryId: entry.id, direction })}
              onRemove={(entry) => queueAction('remove', { entryId: entry.id })}
              onEdit={(entry, peakCost, note) => queueAction('update', { entryId: entry.id, peakCost, note })}
              onSort={() => queueAction('sort', {})}
              onRefresh={() => void refreshIdle()}
              onRun={runIdleQueue}
              onClose={() => setIdleOpen(false)}
              onSaveConfig={(json) => {
                try {
                  JSON.parse(json)
                } catch {
                  notify('Idle config is not valid JSON.', 'error')
                  return
                }
                queueAction('config', { config: json })
              }}
            />
          )}
          {taskInfo !== undefined && (
            <TaskPanel
              progress={taskInfo}
              queuedKeys={queuedKeys}
              onQueue={queueTask}
              onRun={runAll}
              hasTimeline={hasTimeline()}
              onTimeline={openTimelineForSpec}
              onOpenDoc={() => openNativeFile(feature, 'tasks')}
              onOpenIdle={() => setIdleOpen(true)}
              onRunTask={(task) => {
                openTimelineForSpec()
                const fallback = actionPrompt('run', feature, { ready: [task] })
                sendToChat(
                  skills.includes('spec-apply')
                    ? [
                        'Start a new session in this workspace and run:',
                        '',
                        `\`/spec-apply feature=${feature}\``,
                        '',
                        `Then ask it to execute only task ${task.id}.`,
                      ].join('\n')
                    : fallback,
                  `Task ${task.id} handoff sent to chat`,
                )
              }}
            />
          )}

          <div
            className="kaze-doc"
            data-review={reviewMode || undefined}
            hidden={doc === 'tasks' || undefined}
            ref={docRef}
            onMouseUp={handleDocMouseUp}
            onScroll={() => {
              if (pill !== null) setPill(null)
            }}
          >
            <div className="kaze-doc-inner" id="kaze-doc-panel" role="tabpanel" aria-labelledby={`kaze-doc-tab-${doc}`}>
              {outlineOpen && outline.length > 1 && (
                <nav className="kaze-outline" id="kaze-outline" aria-label={tr('Document outline')}>
                  {outline.map((heading) => (
                    <button
                      key={`${heading.start}-${heading.level}`}
                      type="button"
                      className="kaze-outline-row"
                      data-level={Math.min(4, heading.level)}
                      onClick={() => {
                        scrollToLine(heading.start)
                        setOutlineOpen(false)
                      }}
                    >
                      {heading.text}
                    </button>
                  ))}
                </nav>
              )}
              {docStale && docAvailable && (
                <div className="kaze-notice" data-tone="error" role="status">
                  {tr('This document may have changed or been deleted on disk.')}
                  <div className="kaze-notice-actions">
                    <button type="button" className="kaze-btn" onClick={() => void reloadDoc()}>{tr('Retry')}</button>
                  </div>
                </div>
              )}
              {spec !== undefined && !docAvailability(spec, doc) ? (
                <div className="kaze-empty">
                  <strong>{tr(`No ${doc}.md yet`)}</strong>
                  <span>{tr('Use Continue to have the agent write it, then refresh.')}</span>
                </div>
              ) : docError !== '' ? (
                <div className="kaze-notice" data-tone="error">
                  {tr('Could not read')} {doc}.md：{docError}
                  <div className="kaze-notice-actions">
                    <button type="button" className="kaze-btn" onClick={() => void reloadDoc()}>{tr('Retry')}</button>
                  </div>
                </div>
              ) : currentDoc === null ? (
                <div className="kaze-empty">
                  <strong>{tr('Loading')} {doc}.md…</strong>
                  <span>{tr('If this stays empty, use Refresh or Continue.')}</span>
                </div>
              ) : mode === 'diff' ? (
                diffView
              ) : mode === 'source' ? (
                source
              ) : (
                <>
                  {preview}
                  {orphanComments.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      {orphanComments.map(renderComment)}
                    </div>
                  )}
                  {composer !== null && !blocks.some((block) => composer.anchor.start >= block.start && composer.anchor.start <= block.end) && commentComposer}
                </>
              )}
            </div>

            {pill !== null && (
              <div className="kaze-pill" style={{ left: pill.x, top: pill.y }}>
                <button
                  type="button"
                  className="kaze-btn"
                  onClick={() => {
                    if (pill.anchor === undefined) {
                      notify('Select text inside one paragraph to comment.', 'error')
                      return
                    }
                    startComment(pill.anchor, pill.quote)
                  }}
                >
                  <Plus size={11} /> {tr('Comment')}
                </button>
                <button
                  type="button"
                  className="kaze-btn"
                  onClick={() => {
                    if (pill.anchor === undefined) {
                      notify('Select text inside one paragraph to refine.', 'error')
                      return
                    }
                    startRefine(pill.anchor, pill.quote)
                  }}
                  title={tr('Refine this section')}
                >
                  <Spark size={11} /> {tr('Refine')}
                </button>
                <button
                  type="button"
                  className="kaze-btn"
                  title={tr('Copy selection')}
                  aria-label={tr('Copy selection')}
                  onClick={() => void copyText(pill.quote, 'Selection copied')}
                >
                  <Copy size={11} />
                </button>
              </div>
            )}
          </div>

          {reviewMode && doc !== 'tasks' && (
            <div className="kaze-footer">
              <div className="kaze-footer-row">
                <button
                  type="button"
                  className="kaze-btn"
                  data-variant="primary"
                  data-kind="agent"
                  onClick={() => void sendReview()}
                  disabled={promptText === ''}
                  title={tr('Send the review prompt to the current conversation (runs through the agent)')}
                >
                  <Send size={11} /> {tr('Send review')}
                </button>
                <button type="button" className="kaze-btn" onClick={() => setPromptOpen((open) => !open)} disabled={promptText === ''}>
                  <Spark size={11} /> {tr('Prompt')}
                </button>
                <button type="button" className="kaze-btn" onClick={() => void copyText(promptText, 'Review prompt copied')} disabled={!canCopy || promptText === ''}>
                  <Copy size={11} /> {tr('Copy')}
                </button>
                <span className="kaze-spacer" />
                <button
                  type="button"
                  className="kaze-btn"
                  data-variant={clearArmed ? 'danger' : undefined}
                  onClick={clearComments}
                  disabled={comments.length === 0}
                  title={clearArmed ? 'Clear all review comments now' : 'Arm clear; click again to confirm'}
                >
                  {clearArmed ? tr('Confirm clear') : tr('Clear')}
                </button>
              </div>
              <div className="kaze-footer-row">
                <span className="kaze-count">
                  {openComments.length} {tr('open')} / {comments.length} {tr('total')}
                  {' · '}{tr('select text to comment')}
                </span>
                <span className="kaze-count" title={loadError || saveError || savedPath}>
                  {loadError !== ''
                    ? tr('Could not read saved comments')
                    : diskReview
                      ? saveState === 'saving'
                        ? tr('Saving…')
                        : saveState === 'error'
                          ? tr('Save failed')
                          : saveState === 'saved'
                            ? tr('Saved to .kaze')
                            : commentsHydrated
                              ? tr('Ready')
                              : tr('Loading comments…')
                      : tr('Local only')}
                </span>
                {(loadError !== '' || saveState === 'error') && (
                  <button
                    type="button"
                    className="kaze-btn"
                    onClick={() => {
                      if (loadError !== '') void reloadComments()
                      else void flush()
                    }}
                  >
                    {loadError !== '' ? tr('Retry') : tr('Retry save')}
                  </button>
                )}
                <span className="kaze-spacer" />
                <button
                  type="button"
                  className="kaze-btn"
                  onClick={() => startComment({ start: activeLine, end: activeLine })}
                  title={`${tr('Comment')} · ${lineText(activeLine)}`}
                >
                  <Comment size={11} /> {lineText(activeLine)}
                </button>
              </div>
              {promptOpen && promptText !== '' && <pre className="kaze-prompt">{promptText}</pre>}
            </div>
          )}
        </>
      )}

      {lightbox !== null && (
        <div className="kaze-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.alt || 'Image preview'} tabIndex={-1} ref={lightboxRef} onClick={() => setLightbox(null)}>
          <button type="button" className="kaze-lightbox-close" aria-label={tr('Close image preview')} onClick={() => setLightbox(null)}>
            <Close size={16} />
          </button>
          <img src={lightbox.src} alt={lightbox.alt} onClick={(event) => event.stopPropagation()} />
        </div>
      )}

      {toast !== null && (
        <div key={toast.seq} className="kaze-toast" data-tone={toast.tone} role="status" aria-live="polite">
          {toast.tone === 'error' ? <Close size={11} /> : <Check size={11} />}
          {toast.text}
          {toast.undo !== undefined && (
            <button
              type="button"
              className="kaze-btn"
              onClick={() => {
                const undo = toast.undo
                setToast(null)
                undo?.()
              }}
            >
              {tr('Undo')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}






