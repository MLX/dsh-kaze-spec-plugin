/**
 * Minimal idle-queue file helpers for operations outside the idle engine.
 *
 * Archiving or renaming a spec must reconcile `.kaze/idle-queue.json`; the
 * idle engine owns the full entry schema, so these helpers read and rewrite the
 * file without interpreting it, keeping every unknown field intact.
 */
import { join } from 'node:path'
import { exists, readJson, writeJson } from './paths.js'

export const QUEUE_FILE = 'idle-queue.json'

interface QueueDocument {
  schema?: unknown
  updatedAt?: unknown
  entries?: unknown
  [key: string]: unknown
}

async function readDocument(root: string): Promise<QueueDocument | null> {
  const path = join(root, QUEUE_FILE)
  if (!(await exists(path))) return null
  try {
    const raw = await readJson(path)
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw as QueueDocument : null
  } catch {
    // A damaged queue is reported by the idle tool; archive/rename must not
    // fail because the bookkeeping file cannot be parsed.
    return null
  }
}

function entriesOf(document: QueueDocument): Record<string, unknown>[] {
  return Array.isArray(document.entries)
    ? document.entries.filter((entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry))
    : []
}

async function writeDocument(root: string, document: QueueDocument, entries: readonly Record<string, unknown>[]): Promise<void> {
  await writeJson(join(root, QUEUE_FILE), {
    ...document,
    schema: 1,
    updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    entries,
  })
}

/** Remove every queued entry that points at the given spec. */
export async function pruneIdleFeature(root: string, feature: string): Promise<number> {
  const document = await readDocument(root)
  if (document === null) return 0
  const entries = entriesOf(document)
  const kept = entries.filter((entry) => entry.feature !== feature)
  if (kept.length === entries.length) return 0
  await writeDocument(root, document, kept)
  return entries.length - kept.length
}

/**
 * Re-point queued entries from one feature to another.
 *
 * A duplicate entry for the new feature+task is dropped so the queue never
 * carries two rows for the same task.
 */
export async function renameIdleFeature(root: string, from: string, to: string): Promise<{ updated: number; dropped: number }> {
  const document = await readDocument(root)
  if (document === null) return { updated: 0, dropped: 0 }
  const entries = entriesOf(document)
  const seen = new Set<string>()
  const next: Record<string, unknown>[] = []
  let updated = 0
  let dropped = 0
  for (const entry of entries) {
    const feature = entry.feature === from ? to : entry.feature
    const key = `${String(feature)}\u0000${String(entry.taskId)}`
    if (feature !== entry.feature) updated += 1
    if (seen.has(key)) {
      dropped += 1
      continue
    }
    seen.add(key)
    next.push({ ...entry, feature })
  }
  if (updated === 0 && dropped === 0) return { updated: 0, dropped: 0 }
  await writeDocument(root, document, next)
  return { updated, dropped }
}

/** Whether the queue file exists for the workspace root. */
export async function idleQueueExists(root: string): Promise<boolean> {
  return exists(join(root, QUEUE_FILE))
}
