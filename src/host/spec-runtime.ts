/**
 * Synchronous snapshot of one workspace's Kaze runtime facts.
 *
 * Two native seams need these values synchronously: a `systemPrompt.context()`
 * provider runs during prompt assembly, and a `tools.guard()` runs before a
 * tool dispatches. Neither can await `readSpecConfig`, so both read the same
 * two tiny files behind a short cache instead of forcing a second file read
 * onto the model.
 *
 * The workspace files stay authoritative. A stale cache can only last
 * {@link TTL_MS}, and every writer in this process calls
 * {@link invalidateWorkspaceRuntime} so a saved setting applies on the next
 * assembly.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isReservedSpecDir } from '../shared/spec-dirs.js'
import { SPEC_ROOT_NAME } from '../shared/spec-root.js'
import {
  DEFAULT_MAX_PARALLEL,
  normalizeLanguage,
  normalizeMaxParallel,
  type SpecLanguage,
} from './spec/settings.js'

/** How long one snapshot may serve prompt and guard reads. */
export const TTL_MS = 2000

/** What the prompt context and the guards need to know about a workspace. */
export interface WorkspaceSpecRuntime {
  /** Whether `<cwd>/.kaze` exists at all. */
  exists: boolean
  /** Workspace spec prose language, or the profile default. */
  language: SpecLanguage
  /** Workspace parallel task cap, or the profile default. */
  maxParallel: number
  /** Features whose `state.json` phase is `execute`, in directory order. */
  executing: readonly string[]
}

const cache = new Map<string, { at: number; value: WorkspaceSpecRuntime }>()

function readJsonFile(path: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

function readRuntime(
  root: string,
  fallbackLanguage: SpecLanguage,
  fallbackMaxParallel: number,
): WorkspaceSpecRuntime {
  if (!existsSync(root)) {
    return {
      exists: false,
      language: fallbackLanguage,
      maxParallel: fallbackMaxParallel,
      executing: [],
    }
  }
  const config = readJsonFile(join(root, 'spec-config.json'))
  const language = normalizeLanguage(config?.language, fallbackLanguage)
  const maxParallel = normalizeMaxParallel(config?.maxParallel, fallbackMaxParallel)
  // Only the execute-phase guard needs the directory scan, so it runs once per
  // snapshot on first access instead of on every prompt assembly.
  let executing: readonly string[] | undefined
  return {
    exists: true,
    language,
    maxParallel,
    get executing(): readonly string[] {
      return executing ?? (executing = scanExecuting(root))
    },
  }
}

/** Features whose state.json is in the execute phase; a failed scan denies nothing. */
function scanExecuting(root: string): readonly string[] {
  const executing: string[] = []
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || isReservedSpecDir(entry.name)) continue
      const state = readJsonFile(join(root, entry.name, 'state.json'))
      if (state?.phase === 'execute') executing.push(entry.name)
    }
  } catch {
    // An unreadable `.kaze` directory reads as "no executing spec": a guard
    // must never deny work because a scan failed.
  }
  return executing
}

/**
 * Read the current workspace snapshot, at most once per {@link TTL_MS}.
 * @param cwd - absolute workspace directory.
 * @param fallbackLanguage - profile default used when the workspace sets none.
 * @param fallbackMaxParallel - profile default used when the workspace sets none.
 * @returns the cached or freshly read snapshot.
 */
export function workspaceRuntime(
  cwd: string,
  fallbackLanguage: SpecLanguage = 'zh-CN',
  fallbackMaxParallel: number = DEFAULT_MAX_PARALLEL,
): WorkspaceSpecRuntime {
  const root = join(cwd, SPEC_ROOT_NAME)
  const now = Date.now()
  const hit = cache.get(root)
  if (hit !== undefined && now - hit.at < TTL_MS) return hit.value
  const value = readRuntime(root, fallbackLanguage, fallbackMaxParallel)
  cache.set(root, { at: now, value })
  return value
}

/**
 * Drop one workspace's snapshot after a write this process performed.
 * @param cwd - absolute workspace directory.
 */
export function invalidateWorkspaceRuntime(cwd: string): void {
  cache.delete(join(cwd, SPEC_ROOT_NAME))
}

/** Drop every snapshot; exposed so tests start from a clean cache. */
export function clearWorkspaceRuntimeCache(): void {
  cache.clear()
}
