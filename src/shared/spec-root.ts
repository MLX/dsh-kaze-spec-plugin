/**
 * The one workspace directory that holds Kaze spec state.
 *
 * A product-specific dot-directory keeps Kaze's artifacts apart from the
 * generic `specs/` tree other spec-driven toolkits create, and it is the only
 * place the root name is written down: the host engine, the tab, and every
 * path guard resolve it from here.
 */
export const SPEC_ROOT_NAME = '.kaze'

/** `/<root>/`: the portable marker a guard looks for in a forward-slash path. */
export const SPEC_ROOT_MARKER = `/${SPEC_ROOT_NAME}/`

/** The root name escaped for use as a RegExp segment. */
export const SPEC_ROOT_PATTERN = SPEC_ROOT_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
