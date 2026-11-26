/**
 * Native tool guards for spec execution.
 *
 * The Kaze contract says `tasks.md` plus `kaze_spec_task` is the only spec task
 * state, and the Team board and `todo_write` are execution surfaces, not a
 * second plan. That rule used to live in prompt prose only. A `tools.guard()`
 * makes it a mechanism: while any spec in the workspace is in the `execute`
 * phase, the mirroring tools are denied with a reason the model can act on.
 *
 * The guard is deliberately narrow: it never touches a workspace without an
 * executing spec, and `team_task_list` / `team_task_get` stay readable.
 */
import type { Context } from '@deepseek-ai/cordis'
import { workspaceRuntime } from './spec-runtime.js'

/** Tools that mirror task state instead of recording it in the spec. */
export const SURFACE_TOOLS: ReadonlySet<string> = new Set([
  'todo_write',
  'team_task_create',
  'team_task_update',
])

/** The slice of a tool execution a guard reads. */
interface GuardExecution {
  readonly name: string
  readonly agent?: { readonly session?: { readonly header?: { readonly cwd?: string } } }
}

/**
 * Build the denial reason for one call.
 * @param name - tool name.
 * @param cwd - workspace directory, when the call carries an agent session.
 * @returns the reason, or undefined when the call is allowed.
 */
export function surfaceDenial(name: string, cwd: string | undefined): string | undefined {
  if (!SURFACE_TOOLS.has(name) || cwd === undefined || cwd === '') return undefined
  const runtime = workspaceRuntime(cwd)
  if (runtime.executing.length === 0) return undefined
  const features = runtime.executing.join(', ')
  return `Kaze spec ${features} is in the execute phase, so ${name} is disabled: tasks.md plus kaze_spec_task is the only spec task state. Record the work with kaze_spec_task, or finish the spec before using ${name}.`
}

/**
 * Register the guard when the tool registry is composed.
 * @param ctx - the Host plugin context.
 */
export function registerKazeGuards(ctx: Context): void {
  const tools = (ctx as unknown as {
    tools?: { guard?: (guard: (exec: GuardExecution) => string | undefined) => () => void }
  }).tools
  if (typeof tools?.guard !== 'function') return
  tools.guard((exec) => surfaceDenial(exec.name, exec.agent?.session?.header?.cwd))
}
