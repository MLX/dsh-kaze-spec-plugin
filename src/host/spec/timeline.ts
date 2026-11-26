/** One-way projection from `.kaze/<feature>/tasks.md` into the native Timeline. */
import { docPath, exists, readText, safeFeature } from './paths.js'
import { parseTasks, type SpecTask } from './tasks.js'

export interface TimelineSession {
  readonly id: string
}

export interface TimelineTask {
  id: string
  parent: string | null
  title: string
  description: string
  status: 'pending' | 'active' | 'paused' | 'blocked' | 'done' | 'retired'
  done: [number, number]
  timeShare: number
  remaining: null
  mode: 'serial' | 'parallel'
  note: string
  details: string
  priority: null
  createdAt: number
  updatedAt: number
  history: []
}

export interface TimelineTree {
  id: string
  title: string
  description: string
  tasks: TimelineTask[]
  createdAt: number
  lastTaskUpdate?: number
}

/**
 * The Timeline service surface Kaze needs, tolerant across DSH versions.
 *
 * `@deepseek-ai/dsh-timeline` is an optional package: DSH 0.2.2 ships no
 * `timeline` service at all, and the 0.2.3 preview accepts either a record or a
 * builder function as `append`'s third argument. Every member is optional here
 * so a projection degrades to `available: false` instead of throwing.
 */
export interface TimelineService {
  available?(session: TimelineSession): boolean
  stateOf?(session: TimelineSession): {
    readonly view?: {
      readonly trees?: readonly TimelineTree[]
      readonly activeTreeId?: string | null
    }
  } | undefined
  append(
    session: TimelineSession,
    type: 'plugin:timeline/tree',
    change: TimelineTreeRecord | ((state: unknown) => TimelineTreeRecord | undefined),
  ): Promise<void>
}

/** One `plugin:timeline/tree` record, identical in 0.2.3 alpha.1 and alpha.2. */
export interface TimelineTreeRecord {
  version: 1
  sessionId: string
  callId: string
  tree: TimelineTree
}

/** Which `append` form one service instance accepted last. */
type AppendMode = 'record' | 'builder'

const appendModes = new WeakMap<object, AppendMode>()

/** Whether an error means this runtime wanted the builder form, not a bad record. */
function signatureMismatch(error: unknown): boolean {
  return error instanceof TypeError && /not a function/i.test(error.message)
}

/**
 * Append one tree record in the form this Timeline build accepts.
 *
 * The record form is tried first because every published build supports it;
 * a version that only accepts a builder rejects the object with a `TypeError`,
 * and the same record is retried as a builder without losing data.
 * @param timeline - the live service.
 * @param session - target session.
 * @param record - validated tree record.
 */
export async function appendTimelineTree(
  timeline: TimelineService,
  session: TimelineSession,
  record: TimelineTreeRecord,
): Promise<void> {
  const key = timeline as object
  if ((appendModes.get(key) ?? 'record') === 'record') {
    try {
      await timeline.append(session, 'plugin:timeline/tree', record)
      return
    } catch (error) {
      if (!signatureMismatch(error)) throw error
      appendModes.set(key, 'builder')
    }
  }
  await timeline.append(session, 'plugin:timeline/tree', () => record)
}

/** Whether this service can own records for the session. */
function timelineAvailable(timeline: TimelineService, session: TimelineSession): boolean {
  if (typeof timeline.available !== 'function') return true
  try {
    return timeline.available(session) !== false
  } catch {
    return false
  }
}

/** Existing trees, tolerating a service that exposes no reader yet. */
function timelineTrees(timeline: TimelineService, session: TimelineSession): readonly TimelineTree[] {
  if (typeof timeline.stateOf !== 'function') return []
  try {
    const trees = timeline.stateOf(session)?.view?.trees
    return Array.isArray(trees) ? trees : []
  } catch {
    return []
  }
}

export interface TimelineSyncResult {
  available: boolean
  reason?: string
  treeId?: string
  tasks?: number
  progress?: number
  completed?: number
  total?: number
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`
}

interface LeafStats {
  total: number
  done: number
  active: boolean
  failed: boolean
  queued: boolean
}

function leafStats(task: SpecTask): LeafStats {
  if (task.leaf) {
    return {
      total: 1,
      done: task.status === 'completed' ? 1 : 0,
      active: task.status === 'in_progress',
      failed: task.status === 'failed',
      queued: task.status === 'queued',
    }
  }
  return task.children.reduce<LeafStats>(
    (sum, child) => {
      const next = leafStats(child)
      return {
        total: sum.total + next.total,
        done: sum.done + next.done,
        active: sum.active || next.active,
        failed: sum.failed || next.failed,
        queued: sum.queued || next.queued,
      }
    },
    { total: 0, done: 0, active: false, failed: false, queued: false },
  )
}

function timelineStatus(task: SpecTask): TimelineTask['status'] {
  if (task.leaf) {
    switch (task.status) {
      case 'completed':
        return 'done'
      case 'in_progress':
        return 'active'
      case 'queued':
        return 'paused'
      case 'failed':
        return 'blocked'
      default:
        return 'pending'
    }
  }
  const stats = leafStats(task)
  if (stats.total > 0 && stats.done === stats.total) return 'done'
  if (stats.failed) return 'blocked'
  if (stats.active) return 'active'
  if (stats.queued) return 'paused'
  return 'pending'
}

function buildTasks(tasks: readonly SpecTask[], existing: readonly TimelineTask[], at: number): TimelineTask[] {
  const previous = new Map(existing.map((task) => [task.id, task]))
  return tasks.map((task) => {
    const before = previous.get(task.id)
    const stats = leafStats(task)
    const total = Math.max(1, stats.total)
    return {
      id: clip(task.id, 80),
      parent: task.parent === null ? null : clip(task.parent, 80),
      title: clip(`${task.id} ${task.title}`.trim(), 120),
      description: clip(`Kaze spec task ${task.id}`, 320),
      status: timelineStatus(task),
      done: [stats.done, total],
      timeShare: 1,
      remaining: null,
      mode: 'serial',
      note: '',
      details: '',
      priority: null,
      createdAt: before?.createdAt ?? at,
      updatedAt: at,
      history: [],
    }
  })
}

/**
 * Write the current task file as a Timeline tree. Timeline derives progress and
 * reports from this tree; the spec file remains the only source of truth.
 */
export async function syncSpecToTimeline(
  root: string,
  feature: string,
  session: TimelineSession,
  timeline: TimelineService | undefined,
): Promise<TimelineSyncResult> {
  if (timeline === undefined) return { available: false, reason: 'Timeline is not enabled' }
  if (!timelineAvailable(timeline, session)) return { available: false, reason: 'Timeline needs a durable session' }
  const path = docPath(root, feature, 'tasks')
  if (!(await exists(path))) return { available: false, reason: 'tasks.md does not exist' }
  const tasks = parseTasks(await readText(path))
  if (tasks.length === 0) return { available: false, reason: 'tasks.md has no checkbox tasks' }

  const at = Date.now()
  const treeId = clip(`kaze-${safeFeature(feature)}`, 80)
  const existing = timelineTrees(timeline, session).find((tree) => tree.id === treeId)
  const tree: TimelineTree = {
    id: treeId,
    title: clip(`${feature} spec`, 120),
    description: clip(`Kaze spec tasks from .kaze/${safeFeature(feature)}/tasks.md`, 320),
    tasks: buildTasks(tasks, existing?.tasks ?? [], at),
    createdAt: existing?.createdAt ?? at,
    lastTaskUpdate: at,
  }
  await appendTimelineTree(timeline, session, {
    version: 1,
    sessionId: session.id,
    callId: `kaze-sync-${safeFeature(feature)}`,
    tree,
  })
  const leaves = tasks.filter((task) => task.leaf)
  const completed = leaves.filter((task) => task.status === 'completed').length
  return {
    available: true,
    treeId,
    tasks: tasks.length,
    progress: leaves.length === 0 ? 0 : completed / leaves.length,
    completed,
    total: leaves.length,
  }
}

/**
 * Build a retired copy of an existing Timeline tree. Archive uses this before
 * moving the spec so the current Session no longer shows live work for a spec
 * that is no longer active. Returns undefined when the Session has no tree.
 */
export async function buildRetiredTimelineTree(
  feature: string,
  session: TimelineSession,
  timeline: TimelineService | undefined,
): Promise<TimelineTree | undefined> {
  if (timeline === undefined || !timelineAvailable(timeline, session)) return undefined
  const treeId = clip(`kaze-${safeFeature(feature)}`, 80)
  const existing = timelineTrees(timeline, session).find((tree) => tree.id === treeId)
  if (existing === undefined) return undefined
  const at = Date.now()
  return {
    ...existing,
    id: treeId,
    tasks: existing.tasks.map((task) => ({
      ...task,
      status: 'retired' as const,
      note: task.note === '' ? 'Spec archived' : `${task.note}; spec archived`,
      updatedAt: at,
    })),
    lastTaskUpdate: at,
  }
}

/** Append a prebuilt retired tree after the archive move succeeds. */
export async function appendRetiredTimelineTree(
  session: TimelineSession,
  timeline: TimelineService | undefined,
  tree: TimelineTree,
): Promise<void> {
  if (timeline === undefined) return
  await appendTimelineTree(timeline, session, {
    version: 1,
    sessionId: session.id,
    callId: `kaze-archive-${tree.id}`,
    tree,
  })
}

export interface RetiredTimelineTree {
  readonly session: TimelineSession
  readonly tree: TimelineTree
}

/** Collect retired trees for every live Session that currently projects this spec. */
export async function buildRetiredTimelineTrees(
  feature: string,
  sessions: readonly TimelineSession[],
  timeline: TimelineService | undefined,
): Promise<RetiredTimelineTree[]> {
  const rows: RetiredTimelineTree[] = []
  for (const session of sessions) {
    const tree = await buildRetiredTimelineTree(feature, session, timeline)
    if (tree !== undefined) rows.push({ session, tree })
  }
  return rows
}
