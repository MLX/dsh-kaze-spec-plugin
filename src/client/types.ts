/** Shared shapes for the native Kaze Spec tab. */

export const DOCS = ['requirements', 'design', 'tasks', 'bugfix'] as const
export type DocName = (typeof DOCS)[number]

export const DOC_LABEL: Record<DocName, string> = {
  requirements: 'Requirements',
  design: 'Design',
  tasks: 'Tasks',
  bugfix: 'Bugfix',
}

export const DOC_SHORT: Record<DocName, string> = {
  requirements: 'Req',
  design: 'Design',
  tasks: 'Tasks',
  bugfix: 'Bug',
}

export const PHASES = ['initial', 'requirements', 'design', 'tasks', 'execute', 'done'] as const
export type Phase = (typeof PHASES)[number]

export interface SpecSummary {
  readonly feature: string
  readonly phase: string
  readonly specType: string
  readonly workflow: string
  readonly designDetail?: string
  readonly capability?: string
  readonly analysis?: boolean
  readonly updatedAt: string
  readonly docs: readonly DocName[]
  /** Present when the directory exists but its state could not be read. */
  readonly error?: string
}

/** One compact view of how close a spec is to delivery. */
export interface CompletionSummary {
  feature: string
  phase: string
  scope: string
  tasks: { total: number; completed: number; in_progress: number; ready: number }
  acceptance: { present: boolean; approved: boolean; status: string; checked: number; total: number; stale?: boolean }
  fta: { status: string; at: string | null; details: string; stale?: boolean }
  delivery: { present: boolean; path: string; fresh: boolean }
  verification: { present: boolean }
  gates: readonly { gate: string; status: string; at: string; reason: string; returnTo: string | null; evidence?: string }[]
  next: readonly { id: string; label: string; kind: 'host' | 'agent'; command: string }[]
}

export interface ArchivedSpec {
  readonly feature: string
  readonly archiveId: string
  readonly archivedAt: string
  readonly phase: string
  readonly type: string
  readonly workflow: string
  readonly reason: string
  readonly path: string
}

export interface DocumentText {
  readonly text: string
  readonly path: string
  readonly version: string
}

export interface Anchor {
  readonly start: number
  readonly end: number
}

export interface ReviewComment {
  readonly id: string
  readonly quotedSource: string
  readonly section: string
  readonly sourceLines: Anchor
  readonly reviewerNote: string
  readonly createdAt: number
  readonly stale?: boolean
  readonly resolved?: boolean
}

export interface TaskNode {
  readonly id: string
  readonly title: string
  readonly status: TaskStatus
  readonly optional: boolean
  readonly line: number
  readonly indent: number
  readonly children: readonly TaskNode[]
  readonly leaf: boolean
  readonly parent?: string
}

export type TaskStatus = 'not_started' | 'in_progress' | 'queued' | 'completed' | 'failed'

export interface TaskProgress {
  readonly tasks: readonly TaskNode[]
  readonly leaves: readonly TaskNode[]
  readonly required: readonly TaskNode[]
  readonly completed: number
  readonly total: number
  readonly ready: readonly TaskNode[]
}

export interface MarkdownBlock {
  readonly kind: 'heading' | 'paragraph' | 'list' | 'code' | 'quote' | 'table' | 'rule'
  readonly start: number
  readonly end: number
  readonly level?: number
  readonly text?: string
  readonly lang?: string
  readonly items?: readonly MarkdownListItem[]
  readonly rows?: readonly (readonly string[])[]
}

export interface MarkdownListItem {
  readonly text: string
  readonly indent: number
  readonly marker: string
  readonly taskStatus?: TaskStatus
}

export type ViewMode = 'preview' | 'source' | 'diff'

export interface NativeChange {
  readonly seq: number
  readonly turn: number
  readonly index: number
  readonly total: number
}

export interface IdleWindow {
  readonly days: readonly number[]
  readonly start: string
  readonly end: string
}

export interface IdleConfig {
  readonly schema: number
  readonly timezone: string
  readonly peakWindows: readonly IdleWindow[]
  readonly idleWindows: readonly IdleWindow[]
  readonly holidays: readonly string[]
  readonly idlePriceMultiplier: number
  readonly defaultPeakCost: number
  readonly specDependencies: Readonly<Record<string, readonly string[]>>
}

export interface IdleEntryView {
  readonly id: string
  readonly feature: string
  readonly taskId: string
  readonly title: string
  readonly optional: boolean
  readonly dependsOn: readonly string[]
  readonly peakCost: number
  readonly idleCost: number
  readonly status: 'queued' | 'running' | 'done' | 'failed'
  readonly createdAt: string
  readonly updatedAt: string
  readonly note: string
  readonly index: number
}

export interface IdleStatus {
  readonly config: IdleConfig
  readonly queue: readonly IdleEntryView[]
  readonly now: string
  readonly idle: boolean
  readonly priceMultiplier: number
  readonly nextChange: { readonly at: string; readonly idle: boolean } | null
  readonly nextIdle: string | null
  readonly nextPeak: string | null
  readonly counts: {
    readonly queued: number
    readonly running: number
    readonly done: number
    readonly failed: number
    readonly queuedTasks: number
  }
  readonly validation: { readonly ok: boolean; readonly errors: readonly string[]; readonly warnings: readonly string[] }
  readonly result?: unknown
}
