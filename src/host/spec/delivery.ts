/** Delivery report, structured gate history, and completion summary. */
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { SpecError } from './errors.js'
import { withSpecLock } from './lock.js'
import { exists, featureDir, nowIso, readJson, writeAtomic, writeJson } from './paths.js'
import { loadState, requirementsHash, specStatus } from './state.js'
import { parseTasks } from './tasks.js'

export type GateStatus = 'approved' | 'failed' | 'skipped' | 'pending'

export interface GateRecord {
  gate: string
  status: GateStatus
  at: string
  reason: string
  returnTo: string | null
  details: string
  /** Concrete proof for an approval: command output, file/line, or URL. */
  evidence?: string
  /** Phase the spec had when the decision was recorded. */
  phase?: string
  /**
   * Hash of the documents the decision approved (requirements/bugfix, design,
   * tasks, acceptance). Done compares it so an approval cannot outlive the
   * documents it was based on.
   */
  docsHash?: string
}

export interface DeliveryResult {
  path: string
  bytes: number
  gates: number
}

export interface CompletionTaskCounts {
  total: number
  completed: number
  in_progress: number
  ready: number
}

export interface CompletionAcceptance {
  present: boolean
  approved: boolean
  /** Latest gate, or `pending` when criteria exist but no decision was recorded. */
  status: GateStatus | 'none'
  checked: number
  total: number
  /** The approval no longer covers the current documents. */
  stale: boolean
}

export interface CompletionFta {
  status: GateStatus | 'none'
  at: string | null
  details: string
  /** The approval no longer covers the current documents. */
  stale: boolean
}

export interface CompletionDelivery {
  present: boolean
  path: string
  fresh: boolean
}

export interface CompletionVerification {
  present: boolean
}

export interface CompletionGate {
  gate: string
  status: GateStatus
  at: string
  reason: string
  returnTo: string | null
  evidence: string
}

export interface CompletionNext {
  id: string
  label: string
  kind: 'host' | 'agent'
  command: string
}

export interface CompletionSummary {
  feature: string
  phase: string
  scope: string
  tasks: CompletionTaskCounts
  acceptance: CompletionAcceptance
  fta: CompletionFta
  delivery: CompletionDelivery
  verification: CompletionVerification
  gates: CompletionGate[]
  next: CompletionNext[]
}

const GATES_FILE = 'gates.json'
const DELIVERY_FILE = 'delivery.md'

function gatesPath(root: string, feature: string): string {
  return join(featureDir(root, feature), GATES_FILE)
}

function deliveryPath(root: string, feature: string): string {
  return join(featureDir(root, feature), DELIVERY_FILE)
}

/** Read the append-only gate log, dropping entries that are not gate records. */
export async function readGates(root: string, feature: string): Promise<GateRecord[]> {
  const path = gatesPath(root, feature)
  if (!(await exists(path))) return []
  const raw = await readJson(path)
  if (!Array.isArray(raw)) throw new SpecError(`invalid ${path}: expected an array`)
  return raw.flatMap((entry): GateRecord[] => {
    if (typeof entry !== 'object' || entry === null) return []
    const value = entry as Record<string, unknown>
    const status = value.status
    if (status !== 'approved' && status !== 'failed' && status !== 'skipped' && status !== 'pending') return []
    return [{
      gate: typeof value.gate === 'string' ? value.gate : 'unknown',
      status,
      at: typeof value.at === 'string' ? value.at : nowIso(),
      reason: typeof value.reason === 'string' ? value.reason : '',
      returnTo: typeof value.returnTo === 'string' ? value.returnTo : null,
      details: typeof value.details === 'string' ? value.details : '',
      ...(typeof value.evidence === 'string' && value.evidence !== '' ? { evidence: value.evidence } : {}),
      ...(typeof value.phase === 'string' && value.phase !== '' ? { phase: value.phase } : {}),
      ...(typeof value.docsHash === 'string' && value.docsHash !== '' ? { docsHash: value.docsHash } : {}),
    }]
  })
}

/** Latest decision for one gate name; gates are append-only, so scan backwards. */
export function latestGate(gates: readonly GateRecord[], name: string): GateRecord | undefined {
  return [...gates].reverse().find((gate) => gate.gate === name)
}

/**
 * Documents an approval covers.
 *
 * `verification.md` is deliberately absent: the completion flow writes it after
 * the acceptance/FTA decisions, so including it would invalidate every approval.
 */
const APPROVAL_DOCUMENTS = ['requirements.md', 'bugfix.md', 'design.md', 'tasks.md', 'acceptance.md'] as const

/** Stable hash of the documents a human gate approved. */
export async function specDocsHash(root: string, feature: string): Promise<string> {
  const dir = featureDir(root, feature)
  const hash = createHash('sha256')
  for (const name of APPROVAL_DOCUMENTS) {
    hash.update(name)
    hash.update('\n')
    const path = join(dir, name)
    if (await exists(path)) hash.update(await readFile(path, 'utf8'))
    hash.update('\n---\n')
  }
  return hash.digest('hex')
}

function checklist(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^\s*- \[[ xX]\]\s+/.test(line))
    .map((line) => line.trim())
}

/** Bullets under one heading, for the clarify ledger's Assumptions section. */
function sectionBullets(markdown: string, heading: RegExp): string[] {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => heading.test(line))
  if (start < 0) return []
  const bullets: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (/^##\s/.test(line)) break
    if (/^\s*[-*]\s+\S/.test(line)) bullets.push(line.trim())
  }
  return bullets
}

/** Count acceptance checkboxes; `[x]` is checked and `[ ]` is not. */
export function acceptanceCriteria(markdown: string): { checked: number; total: number } {
  const items = checklist(markdown)
  return {
    checked: items.filter((line) => /^- \[[xX]\]\s+/.test(line)).length,
    total: items.length,
  }
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

/**
 * Append one human-gate decision.
 *
 * Approval is evidence-backed and acceptance approval is only valid when every
 * acceptance checkbox is checked. After a valid append the delivery report is
 * refreshed on a best-effort basis: the recorded decision is authoritative and
 * must not be lost because a report could not be rendered.
 */
export async function recordGate(
  root: string,
  feature: string,
  input: { gate: string; status: GateStatus; reason?: string; returnTo?: string; details?: string; evidence?: string; phase?: string },
  signal?: AbortSignal,
): Promise<GateRecord> {
  const gate = input.gate.trim()
  if (gate === '') throw new SpecError('gate name must not be empty')
  const dir = featureDir(root, feature)
  return withSpecLock(dir, async () => {
    const reason = input.reason?.trim() ?? ''
    const details = input.details?.trim() ?? ''
    const evidence = input.evidence?.trim() ?? ''
    if (input.status === 'approved' && details === '' && evidence === '') {
      throw new SpecError(
        `gate ${gate} cannot be approved without details or evidence`,
        'KAZE_SPEC_GATE_EVIDENCE',
      )
    }
    if ((input.status === 'failed' || input.status === 'skipped') && reason === '') {
      throw new SpecError(
        `gate ${gate} cannot be ${input.status} without a non-empty reason`,
        'KAZE_SPEC_GATE_REASON',
      )
    }
    if (gate === 'acceptance' && input.status === 'approved') {
      const path = join(dir, 'acceptance.md')
      if (!(await exists(path))) {
        throw new SpecError(
          'acceptance gate cannot be approved without acceptance.md',
          'KAZE_SPEC_GATE_ACCEPTANCE',
        )
      }
      const criteria = acceptanceCriteria(await readFile(path, 'utf8'))
      if (criteria.total === 0) {
        throw new SpecError(
          'acceptance.md has no checkbox criteria; the acceptance gate cannot be approved',
          'KAZE_SPEC_GATE_ACCEPTANCE',
        )
      }
      if (criteria.checked !== criteria.total) {
        throw new SpecError(
          `acceptance.md has ${criteria.total - criteria.checked} unchecked criterion(s); check every criterion before approving`,
          'KAZE_SPEC_GATE_ACCEPTANCE',
        )
      }
    }

    const gates = await readGates(root, feature)
    const docsHash = await specDocsHash(root, feature)
    const record: GateRecord = {
      gate,
      status: input.status,
      at: nowIso(),
      reason,
      returnTo: input.returnTo?.trim() || null,
      details,
      ...(evidence === '' ? {} : { evidence }),
      ...(input.phase === undefined || input.phase === '' ? {} : { phase: input.phase }),
      docsHash,
    }
    gates.push(record)
    await writeJson(gatesPath(root, feature), gates)
    try {
      await buildDelivery(root, feature)
    } catch {
      // Best effort only: gates.json is the source of truth and the report can
      // be rebuilt later by kaze_spec_delivery, archive, or a later gate append.
    }
    return record
  }, signal)
}

async function deliveryIsFresh(root: string, feature: string, path: string, gates: readonly GateRecord[]): Promise<boolean> {
  if (gates.length === 0) return true
  const latestAt = gates.reduce((latest, gate) => {
    const time = Date.parse(gate.at)
    return Number.isFinite(time) ? Math.max(latest, time) : latest
  }, 0)
  if (latestAt === 0) return true
  const text = await readFile(path, 'utf8')
  // A report generated before a document edit is stale even when the gate
  // timestamps are older; the hash is the durable check, timestamps are the
  // fallback for reports written before this field existed.
  const docsHash = /^Docs-Hash:\s*(\S+)\s*$/m.exec(text)?.[1]
  if (docsHash !== undefined) {
    return docsHash === await specDocsHash(root, feature)
  }
  const generated = /^Generated:\s*(.+)$/m.exec(text)
  const stamp = generated === null ? Number.NaN : Date.parse(generated[1]!.trim())
  if (Number.isFinite(stamp)) return stamp >= latestAt
  const info = await stat(path)
  return info.mtimeMs >= latestAt
}

/** Build the human-readable delivery report from the spec and gate history. */
export async function buildDelivery(
  root: string,
  feature: string,
  residualRisks = '',
  signal?: AbortSignal,
): Promise<DeliveryResult> {
  signal?.throwIfAborted()
  const dir = featureDir(root, feature)
  const state = await loadState(root, feature)
  const status = await specStatus(root, feature)
  const tasks = (await exists(join(dir, 'tasks.md'))) ? parseTasks(await readFile(join(dir, 'tasks.md'), 'utf8')) : []
  const leaves = tasks.filter((task) => task.leaf)
  const gates = await readGates(root, feature)
  const docsHash = await specDocsHash(root, feature)
  const acceptancePath = join(dir, 'acceptance.md')
  const verificationPath = join(dir, 'verification.md')
  const acceptanceText = (await exists(acceptancePath)) ? await readFile(acceptancePath, 'utf8') : ''
  const criteria = checklist(acceptanceText)
  const requirementsText = (await exists(join(dir, 'requirements.md'))) ? await readFile(join(dir, 'requirements.md'), 'utf8') : ''
  const clarifyText = (await exists(join(dir, 'clarify.md'))) ? await readFile(join(dir, 'clarify.md'), 'utf8') : ''
  const fta = latestGate(gates, 'fta')
  const acceptanceGate = latestGate(gates, 'acceptance')
  const assumptions = sectionBullets(clarifyText, /^##\s+(?:Assumptions|假设)\s*$/)
  const unverified = requirementsText
    .split(/\r?\n/)
    .filter((line) => /\bUNVERIFIED\b/i.test(line) || /未验证|未经核实/.test(line))
    .map((line) => line.trim())
  const skipped = [acceptanceGate, fta].filter((gate) => gate?.status === 'skipped')
  const ftaConcerns = Number(/Concerns:\s*(\d+)/i.exec(fta?.details ?? '')?.[1] ?? 0)
  const ftaNotes = Number(/Notes:\s*(\d+)/i.exec(fta?.details ?? '')?.[1] ?? 0)
  const derivedRisks = [
    ...(acceptanceGate?.status === 'skipped' ? [`Acceptance skipped: ${acceptanceGate.reason || 'no reason recorded'}`] : []),
    ...(fta?.status === 'skipped' ? [`FTA skipped: ${fta.reason || 'no reason recorded'}`] : []),
    ...(ftaConcerns > 0 ? [`FTA reported ${ftaConcerns} unresolved Concern(s); see the FTA gate details`] : []),
    ...(ftaNotes > 0 ? [`FTA reported ${ftaNotes} Note(s); see the FTA gate details`] : []),
    ...(unverified.length > 0 ? [`${unverified.length} unverified claim(s) remain in requirements.md`] : []),
  ]
  const risksText = residualRisks.trim() === ''
    ? (derivedRisks.length === 0 ? 'None recorded.' : derivedRisks.join('\n'))
    : residualRisks.trim()

  const lines: string[] = [
    `# Delivery — ${state.feature}`,
    '',
    `Generated: ${nowIso()}`,
    `Docs-Hash: ${docsHash}`,
    '',
    '## Summary',
    '',
    `- Scope: ${state.scope}`,
    `- Type: ${state.specType}`,
    `- Workflow: ${state.workflow}`,
    `- Phase: ${state.phase}`,
    `- Tasks: ${status.tasks.completed}/${status.tasks.total} completed, ${status.tasks.ready} ready`,
    '',
    '## Tasks',
    '',
    ...(leaves.length === 0
      ? ['No leaf tasks.']
      : leaves.map((task) => `- ${task.id} [${task.status}] ${task.title}`)),
    '',
    '## Acceptance',
    '',
    ...(acceptanceGate === undefined ? [] : [`Gate: ${acceptanceGate.status}${acceptanceGate.details === '' ? '' : ` — ${acceptanceGate.details}`}`, '']),
    ...(criteria.length > 0
      ? criteria
      : [await exists(acceptancePath) ? 'acceptance.md exists but has no checkbox criteria.' : 'No acceptance.md.']),
    '',
    '## Verification',
    '',
    await exists(verificationPath) ? 'verification.md is present.' : 'No verification.md.',
    '',
    '## FTA',
    '',
    fta === undefined
      ? 'No FTA gate recorded.'
      : `- Status: ${fta.status}\n- At: ${fta.at}${fta.reason === '' ? '' : `\n- Reason: ${fta.reason}`}${fta.details === '' ? '' : `\n- Details: ${fta.details}`}`,
    '',
    '## Gate history',
    '',
    '| Gate | Status | At | Return to | Reason |',
    '|---|---|---|---|---|',
    ...(gates.length === 0
      ? ['| — | — | — | — | — |']
      : gates.map((gate) => `| ${cell(gate.gate)} | ${gate.status} | ${gate.at} | ${cell(gate.returnTo ?? '')} | ${cell(gate.reason)} |`)),
    '',
    '## Assumptions',
    '',
    ...(assumptions.length === 0 ? ['No assumptions recorded.'] : assumptions),
    '',
    '## Unverified claims',
    '',
    ...(unverified.length === 0 ? ['None recorded.'] : unverified),
    '',
    '## Skipped decisions',
    '',
    ...(skipped.length === 0
      ? ['None.']
      : skipped.map((gate) => `- ${gate!.gate}: ${gate!.reason || 'no reason recorded'}`)),
    '',
    '## Residual risks',
    '',
    risksText,
    '',
    '## Archive',
    '',
    'Archive records the whole spec directory, including this report.',
    '',
  ]

  const text = lines.join('\n')
  await writeAtomic(deliveryPath(root, feature), text)
  return { path: deliveryPath(root, feature), bytes: Buffer.byteLength(text, 'utf8'), gates: gates.length }
}

/**
 * One read-only snapshot of everything the completion surface needs: task and
 * acceptance progress, the latest FTA decision, delivery freshness, the gate
 * log, and the next useful action.
 */
export async function completionSummary(root: string, feature: string): Promise<CompletionSummary> {
  const dir = featureDir(root, feature)
  const state = await loadState(root, feature)
  const status = await specStatus(root, feature)
  const markdown = (await exists(join(dir, 'tasks.md'))) ? await readFile(join(dir, 'tasks.md'), 'utf8') : ''
  const required = parseTasks(markdown).filter((task) => task.leaf && !task.optional)
  const gates = await readGates(root, feature)
  const acceptancePath = join(dir, 'acceptance.md')
  const acceptancePresent = await exists(acceptancePath)
  const criteria = acceptancePresent
    ? acceptanceCriteria(await readFile(acceptancePath, 'utf8'))
    : { checked: 0, total: 0 }
  const acceptanceGate = latestGate(gates, 'acceptance')
  const accepted = acceptanceGate?.status === 'approved'
  const fta = latestGate(gates, 'fta')
  const path = deliveryPath(root, feature)
  const present = await exists(path)
  const fresh = present ? await deliveryIsFresh(root, state.feature, path, gates) : false
  const verificationPresent = await exists(join(dir, 'verification.md'))
  const currentHash = await specDocsHash(root, state.feature)
  const acceptanceStale = acceptanceGate?.status === 'approved'
    && acceptanceGate.docsHash !== undefined
    && acceptanceGate.docsHash !== currentHash
  const ftaStale = fta?.status === 'approved'
    && fta.docsHash !== undefined
    && fta.docsHash !== currentHash
  const requirementsPath = join(dir, 'requirements.md')
  const capabilityStale = state.capability !== undefined
    && ((await exists(requirementsPath))
      ? state.capabilityHash !== requirementsHash(await readFile(requirementsPath, 'utf8'))
      : state.capabilityHash !== undefined)

  const next: CompletionNext[] = []
  if (state.phase === 'done') {
    if (acceptanceStale || ftaStale || capabilityStale) {
      next.push({
        id: 'reapprove',
        label: 'The done spec changed; re-verify and re-record its gates',
        kind: 'agent',
        command: `The documents changed after completion. Re-verify and record the acceptance/FTA decisions (and re-merge the capability if needed), then run /spec-complete feature=${state.feature}. If this is new work, create a new spec instead.`,
      })
    } else {
      next.push(
        { id: 'archive', label: 'Archive the spec', kind: 'host', command: 'kaze_spec_archive' },
        { id: 'delivery', label: 'Rebuild delivery.md', kind: 'host', command: 'kaze_spec_delivery' },
      )
    }
  } else {
    const primary = state.specType === 'bugfix' ? 'bugfix' : 'requirements'
    const docs = status.documents
    const allRequiredDone = required.length > 0 && required.every((task) => task.status === 'completed')
    if (!docs[primary]) {
      next.push({
        id: primary,
        label: primary === 'bugfix' ? 'Write bugfix.md' : 'Write requirements.md',
        kind: 'agent',
        command: `/${primary === 'bugfix' ? 'spec-bugfix' : 'spec-requirements'} feature=${state.feature}`,
      })
    } else if (!docs.design) {
      next.push({
        id: 'design',
        label: 'Write design.md',
        kind: 'agent',
        command: `/spec-design feature=${state.feature}`,
      })
    } else if (!docs.tasks) {
      next.push({
        id: 'tasks',
        label: 'Write tasks.md',
        kind: 'agent',
        command: `/spec-tasks feature=${state.feature}`,
      })
    } else if (required.length === 0) {
      next.push({
        id: 'tasks-empty',
        label: 'Add required tasks',
        kind: 'agent',
        command: `/spec-tasks feature=${state.feature}`,
      })
    } else if (!allRequiredDone) {
      next.push({
        id: 'apply',
        label: 'Apply ready tasks',
        kind: 'agent',
        command: `/spec-apply feature=${state.feature}`,
      })
    } else {
      const acceptanceSkipped = !acceptancePresent
        && acceptanceGate?.status === 'skipped'
        && acceptanceGate.reason.trim() !== ''
      const acceptanceDecided = acceptancePresent ? accepted : acceptanceSkipped
      const acceptanceFailed = acceptancePresent && acceptanceGate?.status === 'failed'
      const failedGate = acceptanceFailed ? acceptanceGate : (fta?.status === 'failed' ? fta : undefined)
      const returnTo = failedGate?.returnTo?.trim() ?? ''
      const gateLabel = failedGate?.gate === 'fta' ? 'FTA' : failedGate?.gate ?? ''
      if (failedGate !== undefined) {
        next.push({
          id: 'rework',
          label: returnTo === ''
            ? `Fix the ${gateLabel} blockers, then re-run completion`
            : `Return to ${returnTo} and rework`,
          kind: 'agent',
          command: returnTo === ''
            ? `Fix the ${gateLabel} blockers recorded in .kaze/${state.feature}/gates.json, then run /spec-complete feature=${state.feature} to re-verify and finish.`
            : `The ${failedGate.gate} gate failed${failedGate.reason === '' ? '' : `: ${failedGate.reason}`}. Rework ${returnTo}, update the affected spec documents, then run /spec-complete feature=${state.feature} to re-verify and finish.`,
        })
      } else if (acceptanceStale || ftaStale) {
        next.push({
          id: 'reapprove',
          label: 'Re-approve the changed documents',
          kind: 'agent',
          command: `The specification changed after a gate was approved. Re-verify and record the acceptance/FTA decisions again, then run /spec-complete feature=${state.feature}.`,
        })
      } else if (!acceptanceDecided) {
        next.push({
          id: 'acceptance',
          label: acceptancePresent ? 'Verify acceptance and finish' : 'Decide acceptance and finish',
          kind: 'agent',
          command: `/spec-complete feature=${state.feature}`,
        })
      } else if (fta === undefined) {
        // /spec-complete owns acceptance + FTA + done + delivery. /spec-fta is
        // a read-only review, so it must not be the completion action.
        next.push({
          id: 'complete',
          label: 'Run FTA and finish',
          kind: 'agent',
          command: `/spec-complete feature=${state.feature}`,
        })
      } else if (fta.status === 'pending' || (fta.status === 'skipped' && fta.reason.trim() === '')) {
        next.push({
          id: 'complete',
          label: 'Resolve FTA and finish',
          kind: 'agent',
          command: `/spec-complete feature=${state.feature}`,
        })
      } else if (state.scope === 'brownfield' && state.specType === 'feature' && !verificationPresent) {
        next.push({
          id: 'verification',
          label: 'Record verification and finish',
          kind: 'agent',
          command: `/spec-complete feature=${state.feature}`,
        })
      } else if ((state.specType === 'bugfix' || state.workflow === 'verify-first') && !verificationPresent) {
        next.push({
          id: 'verification',
          label: 'Record verification and finish',
          kind: 'agent',
          command: `/spec-complete feature=${state.feature}`,
        })
      } else if (capabilityStale) {
        next.push({
          id: 'capability',
          label: 'Merge the capability and finish',
          kind: 'agent',
          command: `/spec-complete feature=${state.feature}`,
        })
      } else {
        next.push({
          id: 'done',
          label: 'Advance to done',
          kind: 'host',
          command: 'kaze_spec_advance',
        })
      }
    }
  }
  const acceptanceStatus = acceptanceGate?.status ?? (acceptancePresent ? 'pending' : 'none')

  return {
    feature: state.feature,
    phase: state.phase,
    scope: state.scope,
    tasks: {
      total: status.tasks.total,
      completed: status.tasks.completed,
      in_progress: status.tasks.in_progress,
      ready: status.tasks.ready,
    },
    acceptance: {
      present: acceptancePresent,
      approved: accepted,
      status: acceptanceStatus,
      checked: criteria.checked,
      total: criteria.total,
      stale: acceptanceStale,
    },
    fta: {
      status: fta?.status ?? 'none',
      at: fta?.at ?? null,
      details: fta?.details ?? '',
      stale: ftaStale,
    },
    delivery: { present, path, fresh },
    verification: { present: verificationPresent },
    gates: gates.map((gate) => ({
      gate: gate.gate,
      status: gate.status,
      at: gate.at,
      reason: gate.reason,
      returnTo: gate.returnTo,
      evidence: gate.evidence ?? '',
    })),
    next,
  }
}

export { deliveryPath, gatesPath }


