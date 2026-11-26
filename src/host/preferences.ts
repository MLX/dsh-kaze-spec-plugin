/**
 * Profile-wide Kaze defaults.
 *
 * The settings page writes these into the `kaze-spec` row's config through the
 * config editor. The Host half, its native tools, and its hooks all read one
 * cached value, so a save applies without restarting them; an external patch
 * edit still takes effect on the next Host start.
 */
import type { Context } from '@deepseek-ai/cordis'
import { DEFAULT_OUTPUT_STYLE, normalizeOutputStyle, type OutputStyle } from './output-style.js'
import type { DesignDetail, SpecScope, SpecType, Workflow } from './spec/paths.js'
import { DEFAULT_DESIGN_DETAIL, DESIGN_DETAILS } from './spec/paths.js'
import { DEFAULT_MAX_PARALLEL, normalizeLanguage, normalizeMaxParallel, type SpecLanguage } from './spec/settings.js'

/** Lowest accepted automatic-correction limit per turn. */
export const STEER_LIMIT_MIN = 1
/** Highest accepted automatic-correction limit per turn. */
export const STEER_LIMIT_MAX = 10

export interface KazePreferences {
  language: SpecLanguage
  maxParallel: number
  /** Warnings fail a phase gate instead of only being reported. */
  strict: boolean
  /** Lint a spec document right after write/edit. */
  validateOnWrite: boolean
  /** Validate touched specs when a turn stops and steer one correction. */
  validateOnTurnEnd: boolean
  /** Automatic corrections allowed per turn before staying silent. */
  steerLimit: number
  /** Project tasks.md into the native Timeline tree. */
  timeline: boolean
  /** Archive a spec automatically after it advances to done. */
  autoArchive: boolean
  defaultSpecType: SpecType
  defaultSpecScope: SpecScope
  defaultSpecWorkflow: Workflow
  defaultDesignDetail: DesignDetail
  /** Default capability id for new specs; empty means none. */
  defaultCapability: string
  /** Inject `.kaze/steering/*.md` once per session. */
  steering: boolean
  /** Voice of user-facing skill prose: structured, or humanized. */
  outputStyle: OutputStyle
}

export const DEFAULT_PREFERENCES: KazePreferences = {
  language: 'zh-CN',
  maxParallel: DEFAULT_MAX_PARALLEL,
  strict: false,
  validateOnWrite: true,
  validateOnTurnEnd: true,
  steerLimit: 5,
  timeline: true,
  autoArchive: false,
  defaultSpecType: 'feature',
  defaultSpecScope: 'brownfield',
  defaultSpecWorkflow: 'requirements-first',
  defaultDesignDetail: DEFAULT_DESIGN_DETAIL,
  defaultCapability: '',
  steering: true,
  outputStyle: DEFAULT_OUTPUT_STYLE,
}

const SPEC_TYPES: readonly SpecType[] = ['feature', 'bugfix']
const SPEC_SCOPES: readonly SpecScope[] = ['brownfield', 'greenfield']
const WORKFLOWS: readonly Workflow[] = ['requirements-first', 'design-first', 'verify-first', 'bugfix']

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function steerLimitValue(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(STEER_LIMIT_MAX, Math.max(STEER_LIMIT_MIN, Math.round(parsed)))
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** Coerce one raw plugin config into complete preferences. */
export function normalizePreferences(
  raw: Record<string, unknown> | undefined,
  fallback: KazePreferences = DEFAULT_PREFERENCES,
): KazePreferences {
  const value = raw ?? {}
  return {
    language: normalizeLanguage(value.defaultLanguage ?? value.language, fallback.language),
    maxParallel: normalizeMaxParallel(value.maxParallel, fallback.maxParallel),
    strict: booleanValue(value.strict, fallback.strict),
    validateOnWrite: booleanValue(value.validateOnWrite, fallback.validateOnWrite),
    validateOnTurnEnd: booleanValue(value.validateOnTurnEnd, fallback.validateOnTurnEnd),
    steerLimit: steerLimitValue(value.steerLimit, fallback.steerLimit),
    timeline: booleanValue(value.timeline, fallback.timeline),
    autoArchive: booleanValue(value.autoArchive, fallback.autoArchive),
    defaultSpecType: pick(value.defaultSpecType, SPEC_TYPES, fallback.defaultSpecType),
    defaultSpecScope: pick(value.defaultSpecScope, SPEC_SCOPES, fallback.defaultSpecScope),
    defaultSpecWorkflow: pick(value.defaultSpecWorkflow, WORKFLOWS, fallback.defaultSpecWorkflow),
    defaultDesignDetail: pick(value.defaultDesignDetail, DESIGN_DETAILS, fallback.defaultDesignDetail),
    defaultCapability: typeof value.defaultCapability === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value.defaultCapability)
      ? value.defaultCapability
      : fallback.defaultCapability,
    steering: booleanValue(value.steering, fallback.steering),
    outputStyle: normalizeOutputStyle(value.outputStyle, fallback.outputStyle),
  }
}

/** The plugin row that owns global preferences. */
export function mainEntryOf(ctx: Context): { readonly options: { readonly id: string; readonly config?: Record<string, unknown> } } | undefined {
  const loader = (ctx as unknown as {
    loader?: { entries(): Iterable<{ readonly options: { readonly id: string; readonly config?: Record<string, unknown> } }> }
  }).loader
  if (loader === undefined) return undefined
  for (const entry of loader.entries()) if (entry.options.id === 'kaze-spec') return entry
  return undefined
}

let cached: KazePreferences | undefined

/** Replace the in-memory defaults after a successful settings save. */
export function cachePreferences(next: KazePreferences): void {
  cached = next
}

/** Current defaults: the saved cache, else the profile row's config. */
export function preferencesOf(ctx: Context): KazePreferences {
  if (cached !== undefined) return cached
  cached = normalizePreferences(mainEntryOf(ctx)?.options.config)
  return cached
}
