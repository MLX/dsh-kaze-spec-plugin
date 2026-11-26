/**
 * Idle-window queue for optional/low-priority spec tasks.
 *
 * Beijing time is the only scheduling timezone. Weekday 09:00–12:00 and
 * 14:00–18:00 are peak, except Chinese statutory holidays; everything else is
 * idle. A custom `idleWindows` list overrides the default complement model.
 */
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SpecError } from './errors.js'
import { withSpecLock } from './lock.js'
import {
  docPath,
  exists,
  nowIso,
  readJson,
  safeFeature,
  writeJson,
} from './paths.js'
import { parseDag, parseTasks, type SpecTask } from './tasks.js'
import { loadState } from './state.js'
import { QUEUE_FILE } from './queue.js'

const CONFIG_FILE = 'idle-config.json'
const TIME_ZONE = 'Asia/Shanghai'

export interface PeakWindow {
  /** ISO weekday numbers: 1=Monday … 7=Sunday. */
  days: number[]
  /** HH:MM in Beijing time. */
  start: string
  /** HH:MM in Beijing time; end <= start means overnight. */
  end: string
}

export interface IdleConfig {
  schema: number
  timezone: string
  peakWindows: PeakWindow[]
  /** When non-empty, these windows replace the default peak complement. */
  idleWindows: PeakWindow[]
  holidays: string[]
  idlePriceMultiplier: number
  defaultPeakCost: number
  /** Optional spec-level dependencies: feature -> specs that must finish first. */
  specDependencies: Record<string, string[]>
}

export type IdleEntryStatus = 'queued' | 'running' | 'done' | 'failed'

export interface IdleEntry {
  id: string
  feature: string
  taskId: string
  title: string
  optional: boolean
  dependsOn: string[]
  peakCost: number
  status: IdleEntryStatus
  createdAt: string
  updatedAt: string
  note: string
}

export interface IdleQueue {
  schema: number
  updatedAt: string
  entries: IdleEntry[]
}

export interface IdleEntryView extends IdleEntry {
  index: number
  idleCost: number
}

export interface IdleStatus {
  config: IdleConfig
  queue: IdleEntryView[]
  now: string
  idle: boolean
  priceMultiplier: number
  nextChange: { at: string; idle: boolean } | null
  nextIdle: string | null
  nextPeak: string | null
  counts: { queued: number; running: number; done: number; failed: number; queuedTasks: number }
  validation: { ok: boolean; errors: string[]; warnings: string[] }
}

export interface IdleMutationResult extends IdleStatus {
  result: unknown
}

const DEFAULT_PEAK: PeakWindow[] = [
  { days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00' },
  { days: [1, 2, 3, 4, 5], start: '14:00', end: '18:00' },
]

// State Council of China, 2026 holiday arrangement. Ranges are inclusive.
const CN_2026_HOLIDAYS = [
  ...datesBetween('2026-01-01', '2026-01-03'),
  ...datesBetween('2026-02-15', '2026-02-23'),
  ...datesBetween('2026-04-04', '2026-04-06'),
  ...datesBetween('2026-05-01', '2026-05-05'),
  ...datesBetween('2026-06-19', '2026-06-21'),
  ...datesBetween('2026-09-25', '2026-09-27'),
  ...datesBetween('2026-10-01', '2026-10-07'),
]

export const DEFAULT_IDLE_CONFIG: IdleConfig = {
  schema: 1,
  timezone: TIME_ZONE,
  peakWindows: DEFAULT_PEAK,
  idleWindows: [],
  holidays: CN_2026_HOLIDAYS,
  idlePriceMultiplier: 0.5,
  defaultPeakCost: 0,
  specDependencies: {},
}

function datesBetween(start: string, end: string): string[] {
  const [sy, sm, sd] = start.split('-').map(Number) as [number, number, number]
  const [ey, em, ed] = end.split('-').map(Number) as [number, number, number]
  const cursor = new Date(Date.UTC(sy, sm - 1, sd))
  const last = Date.UTC(ey, em - 1, ed)
  const out: string[] = []
  while (cursor.getTime() <= last) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

function configPath(root: string): string {
  return join(root, CONFIG_FILE)
}

function queuePath(root: string): string {
  return join(root, QUEUE_FILE)
}

function object(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SpecError(`${what} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function parseClock(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (match === null) throw new SpecError(`idle window time must be HH:MM: ${JSON.stringify(value)}`)
  return Number(match[1]) * 60 + Number(match[2])
}

function normalizeWindow(value: unknown): PeakWindow {
  const raw = object(value, 'idle window')
  const days = Array.isArray(raw.days)
    ? raw.days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    : []
  if (days.length === 0) throw new SpecError('idle window days must contain ISO weekdays 1..7')
  const start = string(raw.start)
  const end = string(raw.end)
  parseClock(start)
  parseClock(end)
  return { days: [...new Set(days)].sort((a, b) => a - b), start, end }
}

function normalizeConfig(raw: unknown): IdleConfig {
  const value = object(raw, 'idle config')
  const peakWindows = Array.isArray(value.peakWindows)
    ? value.peakWindows.map(normalizeWindow)
    : DEFAULT_PEAK.map((window) => ({ ...window, days: [...window.days] }))
  const idleWindows = Array.isArray(value.idleWindows) ? value.idleWindows.map(normalizeWindow) : []
  const holidays = Array.isArray(value.holidays)
    ? value.holidays.filter((day): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))
    : DEFAULT_IDLE_CONFIG.holidays
  const multiplier = number(value.idlePriceMultiplier, DEFAULT_IDLE_CONFIG.idlePriceMultiplier)
  if (multiplier <= 0) throw new SpecError('idlePriceMultiplier must be positive')
  const defaultPeakCost = Math.max(0, number(value.defaultPeakCost, 0))
  const specDependencies: Record<string, string[]> = {}
  if (typeof value.specDependencies === 'object' && value.specDependencies !== null && !Array.isArray(value.specDependencies)) {
    for (const [feature, dependencies] of Object.entries(value.specDependencies as Record<string, unknown>)) {
      specDependencies[feature] = stringList(dependencies).map((item) => safeFeature(item))
    }
  }
  return {
    schema: 1,
    timezone: TIME_ZONE,
    peakWindows,
    idleWindows,
    holidays,
    idlePriceMultiplier: multiplier,
    defaultPeakCost,
    specDependencies,
  }
}

export async function readIdleConfig(root: string): Promise<IdleConfig> {
  const path = configPath(root)
  if (!(await exists(path))) return normalizeConfig(DEFAULT_IDLE_CONFIG)
  return normalizeConfig(await readJson(path))
}

export async function writeIdleConfig(root: string, config: IdleConfig): Promise<IdleConfig> {
  const normalized = normalizeConfig(config)
  await writeJson(configPath(root), normalized)
  return normalized
}

function normalizeEntry(raw: unknown): IdleEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const feature = string(value.feature)
  const taskId = string(value.taskId)
  if (feature === '' || taskId === '') return null
  const status = value.status === 'running' || value.status === 'done' || value.status === 'failed'
    ? value.status
    : 'queued'
  return {
    id: string(value.id) || `idle-${randomBytes(6).toString('hex')}`,
    feature: safeFeature(feature),
    taskId,
    title: string(value.title),
    optional: value.optional !== false,
    dependsOn: stringList(value.dependsOn),
    peakCost: Math.max(0, number(value.peakCost, 0)),
    status,
    createdAt: string(value.createdAt) || nowIso(),
    updatedAt: string(value.updatedAt) || nowIso(),
    note: string(value.note),
  }
}

export async function readIdleQueue(root: string): Promise<IdleQueue> {
  const path = queuePath(root)
  if (!(await exists(path))) return { schema: 1, updatedAt: nowIso(), entries: [] }
  const raw = await readJson(path)
  const value = object(raw, 'idle queue')
  const entries = Array.isArray(value.entries)
    ? value.entries.map(normalizeEntry).filter((entry): entry is IdleEntry => entry !== null)
    : []
  return { schema: 1, updatedAt: string(value.updatedAt) || nowIso(), entries }
}

export async function writeIdleQueue(root: string, queue: IdleQueue): Promise<void> {
  await writeJson(queuePath(root), { schema: 1, updatedAt: nowIso(), entries: queue.entries })
}

const BJ_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
  weekday: 'short',
})

function bjParts(at: Date): { date: string; isoDay: number; minutes: number } {
  const parts = BJ_FORMAT.formatToParts(at)
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? ''
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  const weekday = get('weekday')
  const names: Record<string, number> = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { date, isoDay: names[weekday] ?? 1, minutes }
}

function within(window: PeakWindow, isoDay: number, minutes: number): boolean {  const start = parseClock(window.start)
  const endClock = parseClock(window.end)
  const overnight = endClock <= start
  const end = overnight ? endClock + 24 * 60 : endClock
  if (window.days.includes(isoDay) && minutes >= start && minutes < end) return true
  // An overnight window that started the previous day still covers the early
  // morning; the previous weekday decides membership.
  if (overnight) {
    const previous = isoDay === 1 ? 7 : isoDay - 1
    if (window.days.includes(previous) && minutes + 24 * 60 >= start && minutes + 24 * 60 < end) return true
  }
  return false
}

export function isIdleAt(config: IdleConfig, at: Date): boolean {
  const { isoDay, minutes } = bjParts(at)
  if (config.idleWindows.length > 0) {
    return config.idleWindows.some((window) => within(window, isoDay, minutes))
  }
  // Holidays are intentionally ignored: Kaze prices by peak windows and the
  // Saturday/Sunday default only, so the calendar never needs a yearly update.
  if (config.peakWindows.some((window) => within(window, isoDay, minutes))) return false
  return true
}

function scanTransition(config: IdleConfig, from: Date, target: boolean, days = 14): string | null {
  const start = Math.ceil(from.getTime() / 60_000) * 60_000
  for (let index = 0; index <= days * 24 * 60; index += 1) {
    const at = new Date(start + index * 60_000)
    if (isIdleAt(config, at) === target) return at.toISOString()
  }
  return null
}

function costView(entry: IdleEntry, config: IdleConfig, index: number): IdleEntryView {
  return {
    ...entry,
    index,
    idleCost: Math.round(entry.peakCost * config.idlePriceMultiplier * 100) / 100,
  }
}

interface FeatureContext {
  phase: string
  specType: string
  scope: string
  tasks: SpecTask[]
  dag: Map<string, string[]> | null
  byId: Map<string, SpecTask>
}

async function featureContext(root: string, feature: string): Promise<FeatureContext> {
  const state = await loadState(root, feature)
  const path = docPath(root, feature, 'tasks')
  const markdown = (await exists(path)) ? await readFile(path, 'utf8') : ''
  const tasks = parseTasks(markdown)
  return {
    phase: state.phase,
    specType: state.specType,
    scope: state.scope,
    tasks,
    dag: parseDag(markdown),
    byId: new Map(tasks.filter((task) => task.leaf).map((task) => [task.id, task])),
  }
}

function deriveDependsOn(context: FeatureContext, taskId: string): string[] {
  return (context.dag?.get(taskId) ?? []).filter((dependency) => {
    const task = context.byId.get(dependency)
    return task !== undefined && task.status !== 'completed'
  })
}

function depKey(feature: string, taskId: string): string {
  return `${feature}\u0000${taskId}`
}

function splitDep(value: string): { feature: string; taskId: string } | null {
  const index = value.indexOf(':')
  if (index < 0) return null
  const feature = value.slice(0, index)
  const taskId = value.slice(index + 1)
  if (feature === '' || taskId === '') return null
  return { feature: safeFeature(feature), taskId }
}

async function validateQueue(
  root: string,
  config: IdleConfig,
  entries: readonly IdleEntry[],
): Promise<{ ok: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = []
  const warnings: string[] = []
  const contexts = new Map<string, FeatureContext>()
  const contextFor = async (feature: string): Promise<FeatureContext | undefined> => {
    if (contexts.has(feature)) return contexts.get(feature)
    try {
      const context = await featureContext(root, feature)
      contexts.set(feature, context)
      return context
    } catch {
      return undefined
    }
  }
  const indexByKey = new Map<string, number>()
  for (const [index, entry] of entries.entries()) {
    const key = depKey(entry.feature, entry.taskId)
    if (indexByKey.has(key)) errors.push(`${entry.feature}:${entry.taskId} appears more than once`)
    indexByKey.set(key, index)
  }
  for (const [index, entry] of entries.entries()) {
    if (entry.status === 'done') continue
    const context = await contextFor(entry.feature)
    if (context === undefined) {
      errors.push(`${entry.feature}: spec is missing or unreadable`)
      continue
    }
    const task = context.byId.get(entry.taskId)
    if (task === undefined) {
      errors.push(`${entry.feature}:${entry.taskId}: task not found`)
      continue
    }
    if (task.status === 'completed') {
      warnings.push(`${entry.feature}:${entry.taskId}: task is already completed; remove it from the queue`)
    }
    for (const dependency of entry.dependsOn) {
      const split = splitDep(dependency)
      const depFeature = split?.feature ?? entry.feature
      const depTaskId = split?.taskId ?? dependency
      if (depFeature === entry.feature && depTaskId === entry.taskId) {
        errors.push(`${entry.feature}:${entry.taskId}: task cannot depend on itself`)
        continue
      }
      const depContext = await contextFor(depFeature)
      const depTask = depContext?.byId.get(depTaskId)
      if (depTask === undefined) {
        errors.push(`${entry.feature}:${entry.taskId}: dependency ${depFeature}:${depTaskId} is missing`)
        continue
      }
      if (depTask.status === 'completed') continue
      const depIndex = indexByKey.get(depKey(depFeature, depTaskId))
      if (depIndex === undefined) {
        if (depTask.optional) {
          errors.push(`${entry.feature}:${entry.taskId}: dependency ${depFeature}:${depTaskId} is neither completed nor queued`)
        } else {
          // A required task outside the queue (for example a prerequisite that
          // the current apply is about to execute) is not queued work. It must
          // be complete before the idle run executes this entry, so record a
          // warning instead of rejecting the defer.
          warnings.push(`${entry.feature}:${entry.taskId}: required dependency ${depFeature}:${depTaskId} is not complete; the queue must not execute this entry until it is`)
        }
      } else if (depIndex >= index) {
        errors.push(`${entry.feature}:${entry.taskId}: dependency ${depFeature}:${depTaskId} must be earlier in the queue`)
      }
    }
    for (const depSpec of config.specDependencies[entry.feature] ?? []) {
      const depContext = await contextFor(depSpec)
      if (depContext?.phase === 'done') continue
      const depIndexes = entries
        .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
        .filter(({ candidate }) => candidate.feature === depSpec && candidate.status !== 'done')
        .map(({ candidateIndex }) => candidateIndex)
      if (depIndexes.length === 0) {
        errors.push(`${entry.feature}:${entry.taskId}: spec dependency ${depSpec} is not done and has no queued tasks`)
      } else if (depIndexes.some((depIndex) => depIndex >= index)) {
        errors.push(`${entry.feature}:${entry.taskId}: spec dependency ${depSpec} must be earlier in the queue`)
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings }
}

function sortedEntries(
  entries: readonly IdleEntry[],
  config: IdleConfig,
  errors: string[],
): IdleEntry[] {
  const nodes = entries.map((entry, index) => ({ entry, index }))
  const byKey = new Map(nodes.map((node) => [depKey(node.entry.feature, node.entry.taskId), node]))
  const out: IdleEntry[] = []
  const state = new Map<number, 'new' | 'visiting' | 'done'>()
  const visit = (node: { entry: IdleEntry; index: number }, trail: number[]): void => {
    const current = state.get(node.index) ?? 'new'
    if (current === 'done') return
    if (current === 'visiting') {
      errors.push(`queue dependency cycle: ${[...trail, node.index].map((index) => `${entries[index]?.feature}:${entries[index]?.taskId}`).join(' -> ')}`)
      return
    }
    state.set(node.index, 'visiting')
    for (const dependency of node.entry.dependsOn) {
      const split = splitDep(dependency)
      const depNode = byKey.get(depKey(split?.feature ?? node.entry.feature, split?.taskId ?? dependency))
      if (depNode !== undefined) visit(depNode, [...trail, node.index])
    }
    for (const depSpec of config.specDependencies[node.entry.feature] ?? []) {
      for (const candidate of nodes) {
        if (candidate.entry.feature === depSpec) visit(candidate, [...trail, node.index])
      }
    }
    state.set(node.index, 'done')
    out.push(node.entry)
  }
  for (const node of nodes) visit(node, [])
  return out
}

function entryFrom(input: {
  feature: string
  taskId: string
  title: string
  optional: boolean
  dependsOn: string[]
  peakCost: number
  note: string
}, previous?: IdleEntry): IdleEntry {
  const at = nowIso()
  return {
    id: previous?.id ?? `idle-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`,
    feature: safeFeature(input.feature),
    taskId: input.taskId,
    title: input.title,
    optional: input.optional,
    dependsOn: [...new Set(input.dependsOn)],
    peakCost: Math.max(0, input.peakCost),
    status: previous?.status ?? 'queued',
    createdAt: previous?.createdAt ?? at,
    updatedAt: at,
    note: input.note,
  }
}

async function addOne(
  root: string,
  config: IdleConfig,
  entries: IdleEntry[],
  payload: Record<string, unknown>,
): Promise<IdleEntry> {
  const feature = safeFeature(string(payload.feature))
  const taskId = string(payload.taskId)
  if (taskId === '') throw new SpecError('idle entry requires taskId')
  if (entries.some((entry) => entry.feature === feature && entry.taskId === taskId)) {
    throw new SpecError(`${feature}:${taskId} is already in the idle queue`, 'KAZE_IDLE_DUPLICATE')
  }
  const context = await featureContext(root, feature)
  const task = context.byId.get(taskId)
  if (task === undefined) throw new SpecError(`${feature}:${taskId}: task not found`, 'KAZE_IDLE_TASK_NOT_FOUND')
  if (task.status === 'completed') throw new SpecError(`${feature}:${taskId}: task is already completed`, 'KAZE_IDLE_TASK_DONE')
  if (!task.optional) {
    // The idle queue is the low-cost lane for deferrable work; a required task
    // queued there would silently wait while the execution loop skips it.
    throw new SpecError(
      `${feature}:${taskId} is a required task; the idle queue only accepts optional tasks`,
      'KAZE_SPEC_IDLE_REQUIRED',
    )
  }
  const dependsOn = Array.isArray(payload.dependsOn)
    ? stringList(payload.dependsOn)
    : deriveDependsOn(context, taskId)
  const peakCost = Math.max(0, number(payload.peakCost, config.defaultPeakCost))
  const entry = entryFrom({
    feature,
    taskId,
    title: task.title,
    optional: task.optional,
    dependsOn,
    peakCost,
    note: string(payload.note),
  })
  const candidate = [...entries, entry]
  const validation = await validateQueue(root, config, candidate)
  if (!validation.ok) throw new SpecError(validation.errors.join('; '), 'KAZE_IDLE_CONFLICT')
  return entry
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null || value === '') return {}
  if (typeof value === 'string') {
    try {
      return object(JSON.parse(value), 'idle payload')
    } catch (error) {
      if (error instanceof SpecError) throw error
      throw new SpecError(`invalid idle payload: ${(error as Error).message}`)
    }
  }
  return object(value, 'idle payload')
}

export async function idleStatus(root: string, at = new Date()): Promise<IdleStatus> {
  const config = await readIdleConfig(root)
  const queue = await readIdleQueue(root)
  const validation = await validateQueue(root, config, queue.entries)
  const idle = isIdleAt(config, at)
  return {
    config,
    queue: queue.entries.map((entry, index) => costView(entry, config, index)),
    now: at.toISOString(),
    idle,
    priceMultiplier: idle ? config.idlePriceMultiplier : 1,
    nextChange: (() => {
      const next = scanTransition(config, at, !idle)
      return next === null ? null : { at: next, idle: !idle }
    })(),
    nextIdle: idle ? at.toISOString() : scanTransition(config, at, true),
    nextPeak: idle ? scanTransition(config, at, false) : at.toISOString(),
    counts: {
      queued: queue.entries.filter((entry) => entry.status === 'queued').length,
      running: queue.entries.filter((entry) => entry.status === 'running').length,
      done: queue.entries.filter((entry) => entry.status === 'done').length,
      failed: queue.entries.filter((entry) => entry.status === 'failed').length,
      queuedTasks: queue.entries.filter((entry) => entry.status === 'queued' || entry.status === 'running').length,
    },
    validation,
  }
}

export async function idleMutate(
  root: string,
  action: string,
  payloadValue: unknown,
  signal?: AbortSignal,
): Promise<IdleMutationResult> {
  const payload = parsePayload(payloadValue)
  if (action === 'status') return { ...(await idleStatus(root)), result: null }
  let result: unknown = null
  await withSpecLock(root, async () => {
    signal?.throwIfAborted()
    const config = await readIdleConfig(root)
    let activeConfig = config
    const queue = await readIdleQueue(root)
    const entries = queue.entries
    switch (action) {
      case 'status':
        break
      case 'add': {
        const entry = await addOne(root, config, entries, payload)
        entries.push(entry)
        result = entry
        break
      }
      case 'defer': {
        const feature = safeFeature(string(payload.feature))
        const context = await featureContext(root, feature)
        const before = [...entries]
        const added: string[] = []
        const skipped: string[] = []
        for (const task of context.tasks) {
          if (!task.leaf || !task.optional) continue
          if (task.status === 'completed') {
            skipped.push(`${task.id}: already completed`)
            continue
          }
          if (entries.some((entry) => entry.feature === feature && entry.taskId === task.id)) {
            skipped.push(`${task.id}: already queued`)
            continue
          }
          entries.push(entryFrom({
            feature,
            taskId: task.id,
            title: task.title,
            optional: true,
            dependsOn: deriveDependsOn(context, task.id),
            peakCost: Math.max(0, number(payload.peakCost, config.defaultPeakCost)),
            note: 'deferred from /spec-apply or /spec-complete',
          }))
          added.push(task.id)
        }
        const errors: string[] = []
        const sorted = sortedEntries(entries, config, errors)
        const validation = errors.length === 0 ? await validateQueue(root, config, sorted) : { ok: false, errors, warnings: [] }
        if (!validation.ok) {
          entries.splice(0, entries.length, ...before)
          throw new SpecError(validation.errors.join('; '), 'KAZE_IDLE_CONFLICT')
        }
        entries.splice(0, entries.length, ...sorted)
        result = { added, skipped }
        break
      }
      case 'update': {
        const entryId = string(payload.entryId)
        const index = entries.findIndex((entry) => entry.id === entryId)
        if (index < 0) throw new SpecError(`idle entry not found: ${entryId}`, 'KAZE_IDLE_NOT_FOUND')
        const entry = entries[index]!
        const next = entryFrom({
          feature: entry.feature,
          taskId: entry.taskId,
          title: entry.title,
          optional: entry.optional,
          dependsOn: Array.isArray(payload.dependsOn) ? stringList(payload.dependsOn) : entry.dependsOn,
          peakCost: number(payload.peakCost, entry.peakCost),
          note: string(payload.note, entry.note),
        }, entry)
        if (typeof payload.status === 'string' && ['queued', 'running', 'done', 'failed'].includes(payload.status)) {
          next.status = payload.status as IdleEntryStatus
        }
        entries[index] = next
        result = next
        break
      }
      case 'remove': {
        const entryId = string(payload.entryId)
        const index = entries.findIndex((entry) => entry.id === entryId)
        if (index < 0) throw new SpecError(`idle entry not found: ${entryId}`, 'KAZE_IDLE_NOT_FOUND')
        result = entries.splice(index, 1)[0]
        break
      }
      case 'prune': {
        // Recovery action: drop entries whose spec or task no longer exists, or
        // whose task is already complete. Unlike `remove`, it is allowed to
        // succeed while the remaining queue is still unhealthy.
        const before = entries.length
        const kept: IdleEntry[] = []
        const removed: string[] = []
        for (const entry of entries) {
          try {
            const context = await featureContext(root, entry.feature)
            const task = context.byId.get(entry.taskId)
            if (task === undefined) {
              removed.push(`${entry.feature}:${entry.taskId} (missing task)`)
              continue
            }
            if (task.status === 'completed') {
              removed.push(`${entry.feature}:${entry.taskId} (completed)`)
              continue
            }
            // A failed entry for a done spec has no retry path left; archived
            // specs already surface above as "missing spec".
            if (entry.status === 'failed' && context.phase === 'done') {
              removed.push(`${entry.feature}:${entry.taskId} (spec done)`)
              continue
            }
          } catch {
            removed.push(`${entry.feature}:${entry.taskId} (missing spec)`)
            continue
          }
          kept.push(entry)
        }
        entries.splice(0, entries.length, ...kept)
        result = { removed, before, after: kept.length }
        break
      }
      case 'move': {
        const entryId = string(payload.entryId)
        const index = entries.findIndex((entry) => entry.id === entryId)
        if (index < 0) throw new SpecError(`idle entry not found: ${entryId}`, 'KAZE_IDLE_NOT_FOUND')
        const direction = string(payload.direction) === 'up' ? -1 : 1
        const target = index + direction
        if (target < 0 || target >= entries.length) throw new SpecError('idle entry is already at the edge')
        const before = [...entries]
        const [entry] = entries.splice(index, 1)
        entries.splice(target, 0, entry!)
        const validation = await validateQueue(root, config, entries)
        if (!validation.ok) {
          entries.splice(0, entries.length, ...before)
          throw new SpecError(validation.errors.join('; '), 'KAZE_IDLE_CONFLICT')
        }
        result = { from: index, to: target }
        break
      }
      case 'sort': {
        const errors: string[] = []
        const sorted = sortedEntries(entries, config, errors)
        if (errors.length > 0) throw new SpecError(errors.join('; '), 'KAZE_IDLE_CONFLICT')
        const validation = await validateQueue(root, config, sorted)
        if (!validation.ok) throw new SpecError(validation.errors.join('; '), 'KAZE_IDLE_CONFLICT')
        entries.splice(0, entries.length, ...sorted)
        result = { order: sorted.map((entry) => entry.id) }
        break
      }
      case 'config': {
        const raw = payload.config ?? payload
        const next = normalizeConfig(typeof raw === 'string' ? parsePayload(raw) : raw)
        await writeIdleConfig(root, next)
        activeConfig = next
        result = next
        break
      }
      case 'clear': {
        entries.splice(0, entries.length)
        break
      }
      default:
        throw new SpecError(`unknown idle action: ${action}`)
    }
    const validation = await validateQueue(root, activeConfig, entries)
    // Recovery actions (`remove`, `prune`, `clear`) must stay possible even when
    // other stale entries keep the queue invalid; otherwise one archived spec
    // locks every queue mutation behind a full `clear`.
    const recovery = action === 'remove' || action === 'prune' || action === 'clear' || action === 'config'
    if (!validation.ok && !recovery) {
      throw new SpecError(validation.errors.join('; '), 'KAZE_IDLE_CONFLICT')
    }
    await writeIdleQueue(root, { schema: 1, updatedAt: nowIso(), entries })
  }, signal)
  const status = await idleStatus(root)
  return { ...status, result }
}

export { configPath as idleConfigPath, queuePath as idleQueuePath }


