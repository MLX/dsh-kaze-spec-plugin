/** File-first spec state, gates, tasks, and rename operations. */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename as moveDir, rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { acceptanceCriteria, buildDelivery, latestGate, readGates, specDocsHash } from './delivery.js'
import { SpecError } from './errors.js'
import { withSpecLock } from './lock.js'
import {
  DEFAULT_DESIGN_DETAIL,
  DESIGN_DETAILS,
  DOC_FILES,
  DOC_ORDER,
  FEATURE_WORKFLOWS,
  configPath,
  docPath,
  exists,
  featureDir,
  nowIso,
  PHASES,
  readJson,
  readText,
  safeFeature,
  statePath,
  writeAtomic,
  writeJson,
  type DesignDetail,
  type DocName,
  type FeatureWorkflow,
  type Phase,
  type SpecScope,
  type SpecType,
  type TaskStatus,
  type Workflow,
} from './paths.js'
import { renameIdleFeature } from './queue.js'
import { isReservedSpecDir } from '../../shared/spec-dirs.js'
import { SPEC_ROOT_NAME, SPEC_ROOT_PATTERN } from '../../shared/spec-root.js'
import { parseDag, parseTasks, readyTasks, setCheckbox, uncoveredRequiredLeaves, type SpecTask } from './tasks.js'
import { validateDirectory, validationText, bilingual, modelCoverageIssues, requirementCriterionIds, validateModel, type ValidationReport } from './validator.js'

export interface SpecState {
  schema: number
  feature: string
  specType: SpecType
  scope: SpecScope
  workflow: Workflow
  /** Design depth for the design phase; workflow-independent. */
  designDetail: DesignDetail
  /** Optional capability in `.kaze/specs/<capability>/spec.md` this spec feeds. */
  capability?: string
  /** Hash of requirements.md at the last capability merge for this capability. */
  capabilityHash?: string
  /** Hash of requirements + model when the verify-first check was recorded. */
  verificationHash?: string
  /** Session that created the spec; execution commands must run in another session. */
  createdBy?: string
  phase: Phase
  createdAt: string
  updatedAt: string
  tasks: Record<string, TaskStatus>
  history: Array<Record<string, unknown>>
  pbt?: Record<string, { status: string; example: string; at: string }>
}

export interface SpecConfig {
  schema: number
  specId: string
  workflowType: Workflow
  specType: SpecType
}

export interface SpecSummary {
  feature: string
  type: string
  workflow: string
  designDetail: string
  capability?: string
  analysis: boolean
  phase: string
  updatedAt: string
  /** Present when the spec directory exists but its state could not be read. */
  error?: string
}

export interface SpecStatus {
  feature: string
  type: string
  scope: string
  workflow: string
  designDetail: string
  capability?: string
  phase: string
  documents: Record<DocName, boolean>
  acceptance: boolean
  tasks: { total: number; completed: number; in_progress: number; ready: number }
  updatedAt: string
}

export interface GateResult {
  phase: Phase
  ok: boolean
  errors: string[]
  warnings: string[]
  /** Whether strict mode folded the warnings into `errors`. */
  strict?: boolean
  validation?: ValidationReport
}

const DEFAULT_WORKFLOW: Workflow = 'requirements-first'

function normalizeWorkflow(value: unknown, specType: SpecType): Workflow {
  if (specType === 'bugfix') return 'bugfix'
  if (typeof value === 'string' && (FEATURE_WORKFLOWS as readonly string[]).includes(value)) {
    return value as FeatureWorkflow
  }
  return DEFAULT_WORKFLOW
}

function normalizeDesignDetail(value: unknown): DesignDetail {
  return typeof value === 'string' && (DESIGN_DETAILS as readonly string[]).includes(value)
    ? (value as DesignDetail)
    : DEFAULT_DESIGN_DETAIL
}

function normalizeState(raw: unknown, feature: string): SpecState {
  if (typeof raw !== 'object' || raw === null) throw new SpecError('invalid state.json')
  const value = raw as Record<string, unknown>
  const specType: SpecType = value.specType === 'bugfix' ? 'bugfix' : 'feature'
  return {
    schema: 2,
    feature: typeof value.feature === 'string' ? value.feature : feature,
    specType,
    scope: value.scope === 'brownfield' || value.scope === 'greenfield' ? value.scope : 'unknown',
    workflow: normalizeWorkflow(value.workflow, specType),
    designDetail: normalizeDesignDetail(value.designDetail),
    ...(typeof value.capability === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value.capability)
      ? { capability: value.capability }
      : {}),
    ...(typeof value.capabilityHash === 'string' ? { capabilityHash: value.capabilityHash } : {}),
    ...(typeof value.verificationHash === 'string' ? { verificationHash: value.verificationHash } : {}),
    ...(typeof value.createdBy === 'string' && value.createdBy !== '' ? { createdBy: value.createdBy } : {}),
    phase: (() => {
      if (value.phase === undefined) return 'initial' as Phase
      const phase = String(value.phase)
      if (!(PHASES as readonly string[]).includes(phase)) {
        throw new SpecError(
          `invalid spec phase ${JSON.stringify(value.phase)}; repair state.json before continuing`,
          'KAZE_SPEC_INVALID_STATE',
        )
      }
      return phase as Phase
    })(),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : nowIso(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso(),
    tasks: typeof value.tasks === 'object' && value.tasks !== null ? (value.tasks as Record<string, TaskStatus>) : {},
    history: Array.isArray(value.history) ? (value.history as Array<Record<string, unknown>>) : [],
    ...(typeof value.pbt === 'object' && value.pbt !== null
      ? { pbt: value.pbt as SpecState['pbt'] }
      : {}),
  }
}

export async function loadState(root: string, feature: string): Promise<SpecState> {
  const path = statePath(root, feature)
  if (!(await exists(path))) throw new SpecError(`spec not found: ${path}`, 'KAZE_SPEC_NOT_FOUND')
  return normalizeState(await readJson(path), basename(featureDir(root, feature)))
}

export async function saveState(root: string, feature: string, state: SpecState): Promise<void> {
  state.updatedAt = nowIso()
  // History is audit data, not an unbounded log: keep recent context and every
  // non-task event, but cap the per-task noise.
  if (state.history.length > 2000) {
    const tasks = state.history.filter((event) => event.event === 'task').slice(-200)
    const others = state.history.filter((event) => event.event !== 'task').slice(-1800)
    state.history = [...others, ...tasks].sort((left, right) => String(left.at).localeCompare(String(right.at)))
  }
  await writeJson(statePath(root, feature), state)
}

export async function initSpec(
  root: string,
  input: { feature: string; type?: SpecType; scope?: SpecScope; workflow?: Workflow; designDetail?: DesignDetail; capability?: string; createdBy?: string },
  signal?: AbortSignal,
): Promise<{ state: SpecState; created: boolean }> {
  const feature = safeFeature(input.feature)
  const dir = featureDir(root, feature)
  await mkdir(dir, { recursive: true })
  return withSpecLock(dir, async () => {

    if (await exists(join(dir, 'state.json'))) {
      return { state: await loadState(root, feature), created: false }
    }
    const specType: SpecType = input.type === 'bugfix' ? 'bugfix' : 'feature'
    const scope: SpecScope = specType === 'bugfix' ? 'brownfield' : (input.scope ?? 'brownfield')
    const workflow = normalizeWorkflow(input.workflow, specType)
    const designDetail = normalizeDesignDetail(input.designDetail)
    const capability = typeof input.capability === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(input.capability)
      ? input.capability
      : undefined
    if (specType === 'bugfix' && capability !== undefined) {
      throw new SpecError('a bugfix spec cannot feed a capability; record the fix in a feature spec')
    }
    const at = nowIso()
    const state: SpecState = {
      schema: 2,
      feature,
      specType,
      scope,
      workflow,
      designDetail,
      ...(capability === undefined ? {} : { capability }),
      ...(typeof input.createdBy === 'string' && input.createdBy !== '' ? { createdBy: input.createdBy } : {}),
      phase: 'initial',
      createdAt: at,
      updatedAt: at,
      tasks: {},
      history: [{ at, event: 'init', phase: 'initial' }],
    }
    await saveState(root, feature, state)
    const config = configPath(root, feature)
    if (!(await exists(config))) {
      const value: SpecConfig = {
        schema: 1,
        specId: randomUUID(),
        workflowType: workflow,
        specType,
      }
      await writeJson(config, value)
    }
    return { state, created: true }
  }, signal)
}

export async function listSpecs(root: string): Promise<SpecSummary[]> {
  if (!(await exists(root))) return []
  const entries = await readdir(root, { withFileTypes: true })
  const rows: SpecSummary[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    // Bookkeeping directories (`archive`, `specs`, `batch`, `steering`,
    // `wishes`) are not specs; a directory without state.json is reported as
    // needing repair.
    if (!entry.isDirectory() || isReservedSpecDir(entry.name)) continue
    const dir = featureDir(root, entry.name)
    try {
      const state = await loadState(root, entry.name)
      rows.push({
        feature: state.feature,
        type: state.specType,
        workflow: state.workflow,
        designDetail: state.designDetail,
        ...(state.capability === undefined ? {} : { capability: state.capability }),
        analysis: await exists(join(featureDir(root, state.feature), 'analysis.md')),
        phase: state.phase,
        updatedAt: state.updatedAt,
      })
    } catch (error) {
      // A damaged spec stays visible as "needs repair" instead of vanishing:
      // either its state.json is there but unreadable, or it still holds spec
      // documents. A stray directory (or a bookkeeping directory newer than the
      // reserved list) has neither and is not a spec at all.
      if (!(await exists(join(dir, 'state.json')))) {
        const documents = await Promise.all(
          Object.values(DOC_FILES).map((file) => exists(join(dir, file))),
        )
        if (!documents.some(Boolean)) continue
      }
      rows.push({
        feature: entry.name,
        type: '',
        workflow: '',
        designDetail: '',
        analysis: false,
        phase: '',
        updatedAt: '',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return rows
}

export interface ProjectOverview {
  rules: boolean
  steering: number
  analysis: number
  pbtPassed: number
}

/** Read-only project-level status for the settings surface. */
export async function projectOverview(root: string): Promise<ProjectOverview> {
  const workspace = join(root, '..')
  let rules = false
  for (const name of ['AGENTS.md']) {
    const path = join(workspace, name)
    if (await exists(path)) {
      rules = /^##\s+(?:Project Rules|项目规约|工程规约|工程红线)\s*$/m.test(await readText(path))
      if (rules) break
    }
  }
  let steering = 0
  const steeringDir = join(root, 'steering')
  if (await exists(steeringDir)) {
    steering = (await readdir(steeringDir).catch(() => [])).filter((name) => name.endsWith('.md')).length
  }
  let analysis = 0
  let pbtPassed = 0
  for (const row of await listSpecs(root)) {
    if (row.error !== undefined) continue
    if (await exists(join(root, row.feature, 'analysis.md'))) analysis += 1
    try {
      const state = await loadState(root, row.feature)
      pbtPassed += Object.values(state.pbt ?? {}).filter((record) => record.status === 'passed').length
    } catch {
      // Damaged specs are reported elsewhere.
    }
  }
  return { rules, steering, analysis, pbtPassed }
}

export async function specStatus(root: string, feature: string): Promise<SpecStatus> {
  const state = await loadState(root, feature)
  const dir = featureDir(root, feature)
  const tasks = (await exists(docPath(root, feature, 'tasks'))) ? parseTasks(await readText(docPath(root, feature, 'tasks'))) : []
  const leaves = tasks.filter((task) => task.leaf)
  const markdown = (await exists(docPath(root, feature, 'tasks'))) ? await readText(docPath(root, feature, 'tasks')) : ''
  const documents = {} as Record<DocName, boolean>
  for (const doc of ['requirements', 'design', 'tasks', 'bugfix'] as const) {
    documents[doc] = await exists(join(dir, `${doc}.md`))
  }
  return {
    feature: state.feature,
    type: state.specType,
    scope: state.scope,
    workflow: state.workflow,
    designDetail: state.designDetail,
    ...(state.capability === undefined ? {} : { capability: state.capability }),
    phase: state.phase,
    documents,
    acceptance: await exists(join(dir, 'acceptance.md')),
    tasks: {
      total: leaves.length,
      completed: leaves.filter((task) => task.status === 'completed').length,
      in_progress: leaves.filter((task) => task.status === 'in_progress').length,
      ready: readyTasks(tasks, parseDag(markdown)).length,
    },
    updatedAt: state.updatedAt,
  }
}

function requiredLeaves(tasks: readonly SpecTask[]): SpecTask[] {
  return tasks.filter((task) => task.leaf && !task.optional)
}

/** Done is terminal: no engine-mediated document, task, or metadata change. */
function assertMutable(state: SpecState, action: string): void {
  if (state.phase === 'done') {
    throw new SpecError(
      `spec ${state.feature} is done; ${action} is not allowed after done. Create a new feature or bugfix spec for new work.`,
      'KAZE_SPEC_DONE',
    )
  }
}

/** Stable hash of the feature requirements a capability merge published. */
export function requirementsHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export async function setScope(root: string, feature: string, scope: SpecScope, signal?: AbortSignal): Promise<SpecState> {
  const dir = featureDir(root, feature)
  return withSpecLock(dir, async () => {
    const state = await loadState(root, feature)
    assertMutable(state, 'changing the scope')
    state.scope = scope
    state.history.push({ at: nowIso(), event: 'scope', scope })
    await saveState(root, feature, state)
    return state
  }, signal)
}

/** Record the first time a spec document is seen, for workflow order checks. */
export async function recordDocCreated(
  root: string,
  feature: string,
  doc: DocName,
  signal?: AbortSignal,
): Promise<void> {
  const dir = featureDir(root, feature)
  if (!(await exists(statePath(root, feature)))) return
  await withSpecLock(dir, async () => {
    const state = await loadState(root, feature)
    if (state.history.some((event) => event.event === 'doc-created' && event.doc === doc)) return
    state.history.push({ at: nowIso(), event: 'doc-created', doc })
    await saveState(root, feature, state)
  }, signal)
}

/** Record one history event from a host-side operation. */
export async function recordEvent(
  root: string,
  feature: string,
  event: string,
  details: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<void> {
  const dir = featureDir(root, feature)
  await withSpecLock(dir, async () => {
    const state = await loadState(root, feature)
    state.history.push({ at: nowIso(), event, ...details })
    await saveState(root, feature, state)
  }, signal)
}

export async function setWorkflow(
  root: string,
  feature: string,
  input: { workflow?: string; designDetail?: string },
  signal?: AbortSignal,
): Promise<SpecState> {
  const dir = featureDir(root, feature)
  return withSpecLock(dir, async () => {
    const state = await loadState(root, feature)
    assertMutable(state, 'changing the workflow')
    if (input.workflow !== undefined) {
      if (!(FEATURE_WORKFLOWS as readonly string[]).includes(input.workflow)) {
        throw new SpecError(
          `unknown feature workflow ${JSON.stringify(input.workflow)}; use ${FEATURE_WORKFLOWS.join(' | ')}`,
        )
      }
      if (state.specType === 'bugfix') {
        throw new SpecError('a bugfix spec keeps the bugfix workflow; only its designDetail can change')
      }
      if (state.phase !== 'initial' && state.workflow !== input.workflow) {
        throw new SpecError(
          `workflow route can only change at phase=initial; ${state.feature} is already at ${state.phase}. Create a new spec for a different route.`,
          'KAZE_SPEC_WORKFLOW_PHASE',
        )
      }
      // A route change after any phase document exists would mix the workflows'
      // contracts (e.g. quick requirements upgraded to verify-first). The docs on
      // disk are the source of truth; the route is frozen once one is written.
      if (state.workflow !== input.workflow) {
        const written: string[] = []
        for (const doc of DOC_ORDER) {
          if (await exists(join(dir, DOC_FILES[doc]))) written.push(DOC_FILES[doc])
        }
        if (written.length > 0) {
          throw new SpecError(
            `workflow route is frozen once a spec document exists; ${state.feature} already has ${written.join(', ')}. Create a new spec with the desired route instead.`,
            'KAZE_SPEC_WORKFLOW_DOCS',
          )
        }
      }
      state.workflow = input.workflow as FeatureWorkflow
    }
    if (input.designDetail !== undefined) {
      if (!(DESIGN_DETAILS as readonly string[]).includes(input.designDetail)) {
        throw new SpecError(
          `unknown design detail ${JSON.stringify(input.designDetail)}; use ${DESIGN_DETAILS.join(' | ')}`,
        )
      }
      state.designDetail = input.designDetail as DesignDetail
    }
    state.history.push({
      at: nowIso(),
      event: 'workflow',
      workflow: state.workflow,
      designDetail: state.designDetail,
    })
    await saveState(root, feature, state)
    return state
  }, signal)
}

export async function setCapability(
  root: string,
  feature: string,
  capability: string,
  signal?: AbortSignal,
): Promise<SpecState> {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(capability)) {
    throw new SpecError(`invalid capability ${JSON.stringify(capability)}; use a kebab-case id`)
  }
  const dir = featureDir(root, feature)
  return withSpecLock(dir, async () => {
    const state = await loadState(root, feature)
    assertMutable(state, 'changing the capability')
    if (state.specType === 'bugfix') {
      throw new SpecError('a bugfix spec cannot feed a capability; record the fix in a feature spec')
    }
    state.capability = capability
    state.history.push({ at: nowIso(), event: 'capability', capability })
    await saveState(root, feature, state)
    return state
  }, signal)
}

async function unresolvedComments(dir: string): Promise<number> {
  const reviews = join(dir, 'reviews')
  if (!(await exists(reviews))) return 0
  let names: string[]
  try {
    names = (await readdir(reviews)).filter((name) => name.endsWith('.json'))
  } catch {
    return 0
  }
  let open = 0
  for (const name of names) {
    try {
      const value = JSON.parse(await readFile(join(reviews, name), 'utf8')) as { comments?: unknown }
      if (!Array.isArray(value.comments)) continue
      for (const comment of value.comments) {
        if (typeof comment === 'object' && comment !== null && (comment as { resolved?: unknown }).resolved !== true) open += 1
      }
    } catch {
      // A damaged review file is reported by the UI, not the gate.
    }
  }
  return open
}

/** Properties without a passed `kaze_spec_pbt` record. */
function pbtGaps(design: string, state: SpecState): string[] {
  if (/(?:not applicable|不适用|ruled out|PBT waived)/i.test(design)) return []
  const gaps: string[] = []
  for (const match of design.matchAll(/^###\s+(?:Property|属性)\s*(\d+)[:：]\s*(.+?)\s*$/gm)) {
    const number = match[1]!
    const title = match[2]!.trim()
    const record = state.pbt?.[number] ?? state.pbt?.[title] ?? state.pbt?.[`Property ${number}`]
    if (record?.status !== 'passed') gaps.push(title)
  }
  return gaps
}

/** Completed required tasks whose evidence file is missing or malformed. */
async function evidenceProblems(dir: string, state: SpecState): Promise<string[]> {
  const tasksPath = join(dir, 'tasks.md')
  if (!(await exists(tasksPath))) return []
  const tasks = parseTasks(await readText(tasksPath))
  const required = tasks.filter((task) => task.leaf && !task.optional && task.status === 'completed')
  const problems: string[] = []
  for (const task of required) {
    const path = join(dir, 'exec', 'evidence', `${task.id}.json`)
    if (!(await exists(path))) {
      problems.push(`${task.id}: missing exec/evidence/${task.id}.json`)
      continue
    }
    try {
      const value = JSON.parse(await readText(path)) as Record<string, unknown>
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        problems.push(`${task.id}: evidence must be a JSON object`)
        continue
      }
      if (value.task !== task.id) problems.push(`${task.id}: evidence "task" must equal "${task.id}"`)
      if (typeof value.result !== 'string' || value.result.trim() === '') {
        problems.push(`${task.id}: evidence "result" must be a non-empty string`)
      }
      if (typeof value.at !== 'string' || Number.isNaN(Date.parse(value.at))) {
        problems.push(`${task.id}: evidence "at" must be an ISO timestamp`)
      }
    } catch (error) {
      problems.push(`${task.id}: invalid evidence JSON (${(error as Error).message})`)
    }
  }
  return problems
}

/** Hash of requirements.md, or null when the file is absent. */
async function requirementsHashOf(dir: string): Promise<string | null> {
  const path = join(dir, 'requirements.md')
  if (!(await exists(path))) return null
  return requirementsHash(await readText(path))
}

/** When the workspace declares project rules, the design must check them. */
async function missingRulesCheck(dir: string): Promise<string | null> {
  const workspace = join(dir, '..', '..')
  let rules = ''
  for (const name of ['AGENTS.md']) {
    const path = join(workspace, name)
    if (await exists(path)) {
      rules = await readText(path)
      break
    }
  }
  if (!/^##\s+(?:Project Rules|项目规约|工程规约|工程红线)\s*$/m.test(rules)) return null
  const designPath = join(dir, 'design.md')
  if (!(await exists(designPath))) return null
  const design = await readText(designPath)
  if (!/^##\s+(?:Rules Check|规约检查|红线检查|Constitution Check|宪法检查)\s*$/m.test(design)) {
    return 'the workspace declares Project Rules; design.md is missing ## Rules Check / ## 规约检查 / ## 红线检查'
  }
  const ruleIds = [...rules.matchAll(/^\s*[-*]\s+(R\d+)\s*[:：]/gm)].map((match) => match[1]!)
  if (ruleIds.length === 0) return null
  const lines = design.split(/\r?\n/)
  const start = lines.findIndex((line) => /^##\s+(?:Rules Check|规约检查|红线检查|Constitution Check|宪法检查)\s*$/.test(line))
  const checked = new Set<string>()
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s/.test(lines[index]!)) break
    for (const match of lines[index]!.matchAll(/\b(R\d+)\b/g)) checked.add(match[1]!)
  }
  const missing = ruleIds.filter((id) => !checked.has(id))
  return missing.length === 0
    ? null
    : `Rules Check does not cover: ${missing.join(', ')}; list every rule as compliant or exception`
}

/** The design must record the chosen option, the rejected alternatives, and why. */
async function missingTradeoffs(dir: string): Promise<string | null> {
  const designPath = join(dir, 'design.md')
  if (!(await exists(designPath))) return null
  const design = await readText(designPath)
  if (/^##\s+(?:Trade-offs|权衡|取舍)\s*$/m.test(design)) return null
  return 'design.md is missing ## Trade-offs / ## 权衡: record the chosen option, the rejected alternatives, and why it wins'
}

/** Hash of the verify-first inputs: requirements + the SMT model. */
async function verificationHash(dir: string): Promise<string | null> {
  const requirementsPath = join(dir, 'requirements.md')
  const modelPath = join(dir, 'model.smt2')
  if (!(await exists(requirementsPath)) || !(await exists(modelPath))) return null
  const hash = createHash('sha256')
  hash.update(await readText(requirementsPath))
  hash.update('\n---model---\n')
  hash.update(await readText(modelPath))
  return hash.digest('hex')
}

/**
 * Structural model preflight plus criterion-to-assertion coverage. This is not a
 * solver; it rejects a model that cannot represent the requirements at all.
 */
async function modelProblems(dir: string): Promise<{ errors: string[]; warnings: string[] }> {
  const modelPath = join(dir, 'model.smt2')
  if (!(await exists(modelPath))) return { errors: ['missing model.smt2'], warnings: [] }
  const model = await readText(modelPath)
  const report = validateModel(model)
  const requirementsPath = join(dir, 'requirements.md')
  const criteria = (await exists(requirementsPath))
    ? requirementCriterionIds(await readText(requirementsPath))
    : new Set<string>()
  const coverage = modelCoverageIssues(model, criteria).map((issue) => issue.message)
  return { errors: [...report.errors, ...coverage], warnings: [...report.warnings] }
}

/** Record the current verify-first inputs as the checked baseline. */
export async function recordVerification(
  root: string,
  feature: string,
  signal?: AbortSignal,
): Promise<{ feature: string; hash: string }> {
  const dir = featureDir(root, feature)
  return withSpecLock(dir, async () => {
    const state = await loadState(root, feature)
    assertMutable(state, 'recording a verification baseline')
    const model = await modelProblems(dir)
    if (model.errors.length > 0) {
      throw new SpecError(
        `model.smt2 failed the verification preflight: ${model.errors.join('; ')}`,
        'KAZE_SPEC_MODEL',
      )
    }
    const hash = await verificationHash(dir)
    if (hash === null) {
      throw new SpecError('verify-first needs requirements.md and model.smt2 before recording a baseline')
    }
    state.verificationHash = hash
    state.history.push({ at: nowIso(), event: 'verification-baseline', hash })
    await saveState(root, feature, state)
    return { feature, hash }
  }, signal)
}

/** Whether the verify-first inputs changed after the recorded baseline. */
async function verificationChanged(dir: string, state: SpecState): Promise<'missing' | 'stale' | 'fresh'> {
  if (state.verificationHash === undefined) return 'missing'
  const hash = await verificationHash(dir)
  if (hash === null) return 'missing'
  return hash === state.verificationHash ? 'fresh' : 'stale'
}

/** Text of the `## Result` section in verification.md, or null when absent. */
async function verificationResultText(dir: string): Promise<string | null> {
  const path = join(dir, 'verification.md')
  if (!(await exists(path))) return null
  const lines = (await readText(path)).split(/\r?\n/)
  const start = lines.findIndex((line) => /^##\s+(?:Result|结果)\s*$/.test(line))
  if (start < 0) return null
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s/.test(lines[index]!)) {
      end = index
      break
    }
  }
  return lines.slice(start + 1, end).join('\n').trim()
}

/**
 * Verify-first evidence must be a recorded pass: a FAIL/PARTIAL result is a
 * contradiction between the model and the requirements, not a warning.
 */
async function verificationFailure(dir: string): Promise<string | null> {
  const result = await verificationResultText(dir)
  // A missing file or Result section is reported by the existence/validator checks.
  if (result === null || result === '') return null
  if (/^(?:PASS\b|通过)/i.test(result)) return null
  return 'verification.md Result must start with PASS (e.g. "PASS (manual)"); re-run the model check, fix the contradiction, and re-run kaze_spec_verify'
}

export async function gateErrors(
  root: string,
  feature: string,
  phase: Phase,
  strict = false,
): Promise<GateResult> {
  const dir = featureDir(root, feature)
  const state = await loadState(root, feature)
  const errors: string[] = []
  const warnings: string[] = []
  let validation: ValidationReport | undefined

  if (phase !== 'initial' && state.scope === 'unknown') {
    warnings.push(
      'scope is unknown; brownfield survey, migration, and preservation gates are skipped. Set it with kaze_spec_scope',
    )
  }

  if (phase === 'requirements') {
    const required = state.specType === 'bugfix' ? 'bugfix.md' : 'requirements.md'
    if (!(await exists(join(dir, required)))) errors.push(`missing ${required}`)
    if (!(await exists(join(dir, 'clarify.md')))) {
      errors.push('missing clarify.md; record the clarification ledger (Decisions/Assumptions/Rounds) and assumptions')
    }
    if (state.workflow === 'design-first') {
      const designPath = join(dir, 'design.md')
      const requirementsPath = join(dir, required)
      if (!(await exists(designPath))) {
        errors.push('design-first workflow requires design.md before the requirements gate')
      } else if (await exists(requirementsPath)) {
        // Prefer the recorded creation order; fall back to birth time for specs
        // written outside the hooks.
        let designIndex = -1
        let requirementsIndex = -1
        const primaryDoc = required === 'requirements.md' ? 'requirements' : 'bugfix'
        for (let index = 0; index < state.history.length; index += 1) {
          const event = state.history[index]!
          if (event.event !== 'doc-created') continue
          if (event.doc === 'design' && designIndex < 0) designIndex = index
          if (event.doc === primaryDoc && requirementsIndex < 0) requirementsIndex = index
        }
        if (designIndex >= 0 && requirementsIndex >= 0) {
          if (designIndex > requirementsIndex) {
            errors.push('design-first order: design.md was recorded after requirements.md; the design must come first')
          }
        } else {
          const designStat = await stat(designPath)
          const requirementsStat = await stat(requirementsPath)
          if (designStat.birthtimeMs > 0 && requirementsStat.birthtimeMs > 0
            && designStat.birthtimeMs > requirementsStat.birthtimeMs + 1000) {
            warnings.push('design-first order: design.md was created after requirements.md; the design should come first')
          }
        }
      }
    }
    if (state.workflow === 'verify-first') {
      const modelPath = join(dir, 'model.smt2')
      if (!(await exists(modelPath))) {
        errors.push('verify-first workflow requires model.smt2 before the requirements gate')
      } else {
        const model = await modelProblems(dir)
        errors.push(...model.errors)
        warnings.push(...model.warnings)
      }
      const verificationPath = join(dir, 'verification.md')
      if (!(await exists(verificationPath))) {
        errors.push('verify-first workflow requires verification.md before the requirements gate')
      } else {
        const failure = await verificationFailure(dir)
        if (failure !== null) errors.push(failure)
      }
    }
  } else if (phase === 'design') {
    if (!(await exists(join(dir, 'design.md')))) errors.push('missing design.md')
    const rulesIssue = await missingRulesCheck(dir)
    if (rulesIssue !== null) errors.push(rulesIssue)
    const tradeoffIssue = await missingTradeoffs(dir)
    if (tradeoffIssue !== null) errors.push(tradeoffIssue)
  } else if (phase === 'tasks') {
    if (!(await exists(join(dir, 'tasks.md')))) errors.push('missing tasks.md')
    const markdown = (await exists(join(dir, 'tasks.md'))) ? await readText(join(dir, 'tasks.md')) : ''
    const tasks = parseTasks(markdown)
    if (tasks.length === 0) errors.push('tasks.md has no checkbox tasks')
    const dag = parseDag(markdown)
    if (dag === null) {
      errors.push('tasks.md has no valid Task Dependency Graph')
    } else {
      const uncovered = uncoveredRequiredLeaves(tasks, dag)
      if (uncovered.length > 0) errors.push(`Task Dependency Graph does not cover: ${uncovered.join(', ')}`)
    }
  } else if (phase === 'execute' || phase === 'done') {
    // A phase cannot be complete without a task contract. An absent or empty
    // tasks.md used to compare 0 required tasks with 0 completed tasks and
    // pass, which let a brand-new spec advance straight to done.
    const tasksPath = join(dir, 'tasks.md')
    if (!(await exists(tasksPath))) {
      errors.push('missing tasks.md')
    } else {
      const tasks = parseTasks(await readText(tasksPath))
      const required = requiredLeaves(tasks)
      if (required.length === 0) {
        errors.push('tasks.md has no required tasks')
      } else {
        const done = required.filter((task) => task.status === 'completed')
        if (done.length !== required.length) {
          errors.push(`required tasks incomplete: ${done.length}/${required.length}`)
        } else {
          const problems = await evidenceProblems(dir, state)
          if (problems.length > 0) {
            errors.push(`completed tasks have missing or invalid evidence: ${problems.slice(0, 8).join('; ')}${problems.length > 8 ? ` (+${problems.length - 8} more)` : ''}`)
          }
        }
      }
    }
    if (phase === 'done') {
      // Completion is a host contract, not prompt guidance: the spec documents,
      // acceptance (when defined), and FTA must be decided before done.
      const primary = state.specType === 'bugfix' ? 'bugfix.md' : 'requirements.md'
      if (!(await exists(join(dir, primary)))) errors.push(`missing ${primary}`)
      if (!(await exists(join(dir, 'clarify.md')))) errors.push('missing clarify.md; the completion decision needs the ledger')
      const rulesIssue = await missingRulesCheck(dir)
      if (rulesIssue !== null) errors.push(rulesIssue)
      if (state.capability === undefined && (await exists(join(root, 'specs')))) {
        warnings.push('spec has no capability; the living capability spec is not updated (kaze_spec_capability)')
      }
      if (state.capability !== undefined) {
        const currentHash = await requirementsHashOf(dir)
        if (currentHash === null) {
          errors.push('capability is set but requirements.md is missing')
        } else if (state.capabilityHash === undefined) {
          errors.push(`capability "${state.capability}" was never merged; run kaze_spec_merge before done`)
        } else if (state.capabilityHash !== currentHash) {
          errors.push(`requirements.md changed after the capability merge; run kaze_spec_merge again`)
        }
      }
      const designText = (await exists(join(dir, 'design.md'))) ? await readText(join(dir, 'design.md')) : ''
      if (designText !== '') {
        const gaps = pbtGaps(designText, state)
        if (gaps.length > 0) {
          warnings.push(`properties without a passed kaze_spec_pbt record: ${gaps.join(', ')}`)
        }
      }
      // state.pbt keeps the latest record per property, so a failed status means
      // the property was never re-recorded as passed afterwards.
      const failedPbt = Object.entries(state.pbt ?? {})
        .filter(([, record]) => record.status === 'failed')
        .map(([key]) => key)
      if (failedPbt.length > 0) {
        errors.push(`property test(s) recorded failed: ${failedPbt.join(', ')}; re-run them via /spec-pbt and record kaze_spec_pbt with status=passed before done`)
      }
      const openComments = await unresolvedComments(dir)
      if (openComments > 0) {
        warnings.push(`${openComments} unresolved review comment(s); resolve them before delivery`)
      }
      if (!(await exists(join(dir, 'design.md')))) errors.push('missing design.md')
      const gates = await readGates(root, feature)
      // Approval is bound to the documents it approved. A later edit to the
      // requirements, design, tasks, or acceptance file invalidates the
      // approval even though gates.json still says "approved".
      const docsHash = await specDocsHash(root, feature)
      const acceptancePath = join(dir, 'acceptance.md')
      if (await exists(acceptancePath)) {
        const gate = latestGate(gates, 'acceptance')
        if (gate === undefined) {
          errors.push('missing acceptance gate; record kaze_spec_gate_record gate=acceptance status=approved')
        } else if (gate.status !== 'approved') {
          errors.push(`acceptance gate is ${gate.status}; it must be approved before done`)
        } else {
          if (gate.docsHash !== undefined && gate.docsHash !== docsHash) {
            errors.push('requirements/design/tasks/acceptance changed after the acceptance gate was approved; re-record kaze_spec_gate_record gate=acceptance')
          }
          // Approval checked the boxes at record time; a later edit can add an
          // unchecked criterion, so done re-reads the file instead of trusting
          // the historical gate alone.
          const criteria = acceptanceCriteria(await readFile(acceptancePath, 'utf8'))
          if (criteria.total === 0) {
            errors.push('acceptance.md has no checkbox criteria; the acceptance gate cannot be approved')
          } else if (criteria.checked !== criteria.total) {
            errors.push(`acceptance.md has ${criteria.total - criteria.checked} unchecked criterion(s); check every criterion before done`)
          }
        }
      } else {
        // Acceptance is optional as a file, but the decision is not: a spec
        // without acceptance.md must explicitly record why it is skipped.
        const gate = latestGate(gates, 'acceptance')
        if (gate === undefined) {
          errors.push('missing acceptance decision; add acceptance.md or record gate=acceptance status=skipped with a reason')
        } else if (gate.status !== 'skipped') {
          errors.push(`acceptance gate is ${gate.status} without acceptance.md; only skipped is valid`)
        } else if (gate.reason.trim() === '') {
          errors.push('acceptance gate was skipped without a reason')
        }
      }
      const fta = latestGate(gates, 'fta')
      if (fta === undefined) {
        errors.push('missing fta gate; record kaze_spec_gate_record gate=fta before done')
      } else if (fta.status === 'skipped') {
        if (fta.reason.trim() === '') errors.push('fta gate was skipped without a reason')
      } else if (fta.status !== 'approved') {
        errors.push(`fta gate is ${fta.status}; it must be approved or skipped before done`)
      } else if (fta.docsHash !== undefined && fta.docsHash !== docsHash) {
        errors.push('the specification changed after the FTA gate was approved; re-record kaze_spec_gate_record gate=fta')
      }
      const verificationPath = join(dir, 'verification.md')
      if (!(await exists(verificationPath))) {
        const needsVerification = state.workflow === 'verify-first'
          || state.specType === 'bugfix'
          || (state.scope === 'brownfield' && state.specType === 'feature')
        if (needsVerification) {
          errors.push('missing verification.md; this spec must record the commands and results used to verify completion')
        } else {
          warnings.push('no verification.md; completing without a recorded verification report')
        }
      } else if (state.workflow === 'verify-first') {
        const failure = await verificationFailure(dir)
        if (failure !== null) errors.push(failure)
      }
    }
  }

  if (state.workflow === 'verify-first' && (phase === 'design' || phase === 'tasks' || phase === 'done')) {
    const model = await modelProblems(dir)
    errors.push(...model.errors)
    warnings.push(...model.warnings)
    const changed = await verificationChanged(dir, state)
    if (changed === 'stale') {
      // At done the baseline cannot be refreshed: kaze_spec_verify is refused by
      // assertMutable, so the message must point at the reachable exits.
      const message = phase === 'done'
        ? 'verification record is stale at done: requirements.md or model.smt2 changed after the recorded check; restore a clean copy with kaze_spec_restore, or archive with force, or open a new bugfix/feature spec; kaze_spec_verify cannot run at done'
        : 'requirements.md or model.smt2 changed after the verification record; re-run /spec-verify-first and kaze_spec_verify'
      if (phase === 'done') errors.push(message)
      else warnings.push(message)
    } else if (changed === 'missing' && phase === 'done') {
      warnings.push('no verification baseline recorded; run kaze_spec_verify after the verify-first check')
    }
  }

  if (phase !== 'initial') {
    validation = await validateDirectory(dir, state.specType)
    for (const issue of validation.errors) errors.push(`${basename(issue.file)}: ${issue.message}`)
    for (const issue of validation.warnings) warnings.push(`${basename(issue.file)}: ${issue.message}`)
  }

  // Strict mode is a deployment decision: advisory warnings become gates.
  if (strict) {
    for (const warning of warnings) errors.push(`strict mode: ${warning}`)
  }

  return {
    phase,
    ok: errors.length === 0,
    errors: errors.map(bilingual),
    warnings: warnings.map(bilingual),
    strict,
    ...(validation === undefined ? {} : { validation }),
  }
}

/** Result of one advance attempt; a failed gate never changes the phase. */
export interface AdvanceResult {
  /** Whether every intermediate gate passed and the phase moved. */
  readonly ok: boolean
  /** True only when the phase actually changed. */
  readonly advanced: boolean
  readonly from: Phase
  readonly to: Phase
  /** The phase after the call: the old one when a gate failed. */
  readonly phase: Phase
  /** Phases crossed by a successful advance, in order. */
  readonly steps: readonly Phase[]
  /** The first phase whose gate blocked the advance, when it failed. */
  readonly failedAt?: Phase
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

export async function advanceSpec(
  root: string,
  feature: string,
  target: Phase,
  signal?: AbortSignal,
  strict = false,
): Promise<AdvanceResult> {
  if (!(PHASES as readonly string[]).includes(target)) throw new SpecError(`unknown phase ${JSON.stringify(target)}`)
  const dir = featureDir(root, feature)
  return withSpecLock(dir, async () => {
    const state = await loadState(root, feature)
    const from = state.phase
    const fromIndex = PHASES.indexOf(from)
    const toIndex = PHASES.indexOf(target)
    if (toIndex < fromIndex) {
      throw new SpecError(
        `cannot move ${feature} back from "${from}" to "${target}"; phases only move forward`,
        'KAZE_SPEC_PHASE_ORDER',
      )
    }
    if (toIndex === fromIndex) {
      return { ok: true, advanced: false, from, to: target, phase: from, steps: [], errors: [], warnings: [] }
    }
    // Every gate between the current phase and the target must pass; the phase
    // only moves when the whole walk is clean, so a partial advance never lies.
    const errors: string[] = []
    const warnings: string[] = []
    let failedAt: Phase | undefined
    for (let index = fromIndex + 1; index <= toIndex; index += 1) {
      const step = PHASES[index] as Phase
      const gate = await gateErrors(root, feature, step, strict)
      warnings.push(...gate.warnings)
      if (!gate.ok) {
        failedAt = step
        errors.push(...gate.errors.map((message) => `${step}: ${message}`))
        break
      }
    }
    if (failedAt !== undefined) {
      return { ok: false, advanced: false, from, to: target, phase: from, failedAt, steps: [], errors, warnings }
    }
    const steps = PHASES.slice(fromIndex + 1, toIndex + 1) as Phase[]
    state.phase = target
    state.history.push({ at: nowIso(), event: 'advance', from, to: target, steps })
    if (state.workflow === 'verify-first' && target === 'requirements') {
      const hash = await verificationHash(dir)
      if (hash !== null) {
        state.verificationHash = hash
        state.history.push({ at: nowIso(), event: 'verification-baseline', hash })
      }
    }
    await saveState(root, feature, state)
    if (target === 'done') {
      // Done is auditable: it must come with a delivery report. Roll the phase
      // back when the report cannot be built, so a failed write never leaves a
      // "done" spec without its evidence.
      try {
        await buildDelivery(root, feature, '', signal)
      } catch (error) {
        state.phase = from
        state.history.push({ at: nowIso(), event: 'advance-rollback', from: target, to: from })
        await saveState(root, feature, state)
        throw new SpecError(
          `phase rolled back to ${from}: delivery.md could not be built (${(error as Error).message})`,
          'KAZE_SPEC_DELIVERY',
        )
      }
    }
    return { ok: true, advanced: true, from, to: target, phase: target, steps, errors: [], warnings }
  }, signal)
}

export async function syncSpec(
  root: string,
  feature: string,
  signal?: AbortSignal,
  strict = false,
): Promise<SpecStatus & { inferred: Phase; advanced: boolean }> {
  const dir = featureDir(root, feature)
  return withSpecLock(dir, async () => {
    const state = await loadState(root, feature)
    const markdown = (await exists(join(dir, 'tasks.md'))) ? await readText(join(dir, 'tasks.md')) : ''
    const tasks = parseTasks(markdown)
    let inferred: Phase = 'initial'
    const requirements = state.specType === 'bugfix' ? 'bugfix.md' : 'requirements.md'
    if (await exists(join(dir, requirements))) inferred = 'requirements'
    if (await exists(join(dir, 'design.md'))) inferred = 'design'
    if (await exists(join(dir, 'tasks.md'))) inferred = 'tasks'
    const required = requiredLeaves(tasks)
    if (required.length > 0 && required.every((task) => task.status === 'completed')) inferred = 'execute'
    // Sync may propose a forward phase, but only the next one and only when its
    // gate passes; it never skips, regresses, or bypasses a gate.
    const from = state.phase
    let advanced = false
    const fromIndex = PHASES.indexOf(from)
    const next = PHASES[fromIndex + 1] as Phase | undefined
    if (next !== undefined && PHASES.indexOf(inferred) > fromIndex) {
      const gate = await gateErrors(root, feature, next, strict)
      if (gate.ok) {
        state.phase = next
        advanced = true
      }
    }
    state.history.push({ at: nowIso(), event: 'sync', to: state.phase, inferred, advanced })
    await saveState(root, feature, state)
    const status = await specStatus(root, feature)
    return { ...status, inferred, advanced }
  }, signal)
}

export async function updateTask(
  root: string,
  feature: string,
  id: string,
  status: TaskStatus,
  signal?: AbortSignal,
): Promise<{ feature: string; id: string; status: TaskStatus }> {
  const dir = featureDir(root, feature)
  return withSpecLock(dir, async () => {
    const path = join(dir, 'tasks.md')
    if (!(await exists(path))) throw new SpecError(`missing ${path}`)
    const state = await loadState(root, feature)
    assertMutable(state, 'changing a task')
    const markdown = await readText(path)
    const updated = setCheckbox(markdown, id, status)
    await writeAtomic(path, updated)
    // tasks.md is the single task-status source; state.json no longer mirrors it.
    state.history.push({ at: nowIso(), event: 'task', id, status })
    await saveState(root, feature, state)
    return { feature: state.feature, id, status }
  }, signal)
}

export async function recordPbt(
  root: string,
  feature: string,
  property: string,
  status: string,
  example = '',
  signal?: AbortSignal,
): Promise<{ property: string; status: string }> {
  const dir = featureDir(root, feature)
  return withSpecLock(dir, async () => {
    const state = await loadState(root, feature)
    assertMutable(state, 'recording a property test')
    const key = /^\d+$/.test(property.trim()) ? `Property ${property.trim()}` : property.trim()
    state.pbt = { ...(state.pbt ?? {}), [key]: { status, example, at: nowIso() } }
    state.history.push({ at: nowIso(), event: 'pbt', property: key, status })
    await saveState(root, feature, state)
    return { property: key, status }
  }, signal)
}

export async function renameSpec(
  root: string,
  feature: string,
  next: string,
  signal?: AbortSignal,
): Promise<{ from: string; to: string; changed: string[] }> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/.test(next)) throw new SpecError(`invalid new feature name ${JSON.stringify(next)}`)
  const from = safeFeature(feature)
  const to = safeFeature(next)
  const source = featureDir(root, from)
  const target = featureDir(root, to)
  if (!(await exists(source))) throw new SpecError(`spec not found: ${feature}`, 'KAZE_SPEC_NOT_FOUND')
  if (source === target) return { from, to, changed: [] }
  if (await exists(target)) throw new SpecError(`target already exists: ${next}`)

  return withSpecLock(source, async () => {
    const before = await loadState(root, from)
    if (before.phase === 'execute' || before.phase === 'done') {
      throw new SpecError(
        `cannot rename ${from} at phase=${before.phase}; rename before execution or create a new spec`,
        'KAZE_SPEC_RENAME_PHASE',
      )
    }
    await moveDir(source, target)
    // The lock file moved with the directory; remove it before releasing.
    await rm(join(target, 'kaze.lock'), { force: true })
    const state = await loadState(root, to)
    state.feature = to
    state.history.push({ at: nowIso(), event: 'rename', from, to })
    await saveState(root, to, state)

    const changed: string[] = []
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(path)
          continue
        }
        if (entry.name.endsWith('.md')) {
          const text = await readFile(path, 'utf8')
          // Replace the feature segment only where it ends: `.kaze/demo` must
          // not rewrite `.kaze/demo-2`.
          const pattern = new RegExp(`${SPEC_ROOT_PATTERN}/${escapeRegExp(from)}(?![\\w.-])`, 'g')
          const updated = text.replace(pattern, `${SPEC_ROOT_NAME}/${to}`)
          if (updated !== text) {
            await writeAtomic(path, updated)
            changed.push(path.slice(target.length + 1))
          }
        } else if (entry.name.endsWith('.json') && basename(dir) === 'reviews') {
          try {
            const payload: unknown = JSON.parse(await readFile(path, 'utf8'))
            if (typeof payload === 'object' && payload !== null && (payload as { feature?: unknown }).feature === from) {
              ;(payload as { feature: string }).feature = to
              await writeJson(path, payload)
              changed.push(path.slice(target.length + 1))
            }
          } catch {
            // Invalid review JSON is left untouched.
          }
        }
      }
    }
    await walk(target)
    // Runtime state files also key on the feature id.
    const rewriteJson = async (path: string): Promise<void> => {
      if (!(await exists(path))) return
      try {
        const payload: unknown = JSON.parse(await readFile(path, 'utf8'))
        if (typeof payload !== 'object' || payload === null) return
        const value = payload as Record<string, unknown>
        let modified = false
        if (value.feature === from) {
          value.feature = to
          modified = true
        }
        if (Array.isArray(value.features)) {
          for (const item of value.features) {
            if (typeof item === 'object' && item !== null && (item as { feature?: unknown }).feature === from) {
              ;(item as { feature: string }).feature = to
              modified = true
            }
          }
        }
        if (value.nextFeature === from) {
          value.nextFeature = to
          modified = true
        }
        if (modified) {
          await writeJson(path, value)
          changed.push(path.slice(root.length + 1))
        }
      } catch {
        // A damaged run/batch file is reported elsewhere; rename must not fail.
      }
    }
    await rewriteJson(join(target, 'exec', 'run.json'))
    await rewriteJson(join(root, 'batch', 'last.json'))
    // Keep the living capability Change Log pointing at the renamed feature.
    const livingRoot = join(root, 'specs')
    if (await exists(livingRoot)) {
      for (const entry of await readdir(livingRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const specPath = join(livingRoot, entry.name, 'spec.md')
        if (!(await exists(specPath))) continue
        const text = await readText(specPath)
        const updated = text.replace(new RegExp(`^(\\|\\s*\\d{4}-\\d{2}-\\d{2}\\s*\\|\\s*)${escapeRegExp(from)}(\\s*\\|)`, 'gm'), `$1${to}$2`)
        if (updated !== text) {
          await writeAtomic(specPath, updated)
          changed.push(specPath.slice(target.length + 1))
        }
      }
    }
    // Queued work points at a feature id; a rename must move it with the spec
    // or the idle queue starts reporting a missing spec.
    const idle = await renameIdleFeature(root, from, to)
    return { from, to, changed, idleUpdated: idle.updated, idleDropped: idle.dropped }
  }, signal)
}

export interface RepairIssue {
  severity: 'error' | 'warning'
  message: string
  action: string
}

/** Read-only consistency report; an explicit phase reset repairs a damaged state. */
export async function repairSpec(
  root: string,
  feature: string,
  options: { resetPhase?: Phase } = {},
): Promise<{ feature: string; phase: string; documents: Record<string, boolean>; issues: RepairIssue[]; ok: boolean }> {
  const dir = featureDir(root, feature)
  let state: SpecState
  try {
    state = await loadState(root, feature)
  } catch (error) {
    return {
      feature,
      phase: '',
      documents: {},
      issues: [{
        severity: 'error',
        message: (error as Error).message,
        action: 'repair state.json or restore the spec from archive; do not hand-write the phase',
      }],
      ok: false,
    }
  }
  const documents: Record<string, boolean> = {}
  for (const doc of ['requirements', 'design', 'tasks', 'bugfix'] as const) {
    documents[doc] = await exists(join(dir, `${doc}.md`))
  }
  const issues: RepairIssue[] = []
  if (options.resetPhase !== undefined) {
    if (!(PHASES as readonly string[]).includes(options.resetPhase)) {
      throw new SpecError(`unknown repair phase ${JSON.stringify(options.resetPhase)}`)
    }
    if (state.phase === 'done') {
      throw new SpecError('a done spec cannot be reopened by repair; create a new spec', 'KAZE_SPEC_DONE')
    }
    if (state.phase !== options.resetPhase) {
      const from = state.phase
      state.phase = options.resetPhase
      state.history.push({ at: nowIso(), event: 'repair-phase', from, to: options.resetPhase })
      await saveState(root, feature, state)
      issues.push({
        severity: 'warning',
        message: `phase was reset from ${from} to ${options.resetPhase}`,
        action: 're-create the missing documents, validate, and advance through the gates again',
      })
    }
  }
  const primary = state.specType === 'bugfix' ? 'bugfix' : 'requirements'
  const rank = PHASES.indexOf(state.phase)
  if (rank >= PHASES.indexOf('requirements') && !documents[primary]) {
    issues.push({ severity: 'error', message: `phase is ${state.phase} but ${primary}.md is missing`, action: 'restore the document or run kaze_spec_sync after recreating it' })
  }
  if (rank >= PHASES.indexOf('design') && !documents.design) {
    issues.push({ severity: 'error', message: `phase is ${state.phase} but design.md is missing`, action: 'restore design.md or move the spec back to requirements' })
  }
  if (rank >= PHASES.indexOf('tasks') && !documents.tasks) {
    issues.push({ severity: 'error', message: `phase is ${state.phase} but tasks.md is missing`, action: 'restore tasks.md or re-run /spec-tasks' })
  }
  if (rank < PHASES.indexOf('requirements') && documents[primary]) {
    issues.push({ severity: 'warning', message: `${primary}.md exists but phase is still ${state.phase}`, action: 'run kaze_spec_sync to advance one gated step' })
  }
  if (state.workflow === 'design-first' && documents.design && documents[primary]) {
    try {
      const designStat = await stat(join(dir, 'design.md'))
      const requirementsStat = await stat(join(dir, `${primary}.md`))
      if (designStat.birthtimeMs > 0 && requirementsStat.birthtimeMs > 0
        && designStat.birthtimeMs > requirementsStat.birthtimeMs + 1000) {
        issues.push({ severity: 'warning', message: 'design.md was created after requirements.md', action: 'for design-first, keep the recorded order or rerun the design phase' })
      }
    } catch {
      // Missing files already reported.
    }
  }
  if (documents.tasks) {
    const markdown = await readText(join(dir, 'tasks.md')).catch(() => '')
    const startedAt = new Map<string, string>()
    for (const event of state.history) {
      if (event.event !== 'task') continue
      const id = typeof event.id === 'string' ? event.id : ''
      if (id === '' || event.status !== 'in_progress') continue
      const at = typeof event.at === 'string' ? event.at : ''
      if (at !== '') startedAt.set(id, at)
    }
    for (const task of parseTasks(markdown)) {
      if (!task.leaf || task.status !== 'in_progress') continue
      const since = startedAt.get(task.id)
      const age = since === undefined ? Number.POSITIVE_INFINITY : Date.now() - Date.parse(since)
      if (Number.isFinite(age) && age < 30 * 60 * 1000) continue
      issues.push({
        severity: 'warning',
        message: `task ${task.id} has been in_progress${since === undefined ? '' : ` since ${since}`}; the execution session may have stopped`,
        action: `If no writer is active, run kaze_spec_task { feature: "${feature}", id: "${task.id}", status: "not_started" } (or "failed") and retry /spec-apply.`,
      })
    }
  }
  return { feature, phase: state.phase, documents, issues, ok: !issues.some((issue) => issue.severity === 'error') }
}

export async function specDirectory(root: string, feature: string): Promise<string> {
  const dir = featureDir(root, feature)
  if (!(await exists(dir))) throw new SpecError(`spec not found: ${dir}`, 'KAZE_SPEC_NOT_FOUND')
  return dir
}

/** Escape a literal segment for use inside a RegExp source string. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}



