/** Parse and update the checkbox task contract in `tasks.md`. */
import { SpecError } from './errors.js'
import type { TaskStatus } from './paths.js'

const TASK_RE = /^(\s*)[-*]\s*\[([ xX\-~!])\]\s*(\*?)\s*(\d+(?:\.\d+)?)\.?\s+(.+)$/
const OPTIONAL_PREFIX = /^(?:\(\?\)|\(optional\))\s*/i
const DAG_HEADING = /^##\s+(?:Task Dependency Graph|任务依赖图|依赖图)\s*$/
const DAG_FENCE = /```json\s*\n?([\s\S]*?)```/
const CHECKBOX: Partial<Readonly<Record<TaskStatus, string>>> = {
  not_started: ' ',
  in_progress: '-',
  queued: '~',
  completed: 'x',
  failed: '!',
}

export interface SpecTask {
  id: string
  title: string
  status: TaskStatus
  optional: boolean
  line: number
  indent: number
  children: SpecTask[]
  leaf: boolean
  parent: string | null
}

export function statusFromMarker(marker: string): TaskStatus {
  switch (marker) {
    case 'x':
    case 'X':
      return 'completed'
    case '-':
      return 'in_progress'
    case '~':
      return 'queued'
    case '!':
      return 'failed'
    default:
      return 'not_started'
  }
}

export function parseTasks(markdown: string): SpecTask[] {
  const rows: SpecTask[] = []
  const stack: SpecTask[] = []
  markdown.split(/\r?\n/).forEach((line, index) => {
    const match = TASK_RE.exec(line)
    if (match === null) return
    const [, indent, marker, star, id, rawTitle] = match
    const trimmed = rawTitle.trim()
    const task: SpecTask = {
      id,
      title: trimmed.replace(OPTIONAL_PREFIX, ''),
      status: statusFromMarker(marker),
      optional: star !== '' || OPTIONAL_PREFIX.test(trimmed),
      line: index + 1,
      indent: indent.length,
      children: [],
      leaf: true,
      parent: null,
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
  return rows
}

export function parseDag(markdown: string): Map<string, string[]> | null {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => DAG_HEADING.test(line))
  if (start < 0) return null
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index]!.startsWith('## ')) {
      end = index
      break
    }
  }
  const match = DAG_FENCE.exec(lines.slice(start + 1, end).join('\n'))
  if (match === null) return null
  let data: unknown
  try {
    data = JSON.parse(match[1]!)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const waves = (data as { waves?: unknown }).waves
  if (!Array.isArray(waves)) return null
  const deps = new Map<string, string[]>()
  let previous: string[] = []
  for (const wave of waves) {
    if (typeof wave !== 'object' || wave === null || !Array.isArray((wave as { tasks?: unknown }).tasks)) continue
    const current = (wave as { tasks: unknown[] }).tasks.map((value) => String(value))
    for (const task of current) {
      const list = deps.get(task) ?? []
      for (const dependency of previous) {
        if (!list.includes(dependency)) list.push(dependency)
      }
      deps.set(task, list)
    }
    previous = [...previous, ...current]
  }
  return deps
}

export function leafMap(tasks: readonly SpecTask[]): Map<string, SpecTask> {
  return new Map(tasks.filter((task) => task.leaf).map((task) => [task.id, task]))
}

/** Required leaf tasks the dependency graph does not list at all. */
export function uncoveredRequiredLeaves(
  tasks: readonly SpecTask[],
  dag: Map<string, string[]>,
): string[] {
  return tasks
    .filter((task) => task.leaf && !task.optional && !dag.has(task.id))
    .map((task) => task.id)
}

export function readyTasks(
  tasks: readonly SpecTask[],
  dag: Map<string, string[]> | null,
  includeOptional = false,
): SpecTask[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const done = (id: string): boolean => {
    const task = byId.get(id)
    if (task === undefined) return false
    if (task.leaf) return task.status === 'completed'
    return task.children.every((child) => done(child.id))
  }
  if (dag === null) {
    return tasks.filter((task) =>
      task.leaf
      && (includeOptional || !task.optional)
      && task.status !== 'completed'
      && task.status !== 'in_progress'
      && task.status !== 'queued')
  }
  const ready: SpecTask[] = []
  for (const task of tasks) {
    if (!task.leaf) continue
    if (task.optional && !includeOptional) continue
    if (task.status === 'completed' || task.status === 'in_progress' || task.status === 'queued') continue
    const dependencies = dag.get(task.id) ?? []
    if (dependencies.every((dependency) => done(dependency))) ready.push(task)
  }
  return ready
}

export function setCheckbox(markdown: string, taskId: string, status: TaskStatus): string {
  const marker = CHECKBOX[status]
  if (marker === undefined) throw new SpecError(`cannot write status ${JSON.stringify(status)}`)
  const lines = markdown.split(/(?<=\n)/)
  let hit = false
  for (let index = 0; index < lines.length; index += 1) {
    const match = TASK_RE.exec(lines[index]!.replace(/\r?\n$/, ''))
    if (match === null || match[4] !== taskId) continue
    const [, indent, , star, , text] = match
    lines[index] = `${indent}- [${marker}]${star === '' ? '' : '*'} ${taskId}. ${text}\n`
    hit = true
    break
  }
  if (!hit) throw new SpecError(`task ${taskId} not found`)
  return lines.join('')
}

export function taskProgress(tasks: readonly SpecTask[]): {
  total: number
  completed: number
  inProgress: number
  ready: number
} {
  const leaves = tasks.filter((task) => task.leaf)
  return {
    total: leaves.length,
    completed: leaves.filter((task) => task.status === 'completed').length,
    inProgress: leaves.filter((task) => task.status === 'in_progress').length,
    ready: 0,
  }
}
