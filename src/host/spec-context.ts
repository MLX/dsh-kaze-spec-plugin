/**
 * Kaze's native runtime context.
 *
 * DSH's prompt registry owns the system prompt; a `systemPrompt.context()`
 * provider is the intended way to add changing facts. Kaze registers one
 * workspace-scoped block so the model no longer has to open
 * `.kaze/spec-config.json` before every spec document: the block states the
 * language, the execution-wave cap, and whether validator warnings fail a
 * gate, resolved from the same files the engine reads.
 *
 * The provider is evaluated at each assembly and once more at admission
 * refresh (`dsh-system-prompt` contract), so a settings save reaches the very
 * next step.
 */
import type { Context } from '@deepseek-ai/cordis'
import { preferencesOf } from './preferences.js'
import type { SpecLanguage } from './spec/settings.js'
import { workspaceRuntime } from './spec-runtime.js'

/** Registry name of the Kaze workspace context; unique across the profile. */
export const KAZE_CONTEXT_NAME = 'kaze:spec-context'

/**
 * Order inside the runtime-context list. Named positions use 100–210
 * (`WORKING_DIRECTORY`, sandbox/approval policy, subagent delegation, harness
 * source, web surface); 130 keeps Kaze facts beside the other policy blocks.
 */
export const KAZE_CONTEXT_ORDER = 130

/** The slice of an Agent this provider needs; kept structural for portability. */
export interface ContextAgent {
  readonly session?: { readonly header?: { readonly cwd?: string } }
}

function languageLine(language: SpecLanguage): string {
  return language === 'zh-CN'
    ? '- language: zh-CN — write spec prose with the Chinese headings and EARS patterns. Task markers and task ids stay unchanged.'
    : '- language: en — write spec prose with the English headings and EARS patterns. Task markers and task ids stay unchanged.'
}

function strictLine(strict: boolean): string {
  return strict
    ? '- strict: on — validator warnings fail a phase gate.'
    : '- strict: off — validator warnings are reported but do not fail a gate.'
}

/**
 * Render the block for one workspace.
 * @param cwd - absolute workspace directory.
 * @param strict - profile strict-mode preference.
 * @param fallbackLanguage - profile language default.
 * @param fallbackMaxParallel - profile parallel default.
 * @returns the block, or an empty string when the workspace has no `.kaze`.
 */
export function specContextText(
  cwd: string,
  strict: boolean,
  fallbackLanguage: SpecLanguage,
  fallbackMaxParallel: number,
): string {
  const runtime = workspaceRuntime(cwd, fallbackLanguage, fallbackMaxParallel)
  if (!runtime.exists) return ''
  return [
    '<kaze_spec_context>',
    'Workspace `.kaze` settings. These values are authoritative; do not re-read `.kaze/spec-config.json` while this block is present.',
    languageLine(runtime.language),
    `- maxParallel: ${runtime.maxParallel} — one execution wave runs at most ${runtime.maxParallel} independent tasks.`,
    strictLine(strict),
    '</kaze_spec_context>',
  ].join('\n')
}

/**
 * Register the workspace context when the prompt registry is composed.
 * A profile without `system-prompt` simply never activates the child scope,
 * and every Kaze tool keeps working.
 * @param ctx - the Host plugin context.
 */
export function registerKazeContext(ctx: Context): void {
  const inject = (ctx as unknown as { inject?: (deps: string[], callback: (child: unknown) => void) => void }).inject
  if (typeof inject !== 'function') return
  inject.call(ctx, ['systemPrompt'], (child) => {
    const systemPrompt = (child as {
      systemPrompt: { context(entry: Record<string, unknown>): () => void }
    }).systemPrompt
    systemPrompt.context({
      name: KAZE_CONTEXT_NAME,
      order: KAZE_CONTEXT_ORDER,
      required: false,
      text: (context: { agent?: ContextAgent }) => {
        const cwd = context.agent?.session?.header?.cwd
        if (typeof cwd !== 'string' || cwd === '') return ''
        const preferences = preferencesOf(ctx)
        return specContextText(cwd, preferences.strict, preferences.language, preferences.maxParallel)
      },
    })
  })
}
