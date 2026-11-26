/**
 * Pure model logic for the native tab: task parsing, review anchors, Markdown
 * blocks, and the exact native review prompt.
 *
 * Keeping this free of React and DSH imports lets the same rules be reasoned
 * about (and tested) without a browser.
 */
import { reviewBrief } from '../shared/review-brief.js'
import { SPEC_ROOT_NAME } from '../shared/spec-root.js'
import {
  DOCS,
  type Anchor,
  type DocName,
  type MarkdownBlock,
  type MarkdownListItem,
  type ReviewComment,
  type SpecSummary,
  type TaskNode,
  type TaskProgress,
  type TaskStatus,
} from './types'

const TASK_RE = /^(\s*)[-*]\s*\[([ xX\-~])\]\s*(\*?)\s*(\d+(?:\.\d+)?)\.?\s+(.+)$/
const OPTIONAL_PREFIX = /^(?:\(\?\)|\(optional\))\s*/i
const DAG_RE = /##\s+(?:Task Dependency Graph|任务依赖图|依赖图)\s*\n+```json\s*\n([\s\S]*?)\n```/
const LIST_RE = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/
const FENCE_RE = /^\s*```([\w+-]*)/
const HEADING_RE = /^(\s*)(#{1,6})\s+(.*)$/
const QUOTE_RE = /^\s*>\s?(.*)$/
const RULE_RE = /^\s*(?:---|\*\*\*|___)\s*$/

export function statusFromMarker(marker: string): TaskStatus {
  switch (marker) {
    case 'x':
    case 'X':
      return 'completed'
    case '-':
      return 'in_progress'
    case '~':
      return 'queued'
    default:
      return 'not_started'
  }
}

/** Parse every task line, nesting by indentation with the task contract. */
export function parseTasks(markdown: string): TaskNode[] {
  interface MutableTask {
    id: string
    title: string
    status: TaskStatus
    optional: boolean
    line: number
    indent: number
    children: MutableTask[]
    leaf: boolean
    parent?: string
  }

  const rows: MutableTask[] = []
  const stack: MutableTask[] = []

  markdown.split('\n').forEach((line, index) => {
    const match = TASK_RE.exec(line)
    if (match === null) return
    const [, indent, marker, star, id, rawTitle] = match
    const title = rawTitle.trim().replace(OPTIONAL_PREFIX, '')
    const task: MutableTask = {
      id,
      title,
      status: statusFromMarker(marker),
      optional: star !== '' || OPTIONAL_PREFIX.test(rawTitle.trim()),
      line: index + 1,
      indent: indent.length,
      children: [],
      leaf: true,
    }
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= task.indent) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent !== undefined) {
      parent.children.push(task)
      parent.leaf = false
      task.parent = parent.id
    }
    rows.push(task)
    stack.push(task)
  })

  // Freeze the tree shape; children are never mutated after parsing.
  const freeze = (task: MutableTask): TaskNode => ({
    id: task.id,
    title: task.title,
    status: task.status,
    optional: task.optional,
    line: task.line,
    indent: task.indent,
    children: task.children.map(freeze),
    leaf: task.leaf,
    ...(task.parent === undefined ? {} : { parent: task.parent }),
  })
  return rows.filter((task) => task.parent === undefined).map(freeze)
}

export function flattenTasks(tasks: readonly TaskNode[]): TaskNode[] {
  return tasks.flatMap((task) => [task, ...flattenTasks(task.children)])
}

/** Parse the optional `## Task Dependency Graph` waves block. */
export function parseDag(markdown: string): Record<string, string[]> | undefined {
  const match = DAG_RE.exec(markdown)
  if (match === null) return undefined
  let data: unknown
  try {
    data = JSON.parse(match[1]!)
  } catch {
    return undefined
  }
  if (typeof data !== 'object' || data === null) return undefined
  const waves = (data as { waves?: unknown }).waves
  if (!Array.isArray(waves)) return undefined
  const deps: Record<string, string[]> = {}
  let previous: string[] = []
  for (const wave of waves) {
    if (typeof wave !== 'object' || wave === null) continue
    const ids = (wave as { tasks?: unknown }).tasks
    if (!Array.isArray(ids)) continue
    const current = ids.map(String)
    for (const id of current) {
      deps[id] = [...new Set([...(deps[id] ?? []), ...previous.filter((item) => !(deps[id] ?? []).includes(item))])]
    }
    previous = [...previous, ...current]
  }
  return deps
}

/** Ready tasks, matching the DAG and sequential fallbacks. */
export function readyTasks(
  tasks: readonly TaskNode[],
  dag: Record<string, string[]> | undefined,
  includeOptional = false,
): TaskNode[] {
  const all = flattenTasks(tasks)
  const byId = new Map(all.map((task) => [task.id, task]))
  const leaves = all.filter((task) => task.leaf)

  const done = (id: string): boolean => {
    const task = byId.get(id)
    if (task === undefined) return false
    if (task.leaf) return task.status === 'completed'
    return task.children.every((child) => done(child.id))
  }

  if (dag === undefined) {
    const next = leaves.find(
      (task) => (includeOptional || !task.optional) && task.status !== 'completed' && task.status !== 'in_progress',
    )
    return next === undefined ? [] : [next]
  }

  return leaves.filter((task) => {
    if (task.optional && !includeOptional) return false
    if (task.status === 'completed' || task.status === 'in_progress' || task.status === 'queued') return false
    return (dag[task.id] ?? []).every(done)
  })
}

export function taskProgress(markdown: string): TaskProgress {
  const tasks = parseTasks(markdown)
  const leaves = flattenTasks(tasks).filter((task) => task.leaf)
  const required = leaves.filter((task) => !task.optional)
  const completed = required.filter((task) => task.status === 'completed').length
  return {
    tasks,
    leaves,
    required,
    completed,
    total: required.length,
    ready: readyTasks(tasks, parseDag(markdown)),
  }
}

/** Character offset -> 1-based line number. */
export function lineAtOffset(text: string, offset: number): number {
  let line = 1
  const end = Math.min(Math.max(offset, 0), text.length)
  for (let index = 0; index < end; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1
  }
  return line
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Resolve a quoted passage to a line range: exact match first, then a
 * whitespace-normalized match (the anchor fallback order).
 */
export function resolveQuote(text: string, quote: string): Anchor | undefined {
  const trimmed = quote.trim()
  if (trimmed === '') return undefined
  const exact = text.indexOf(trimmed)
  if (exact >= 0) {
    return { start: lineAtOffset(text, exact), end: lineAtOffset(text, exact + trimmed.length - 1) }
  }

  const lines = text.split('\n')
  const normalizedLines = lines.map((line) => normalize(line))
  const haystack = normalizedLines.join(' ')
  const needle = normalize(trimmed)
  if (needle === '') return undefined
  const hit = haystack.indexOf(needle)
  if (hit < 0) return undefined

  // Map the normalized character offset back onto original lines.
  let cursor = 0
  let start: number | undefined
  let end: number | undefined
  normalizedLines.forEach((line, index) => {
    const from = cursor
    const to = cursor + line.length
    if (start === undefined && hit <= to && (line !== '' || hit === from)) start = index + 1
    if (start !== undefined && hit + needle.length - 1 <= to) {
      end = index + 1
    }
    cursor = to + 1
  })
  if (start === undefined) return undefined
  return { start, end: Math.max(end ?? start, start) }
}

/** The nearest heading at or above a line, used as the comment's section. */
export function sectionAt(lines: readonly string[], line: number): string {
  for (let index = Math.min(line - 1, lines.length - 1); index >= 0; index -= 1) {
    if (/^#{1,6}\s+/.test(lines[index] ?? '')) return lines[index]!.trim()
  }
  return ''
}

function startsBlock(line: string): boolean {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    QUOTE_RE.test(line) ||
    RULE_RE.test(line) ||
    LIST_RE.test(line) ||
    /^\s*\|/.test(line)
  )
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/** Split Markdown into renderable blocks while retaining source line ranges. */
export function parseBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    if (line.trim() === '') {
      index += 1
      continue
    }

    const fence = FENCE_RE.exec(line)
    if (fence !== null) {
      const start = index + 1
      const body: string[] = []
      index += 1
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index]!)) {
        body.push(lines[index]!)
        index += 1
      }
      index += 1 // closing fence
      blocks.push({ kind: 'code', start, end: index, text: body.join('\n'), lang: fence[1] || '' })
      continue
    }

    const heading = HEADING_RE.exec(line)
    if (heading !== null) {
      blocks.push({
        kind: 'heading',
        start: index + 1,
        end: index + 1,
        level: heading[2]!.length,
        text: heading[3]!.trim(),
      })
      index += 1
      continue
    }

    if (RULE_RE.test(line)) {
      blocks.push({ kind: 'rule', start: index + 1, end: index + 1 })
      index += 1
      continue
    }

    if (/^\s*\|/.test(line) && /^\s*\|?[\s:-]+\|/.test(lines[index + 1] ?? '')) {
      const start = index + 1
      const rows: string[][] = []
      while (index < lines.length && /^\s*\|/.test(lines[index]!)) {
        const row = lines[index]!
        if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(row)) rows.push(splitRow(row))
        index += 1
      }
      blocks.push({ kind: 'table', start, end: index, rows })
      continue
    }

    if (QUOTE_RE.test(line)) {
      const start = index + 1
      const parts: string[] = []
      while (index < lines.length) {
        const match = QUOTE_RE.exec(lines[index]!)
        if (match === null) break
        parts.push(match[1] ?? '')
        index += 1
      }
      blocks.push({ kind: 'quote', start, end: index, text: parts.join('\n') })
      continue
    }

    const list = LIST_RE.exec(line)
    if (list !== null) {
      const start = index + 1
      const items: MarkdownListItem[] = []
      const baseIndent = LIST_RE.exec(line)![1]!.length
      while (index < lines.length) {
        const candidate = lines[index]!
        const match = LIST_RE.exec(candidate)
        if (match !== null) {
          const [, indent, marker, raw] = match
          const checked = /^\[([ xX-~])\]\s+/.exec(raw)
          items.push({
            indent: indent!.length,
            marker: marker!,
            text: checked === null ? raw! : raw!.slice(checked[0].length),
            ...(checked === null ? {} : { taskStatus: statusFromMarker(checked[1]!) }),
          })
          index += 1
          continue
        }
        // Continuation of the previous item: indented prose that is not a
        // nested block. Join it so wrapped Markdown text stays in one item.
        if (
          candidate.trim() !== ''
          && /^\s{2,}/.test(candidate)
          && !startsBlock(candidate)
          && items.length > 0
          && candidate.search(/\S/) > baseIndent
        ) {
          const previous = items[items.length - 1]!
          items[items.length - 1] = { ...previous, text: `${previous.text} ${candidate.trim()}` }
          index += 1
          continue
        }
        break
      }
      blocks.push({ kind: 'list', start, end: index, items })
      continue
    }

    // Paragraph: consume until a blank line or another block starts. Always
    // take the first line so an unhandled block starter cannot stall the loop.
    const start = index + 1
    const parts: string[] = [line.trim()]
    index += 1
    while (index < lines.length && lines[index]!.trim() !== '' && !startsBlock(lines[index]!)) {
      parts.push(lines[index]!.trim())
      index += 1
    }
    blocks.push({ kind: 'paragraph', start, end: index, text: parts.join(' ') })
  }

  return blocks
}

export function commentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Storage key: comments belong to one workspace, spec, and document. */
export function commentsKey(cwd: string | undefined, feature: string, doc: DocName): string {
  return `kaze-spec:comments:${cwd ?? ''}:${feature}:${doc}`
}

/** Validate and normalize comment entries from disk or local storage. */
export function parseComments(data: unknown): ReviewComment[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((entry): ReviewComment[] => {
    if (typeof entry !== 'object' || entry === null) return []
    const value = entry as Record<string, unknown>
    const lines = value.sourceLines as { start?: unknown; end?: unknown } | undefined
    if (typeof value.quotedSource !== 'string' || typeof value.reviewerNote !== 'string') return []
    const start = Number(lines?.start ?? 0)
    const end = Number(lines?.end ?? start)
    return [{
      id: typeof value.id === 'string' ? value.id : commentId(),
      quotedSource: value.quotedSource,
      section: typeof value.section === 'string' ? value.section : '',
      sourceLines: {
        start: Number.isFinite(start) && start > 0 ? start : 1,
        end: Number.isFinite(end) && end > 0 ? end : 1,
      },
      reviewerNote: value.reviewerNote,
      createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
      ...(value.stale === true ? { stale: true } : {}),
      ...(value.resolved === true ? { resolved: true } : {}),
    }]
  })
}

export function loadComments(key: string): ReviewComment[] {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    if (raw === null || raw === undefined || raw === '') return []
    return parseComments(JSON.parse(raw))
  } catch {
    return []
  }
}

export function saveComments(key: string, comments: readonly ReviewComment[]): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(comments))
  } catch {
    // Storage may be unavailable or full; comments still live in memory.
  }
}

/**
 * Build the native review brief through the shared builder so the browser and
 * the Host tool produce identical text, caps, and untrusted-data boundary.
 */
export function buildReviewPrompt(
  path: string,
  doc: DocName,
  comments: readonly ReviewComment[],
): string {
  return reviewBrief(path, doc, comments.map((comment) => ({
    lineStart: comment.sourceLines.start,
    lineEnd: comment.sourceLines.end,
    section: comment.section,
    quote: comment.quotedSource,
    note: comment.reviewerNote,
  })))
}


export interface DiffSide {
  readonly no: number
  readonly text: string
}

export interface DiffRow {
  readonly kind: 'equal' | 'change' | 'add' | 'remove'
  readonly left?: DiffSide
  readonly right?: DiffSide
}

type Edit = { readonly type: 'equal' | 'remove' | 'add'; readonly text: string; readonly leftNo?: number; readonly rightNo?: number }

/**
 * Line diff for the side-by-side view. It is LCS-based for normal spec sizes
 * and falls back to a coarse replace beyond a bounded matrix.
 */
export function diffLines(before: string, after: string): DiffRow[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const edits: Edit[] = []

  if (a.length * b.length > 2_000_000) {
    a.forEach((text, index) => edits.push({ type: 'remove', text, leftNo: index + 1 }))
    b.forEach((text, index) => edits.push({ type: 'add', text, rightNo: index + 1 }))
  } else {
    const n = a.length
    const m = b.length
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        edits.push({ type: 'equal', text: a[i]!, leftNo: i + 1, rightNo: j + 1 })
        i += 1
        j += 1
      } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
        edits.push({ type: 'remove', text: a[i]!, leftNo: i + 1 })
        i += 1
      } else {
        edits.push({ type: 'add', text: b[j]!, rightNo: j + 1 })
        j += 1
      }
    }
    while (i < n) {
      edits.push({ type: 'remove', text: a[i]!, leftNo: i + 1 })
      i += 1
    }
    while (j < m) {
      edits.push({ type: 'add', text: b[j]!, rightNo: j + 1 })
      j += 1
    }
  }

  const rows: DiffRow[] = []
  let cursor = 0
  while (cursor < edits.length) {
    const edit = edits[cursor]!
    if (edit.type === 'equal') {
      rows.push({ kind: 'equal', left: { no: edit.leftNo ?? 0, text: edit.text }, right: { no: edit.rightNo ?? 0, text: edit.text } })
      cursor += 1
      continue
    }
    const removes: Edit[] = []
    const adds: Edit[] = []
    while (cursor < edits.length && edits[cursor]!.type !== 'equal') {
      const next = edits[cursor]!
      if (next.type === 'remove') removes.push(next)
      else adds.push(next)
      cursor += 1
    }
    const count = Math.max(removes.length, adds.length)
    for (let index = 0; index < count; index += 1) {
      const left = removes[index]
      const right = adds[index]
      rows.push({
        kind: left !== undefined && right !== undefined ? 'change' : left !== undefined ? 'remove' : 'add',
        ...(left === undefined ? {} : { left: { no: left.leftNo ?? 0, text: left.text } }),
        ...(right === undefined ? {} : { right: { no: right.rightNo ?? 0, text: right.text } }),
      })
    }
  }
  return rows
}

export function docAvailability(spec: SpecSummary | undefined, doc: DocName): boolean {
  return spec?.docs.includes(doc) ?? false
}

export function adjacentDoc(docs: readonly DocName[], current: DocName, step: -1 | 1): DocName | undefined {
  if (docs.length === 0) return undefined
  const index = docs.indexOf(current)
  if (index < 0) return docs[0]
  return docs[(index + step + docs.length) % docs.length]
}

export function phaseTone(phase: string): 'idle' | 'info' | 'ok' {
  if (phase === 'done') return 'ok'
  if (phase === 'initial') return 'idle'
  return 'info'
}

export function phaseLabel(phase: string): string {
  if (phase === '') return 'unknown'
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}

export function findMatches(text: string, query: string): number[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []
  const haystack = text.toLowerCase()
  const hits: number[] = []
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) {
    hits.push(at)
    if (hits.length > 500) break
  }
  return hits
}

export function isDocName(value: string): value is DocName {
  return (DOCS as readonly string[]).includes(value)
}

export function relativeTime(iso: string, now = Date.now()): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  const delta = Math.max(0, now - at)
  const minute = 60_000
  if (delta < minute) return 'just now'
  if (delta < 60 * minute) return `${Math.floor(delta / minute)}m ago`
  if (delta < 24 * 60 * minute) return `${Math.floor(delta / (60 * minute))}h ago`
  return `${Math.floor(delta / (24 * 60 * minute))}d ago`
}

export function parseState(raw: string): { phase: string; specType: string; workflow: string; designDetail: string; capability: string; updatedAt: string } {
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) throw new Error('not an object')
    const value = data as Record<string, unknown>
    return {
      phase: typeof value.phase === 'string' ? value.phase : '',
      specType: typeof value.specType === 'string' ? value.specType : '',
      workflow: typeof value.workflow === 'string' ? value.workflow : '',
      designDetail: typeof value.designDetail === 'string' ? value.designDetail : '',
      capability: typeof value.capability === 'string' ? value.capability : '',
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    }
  } catch {
    return { phase: '', specType: '', workflow: '', designDetail: '', capability: '', updatedAt: '' }
  }
}

/** Prompt text for a spec action, phrased for the agent and the shared engine. */
export function actionPrompt(
  action: 'sync' | 'continue' | 'validate' | 'run' | 'review',
  feature: string,
  extra: { doc?: DocName; ready?: readonly TaskNode[]; nextDoc?: DocName; prompt?: string } = {},
): string {
  const spec = `${SPEC_ROOT_NAME}/${feature}`
  switch (action) {
    case 'sync':
      return [
        `Sync the Kaze spec at ${spec}.`,
        `Call \`kaze_spec_sync\` with feature=${feature}, then re-check requirements, design, and tasks for consistency.`,
        'Update only the spec documents that are out of date, keep the required headings and task markers, then report what changed.',
      ].join('\n')
    case 'continue': {
      const target =
        extra.nextDoc === undefined
          ? 'Every document already exists. Run `kaze_spec_validate` and report the next failing gate.'
          : `The next document is ${spec}/${extra.nextDoc}.md. Use the matching phase rules in core/ and call \`kaze_spec_gate\` for ${extra.nextDoc} before declaring it complete.`
      return [`Continue the Kaze spec at ${spec}.`, target, 'Do not skip a failing gate.'].join('\n')
    }
    case 'validate':
      return [
        `Validate the Kaze spec at ${spec}.`,
        `Call \`kaze_spec_validate\` with feature=${feature} and summarize every error and warning by document and line.`,
        'Do not edit any file in this turn.',
      ].join('\n')
    case 'run': {
      const ready = extra.ready ?? []
      const list = ready.length === 0 ? '' : ` (${ready.map((task) => `${task.id} ${task.title}`).join('; ')})`
      return [
        `Execute the ready tasks for ${spec}${list}.`,
        'If the set is empty, call `kaze_spec_tasks` with ready=true first.',
        'Run one task at a time. Set it to in_progress with `kaze_spec_task` before starting, and completed only after evidence (tests or commands) passes.',
        'Stop and report a blocker instead of guessing.',
      ].join('\n')
    }
    case 'review':
      return extra.prompt ?? ''
  }
}
