/** Native DSH tools for the Kaze spec engine. */
import { readFile } from 'node:fs/promises'
import { isAbsolute, dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { SpecError } from './spec/errors.js'
import { docPath, exists, featureDir, PHASES, TASK_STATUSES, type DesignDetail, type Phase, type SpecScope, type SpecType, type TaskStatus, type Workflow } from './spec/paths.js'
import { SPEC_ROOT_NAME } from '../shared/spec-root.js'
import { listArchived, restoreSpec } from './spec/archive.js'
import { archiveWithTimeline } from './spec/archive-timeline.js'
import { DEFAULT_PREFERENCES, preferencesOf, type KazePreferences } from './preferences.js'
import { buildDelivery, recordGate, type GateStatus } from './spec/delivery.js'
import { idleMutate } from './spec/idle.js'
import { buildReview } from './spec/review.js'
import { advanceSpec, gateErrors, initSpec, listSpecs, loadState, recordEvent, recordPbt, recordVerification, renameSpec, repairSpec, setCapability, setScope, setWorkflow, specStatus, syncSpec, updateTask } from './spec/state.js'
import { mergeRequirements, listCapabilities } from './spec/living.js'
import { parseDag, parseTasks, readyTasks } from './spec/tasks.js'
import { appendRetiredTimelineTree, buildRetiredTimelineTrees, syncSpecToTimeline, type TimelineService } from './spec/timeline.js'
import { invalidateWorkspaceRuntime } from './spec-runtime.js'
import { validateDirectory, validationText } from './spec/validator.js'

interface ContentBlock {
  type: 'text'
  text: string
}

interface ToolSession {
  readonly id: string
  readonly header?: { readonly cwd?: string }
}

interface ToolExec {
  readonly agent?: { readonly session: ToolSession }
  readonly signal: AbortSignal
  readonly callId: string
}

interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: {
    schema: Record<string, unknown>
    render(args: unknown, value: { text: string }): ContentBlock[]
  }
  execute(args: unknown, exec: ToolExec): Promise<{ text: string }>
  presentCall?(args: unknown): { card: 'generic'; title: string; kind: 'other'; rawInput: unknown }
}

const WRITABLE_TASK_STATUSES = ['not_started', 'in_progress', 'queued', 'completed', 'failed'] as const

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { text: { type: 'string' } },
  required: ['text'],
}

function defineTool(spec: ToolSpec): ToolSpec {
  return spec
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function output(value: unknown): { text: string } {
  return { text: text(value) }
}

function render(_args: unknown, value: { text: string }): ContentBlock[] {
  return [{ type: 'text', text: value.text }]
}

function stringArg(args: unknown, key: string, required = true): string {
  const value = typeof args === 'object' && args !== null ? (args as Record<string, unknown>)[key] : undefined
  if (typeof value === 'string' && value !== '') return value
  if (!required && value === undefined) return ''
  throw new SpecError(`missing required string argument: ${key}`, 'KAZE_SPEC_ARGS')
}

function optionalString(args: unknown, key: string): string | undefined {
  const value = typeof args === 'object' && args !== null ? (args as Record<string, unknown>)[key] : undefined
  return typeof value === 'string' && value !== '' ? value : undefined
}

function booleanArg(args: unknown, key: string): boolean {
  return typeof args === 'object' && args !== null && (args as Record<string, unknown>)[key] === true
}

function label(args: unknown, key: string): string {
  const value = typeof args === 'object' && args !== null ? (args as Record<string, unknown>)[key] : undefined
  return typeof value === 'string' ? value : ''
}

function workspaceRoot(exec: ToolExec): string {
  const cwd = exec.agent?.session.header?.cwd
  if (cwd === undefined || cwd === '') {
    throw new SpecError('Kaze spec tools require an agent session with a working directory', 'KAZE_SPEC_NO_CWD')
  }
  return join(cwd, SPEC_ROOT_NAME)
}

/** The creation session may plan, but execution and completion run elsewhere. */
function assertFreshSession(exec: ToolExec, createdBy: string | undefined, action: string): void {
  const current = exec.agent?.session.id
  if (createdBy === undefined || current === undefined || current !== createdBy) return
  throw new SpecError(
    `${action} must run in a fresh execution session, not the session that created the spec. Start a new session in this workspace and retry.`,
    'KAZE_SPEC_SESSION',
  )
}

function timelineOf(ctx: Context): TimelineService | undefined {
  const get = (ctx as unknown as { get(name: string): unknown }).get
  return typeof get === 'function' ? (get.call(ctx, 'timeline') as TimelineService | undefined) : undefined
}

let activeContext: Context | undefined

/** Current profile defaults; safe before the Host context is attached. */
function preferences(): KazePreferences {
  return activeContext === undefined ? DEFAULT_PREFERENCES : preferencesOf(activeContext)
}

/** Archive the spec after a successful advance to done when that option is on. */
async function autoArchive(root: string, feature: string, to: Phase, signal?: AbortSignal): Promise<unknown> {
  if (to !== 'done' || !preferences().autoArchive) return undefined
  try {
    const result = await archiveWithTimeline(activeContext, root, feature, { reason: 'auto: advanced to done' }, signal)
    return { archived: true, result }
  } catch (error) {
    // Archiving is a convenience; a failure must not undo the completed advance,
    // but it must stay visible in the spec history.
    const reason = (error as Error).message
    await recordEvent(root, feature, 'auto-archive-failed', { reason }, signal).catch(() => undefined)
    return { archived: false, reason }
  }
}

async function projectTimeline(exec: ToolExec, feature: string): Promise<unknown> {
  if (!preferences().timeline) return { available: false, reason: 'Timeline projection is off in Kaze settings' }
  const ctx = activeContext
  if (ctx === undefined) return { available: false, reason: 'Kaze host context is unavailable' }
  const timeline = timelineOf(ctx)
  if (timeline === undefined || exec.agent === undefined) return { available: false, reason: 'Timeline is not enabled' }
  const get = (ctx as unknown as { get?(name: string): unknown }).get
  const sessions = typeof get === 'function'
    ? (get.call(ctx, 'sessions') as { flush(session: unknown): Promise<boolean> } | undefined)
    : undefined
  if (sessions !== undefined) await sessions.flush(exec.agent.session)
  try {
    return await syncSpecToTimeline(workspaceRoot(exec), feature, exec.agent.session, timeline)
  } catch (error) {
    return { available: false, reason: (error as Error).message }
  }
}

function featureParams(extra: Record<string, unknown> = {}, required: string[] = []): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      feature: { type: 'string', description: 'Spec directory name under .kaze.' },
      ...extra,
    },
    required: ['feature', ...required],
  }
}

const listTool = defineTool({
  name: 'kaze_spec_list',
  description:
    'List every active Kaze spec under .kaze with its type, workflow, phase, and update time. Set include_archived=true to also list archived specs. Read-only.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      include_archived: { type: 'boolean', description: 'Also list specs under .kaze/archive.' },
    },
  },
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const active = await listSpecs(root)
    if (!booleanArg(args, 'include_archived')) return output(active)
    return output({ active, archived: await listArchived(root) })
  },
  presentCall: () => ({ card: 'generic', title: 'List Kaze specs', kind: 'other', rawInput: {} }),
})

const statusTool = defineTool({
  name: 'kaze_spec_status',
  description:
    'Show one Kaze spec: workflow, design detail, phase, documents, task totals, in-progress tasks, and ready tasks. Read-only.',
  parameters: featureParams(),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    return output(await specStatus(workspaceRoot(exec), stringArg(args, 'feature')))
  },
  presentCall: (args) => ({ card: 'generic', title: `Kaze status: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const initTool = defineTool({
  name: 'kaze_spec_init',
  description:
    'Create a Kaze spec directory with state.json and config.json. Idempotent: an existing spec is returned unchanged. Omitted type, scope, workflow, and design detail come from the Kaze settings page defaults.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      feature: { type: 'string', description: 'New spec directory name under .kaze.' },
      type: { type: 'string', enum: ['feature', 'bugfix'], description: 'Spec type. Defaults to feature.' },
      scope: { type: 'string', enum: ['brownfield', 'greenfield'], description: 'Project scope. Defaults to brownfield; use greenfield only for a truly empty project.' },
      workflow: {
        type: 'string',
        enum: ['requirements-first', 'design-first', 'verify-first', 'bugfix'],
        description: 'Workflow route. Defaults to requirements-first; bugfix type forces bugfix.',
      },
      designDetail: {
        type: 'string',
        enum: ['high', 'low', 'comprehensive'],
        description: 'Design depth: high-level, low-level, or comprehensive. Defaults to comprehensive.',
      },
      capability: {
        type: 'string',
        description: 'Optional capability id this spec feeds for kaze_spec_merge.',
      },
    },
    required: ['feature'],
  },
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const defaults = preferences()
    const type = (optionalString(args, 'type') ?? defaults.defaultSpecType) as SpecType
    const scope = (optionalString(args, 'scope') ?? defaults.defaultSpecScope) as SpecScope
    const workflow = (optionalString(args, 'workflow') ?? defaults.defaultSpecWorkflow) as Workflow
    const designDetail = (optionalString(args, 'designDetail') ?? defaults.defaultDesignDetail) as DesignDetail
    const capability = optionalString(args, 'capability') ?? (defaults.defaultCapability === '' ? undefined : defaults.defaultCapability)
    const root = workspaceRoot(exec)
    const created = await initSpec(root, {
      feature: stringArg(args, 'feature'),
      type,
      scope,
      workflow,
      designDetail,
      ...(capability === undefined ? {} : { capability }),
      ...(exec.agent?.session.id === undefined ? {} : { createdBy: exec.agent.session.id }),
    }, exec.signal)
    invalidateWorkspaceRuntime(dirname(root))
    return output(created)
  },
  presentCall: (args) => ({ card: 'generic', title: `Create Kaze spec: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const workflowTool = defineTool({
  name: 'kaze_spec_workflow',
  description:
    'Set one spec\'s workflow route (requirements-first | design-first | verify-first) and design detail level (high | low | comprehensive) after creation. Use when the user picks a route in the creation questions; a bugfix spec keeps its workflow. The route is frozen once any spec document (requirements/design/tasks/bugfix.md) exists; create a new spec for a different route.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      feature: { type: 'string', description: 'Spec directory name under .kaze.' },
      workflow: {
        type: 'string',
        enum: ['requirements-first', 'design-first', 'verify-first'],
        description: 'Feature workflow route to record.',
      },
      designDetail: {
        type: 'string',
        enum: ['high', 'low', 'comprehensive'],
        description: 'Design depth to record.',
      },
    },
    required: ['feature'],
  },
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const workflow = optionalString(args, 'workflow')
    const designDetail = optionalString(args, 'designDetail')
    if (workflow === undefined && designDetail === undefined) {
      throw new SpecError('kaze_spec_workflow needs workflow and/or designDetail')
    }
    return output(await setWorkflow(
      workspaceRoot(exec),
      stringArg(args, 'feature'),
      { ...(workflow === undefined ? {} : { workflow }), ...(designDetail === undefined ? {} : { designDetail }) },
      exec.signal,
    ))
  },
  presentCall: (args) => ({ card: 'generic', title: `Set workflow: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const verifyTool = defineTool({
  name: 'kaze_spec_verify',
  description:
    'Record the current verify-first baseline after a model preflight: checks (check-sat), declarations, :named assertions (one per acceptance criterion), balanced parentheses, and Assertion Map coverage. Rejects an invalid model instead of recording a hash. Run after the check and after any re-check.',
  parameters: featureParams(),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    return output(await recordVerification(workspaceRoot(exec), stringArg(args, 'feature'), exec.signal))
  },
  presentCall: (args) => ({ card: 'generic', title: `Record verification: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const capabilityTool = defineTool({
  name: 'kaze_spec_capability',
  description:
    'Set the capability this spec feeds. The capability is the folder under .kaze/specs/<capability>/spec.md that kaze_spec_merge updates as the project\'s living behavior record.',
  parameters: featureParams(
    { capability: { type: 'string', description: 'Kebab-case capability id, for example "auth".' } },
    ['capability'],
  ),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    return output(await setCapability(
      workspaceRoot(exec),
      stringArg(args, 'feature'),
      stringArg(args, 'capability'),
      exec.signal,
    ))
  },
  presentCall: (args) => ({ card: 'generic', title: `Set capability: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const mergeTool = defineTool({
  name: 'kaze_spec_merge',
  description:
    'Merge one feature spec\'s requirements into the capability spec at .kaze/specs/<capability>/spec.md. The task plan must exist and every required task must be complete before a capability is published. Matching requirement titles are updated only when the body matches, otherwise the merge reports a conflict; force=true replaces it. Read-write.',
  parameters: featureParams(
    {
      capability: { type: 'string', description: 'Override the capability recorded on the spec.' },
      force: { type: 'boolean', description: 'Replace a conflicting requirement instead of failing the merge.' },
    },
  ),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    const capability = optionalString(args, 'capability')
    const state = await loadState(root, feature)
    assertFreshSession(exec, state.createdBy, 'Merging a capability')
    return output(await mergeRequirements(
      root,
      feature,
      { ...(capability === undefined ? {} : { capability }), ...(booleanArg(args, 'force') ? { force: true } : {}) },
      exec.signal,
    ))
  },
  presentCall: (args) => ({ card: 'generic', title: `Merge into capability: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const repairTool = defineTool({
  name: 'kaze_spec_repair',
  description:
    'Consistency report between state.json and the documents on disk. Read-only by default; pass phase only to repair a damaged state.json phase (records a repair-phase event, never reopens a done spec).',
  parameters: featureParams({
    phase: { type: 'string', enum: [...PHASES], description: 'Optional explicit phase reset for a damaged state.json.' },
  }),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const phase = optionalString(args, 'phase') as Phase | undefined
    return output(await repairSpec(
      workspaceRoot(exec),
      stringArg(args, 'feature'),
      phase === undefined ? {} : { resetPhase: phase },
    ))
  },
  presentCall: (args) => ({ card: 'generic', title: `Repair report: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const capabilitiesTool = defineTool({
  name: 'kaze_spec_capabilities',
  description:
    'List living capability specs under .kaze/specs: requirement count, duplicate titles, last change date, and path. Read-only.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(_args, exec) {
    return output(await listCapabilities(workspaceRoot(exec)))
  },
  presentCall: () => ({ card: 'generic', title: 'List capabilities', kind: 'other', rawInput: {} }),
})

const validateTool = defineTool({
  name: 'kaze_spec_validate',
  description:
    'Lint requirements.md, design.md, tasks.md, bugfix.md, and optional research.md/acceptance.md for exact headings, EARS structure, property traceability, checkbox syntax, the dependency graph, research decisions, and acceptance criteria. Read-only.',
  parameters: featureParams(),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    const state = await loadState(root, feature)
    const report = await validateDirectory(featureDir(root, feature), state.specType)
    return output({ ...report, text: validationText(report) })
  },
  presentCall: (args) => ({ card: 'generic', title: `Validate ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const gateTool = defineTool({
  name: 'kaze_spec_gate',
  description:
    'Check one phase gate. Returns ok, errors, and warnings; a failing gate must not be reported as complete. Strict mode in the Kaze settings also fails the gate on warnings. Read-only.',
  parameters: featureParams(
    { phase: { type: 'string', enum: [...PHASES], description: 'Phase gate to check.' } },
    ['phase'],
  ),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const phase = stringArg(args, 'phase') as Phase
    if (!(PHASES as readonly string[]).includes(phase)) throw new SpecError(`unknown phase ${phase}`)
    return output(await gateErrors(workspaceRoot(exec), stringArg(args, 'feature'), phase, preferences().strict))
  },
  presentCall: (args) => ({ card: 'generic', title: `Gate: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const advanceTool = defineTool({
  name: 'kaze_spec_advance',
  description:
    'Advance toward a target phase. Every intermediate gate must pass and phases only move forward; a failed gate leaves the phase unchanged. When the Kaze settings enable archive on done, a successful advance to done also archives the spec.',
  parameters: featureParams(
    { to: { type: 'string', enum: [...PHASES], description: 'Target phase.' } },
    ['to'],
  ),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    const to = stringArg(args, 'to') as Phase
    const state = await loadState(root, feature)
    if (to === 'execute' || to === 'done') assertFreshSession(exec, state.createdBy, 'Execution and completion')
    const result = await advanceSpec(root, feature, to, exec.signal, preferences().strict)
    if (result.ok) invalidateWorkspaceRuntime(dirname(root))
    const archive = await autoArchive(root, feature, to, exec.signal)
    return output(archive === undefined ? result : { ...result, autoArchive: archive })
  },
  presentCall: (args) => ({ card: 'generic', title: `Advance ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const tasksTool = defineTool({
  name: 'kaze_spec_tasks',
  description:
    'List leaf tasks from tasks.md. Use ready=true for the dependency-ready set, or filter by status. Read-only.',
  parameters: featureParams({
    ready: { type: 'boolean', description: 'Only tasks whose dependencies are complete.' },
    include_optional: { type: 'boolean', description: 'Include optional tasks.' },
    status: { type: 'string', enum: [...TASK_STATUSES], description: 'Only tasks with this status.' },
  }),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    const path = docPath(root, feature, 'tasks')
    if (!(await exists(path))) throw new SpecError(`missing ${path}`)
    const markdown = await readFile(path, 'utf8')
    const tasks = parseTasks(markdown)
    const status = optionalString(args, 'status')
    const rows = booleanArg(args, 'ready')
      ? readyTasks(tasks, parseDag(markdown), booleanArg(args, 'include_optional'))
      : tasks.filter((task) =>
        task.leaf
        && (status === undefined || task.status === status)
        && (booleanArg(args, 'include_optional') || !task.optional))
    return output(rows.map(({ children: _children, ...task }) => task))
  },
  presentCall: (args) => ({ card: 'generic', title: `Tasks: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const taskTool = defineTool({
  name: 'kaze_spec_task',
  description:
    'Update one task checkbox in tasks.md, record the transition in state.json history, and refresh the native Timeline tree. Rejected after done; use kaze_spec_task instead of editing task markers by hand.',
  parameters: featureParams(
    {
      id: { type: 'string', description: 'Task id, for example 1.1.' },
      status: { type: 'string', enum: [...WRITABLE_TASK_STATUSES], description: 'New task status.' },
    },
    ['id', 'status'],
  ),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    const status = stringArg(args, 'status') as TaskStatus
    if (!(WRITABLE_TASK_STATUSES as readonly string[]).includes(status)) throw new SpecError(`unknown task status ${status}`)
    const state = await loadState(root, feature)
    assertFreshSession(exec, state.createdBy, 'Updating a task')
    const result = await updateTask(root, feature, stringArg(args, 'id'), status, exec.signal)
    return output({ ...result, timeline: await projectTimeline(exec, feature) })
  },
  presentCall: (args) => ({
    card: 'generic',
    title: `Task ${label(args, 'id')} → ${label(args, 'status')}`,
    kind: 'other',
    rawInput: args,
  }),
})

const syncTool = defineTool({
  name: 'kaze_spec_sync',
  description:
    'Reconcile state.json with the files and task markers, then refresh the native Timeline tree. Sync only proposes the next phase when that gate passes; it never skips or regresses.',
  parameters: featureParams(),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const feature = stringArg(args, 'feature')
    const result = await syncSpec(workspaceRoot(exec), feature, exec.signal, preferences().strict)
    return output({ ...result, timeline: await projectTimeline(exec, feature) })
  },
  presentCall: (args) => ({ card: 'generic', title: `Sync ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const pbtTool = defineTool({
  name: 'kaze_spec_pbt',
  description:
    'Record one property-based test outcome (passed, failed, not_run, unexpected_pass) in state.json.',
  parameters: featureParams(
    {
      property: { type: 'string', description: 'Property name or number.' },
      status: { type: 'string', enum: ['passed', 'failed', 'not_run', 'unexpected_pass'] },
      example: { type: 'string', description: 'Counterexample or evidence, if any.' },
    },
    ['property', 'status'],
  ),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    return output(
      await recordPbt(
        workspaceRoot(exec),
        stringArg(args, 'feature'),
        stringArg(args, 'property'),
        stringArg(args, 'status'),
        optionalString(args, 'example') ?? '',
        exec.signal,
      ),
    )
  },
  presentCall: (args) => ({ card: 'generic', title: `PBT: ${label(args, 'property')}`, kind: 'other', rawInput: args }),
})

const reviewTool = defineTool({
  name: 'kaze_spec_review',
  description:
    'Build the Markdown review brief for one spec document from persisted anchored comments. Read-only; then apply the brief to that file.',
  parameters: featureParams(
    {
      file: { type: 'string', description: 'Document path, relative to the workspace or absolute.' },
      comments: { type: 'string', description: 'Optional comments JSON path. Defaults to reviews/<doc>.json.' },
    },
    ['file'],
  ),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    const file = stringArg(args, 'file')
    const cwd = exec.agent?.session.header?.cwd ?? ''
    const candidate = isAbsolute(file) ? file : join(cwd, file)
    const target = (await exists(candidate)) ? candidate : join(featureDir(root, feature), file)
    return output(await buildReview(root, feature, target, optionalString(args, 'comments')))
  },
  presentCall: (args) => ({ card: 'generic', title: `Review ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const renameTool = defineTool({
  name: 'kaze_spec_rename',
  description:
    'Rename one spec directory, update .kaze/<old> path references in its own Markdown, and update its review files. Rejected at execute and done, where path edits would invalidate approvals.',
  parameters: featureParams(
    { to: { type: 'string', description: 'New feature name.' } },
    ['to'],
  ),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    const ctx = activeContext
    const timeline = ctx === undefined ? undefined : timelineOf(ctx)
    const get = ctx === undefined ? undefined : (ctx as unknown as { get(name: string): unknown }).get
    const sessions = typeof get === 'function'
      ? (get.call(ctx, 'sessions') as { list(): readonly { readonly id: string }[] } | undefined)
      : undefined
    const retired = await buildRetiredTimelineTrees(feature, sessions?.list() ?? [], timeline)
    const renamed = await renameSpec(root, feature, stringArg(args, 'to'), exec.signal)
    for (const item of retired) {
      await appendRetiredTimelineTree(item.session, timeline, item.tree).catch(() => undefined)
    }
    return output({ ...renamed, timelineRetired: retired.length > 0, timeline: await projectTimeline(exec, renamed.to) })
  },
  presentCall: (args) => ({ card: 'generic', title: `Rename ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const gateRecordTool = defineTool({
  name: 'kaze_spec_gate_record',
  description:
    'Append one human-gate decision (acceptance, fta, archive, or a custom gate) to gates.json. Acceptance/FTA decisions require the task plan to exist (phase tasks or later); approved requires details or evidence; failed/skipped requires a reason; acceptance approval requires every acceptance.md criterion to be checked. The record stores the phase and a hash of the approved documents, so done rejects a decision whose documents changed afterwards.',
  parameters: featureParams({
    gate: { type: 'string', enum: ['acceptance', 'fta', 'archive', 'custom'], description: 'Gate name.' },
    status: { type: 'string', enum: ['approved', 'failed', 'skipped', 'pending'], description: 'Gate decision.' },
    reason: { type: 'string', description: 'Why the gate passed, failed, or was skipped. Required for failed and skipped.' },
    return_to: { type: 'string', description: 'Optional spec task or phase to return to when the decision is failed.' },
    details: { type: 'string', description: 'Verdict or summary; required for approved unless evidence is given.' },
    evidence: { type: 'string', description: 'Concrete proof: command output, file and line, or URL. Counts as approval evidence.' },
  }, ['gate', 'status']),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    const gate = stringArg(args, 'gate')
    const status = stringArg(args, 'status') as GateStatus
    if (!['approved', 'failed', 'skipped', 'pending'].includes(status)) throw new SpecError(`unknown gate status ${status}`)
    const state = await loadState(root, feature)
    if ((gate === 'acceptance' || gate === 'fta') && PHASES.indexOf(state.phase) < PHASES.indexOf('tasks')) {
      throw new SpecError(
        `cannot record the ${gate} gate at phase=${state.phase}; the task plan must exist and execution must be the current work`,
      )
    }
    if (gate === 'acceptance' || gate === 'fta') assertFreshSession(exec, state.createdBy, 'Recording an acceptance or FTA gate')
    return output(await recordGate(root, feature, {
      gate,
      status,
      reason: optionalString(args, 'reason'),
      returnTo: optionalString(args, 'return_to'),
      details: optionalString(args, 'details'),
      evidence: optionalString(args, 'evidence'),
      phase: state.phase,
    }, exec.signal))
  },
  presentCall: (args) => ({ card: 'generic', title: `Gate: ${label(args, 'gate')}`, kind: 'other', rawInput: args }),
})

const deliveryTool = defineTool({
  name: 'kaze_spec_delivery',
  description:
    'Build delivery.md from the spec state, tasks, acceptance criteria, verification record, FTA, and gate history.',
  parameters: featureParams({
    residual_risks: { type: 'string', description: 'Optional residual-risk text for the report.' },
  }),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    try {
      return output(await buildDelivery(root, feature, optionalString(args, 'residual_risks') ?? '', exec.signal))
    } catch (error) {
      // An auto-archived spec no longer lives under `.kaze/<feature>`. Point
      // the caller at the archived report instead of a bare "not found".
      if ((error as { code?: string }).code === 'KAZE_SPEC_NOT_FOUND') {
        const archived = await listArchived(root).catch(() => [])
        const match = archived.find((entry) => entry.feature === feature || entry.archiveId === feature)
        if (match !== undefined) {
          throw new SpecError(
            `spec ${feature} is archived at ${match.path}; its delivery.md was built before archiving`,
            'KAZE_SPEC_NOT_FOUND',
          )
        }
      }
      throw error
    }
  },
  presentCall: (args) => ({ card: 'generic', title: `Delivery: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const scopeTool = defineTool({
  name: 'kaze_spec_scope',
  description:
    'Set or correct a spec project scope. Brownfield enforces existing-system survey, impact/migration, preservation, and regression checks; greenfield disables those checks.',
  parameters: featureParams({
    scope: { type: 'string', enum: ['brownfield', 'greenfield'], description: 'Project scope.' },
  }, ['scope']),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const scope = stringArg(args, 'scope') as SpecScope
    if (scope !== 'brownfield' && scope !== 'greenfield') throw new SpecError(`unknown scope ${scope}`)
    return output(await setScope(workspaceRoot(exec), stringArg(args, 'feature'), scope, exec.signal))
  },
  presentCall: (args) => ({ card: 'generic', title: `Scope: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const idleTool = defineTool({
  name: 'kaze_spec_idle',
  description:
    'Manage the idle-time queue. Peak is Beijing Mon-Fri 09:00-12:00 and 14:00-18:00; everything else is idle at half the peak cost (the holiday calendar is not applied). Actions: status, add, defer, update, remove, prune, move, sort, config, clear. `prune` drops entries whose spec/task is gone or already complete.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      action: { type: 'string', enum: ['status', 'add', 'defer', 'update', 'remove', 'prune', 'move', 'sort', 'config', 'clear'] },
      feature: { type: 'string', description: 'Spec directory name for add/defer.' },
      taskId: { type: 'string', description: 'Task id for add.' },
      entryId: { type: 'string', description: 'Queue entry id for update/remove/move.' },
      direction: { type: 'string', enum: ['up', 'down'], description: 'Move direction.' },
      peakCost: { type: 'number', description: 'Estimated peak-time cost; idle cost is half by default.' },
      note: { type: 'string', description: 'Optional queue note.' },
      dependsOn: { type: 'array', items: { type: 'string' }, description: 'Task ids or feature:taskId dependencies.' },
      config: { type: 'string', description: 'JSON idle config for action=config.' },
    },
    required: ['action'],
  },
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const action = stringArg(args, 'action')
    return output(await idleMutate(workspaceRoot(exec), action, args, exec.signal))
  },
  presentCall: (args) => ({ card: 'generic', title: `Idle queue: ${label(args, 'action')}`, kind: 'other', rawInput: args }),
})

const archiveTool = defineTool({
  name: 'kaze_spec_archive',
  description:
    'Move one completed spec from .kaze/<feature> to .kaze/archive/YYYY-MM-DD-<feature>. Requires phase=done unless force=true, and re-checks the done gate before moving. A capability-bound spec merges its accepted requirements first; a forced archive of unfinished work skips that merge. Queued idle entries for the spec are pruned. Non-destructive and reversible with kaze_spec_restore.',
  parameters: featureParams({
    reason: { type: 'string', description: 'Optional short reason for the archive metadata.' },
    force: { type: 'boolean', description: 'Archive even when the phase is not done.' },
  }),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const root = workspaceRoot(exec)
    const feature = stringArg(args, 'feature')
    return output(await archiveWithTimeline(activeContext, root, feature, {
      reason: optionalString(args, 'reason'),
      force: booleanArg(args, 'force'),
    }, exec.signal))
  },
  presentCall: (args) => ({ card: 'generic', title: `Archive ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const restoreTool = defineTool({
  name: 'kaze_spec_restore',
  description:
    'Restore one archived spec from .kaze/archive back to .kaze/<feature>. Accepts either the archive id (YYYY-MM-DD-<feature>) or the original feature name.',
  parameters: featureParams(),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    const restored = await restoreSpec(workspaceRoot(exec), stringArg(args, 'feature'), exec.signal)
    // Archive retired the Timeline tree; restore re-projects the tasks so the
    // spec is visible again.
    return output({ ...restored, timeline: await projectTimeline(exec, restored.feature) })
  },
  presentCall: (args) => ({ card: 'generic', title: `Restore ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const timelineTool = defineTool({
  name: 'kaze_spec_timeline',
  description:
    'Project the current tasks.md into the native Timeline as one task tree. The spec file stays authoritative; Timeline is a one-way mirror.',
  parameters: featureParams(),
  output: { schema: OUTPUT_SCHEMA, render },
  async execute(args, exec) {
    return output(await projectTimeline(exec, stringArg(args, 'feature')))
  },
  presentCall: (args) => ({ card: 'generic', title: `Timeline: ${label(args, 'feature')}`, kind: 'other', rawInput: args }),
})

const TOOLS: readonly ToolSpec[] = [
  listTool,
  statusTool,
  initTool,
  workflowTool,
  verifyTool,
  capabilityTool,
  mergeTool,
  repairTool,
  capabilitiesTool,
  validateTool,
  gateTool,
  advanceTool,
  tasksTool,
  taskTool,
  syncTool,
  pbtTool,
  reviewTool,
  renameTool,
  gateRecordTool,
  deliveryTool,
  scopeTool,
  idleTool,
  archiveTool,
  restoreTool,
  timelineTool,
]

/** Register every `kaze_spec_*` tool on the DSH registry. */
export function registerKazeTools(ctx: Context): void {
  activeContext = ctx
  const registry = (ctx as unknown as { tools: { register(definition: unknown): () => void } }).tools
  for (const tool of TOOLS) registry.register(tool)
}

