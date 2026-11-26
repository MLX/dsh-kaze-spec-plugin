/**
 * Preset-scoped registration of the generated Kaze skill bodies.
 *
 * Mount this row inside the Kaze preset so the skills land in that preset's
 * skill-registry layer, not the global layer. The Host hook keeps the same
 * bodies as a fallback for sessions that run another preset.
 */
import type { Context } from '@deepseek-ai/cordis'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { KAZE_SKILLS } from '../shared/skills.generated.js'

export const name = 'kaze-spec-skills'

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

interface SkillRegistration {
  readonly name: string
  readonly description: string
  readonly content: string
  readonly source: string
  readonly invocation: { readonly modelInvocable: boolean; readonly userInvocable: boolean }
  readonly resourceBase: { readonly kind: 'directory'; readonly path: string }
}

interface SkillRegistry {
  register(skill: SkillRegistration): () => void
}

/**
 * Register every embedded skill in the calling preset's layer.
 * @param ctx - the preset-scoped plugin context.
 */
export function apply(ctx: Context): void {
  const get = (ctx as unknown as { get?(name: string): unknown }).get
  if (typeof get !== 'function') return
  let skills: SkillRegistry | undefined
  try {
    skills = get.call(ctx, 'skills') as SkillRegistry | undefined
  } catch {
    return
  }
  if (skills === undefined) return
  const effect = (ctx as unknown as {
    effect?<T>(execute: () => () => void, label?: string): T
  }).effect
  for (const skill of KAZE_SKILLS) {
    const register = () => skills!.register({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      source: 'bundled',
      invocation: {
        modelInvocable: skill.modelInvocable,
        userInvocable: skill.userInvocable,
      },
      resourceBase: { kind: 'directory', path: PACKAGE_ROOT },
    })
    if (typeof effect === 'function') effect.call(ctx, register, 'kaze-spec: embedded skills')
    else register()
  }
}
