/**
 * Kaze's localized command layer.
 *
 * DSH's built-in skill gesture grammar is ASCII-only and its skill catalog is
 * mounted per agent preset. The Kaze menu therefore inserts the stable ASCII
 * command id, and this Host hook resolves every alias (the id or a manually
 * typed localized name) to the skill body before the Agent turn starts. When
 * the current session's preset does not mount the bundled skills, the body is
 * read from the embedded generated copy, so the menu works in every profile
 * rather than only inside the Kaze preset.
 */
import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { KAZE_COMMAND_ALIASES } from '../shared/commands.js'
import { SPEC_ROOT_NAME } from '../shared/spec-root.js'
import { KAZE_SKILL_BY_ID } from '../shared/skills.generated.js'
import { normalizeOutputStyle, OUTPUT_STYLE_SOURCE, outputStyleBlock } from './output-style.js'
import { preferencesOf } from './preferences.js'
import { renderSkillContent, ensureNativeSkillRenderer, type SkillText } from './skill-content.js'

const TOKEN = tokenPattern()

/** Escape one literal alias for use inside a RegExp alternation. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match a slash command by the longest known alias. Chinese command names may
 * contain spaces ("执行 Spec 任务"), which a token-based regex would truncate.
 */
function tokenPattern(): RegExp {
  const aliases = [...KAZE_COMMAND_ALIASES.keys()]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
  return new RegExp(`(^|\\s)\\/(${aliases.join('|')})(?=\\s|$)`, 'g')
}
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
/** Kebab-case skill id, the same grammar the skill registry validates. */
const SKILL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Every command id whose body counts as a live Kaze skill. */
const KAZE_SKILL_IDS: ReadonlySet<string> = new Set(KAZE_COMMAND_ALIASES.values())

/**
 * Remove one leading YAML frontmatter block, the part every skill provider
 * strips before the body reaches the model.
 * @param markdown - raw `SKILL.md` contents.
 * @returns the instruction body.
 */
export function stripFrontmatter(markdown: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/.exec(markdown)
  return match === null ? markdown : markdown.slice(match[0].length)
}

/**
 * Read one bundled skill body without the session's skill registry.
 *
 * The Kaze preset registers these bodies through `ctx.skills.register`; a
 * session on any other preset has no such catalog, so resolving the menu
 * command through `ctx.skills` alone would silently inject nothing. The
 * generated copy keeps every menu command working in every profile, and a
 * registry hit (including a workspace override) still wins. A directory can
 * still be supplied by tests that exercise the file-backed source form.
 * @param id - stable command id, also the skill directory name.
 * @param skillsDir - optional file-backed skills root for tests.
 * @returns the renderable skill, or undefined when the id is unknown.
 */
export function readBundledSkill(id: string, skillsDir?: string): SkillText | undefined {
  if (!SKILL_ID.test(id)) return undefined
  if (skillsDir !== undefined) {
    const file = join(skillsDir, id, 'SKILL.md')
    try {
      const content = stripFrontmatter(readFileSync(file, 'utf8'))
      if (content.trim() === '') return undefined
      return {
        name: id,
        provider: 'kaze-spec',
        resourceBase: { kind: 'directory', path: dirname(file) },
        content,
      }
    } catch {
      return undefined
    }
  }
  const skill = KAZE_SKILL_BY_ID.get(id)
  if (skill === undefined || skill.content.trim() === '') return undefined
  return {
    name: id,
    provider: 'kaze-spec',
    resourceBase: { kind: 'directory', path: PACKAGE_ROOT },
    content: skill.content,
  }
}

interface PreStepInput {
  readonly agent: unknown
  readonly messages: readonly {
    readonly source?: { readonly kind?: string }
    readonly content: readonly { readonly type: string; readonly text?: string }[]
  }[]
  readonly signal: AbortSignal
}

/** Skill names already injected as skill-invocation context in these messages. */
export function injectedSkillNames(messages: readonly unknown[]): Set<string> {
  const names = new Set<string>()
  for (const message of messages) {
    if (typeof message !== 'object' || message === null) continue
    const source = (message as { readonly source?: { readonly kind?: string; readonly name?: unknown } }).source
    if (source?.kind === 'skill-invocation' && typeof source.name === 'string') names.add(source.name)
  }
  return names
}

/**
 * One model-facing skill body in DSH's canonical `<skill_content>` envelope.
 * The fallback injection path uses it; the native gesture renders its own copy
 * from the runtime package.
 * @param skill - the loaded skill.
 * @param name - source name recorded on the message; the requested command id.
 * @returns a user-role message carrying the envelope.
 */
export function skillBodyMessage(skill: SkillText, name: string = skill.name): unknown {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: renderSkillContent(skill) }],
    source: { kind: 'skill-invocation', name, form: 'instructions' },
  }
}

/**
 * One model-facing voice block, marked so a later step can recognize it.
 * @param style - the rendered `outputStyleBlock` text; empty means none.
 * @returns a user-role message, or undefined when there is no style.
 */
export function outputStyleMessage(style: string): unknown {
  if (style === '') return undefined
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: style }],
    source: { kind: 'skill-invocation', name: OUTPUT_STYLE_SOURCE, form: 'instructions' },
  }
}

/**
 * A catalog skill also carries DSH's invocation policy.
 *
 * `userInvocable` is what makes `dsh-tool-skill`'s `/name` gesture inject the
 * body itself; Kaze only needs the fallback path when that policy is absent.
 */
export interface CatalogSkill extends SkillText {
  readonly invocation?: {
    readonly userInvocable?: boolean
    readonly modelInvocable?: boolean
  }
}

/**
 * Resolve one skill from the session catalog, without the packaged fallback.
 * @param ctx - the Host plugin context.
 * @param id - stable command id, also the skill directory name.
 * @param lookup - registry lookup, carrying the session working directory.
 * @returns the catalog definition (including its invocation policy), or undefined.
 */
export async function lookupKazeSkill(
  ctx: Context,
  id: string,
  lookup: { cwd: string; signal: AbortSignal; scope?: unknown },
): Promise<CatalogSkill | undefined> {
  const skills = (ctx as unknown as { get?(name: string): unknown }).get?.call(ctx, 'skills') as {
    get(name: string, lookup: unknown): Promise<CatalogSkill | undefined>
  } | undefined
  return skills === undefined ? undefined : await skills.get(id, lookup).catch(() => undefined)
}

/**
 * Resolve one Kaze skill body.
 *
 * A preset-mounted definition (or a workspace override) wins; the packaged
 * copy keeps the command working in sessions that mount no Kaze catalog.
 * @param ctx - the Host plugin context.
 * @param id - stable command id, also the skill directory name.
 * @param lookup - registry lookup, carrying the session working directory.
 * @returns the skill, or undefined when no provider or packaged file has it.
 */
export async function loadKazeSkill(
  ctx: Context,
  id: string,
  lookup: { cwd: string; signal: AbortSignal; scope?: unknown },
): Promise<SkillText | undefined> {
  return (await lookupKazeSkill(ctx, id, lookup)) ?? readBundledSkill(id)
}

function invokedTokens(input: PreStepInput): string[] {
  const names: string[] = []
  for (const message of input.messages) {
    if (message.source?.kind !== 'user') continue
    for (const block of message.content) {
      if (block.type !== 'text' || block.text === undefined) continue
      for (const match of block.text.matchAll(TOKEN)) {
        const token = match[2]
        if (token !== undefined && !names.includes(token)) names.push(token)
      }
    }
  }
  return names
}

export function registerKazeSkillInjection(ctx: Context): void {
  ;(ctx as unknown as {
    on(event: string, handler: (input: PreStepInput, next: () => Promise<unknown>) => Promise<unknown>): void
  }).on('agent/pre-step', async (input, next) => {
    const decision = await next() as {
      kind: string
      messages?: readonly unknown[]
    }
    if (decision.kind === 'reject') return decision
    const tokens = invokedTokens(input)
    if (tokens.length === 0) return decision
    // A skill already injected earlier in this conversation is not injected
    // again, and neither is one an earlier pre-step listener (DSH's own skill
    // gesture) already injected for this step, so the body cannot duplicate.
    const alreadyInjected = new Set([
      ...injectedSkillNames(input.messages),
      ...injectedSkillNames(decision.messages ?? []),
    ])
    // The humanized voice is one instruction per conversation, not one per
    // command: once it is in context, later Kaze commands (and the DSH skill
    // gesture's own injection) do not repeat it.
    const style = outputStyleBlock(normalizeOutputStyle(preferencesOf(ctx).outputStyle))
    const styleWanted = style !== '' && !alreadyInjected.has(OUTPUT_STYLE_SOURCE)
    const workingDirectory = (ctx as unknown as { get?(name: string): unknown }).get?.call(ctx, 'workingDirectory') as {
      ensure(agent: unknown, signal: AbortSignal): Promise<string>
    } | undefined
    let cwd = process.cwd()
    if (workingDirectory !== undefined) {
      try {
        cwd = await workingDirectory.ensure(input.agent, input.signal)
      } catch {
        return decision
      }
    }
    const lookup = { cwd, signal: input.signal, scope: input.agent }
    // Prefer DSH's own `/name` gesture. When the step's token is the ASCII
    // skill name and the session catalog provides that skill as
    // user-invocable, `dsh-tool-skill` injects the body with its own canonical
    // renderer, so Kaze must not inject a second copy. Localized aliases and
    // catalog-less sessions keep the fallback path below.
    await ensureNativeSkillRenderer()
    const injectedIds = new Set<string>()
    const nativeIds = new Set<string>()
    const injections: unknown[] = []
    for (const token of tokens) {
      const id = KAZE_COMMAND_ALIASES.get(token)
      if (id === undefined || injectedIds.has(id) || nativeIds.has(id) || alreadyInjected.has(id)) continue
      const catalog = await lookupKazeSkill(ctx, id, lookup)
      if (token === id && catalog?.invocation?.userInvocable === true) {
        nativeIds.add(id)
        continue
      }
      const skill = catalog ?? readBundledSkill(id)
      if (skill === undefined) continue
      injectedIds.add(id)
      injections.push(skillBodyMessage(skill, id))
    }
    if (styleWanted) {
      // Add the voice after the body so it follows the command it applies to.
      // A body injected by DSH's own gesture still gets the voice here.
      const skillActive = injectedIds.size > 0
        || nativeIds.size > 0
        || [...alreadyInjected].some((name) => KAZE_SKILL_IDS.has(name))
      if (skillActive) {
        const message = outputStyleMessage(style)
        if (message !== undefined) injections.push(message)
      }
    }
    if (injections.length === 0) return decision
    return { ...decision, messages: [...(decision.messages ?? []), ...injections] }
  })

  // Workspace steering: `.kaze/steering/*.md` is injected once per session so
  // project conventions stay in front of the model without repeating each step.
  const steeredSessions = new Set<string>()
  ;(ctx as unknown as {
    on(event: string, handler: (input: PreStepInput, next: () => Promise<unknown>) => Promise<unknown>): void
  }).on('agent/pre-step', async (input, next) => {
    const decision = await next() as { kind: string; messages?: readonly unknown[] }
    if (decision.kind === 'reject') return decision
    const sessionId = (input.agent as { session?: { id?: unknown } } | undefined)?.session?.id
    if (typeof sessionId !== 'string' || steeredSessions.has(sessionId)) return decision
    if (!preferencesOf(ctx).steering) return decision
    const workingDirectory = (ctx as unknown as { get?(name: string): unknown }).get?.call(ctx, 'workingDirectory') as {
      ensure(agent: unknown, signal: AbortSignal): Promise<string>
    } | undefined
    let cwd = process.cwd()
    if (workingDirectory !== undefined) {
      try {
        cwd = await workingDirectory.ensure(input.agent, input.signal)
      } catch {
        return decision
      }
    }
    const dir = join(cwd, SPEC_ROOT_NAME, 'steering')
    let names: string[]
    try {
      names = readdirSync(dir).filter((name) => name.endsWith('.md')).sort()
    } catch {
      return decision
    }
    const blocks: string[] = []
    for (const name of names) {
      try {
        const text = readFileSync(join(dir, name), 'utf8')
        const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '').trim()
        if (body !== '') blocks.push(`### ${name}\n\n${body}`)
      } catch {
        // An unreadable steering file never blocks the turn.
      }
    }
    if (blocks.length === 0) return decision
    steeredSessions.add(sessionId)
    return {
      ...decision,
      messages: [
        ...(decision.messages ?? []),
        {
          id: randomUUID(),
          role: 'user',
          content: [{
            type: 'text',
            text: `<steering>\nProject steering for this workspace. Follow it unless the user explicitly overrides it.\n\n${blocks.join('\n\n')}\n</steering>`,
          }],
          source: { kind: 'skill-invocation', name: 'kaze-steering', form: 'instructions' },
        },
      ],
    }
  })

  // Session-scoped bookkeeping must not outlive its session. The disposed
  // event fires exactly once per announced session, including publication
  // rollback, so the steering set stays bounded in a long-running Host.
  ;(ctx as unknown as {
    on(event: string, handler: (session: { id?: unknown }) => void): void
  }).on('session/disposed', (session) => {
    if (typeof session?.id === 'string') steeredSessions.delete(session.id)
  })
}
