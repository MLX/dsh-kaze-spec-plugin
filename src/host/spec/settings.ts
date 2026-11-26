/** Workspace-level spec authoring preferences. */
import { exists, nowIso, readJson, writeJson } from './paths.js'
import { join } from 'node:path'

export type SpecLanguage = 'zh-CN' | 'en'

/** Parallel task limit used when neither the workspace nor the profile sets one. */
export const DEFAULT_MAX_PARALLEL = 3
/** Lowest accepted parallel task limit. */
export const MIN_MAX_PARALLEL = 1
/** Highest accepted parallel task limit. */
export const MAX_MAX_PARALLEL = 8

export interface SpecConfig {
  schema: number
  language: SpecLanguage
  maxParallel: number
  updatedAt: string
}

const FILE = 'spec-config.json'

function path(root: string): string {
  return join(root, FILE)
}

/** Coerce a persisted language; anything unrecognized falls back. */
export function normalizeLanguage(value: unknown, fallback: SpecLanguage = 'zh-CN'): SpecLanguage {
  return value === 'en' || value === 'zh-CN' ? value : fallback
}

function clampParallel(value: number): number {
  return Math.min(MAX_MAX_PARALLEL, Math.max(MIN_MAX_PARALLEL, Math.round(value)))
}

/** Coerce a persisted parallel limit into 1..8, rounding and clamping; otherwise fall back. */
export function normalizeMaxParallel(value: unknown, fallback: number = DEFAULT_MAX_PARALLEL): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN
  return Number.isFinite(parsed) ? clampParallel(parsed) : clampParallel(fallback)
}

export async function readSpecConfig(
  root: string,
  fallbackLanguage: SpecLanguage = 'zh-CN',
  fallbackMaxParallel: number = DEFAULT_MAX_PARALLEL,
): Promise<SpecConfig> {
  const file = path(root)
  if (!(await exists(file))) {
    return {
      schema: 1,
      language: normalizeLanguage(fallbackLanguage),
      maxParallel: normalizeMaxParallel(fallbackMaxParallel),
      updatedAt: nowIso(),
    }
  }
  const raw = await readJson(file) as Record<string, unknown>
  return {
    schema: 1,
    language: normalizeLanguage(raw.language, fallbackLanguage),
    maxParallel: normalizeMaxParallel(raw.maxParallel, fallbackMaxParallel),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
  }
}

export async function writeSpecConfig(
  root: string,
  language: SpecLanguage,
  maxParallel: number = DEFAULT_MAX_PARALLEL,
): Promise<SpecConfig> {
  const value: SpecConfig = {
    schema: 1,
    language: normalizeLanguage(language),
    maxParallel: normalizeMaxParallel(maxParallel),
    updatedAt: nowIso(),
  }
  await writeJson(path(root), value)
  return value
}
