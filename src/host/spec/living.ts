/** Living capability specs: merge one feature spec's requirements into `.kaze/specs/<capability>/spec.md`. */
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { SpecError } from './errors.js'
import { latestGate, readGates, specDocsHash } from './delivery.js'
import { withSpecLock } from './lock.js'
import { exists, nowIso, PHASES, readJson, readText, safeFeature, writeAtomic, writeJson } from './paths.js'
import { loadState, requirementsHash, saveState } from './state.js'
import { parseTasks } from './tasks.js'

export interface LivingBlock {
  key: string
  title: string
  body: string
}

export interface MergeResult {
  capability: string
  path: string
  added: string[]
  updated: string[]
  removed: string[]
  unchanged: string[]
  conflicts: string[]
}

interface BaseSnapshot {
  capability: string
  at: string
  blocks: LivingBlock[]
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim().toLowerCase()
}

function sameBody(left: string, right: string): boolean {
  return normalizeBody(left) === normalizeBody(right)
}

/** Parse `### Requirement N: Title` (or `### Requirement: Title`) blocks. */
export function parseRequirementBlocks(text: string): LivingBlock[] {
  const lines = text.split(/\r?\n/)
  const starts: Array<{ index: number; title: string }> = []
  lines.forEach((line, index) => {
    const match = /^###\s+(?:Requirement|需求)\s*(?:\d+)?\s*[:：]\s*(.+?)\s*$/.exec(line)
    if (match !== null) starts.push({ index, title: match[1]! })
  })
  return starts.map((start, position) => {
    let end = position + 1 < starts.length ? starts[position + 1]!.index : lines.length
    for (let index = start.index + 1; index < end; index += 1) {
      if (/^##\s/.test(lines[index]!)) {
        end = index
        break
      }
    }
    const body = lines.slice(start.index + 1, end).join('\n').replace(/\n+$/, '')
    return { key: normalizeTitle(start.title), title: start.title, body }
  })
}

/** Explicit removals declared in the feature requirements. */
export function parseRemovedTitles(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((line) => /^##\s+(?:Removed Requirements|移除的需求|删除的需求)\s*$/.test(line))
  if (start < 0) return []
  const titles: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (/^##\s/.test(line)) break
    const match = /^\s*[-*]\s+(.+?)\s*$/.exec(line)
    if (match !== null) titles.push(match[1]!)
  }
  return titles
}

function renderDocument(capability: string, blocks: readonly LivingBlock[], logRows: readonly string[]): string {
  const parts = [
    `# ${capability} Specification`,
    '',
    '## Purpose',
    '',
    `Behavior accumulated for the ${capability} capability. Maintained by \`kaze_spec_merge\`; edit the feature spec, not this file.`,
    '',
    '## Requirements',
    '',
  ]
  for (const block of blocks) {
    parts.push(`### Requirement: ${block.title}`, '', block.body.trim(), '')
  }
  if (logRows.length > 0) {
    parts.push('## Change Log', '', '| Date | Spec | Result |', '|---|---|---|', ...logRows, '')
  }
  return `${parts.join('\n').replace(/\n{3,}/g, '\n\n')}\n`
}

function existingLogRows(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(line))
}

function basePath(root: string, feature: string): string {
  return join(root, safeFeature(feature), 'capability-base.json')
}

async function readBase(root: string, feature: string, capability: string): Promise<Map<string, LivingBlock> | null> {
  const path = basePath(root, feature)
  if (!(await exists(path))) return null
  try {
    const value = (await readJson(path)) as Partial<BaseSnapshot>
    if (value.capability !== capability || !Array.isArray(value.blocks)) return null
    return new Map(value.blocks.map((block) => [block.key, block]))
  } catch {
    return null
  }
}

/**
 * Merge the feature's requirements into its capability spec.
 * A three-way merge against the last baseline detects another spec changing the
 * same requirement; `force` replaces instead of reporting a conflict.
 * The capability file is locked for the whole merge.
 */
export async function mergeRequirements(
  root: string,
  feature: string,
  options: { capability?: string; force?: boolean } = {},
  signal?: AbortSignal,
): Promise<MergeResult> {
  const state = await loadState(root, feature)
  const capability = options.capability ?? state.capability
  if (capability === undefined) {
    throw new SpecError('spec has no capability; set one with kaze_spec_capability before merging')
  }
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(capability)) {
    throw new SpecError(`invalid capability ${JSON.stringify(capability)}`)
  }
  await mkdir(join(root, 'specs', capability), { recursive: true })
  return withSpecLock(join(root, 'specs', capability), async () =>
    mergeInto(root, feature, capability, options, signal), signal)
}

async function mergeInto(
  root: string,
  feature: string,
  capability: string,
  options: { capability?: string; force?: boolean },
  signal?: AbortSignal,
): Promise<MergeResult> {
  signal?.throwIfAborted()
  const state = await loadState(root, feature)
  const featureDir = join(root, safeFeature(feature))
  // A capability records accepted behavior, not a draft. The task plan must
  // exist and every required task must be complete before it is published.
  if (PHASES.indexOf(state.phase) < PHASES.indexOf('tasks')) {
    throw new SpecError(
      `cannot merge ${feature} at phase=${state.phase}: the capability accepts behavior only after the task plan exists and execution is complete`,
    )
  }
  const tasksPath = join(featureDir, 'tasks.md')
  const tasksText = (await exists(tasksPath)) ? await readText(tasksPath) : ''
  const required = parseTasks(tasksText).filter((task) => task.leaf && !task.optional)
  if (required.length === 0) {
    throw new SpecError(`cannot merge ${feature}: tasks.md has no required tasks`)
  }
  const open = required.filter((task) => task.status !== 'completed')
  if (open.length > 0) {
    throw new SpecError(
      `cannot merge ${feature}: required tasks are not complete (${open.map((task) => task.id).join(', ')})`,
    )
  }
  // A capability publishes accepted behavior, so acceptance and FTA must be
  // decided before the merge. The done gate repeats the freshness check.
  if (state.phase !== 'done') {
    const gates = await readGates(root, feature)
    const acceptance = latestGate(gates, 'acceptance')
    const fta = latestGate(gates, 'fta')
    const decided = (gate: typeof acceptance): boolean =>
      gate !== undefined && (gate.status === 'approved' || (gate.status === 'skipped' && gate.reason.trim() !== ''))
    if (!decided(acceptance) || !decided(fta)) {
      throw new SpecError(
        `cannot merge ${feature}: acceptance and FTA must be approved (or skipped with a reason) before publishing`,
      )
    }
    const docsHash = await specDocsHash(root, feature)
    for (const gate of [acceptance, fta]) {
      if (gate?.status !== 'approved') continue
      if (gate.docsHash !== undefined && gate.docsHash !== docsHash) {
        throw new SpecError(
          `cannot merge ${feature}: the ${gate.gate} approval is stale; re-verify and re-record it before publishing`,
        )
      }
    }
  }
  const requirementsPath = join(featureDir, 'requirements.md')
  if (!(await exists(requirementsPath))) {
    throw new SpecError('missing requirements.md; merge needs a feature requirements document')
  }
  const source = await readText(requirementsPath)
  const incoming = parseRequirementBlocks(source)
  if (incoming.length === 0) throw new SpecError('requirements.md has no ### Requirement blocks to merge')
  const removals = parseRemovedTitles(source).map(normalizeTitle)

  const targetDir = join(root, 'specs', capability)
  const targetPath = join(targetDir, 'spec.md')
  const previousText = (await exists(targetPath)) ? await readText(targetPath) : ''
  const current = new Map(parseRequirementBlocks(previousText).map((block) => [block.key, block]))
  const base = (await readBase(root, feature, capability)) ?? current
  const merged = new Map(current)

  const added: string[] = []
  const updated: string[] = []
  const unchanged: string[] = []
  const removed: string[] = []
  const conflicts: string[] = []

  for (const block of incoming) {
    const now = current.get(block.key)
    const before = base.get(block.key)
    if (now === undefined) {
      added.push(block.title)
      merged.set(block.key, block)
      continue
    }
    if (sameBody(now.body, block.body)) {
      unchanged.push(block.title)
      continue
    }
    if (before === undefined) {
      // Another spec added this requirement after this feature's baseline.
      if (options.force === true) {
        updated.push(block.title)
        merged.set(block.key, block)
      } else {
        conflicts.push(block.title)
      }
      continue
    }
    if (!sameBody(before.body, now.body)) {
      // Both sides changed the same requirement.
      if (options.force === true) {
        updated.push(block.title)
        merged.set(block.key, block)
      } else {
        conflicts.push(block.title)
      }
      continue
    }
    updated.push(block.title)
    merged.set(block.key, block)
  }

  for (const key of removals) {
    const now = current.get(key)
    const before = base.get(key)
    if (now === undefined) {
      conflicts.push(`remove:${key} (not present)`)
      continue
    }
    if (before !== undefined && !sameBody(before.body, now.body) && options.force !== true) {
      conflicts.push(`remove:${now.title} (changed by another spec)`)
      continue
    }
    removed.push(now.title)
    merged.delete(key)
  }

  if (conflicts.length > 0) {
    throw new SpecError(
      `capability "${capability}" has merge conflicts: ${conflicts.join(', ')}; ` +
        'edit the capability spec or pass force=true to replace them',
    )
  }

  const today = nowIso().slice(0, 10)
  const summary = `${added.length} added, ${updated.length} updated, ${removed.length} removed, ${unchanged.length} unchanged`
  const logRows = [...existingLogRows(previousText), `| ${today} | ${safeFeature(feature)} | ${summary} |`]
  await writeAtomic(targetPath, renderDocument(capability, [...merged.values()], logRows))
  const snapshot: BaseSnapshot = { capability, at: nowIso(), blocks: [...merged.values()] }
  await writeJson(basePath(root, feature), snapshot)
  const mergedHash = requirementsHash(source)
  state.capability = capability
  state.capabilityHash = mergedHash
  state.history.push({
    at: nowIso(),
    event: 'capability-merge',
    capability,
    requirementsHash: mergedHash,
    added: added.length,
    updated: updated.length,
    removed: removed.length,
    forced: options.force === true,
  })
  await saveState(root, feature, state)
  return { capability, path: targetPath, added, updated, removed, unchanged, conflicts }
}

export interface CapabilitySummary {
  capability: string
  path: string
  requirements: number
  duplicates: string[]
  lastChange: string
  issues: Array<{ severity: 'error' | 'warning'; message: string }>
}

/** Structural checks for a hand-edited capability spec. */
function capabilityIssues(text: string): Array<{ severity: 'error' | 'warning'; message: string }> {
  const lines = text.split(/\r?\n/)
  const issues: Array<{ severity: 'error' | 'warning'; message: string }> = []
  if (!/^#\s+\S+/m.test(text)) issues.push({ severity: 'error', message: 'missing "# <capability> Specification" title' })
  if (!/^##\s+(?:Purpose|目的)\s*$/m.test(text)) issues.push({ severity: 'warning', message: 'missing ## Purpose' })
  if (!/^##\s+(?:Requirements|需求)\s*$/m.test(text)) issues.push({ severity: 'error', message: 'missing ## Requirements' })
  const blocks = parseRequirementBlocks(text)
  if (blocks.length === 0) issues.push({ severity: 'error', message: 'no ### Requirement blocks' })
  for (const block of blocks) {
    if (block.body.trim() === '') issues.push({ severity: 'error', message: `requirement "${block.title}" has an empty body` })
  }
  const seen = new Set<string>()
  for (const block of blocks) {
    if (seen.has(block.key)) issues.push({ severity: 'error', message: `duplicate requirement title "${block.title}"` })
    seen.add(block.key)
  }
  if (/^##\s+(?:Change Log|变更记录)\s*$/m.test(text) && !/^\|\s*\d{4}-\d{2}-\d{2}\s*\|/m.test(text)) {
    issues.push({ severity: 'warning', message: 'Change Log section has no dated row' })
  }
  return issues
}

/** Read `.kaze/specs/*` into a small index for status and UI. */
export async function listCapabilities(root: string): Promise<CapabilitySummary[]> {
  const dir = join(root, 'specs')
  if (!(await exists(dir))) return []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const rows: CapabilitySummary[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue
    const path = join(dir, entry.name, 'spec.md')
    if (!(await exists(path))) continue
    const text = await readText(path)
    const blocks = parseRequirementBlocks(text)
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const block of blocks) {
      if (seen.has(block.key)) duplicates.push(block.title)
      seen.add(block.key)
    }
    const lastChange = [...text.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm)].at(-1)?.[1] ?? ''
    rows.push({
      capability: entry.name,
      path,
      requirements: blocks.length,
      duplicates,
      lastChange,
      issues: capabilityIssues(text),
    })
  }
  return rows
}
