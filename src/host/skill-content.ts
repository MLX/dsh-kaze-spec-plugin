/**
 * The model-facing skill envelope.
 *
 * DSH owns one canonical `<skill_content>` rendering in
 * `@deepseek-ai/dsh-skill`, shared by the `skill` tool result and the
 * user-gesture injection. The Host half prefers that runtime export: the
 * activation probe imports it once, and every later render delegates to it, so
 * an upgraded DSH changes the envelope without Kaze shipping a stale copy.
 *
 * The pinned fallback below exists only for a profile where the probe cannot
 * resolve the package (for example a session with no mounted skill provider).
 * It reproduces `@deepseek-ai/dsh-skill` 0.2.2-rc.5 (MIT) verbatim; the golden
 * test in `test/skill.test.ts` keeps it honest until the native renderer takes
 * over. `SKILL_ENVELOPE_DSH_VERSION` names the release the fallback matches.
 */

/**
 * The DSH release whose `dsh-skill` rendering the fallback reproduces.
 *
 * When the runtime probe succeeds this version is informational. When it fails,
 * compare `renderSkillContent` with `@deepseek-ai/dsh-skill` on upgrade and
 * update both the fallback and this constant.
 */
export const SKILL_ENVELOPE_DSH_VERSION = '0.2.2-rc.5'

/** Skill resource base union used by loaded skill bodies to resolve relative resources. */
export type SkillResourceBase =
  | { readonly kind: 'directory'; readonly path: string }
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'opaque'; readonly description: string }

/** The parts of a loaded skill definition this renderer reads. */
export interface SkillText {
  readonly name: string
  readonly provider: string
  readonly resourceBase?: SkillResourceBase
  readonly content: string
}

/** The native renderer's shape, resolved from `@deepseek-ai/dsh-skill`. */
export type SkillRenderer = (skill: SkillText) => string

let nativeRenderer: SkillRenderer | undefined
let probe: Promise<boolean> | undefined

/**
 * Install a renderer. The activation probe uses it for the runtime module; the
 * golden test uses it to prove delegation without a resolvable package.
 * @param renderer - the native `renderSkillContent`, or undefined to reset.
 */
export function installSkillRenderer(renderer: SkillRenderer | undefined): void {
  nativeRenderer = renderer
}

/** Whether rendering currently delegates to the runtime package. */
export function hasNativeSkillRenderer(): boolean {
  return nativeRenderer !== undefined
}

/**
 * Resolve the runtime renderer once and keep the result.
 * The dynamic specifier is external in the bundle, so this is exactly the
 * package the running DSH loads for its own skill tool.
 * @returns whether the native renderer is now active.
 */
export async function ensureNativeSkillRenderer(): Promise<boolean> {
  if (nativeRenderer !== undefined) return true
  probe ??= (async () => {
    try {
      // Computed so a bundler leaves it as a runtime import: the running DSH
      // resolver owns this specifier, exactly as it owns the Host's cordis
      // import. A build-time resolution would bake one installation's path in.
      const specifier = ['@deepseek-ai', 'dsh-skill'].join('/')
      const module = await import(/* @vite-ignore */ specifier) as {
        renderSkillContent?: (skill: unknown) => string
      }
      if (typeof module.renderSkillContent !== 'function') return false
      nativeRenderer = (skill) => module.renderSkillContent!(skill)
      return true
    } catch {
      // The pinned fallback keeps every entry point working.
      return false
    }
  })()
  return probe
}

/**
 * Render one loaded skill for the model.
 * @param skill - name, provider, optional resource base, and body to render.
 * @returns the complete model-facing `<skill_content>` block.
 */
export function renderSkillContent(skill: SkillText): string {
  return nativeRenderer === undefined ? fallbackRenderSkillContent(skill) : nativeRenderer(skill)
}

/**
 * Render one loaded skill for the model.
 * @param skill - name, provider, optional resource base, and body to render.
 * @returns the complete model-facing `<skill_content>` block.
 */
function fallbackRenderSkillContent(skill: SkillText): string {
  const resourceHint = renderResourceHint(skill)
  return [
    `<skill_content name="${escapeAttr(skill.name)}">`,
    '<skill_resources>',
    ...resourceHint,
    '</skill_resources>',
    '',
    '<skill_instructions>',
    skill.content,
    '</skill_instructions>',
    '</skill_content>',
  ].join('\n')
}

function renderResourceHint(skill: Pick<SkillText, 'provider' | 'resourceBase'>): string[] {
  const base = skill.resourceBase
  if (base === undefined) {
    return [
      `Resources for this skill are managed by provider "${escapeText(skill.provider)}".`,
      'Load referenced resources only as needed.',
    ]
  }
  switch (base.kind) {
    case 'directory':
      return [
        `Base directory for this skill: ${escapeText(base.path)}`,
        'Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.',
      ]
    case 'url':
      return [
        `Base URL for this skill: ${escapeText(base.url)}`,
        'Resolve relative URLs mentioned by this skill against the base URL before using them. Load referenced resources only as needed.',
      ]
    case 'opaque':
      return [
        `Resources for this skill: ${escapeText(base.description)}`,
        'Load referenced resources only as needed.',
      ]
    default: {
      const unreachable: never = base
      throw new Error(`unknown skill resource base: ${JSON.stringify(unreachable)}`)
    }
  }
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

/**
 * Escape model-facing prose embedded inside skill markup so provider-supplied
 * text cannot open or close framing tags.
 * @param value - raw prose to embed.
 * @returns the escaped text.
 */
export function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
