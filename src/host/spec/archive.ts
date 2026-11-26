/** Non-destructive spec archive and restore. */
import { mkdir, readdir, rename as moveDir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { buildDelivery, latestGate, readGates } from './delivery.js'
import { SpecError } from './errors.js'
import { withSpecLock } from './lock.js'
import {
  ARCHIVE_DIR,
  ARCHIVE_META,
  exists,
  featureDir,
  nowIso,
  readJson,
  safeFeature,
  writeJson,
  type Phase,
} from './paths.js'
import { loadState, gateErrors, saveState, type SpecState } from './state.js'
import { mergeRequirements } from './living.js'
import { pruneIdleFeature } from './queue.js'

export interface ArchiveMeta {
  schema: 1
  specId: string
  feature: string
  archiveId: string
  archivedAt: string
  phase: Phase
  reason: string
  originalPath: string
}

export interface ArchivedSpec {
  feature: string
  archiveId: string
  archivedAt: string
  phase: string
  type: string
  workflow: string
  reason: string
  path: string
}

function localDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localTime(date = new Date()): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join('')
}

function archiveIdFor(feature: string, at: Date): string {
  // OpenSpec behavior: do not stack a second date prefix on an already dated name.
  if (/^\d{4}-\d{2}-\d{2}-/.test(feature)) return feature
  return `${localDate(at)}-${feature}`
}

async function nextArchiveId(root: string, feature: string, at: Date): Promise<string> {
  const base = archiveIdFor(feature, at)
  const archiveRoot = join(root, ARCHIVE_DIR)
  if (!(await exists(join(archiveRoot, base)))) return base
  const withTime = `${base}-${localTime(at)}`
  if (!(await exists(join(archiveRoot, withTime)))) return withTime
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${withTime}-${index}`
    if (!(await exists(join(archiveRoot, candidate)))) return candidate
  }
  throw new SpecError(`could not allocate an archive id for ${feature}`)
}

async function readMeta(dir: string, archiveId: string): Promise<ArchiveMeta | null> {
  const path = join(dir, ARCHIVE_META)
  if (!(await exists(path))) return null
  try {
    const raw = await readJson(path)
    if (typeof raw !== 'object' || raw === null) return null
    const value = raw as Record<string, unknown>
    if (typeof value.feature !== 'string') return null
    return {
      schema: 1,
      specId: typeof value.specId === 'string' ? value.specId : '',
      feature: value.feature,
      archiveId: typeof value.archiveId === 'string' ? value.archiveId : archiveId,
      archivedAt: typeof value.archivedAt === 'string' ? value.archivedAt : nowIso(),
      phase: (typeof value.phase === 'string' ? value.phase : 'done') as Phase,
      reason: typeof value.reason === 'string' ? value.reason : '',
      originalPath: typeof value.originalPath === 'string' ? value.originalPath : `.kaze/${value.feature}`,
    }
  } catch {
    return null
  }
}

async function readStateSafe(dir: string): Promise<SpecState | null> {
  try {
    const raw = await readJson(join(dir, 'state.json'))
    if (typeof raw !== 'object' || raw === null) return null
    const value = raw as Record<string, unknown>
    return {
      schema: 1,
      feature: typeof value.feature === 'string' ? value.feature : basename(dir),
      specType: value.specType === 'bugfix' ? 'bugfix' : 'feature',
      scope: value.scope === 'brownfield' || value.scope === 'greenfield' ? value.scope : 'unknown',
      workflow: typeof value.workflow === 'string' ? (value.workflow as SpecState['workflow']) : 'requirements-first',
      phase: (typeof value.phase === 'string' ? value.phase : 'done') as Phase,
      createdAt: typeof value.createdAt === 'string' ? value.createdAt : nowIso(),
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso(),
      tasks: {},
      history: [],
    }
  } catch {
    return null
  }
}

/** List archived specs, newest first. */
export async function listArchived(root: string): Promise<ArchivedSpec[]> {
  const archiveRoot = join(root, ARCHIVE_DIR)
  if (!(await exists(archiveRoot))) return []
  const entries = await readdir(archiveRoot, { withFileTypes: true })
  const rows: ArchivedSpec[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(archiveRoot, entry.name)
    const meta = await readMeta(dir, entry.name)
    const state = await readStateSafe(dir)
    // An archived spec carries archive.json or the state.json it was archived
    // with. A stray directory is not an archived spec: listing it would offer a
    // Restore that can only fail.
    if (meta === null && state === null) continue
    const feature = meta?.feature ?? state?.feature ?? entry.name.replace(/^\d{4}-\d{2}-\d{2}-/, '')
    rows.push({
      feature,
      archiveId: meta?.archiveId ?? entry.name,
      archivedAt: meta?.archivedAt ?? state?.updatedAt ?? '',
      phase: meta?.phase ?? state?.phase ?? '',
      type: state?.specType ?? 'feature',
      workflow: state?.workflow ?? '',
      reason: meta?.reason ?? '',
      path: dir,
    })
  }
  return rows.sort((left, right) => (right.archivedAt || '').localeCompare(left.archivedAt || '') || right.archiveId.localeCompare(left.archiveId))
}

/** Move a completed spec into `.kaze/archive/YYYY-MM-DD-<feature>/`. */
export async function archiveSpec(
  root: string,
  feature: string,
  options: { reason?: string; force?: boolean } = {},
  signal?: AbortSignal,
): Promise<{ feature: string; archiveId: string; path: string; archivedAt: string; idlePruned: number }> {
  const name = safeFeature(feature)
  const source = featureDir(root, name)
  if (!(await exists(source))) throw new SpecError(`spec not found: ${feature}`, 'KAZE_SPEC_NOT_FOUND')
  const state = await loadState(root, name)
  if (state.phase !== 'done' && options.force !== true) {
    throw new SpecError(`spec ${name} is not done (phase=${state.phase}); pass force=true to archive it`, 'KAZE_SPEC_NOT_DONE')
  }
  // A recorded, failed archive gate blocks archiving unless forced; an absent
  // or approved gate leaves the existing done/force rule in charge.
  if (options.force !== true) {
    const gates = await readGates(root, name)
    const archiveGate = latestGate(gates, 'archive')
    if (archiveGate?.status === 'failed') {
      throw new SpecError(
        `archive gate is failed${archiveGate.reason === '' ? '' : `: ${archiveGate.reason}`}; record an approved decision or pass force=true`,
        'KAZE_SPEC_GATE_FAILED',
      )
    }
  }

  return withSpecLock(source, async () => {
    // Archiving is a delivery decision: a done spec must still satisfy its
    // own done gate. This catches documents edited after approval even when
    // the edit happened outside the engine (for example by a file tool).
    if (state.phase === 'done') {
      const gate = await gateErrors(root, name, 'done')
      if (!gate.ok) {
        throw new SpecError(
          `cannot archive ${name}: the done gate no longer passes: ${gate.errors.join('; ')}`,
          'KAZE_SPEC_GATE_FAILED',
        )
      }
    }
    // A spec bound to a capability must update the capability record before it
    // leaves the active tree. A merge conflict aborts the archive. A forced
    // archive of unfinished work skips the merge instead: unaccepted behavior
    // must never be published into the capability.
    if (state.capability !== undefined && !(options.force === true && state.phase !== 'done')) {
      try {
        await mergeRequirements(root, name, {}, signal)
      } catch (error) {
        const message = (error as Error).message
        throw new SpecError(
          `cannot archive ${name}: capability merge failed: ${message}` +
            (message.includes('merge conflicts')
              ? `; resolve with kaze_spec_merge { feature: "${name}", force: true } or edit .kaze/specs/${state.capability}/spec.md`
              : ''),
          'KAZE_SPEC_MERGE',
        )
      }
    }
    // Archived specs must carry a current delivery report, so refresh it while
    // the spec is still at its live path. A failed build aborts the archive.
    try {
      await buildDelivery(root, name, '', signal)
    } catch (error) {
      throw new SpecError(
        `cannot archive ${name}: delivery.md could not be built: ${(error as Error).message}`,
        'KAZE_SPEC_DELIVERY',
      )
    }
    const at = new Date()
    const archiveId = await nextArchiveId(root, name, at)
    const archiveRoot = join(root, ARCHIVE_DIR)
    const target = join(archiveRoot, archiveId)
    await mkdir(archiveRoot, { recursive: true })
    await moveDir(source, target)
    // The lock moved with the directory.
    await rm(join(target, 'kaze.lock'), { force: true })

    const archivedAt = nowIso()
    const config = await readJson(join(target, 'config.json')).catch(() => null)
    const specId = typeof config === 'object' && config !== null && typeof (config as { specId?: unknown }).specId === 'string'
      ? (config as { specId: string }).specId
      : ''
    const stateFile = await readJson(join(target, 'state.json')).catch(() => null)
    if (typeof stateFile === 'object' && stateFile !== null) {
      const value = stateFile as Record<string, unknown>
      const history = Array.isArray(value.history) ? value.history : []
      value.history = [...history, { at: archivedAt, event: 'archive', archiveId, reason: options.reason ?? 'completed' }]
      value.updatedAt = archivedAt
      await writeJson(join(target, 'state.json'), value)
    }
    const meta: ArchiveMeta = {
      schema: 1,
      specId,
      feature: name,
      archiveId,
      archivedAt,
      phase: state.phase,
      reason: options.reason ?? 'completed',
      originalPath: `.kaze/${name}`,
    }
    await writeJson(join(target, ARCHIVE_META), meta)
    // Queue entries for an archived spec can never run again; leaving them in
    // place makes the whole idle queue fail validation.
    const idlePruned = await pruneIdleFeature(root, name)
    return { feature: name, archiveId, path: target, archivedAt, idlePruned }
  }, signal)
}

/** Restore one archived spec by archive id or feature name. */
export async function restoreSpec(
  root: string,
  query: string,
  signal?: AbortSignal,
): Promise<{ feature: string; archiveId: string; path: string }> {
  const archived = await listArchived(root)
  const needle = query.trim()
  const exact = archived.filter((entry) => entry.archiveId === needle)
  const matches = exact.length > 0 ? exact : archived.filter((entry) => entry.feature === needle)
  if (matches.length === 0) throw new SpecError(`archived spec not found: ${query}`, 'KAZE_SPEC_NOT_FOUND')
  if (matches.length > 1) {
    throw new SpecError(
      `multiple archived specs match ${query}: ${matches.map((entry) => entry.archiveId).join(', ')}`,
      'KAZE_SPEC_AMBIGUOUS',
    )
  }
  const match = matches[0]!
  const target = featureDir(root, match.feature)
  if (await exists(target)) throw new SpecError(`target already exists: ${match.feature}`, 'KAZE_SPEC_EXISTS')

  return withSpecLock(match.path, async () => {
    await moveDir(match.path, target)
    await rm(join(target, 'kaze.lock'), { force: true })
    await rm(join(target, ARCHIVE_META), { force: true })
    const state = await loadState(root, match.feature)
    state.history.push({ at: nowIso(), event: 'restore', archiveId: match.archiveId })
    await saveState(root, match.feature, state)
    return { feature: match.feature, archiveId: match.archiveId, path: target }
  }, signal)
}


