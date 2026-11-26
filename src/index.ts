import type { Context } from '@deepseek-ai/cordis'

export const name = 'kaze-spec-plugin'

/**
 * Plugin identity.
 *
 * The functional Host half is `src/host/index.ts`: it owns the TypeScript spec
 * engine, registers `kaze_spec_*` tools, projects tasks into Timeline, and
 * mounts the review Remote. This entry stays empty so the loader can address
 * `kaze-spec-plugin` independently of the Host service.
 */
export function apply(_ctx: Context): void {
  // Intentionally empty: the client tab is the whole product surface.
}
