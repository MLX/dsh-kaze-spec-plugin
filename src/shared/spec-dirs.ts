/**
 * Directories under `.kaze` that are not specs.
 *
 * The engine keeps a few bookkeeping directories beside the feature specs.
 * They have no `state.json`, so a naive directory scan would report them as
 * damaged specs; both the Host list and the client picker must skip them.
 * `wishes` holds the refined wish records written by `/spec-wish`; it is not a
 * spec, even though it can appear in `.kaze` before the first spec exists.
 */
export const RESERVED_SPEC_DIRS = ['archive', 'specs', 'batch', 'steering', 'wishes'] as const

/** Whether one `.kaze` directory name is a bookkeeping directory, not a spec. */
export function isReservedSpecDir(name: string): boolean {
  return (RESERVED_SPEC_DIRS as readonly string[]).includes(name.trim().toLowerCase())
}

/** Longest accepted feature id, shared by the client form and the engine. */
export const FEATURE_ID_MAX = 81

/**
 * The portable feature-id form: lowercase letters and digits separated by
 * dashes, with no leading or trailing dash. The engine normalizes anything else
 * (`My.Spec` → `my-spec`), so a form that does not already match would name a
 * directory nobody typed.
 */
const FEATURE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/**
 * Why one candidate feature id cannot be used as typed, or `undefined` when it
 * is already in portable form. The reason is a code so each half supplies its
 * own localized message.
 */
export type FeatureIdProblem = 'format' | 'reserved'

export function featureIdProblem(value: string): FeatureIdProblem | undefined {
  if (value.length === 0 || value.length > FEATURE_ID_MAX || !FEATURE_ID_PATTERN.test(value)) return 'format'
  if (isReservedSpecDir(value)) return 'reserved'
  return undefined
}
