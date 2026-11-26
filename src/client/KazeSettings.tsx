/**
 * Plugins-page settings for Kaze Spec.
 *
 * Groups, in order: global preference (Kaze default language), interface
 * (language and notices), Spec (language and parallelism), validation and
 * automation, new-spec defaults, and the selected workspace (language,
 * parallelism, and the idle queue).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { setKazeCommandLanguage } from './command-menu'
import {
  dshLanguage,
  kazeLanguageChoice,
  resolveSpecLanguage,
  resolveUiLanguage,
  setKazeLanguageChoice,
  setSpecLanguageChoice,
  setUiLanguageChoice,
  specLanguageChoice,
  uiLanguageChoice,
  type Language,
  type LanguageChoice,
} from './language'
import { kazeToastsEnabled, setKazeToastsEnabled } from './toasts'

export type SpecLanguage = Language

/** Lowest accepted parallel task limit. */
export const MIN_PARALLEL = 1
/** Highest accepted parallel task limit. */
export const MAX_PARALLEL = 8
/** Lowest accepted automatic-correction limit per turn. */
export const MIN_STEER = 1
/** Highest accepted automatic-correction limit per turn. */
export const MAX_STEER = 10

/** One workspace row as the browser-side workspace controller publishes it. */
export interface KazeWorkspaceItem {
  readonly workspaceId: string
  readonly path: string
  readonly title: string
}

export interface KazeSettingsRemote {
  specPreferences(action: string, payload: string, signal: AbortSignal): Promise<unknown>
  specConfig(root: string, action: string, payload: string, signal: AbortSignal): Promise<unknown>
  specIdle(root: string, action: string, payload: string, signal: AbortSignal): Promise<unknown>
  specCapabilities(root: string, signal: AbortSignal): Promise<unknown>
  specOverview(root: string, signal: AbortSignal): Promise<unknown>
}

/** Business face injected by the client entry; no React or Host types here. */
export interface KazeSettingsFace {
  /** Resolve the mounted Kaze Remote lazily; the client mounts it after this slot. */
  readonly getRemote: () => KazeSettingsRemote | undefined
  /** The DSH interface language id, read at call time. */
  readonly getLocale?: () => unknown
  readonly workspaces: {
    readonly list: {
      getSnapshot(): { readonly items: readonly KazeWorkspaceItem[] }
      subscribe(listener: () => void): () => void
    }
  }
}

/** Props the slot renderer composes: the business face plus the locale seat. */
export interface KazeSettingsProps extends KazeSettingsFace {
  readonly t: (key: string, vars?: Record<string, string>) => string
}

/** Locale namespace registered by the client entry. */
export const SETTINGS_NS = 'kaze-spec-settings'

/** English dictionary. */
export const SETTINGS_EN: Record<string, string> = {
  title: 'Kaze Spec settings',
  intro: 'How Kaze talks, how it writes, how many tasks it runs at once, and how it checks and archives Specs.',
  globalGroup: 'Global preference',
  kazeLanguage: 'Kaze default language',
  kazeLanguageHint: 'Kaze’s own default. Following the system uses the current DeepSeek Harness interface language, which follows the system by default.',
  autoSystem: 'Follow system',
  uiGroup: 'Interface',
  uiLanguage: 'Interface and command language',
  uiLanguageHint: 'Menus, tabs, and button text. Following the global preference uses the Kaze default language above.',
  followGlobal: 'Follow global preference',
  toasts: 'Show operation notices',
  toastsHint: 'Short messages such as “Saved” or a failure reason.',
  voiceGroup: 'Answer style',
  outputStyle: 'How Kaze writes',
  outputStyleHint: '“Human” leads with the answer and drops filler. Required document structure and verification evidence stay exactly as they are.',
  voiceStandard: 'Standard',
  voiceHuman: 'Human (说人话)',
  specGroup: 'Spec',
  specLanguage: 'Default Spec language',
  specLanguageHint: 'Language for new Spec documents. Following the global preference uses the Kaze default.',
  defaultMaxParallel: 'Default parallel tasks',
  defaultMaxParallelHint: 'How many tasks one run may work on at once (1–8). A workspace can set its own.',
  behaviorGroup: 'Checks and automation',
  strict: 'Strict mode',
  strictHint: 'Treat checker reminders as errors, so they block the next phase.',
  validateOnWrite: 'Check after edits',
  validateOnWriteHint: 'Check a Spec document as soon as it is written.',
  validateOnTurnEnd: 'Check when a turn ends',
  validateOnTurnEndHint: 'Recheck the Specs a turn touched and remind the model to fix them.',
  steerLimit: 'Reminders per turn',
  steerLimitHint: 'How many times one problem may be repeated before Kaze stays quiet.',
  timeline: 'Sync to task timeline',
  timelineHint: 'Mirror task checkboxes into the DeepSeek Harness Timeline.',
  autoArchive: 'Archive when done',
  autoArchiveHint: 'Move a finished Spec to .kaze/archive. You can restore it later.',
  unsupported: 'This DeepSeek Harness still runs an older Kaze Host. Restart DeepSeek Harness to change these switches.',
  newSpecGroup: 'New Spec defaults',
  newSpecHint: 'Used when a new spec does not choose its own defaults.',
  specType: 'Type',
  specScope: 'Project scope',
  specWorkflow: 'Workflow',
  typeFeature: 'New feature',
  typeBugfix: 'Bug fix',
  scopeBrownfield: 'Existing project',
  scopeGreenfield: 'Empty project',
  workflowRequirements: 'Requirements first',
  workflowDesignFirst: 'Design first',
  workflowVerifyFirst: 'Verify first',
  workflowBugfix: 'Bug-fix workflow',
  specDetail: 'Design detail',
  detailComprehensive: 'Comprehensive',
  detailHigh: 'High level',
  detailLow: 'Low level',
  specCapability: 'Default capability',
  specCapabilityHint: 'Optional capability id written into new specs (e.g. auth).',
  steering: 'Inject workspace conventions',
  steeringHint: 'Inject .kaze/steering/*.md once per session; these conventions are advisory, not gate-enforced.',
  workspaceGroup: 'Workspace',
  workspace: 'Choose a workspace',
  workspaceLanguage: 'Spec language for this workspace',
  workspaceMaxParallel: 'Parallel tasks for this workspace',
  workspaceHint: 'Saved in this workspace’s .kaze/spec-config.json and only affects this workspace.',
  noWorkspace: 'Open or create a workspace first.',
  idleGroup: 'Idle queue',
  capabilitiesGroup: 'Capabilities',
  loadCapabilities: 'Load capabilities',
  noCapabilities: 'No capability records yet. When a spec is complete and accepted, its requirements can become a capability.',
  capabilityIssues: 'issues',
  rulesLabel: 'Hard rules',
  steeringLabel: 'Steering conventions',
  analysisLabel: 'Analysis',
  pbtLabel: 'PBT passed',
  yes: 'yes',
  no: 'no',
  idleHint: 'Optional tasks wait for idle windows. Times use Beijing time.',
  idleMultiplier: 'Idle price multiplier',
  idleMultiplierHint: 'Discount during idle windows. 1 means no discount; 0.5 means half price.',
  idlePeakCost: 'Default peak cost',
  idlePeakCostHint: 'Used when a queued task has no cost of its own.',
  peakWindows: 'Peak windows',
  addWindow: 'Add a window',
  removeWindow: 'Remove',
  startTime: 'Start time',
  endTime: 'End time',
  saveIdle: 'Save idle settings',
  day1: 'Mon',
  day2: 'Tue',
  day3: 'Wed',
  day4: 'Thu',
  day5: 'Fri',
  day6: 'Sat',
  day7: 'Sun',
  saved: 'Saved',
  error: 'Could not save: {message}',
  loadError: 'Could not read settings: {message}',
  unavailable: 'The Kaze engine is not reachable yet; retrying.',
  languageZh: '简体中文',
  languageEn: 'English',
  tasks: '{count}',
}

/** Simplified Chinese dictionary. */
export const SETTINGS_ZH: Record<string, string> = {
  title: 'Kaze Spec 设置',
  intro: '这些设置决定 Kaze 用什么语言、一次并行做多少任务，以及怎么检查和归档。',
  globalGroup: '全局偏好',
  kazeLanguage: 'Kaze 默认语言',
  kazeLanguageHint: 'Kaze 自己的默认语言。选择“跟随系统”时，使用 DeepSeek Harness 当前的界面语言（默认跟随系统）。',
  autoSystem: '跟随系统',
  uiGroup: '界面',
  uiLanguage: '界面和命令语言',
  uiLanguageHint: '菜单、标签页和按钮上的文字。选择“跟随全局偏好”时，使用上面的 Kaze 默认语言。',
  followGlobal: '跟随全局偏好',
  toasts: '显示操作提示',
  toastsHint: '保存成功、失败原因这类短暂提示。',
  voiceGroup: '回答风格',
  outputStyle: 'Kaze 怎么说话',
  outputStyleHint: '“说人话”会先给结论、少套话、多用短句；Spec 文档结构和验证证据保持原样，不做改动。',
  voiceStandard: '标准',
  voiceHuman: '说人话',
  specGroup: 'Spec',
  specLanguage: '默认 Spec 语言',
  specLanguageHint: '新建 Spec 文档时使用的语言。选择“跟随全局偏好”时，使用 Kaze 默认语言。',
  defaultMaxParallel: '默认并行任务数',
  defaultMaxParallelHint: '一次执行最多同时做几个任务（1–8）。工作区可以单独设置。',
  behaviorGroup: '校验与自动处理',
  strict: '严格模式',
  strictHint: '把校验里的提醒也当成错误，不让它进入下一阶段。',
  validateOnWrite: '编辑后检查',
  validateOnWriteHint: '改完 Spec 文档就检查格式。',
  validateOnTurnEnd: '每轮结束时检查',
  validateOnTurnEndHint: '一轮结束时复查改过的 Spec，并提醒模型修正。',
  steerLimit: '每轮最多提醒次数',
  steerLimitHint: '同一个问题最多提醒几次，避免来回循环。',
  timeline: '同步到任务时间线',
  timelineHint: '把任务勾选状态同步到 DeepSeek Harness 的 Timeline。',
  autoArchive: '完成后自动归档',
  autoArchiveHint: 'Spec 完成后自动移到 .kaze/archive，之后可以恢复。',
  unsupported: '当前 DeepSeek Harness 还在用旧版 Kaze 引擎，重启后这些开关才能保存。',
  newSpecGroup: '新建 Spec 的默认值',
  newSpecHint: '新建 Spec 时没有单独指定这些值，就使用这里的设置。',
  specType: '类型',
  specScope: '项目范围',
  specWorkflow: '流程',
  typeFeature: '新功能',
  typeBugfix: '修复缺陷',
  scopeBrownfield: '已有项目',
  scopeGreenfield: '空项目',
  workflowRequirements: '先写需求',
  workflowDesignFirst: '先写设计',
  workflowVerifyFirst: '先验证需求',
  workflowBugfix: '缺陷修复流程',
  specDetail: '设计详细度',
  detailComprehensive: '完整',
  detailHigh: '高层',
  detailLow: '低层',
  specCapability: '默认 capability',
  specCapabilityHint: '可选的能力 id，会写进新建的 Spec（例如 auth）。',
  steering: '注入工作区约定',
  steeringHint: '每个会话注入一次 .kaze/steering/*.md；这些约定是建议性的，不参与门禁。',
  workspaceGroup: '工作区',
  workspace: '选择工作区',
  workspaceLanguage: '这个工作区的 Spec 语言',
  workspaceMaxParallel: '这个工作区的并行任务数',
  workspaceHint: '保存在该工作区的 .kaze/spec-config.json，只影响这个工作区。',
  noWorkspace: '先打开或新建一个工作区。',
  idleGroup: '空闲队列',
  capabilitiesGroup: '能力事实源',
  loadCapabilities: '加载能力列表',
  noCapabilities: '还没有能力记录。Spec 完成并通过验收后，它的需求可以沉淀成一项能力。',
  capabilityIssues: '问题',
  rulesLabel: '工程红线',
  steeringLabel: '工作区约定',
  analysisLabel: '需求分析',
  pbtLabel: '属性通过',
  yes: '有',
  no: '无',
  idleHint: '可选任务会等到空闲时段再做，时间按北京时间。',
  idleMultiplier: '空闲价格倍数',
  idleMultiplierHint: '空闲时段的价格折扣。1 表示不打折，0.5 表示半价。',
  idlePeakCost: '默认高峰成本',
  idlePeakCostHint: '队列任务没有单独设置成本时使用。',
  peakWindows: '高峰时段',
  addWindow: '添加时段',
  removeWindow: '删除',
  startTime: '开始时间',
  endTime: '结束时间',
  saveIdle: '保存空闲设置',
  day1: '一',
  day2: '二',
  day3: '三',
  day4: '四',
  day5: '五',
  day6: '六',
  day7: '日',
  saved: '已保存',
  error: '保存失败：{message}',
  loadError: '读取设置失败：{message}',
  unavailable: '暂时连不上 Kaze 引擎，正在重试。',
  languageZh: '简体中文',
  languageEn: 'English',
  tasks: '{count} 个',
}

const SPEC_TYPES = ['feature', 'bugfix'] as const
const SPEC_SCOPES = ['brownfield', 'greenfield'] as const
const WORKFLOWS = ['requirements-first', 'design-first', 'verify-first', 'bugfix'] as const
const DETAILS = ['comprehensive', 'high', 'low'] as const
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const

interface GlobalPreferences {
  language: SpecLanguage
  maxParallel: number
  strict: boolean
  validateOnWrite: boolean
  validateOnTurnEnd: boolean
  steerLimit: number
  timeline: boolean
  autoArchive: boolean
  defaultSpecType: 'feature' | 'bugfix'
  defaultSpecScope: 'brownfield' | 'greenfield'
  defaultSpecWorkflow: 'requirements-first' | 'design-first' | 'verify-first' | 'bugfix'
  defaultDesignDetail: 'comprehensive' | 'high' | 'low'
  defaultCapability: string
  steering: boolean
  outputStyle: 'standard' | 'human'
}

const FALLBACK_GLOBAL: GlobalPreferences = {
  language: 'zh-CN',
  maxParallel: 3,
  strict: false,
  validateOnWrite: true,
  validateOnTurnEnd: true,
  steerLimit: 5,
  timeline: true,
  autoArchive: false,
  defaultSpecType: 'feature',
  defaultSpecScope: 'brownfield',
  defaultSpecWorkflow: 'requirements-first',
  defaultDesignDetail: 'comprehensive',
  defaultCapability: '',
  steering: true,
  outputStyle: 'human',
}

interface CapabilityRow {
  capability: string
  requirements: number
  lastChange: string
  duplicates: string[]
  issues: Array<{ severity: string; message: string }>
}

interface ProjectOverview {
  rules: boolean
  steering: number
  analysis: number
  pbtPassed: number
}

interface IdleWindow {
  days: number[]
  start: string
  end: string
}

interface IdleDraft {
  schema: number
  timezone: string
  peakWindows: IdleWindow[]
  idleWindows: IdleWindow[]
  holidays: string[]
  idlePriceMultiplier: number
  defaultPeakCost: number
  specDependencies: Record<string, string[]>
}

const FALLBACK_WINDOWS: IdleWindow[] = [
  { days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00' },
  { days: [1, 2, 3, 4, 5], start: '14:00', end: '18:00' },
]

function rootOf(item: KazeWorkspaceItem): string {
  return `${item.path.replace(/[\\/]+$/, '')}/.kaze`
}

/** Readable text for one Remote failure payload. */
function remoteFailure(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.code === 'string') return record.code
    try {
      return JSON.stringify(error)
    } catch {
      return 'Remote failure'
    }
  }
  return String(error)
}

/**
 * Remote methods answer with a `{ ok, value }` envelope whose `value` is the
 * JSON text the Host returned; an older Host may still answer with plain text.
 */
function remoteText(result: unknown): string {
  if (typeof result === 'string') return result
  if (typeof result === 'object' && result !== null) {
    const envelope = result as { readonly ok?: unknown; readonly value?: unknown; readonly error?: unknown }
    if (envelope.ok === false) throw new Error(remoteFailure(envelope.error))
    if (typeof envelope.value === 'string') return envelope.value
    // A gateway may already have decoded the JSON payload into an object.
    if (typeof envelope.value === 'object' && envelope.value !== null) return JSON.stringify(envelope.value)
  }
  throw new Error(`unexpected Remote result: ${remoteFailure(result)}`)
}

function boolOf(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Coerce one persisted parallel limit into the accepted range. */
function parallelOf(value: unknown): number | null {
  if (typeof value === 'number' ? !Number.isFinite(value) : typeof value !== 'string' || value.trim() === '') return null
  return Math.min(MAX_PARALLEL, Math.max(MIN_PARALLEL, Math.round(numberOr(value, FALLBACK_GLOBAL.maxParallel))))
}

function steerOf(value: unknown): number {
  return Math.min(MAX_STEER, Math.max(MIN_STEER, Math.round(numberOr(value, FALLBACK_GLOBAL.steerLimit))))
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function coerceGlobal(value: Record<string, unknown>): GlobalPreferences {
  return {
    language: value.language === 'en' || value.defaultLanguage === 'en' ? 'en' : 'zh-CN',
    maxParallel: parallelOf(value.maxParallel) ?? FALLBACK_GLOBAL.maxParallel,
    strict: boolOf(value.strict, FALLBACK_GLOBAL.strict),
    validateOnWrite: boolOf(value.validateOnWrite, FALLBACK_GLOBAL.validateOnWrite),
    validateOnTurnEnd: boolOf(value.validateOnTurnEnd, FALLBACK_GLOBAL.validateOnTurnEnd),
    steerLimit: steerOf(value.steerLimit),
    timeline: boolOf(value.timeline, FALLBACK_GLOBAL.timeline),
    autoArchive: boolOf(value.autoArchive, FALLBACK_GLOBAL.autoArchive),
    defaultSpecType: pick(value.defaultSpecType, SPEC_TYPES, FALLBACK_GLOBAL.defaultSpecType),
    defaultSpecScope: pick(value.defaultSpecScope, SPEC_SCOPES, FALLBACK_GLOBAL.defaultSpecScope),
    defaultSpecWorkflow: pick(value.defaultSpecWorkflow, WORKFLOWS, FALLBACK_GLOBAL.defaultSpecWorkflow),
    defaultDesignDetail: pick(value.defaultDesignDetail, DETAILS, FALLBACK_GLOBAL.defaultDesignDetail),
    defaultCapability: typeof value.defaultCapability === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value.defaultCapability)
      ? value.defaultCapability
      : FALLBACK_GLOBAL.defaultCapability,
    steering: boolOf(value.steering, FALLBACK_GLOBAL.steering),
    outputStyle: value.outputStyle === 'standard' || value.outputStyle === 'human'
      ? value.outputStyle
      : FALLBACK_GLOBAL.outputStyle,
  }
}

function coerceWindow(value: unknown): IdleWindow | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.filter((day): day is number => typeof day === 'number' && day >= 1 && day <= 7))].sort((a, b) => a - b)
    : []
  const start = typeof raw.start === 'string' ? raw.start : '09:00'
  const end = typeof raw.end === 'string' ? raw.end : '18:00'
  return { days: days.length === 0 ? [1, 2, 3, 4, 5] : days, start, end }
}

function coerceIdle(value: unknown): IdleDraft | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const windows = Array.isArray(raw.peakWindows)
    ? raw.peakWindows.map(coerceWindow).filter((window): window is IdleWindow => window !== null)
    : []
  return {
    schema: numberOr(raw.schema, 1),
    timezone: typeof raw.timezone === 'string' ? raw.timezone : 'Asia/Shanghai',
    peakWindows: windows.length > 0 ? windows : FALLBACK_WINDOWS.map((window) => ({ ...window, days: [...window.days] })),
    idleWindows: Array.isArray(raw.idleWindows)
      ? raw.idleWindows.map(coerceWindow).filter((window): window is IdleWindow => window !== null)
      : [],
    holidays: Array.isArray(raw.holidays) ? raw.holidays.filter((day): day is string => typeof day === 'string') : [],
    idlePriceMultiplier: numberOr(raw.idlePriceMultiplier, 0.5),
    defaultPeakCost: Math.max(0, numberOr(raw.defaultPeakCost, 0)),
    specDependencies: typeof raw.specDependencies === 'object' && raw.specDependencies !== null
      ? (raw.specDependencies as Record<string, string[]>)
      : {},
  }
}

/** One labelled control row. */
function Field(props: { readonly label: string; readonly hint?: string; readonly children: ReactNode }) {
  return (
    <>
      <label className="kaze-settings-field">
        <span>{props.label}</span>
        {props.children}
      </label>
      {props.hint === undefined ? null : <p className="kaze-settings-hint">{props.hint}</p>}
    </>
  )
}

/** One switch row. */
function Toggle(props: {
  readonly label: string
  readonly hint?: string
  readonly checked: boolean
  readonly disabled: boolean
  readonly onChange: (next: boolean) => void
}) {
  return (
    <label className="kaze-settings-toggle">
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => { props.onChange(event.target.checked) }}
      />
      <span>
        {props.label}
        {props.hint === undefined ? null : <small>{props.hint}</small>}
      </span>
    </label>
  )
}

/**
 * Render the Kaze Spec settings controls.
 * @param props - injected Remote, workspace store, DSH locale, and translator.
 * @returns the settings section for the bundle page.
 */
export function KazeSettings(props: KazeSettingsProps) {
  const { t } = props
  const dsh = dshLanguage(props.getLocale?.())
  const [kazeChoice, setKazeChoice] = useState<LanguageChoice>(() => kazeLanguageChoice())
  const [uiChoice, setUiChoice] = useState<LanguageChoice>(() => uiLanguageChoice())
  const [specChoice, setSpecChoice] = useState<LanguageChoice>(() => specLanguageChoice())
  const [toasts, setToasts] = useState<boolean>(() => kazeToastsEnabled())
  const [global, setGlobal] = useState<GlobalPreferences | null>(null)
  const [supported, setSupported] = useState(false)
  const [workspaces, setWorkspaces] = useState<readonly KazeWorkspaceItem[]>([])
  const [selected, setSelected] = useState('')
  const [workspaceLanguage, setWorkspaceLanguage] = useState<SpecLanguage | null>(null)
  const [workspaceMaxParallel, setWorkspaceMaxParallel] = useState<number | null>(null)
  const [idle, setIdle] = useState<IdleDraft | null>(null)
  const [capabilities, setCapabilities] = useState<CapabilityRow[]>([])
  const [overview, setOverview] = useState<ProjectOverview | null>(null)
  const [capabilityNote, setCapabilityNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const synced = useRef(false)

  useEffect(() => {
    const store = (props.workspaces as { list?: KazeSettingsFace['workspaces']['list'] } | undefined)?.list
    if (store === undefined) return
    let alive = true
    const sync = (): void => {
      if (!alive) return
      try {
        setWorkspaces(store.getSnapshot().items)
      } catch {
        // An unavailable workspace store leaves the global controls usable.
      }
    }
    sync()
    const off = store.subscribe(sync)
    return () => {
      alive = false
      off()
    }
  }, [props.workspaces])

  useEffect(() => {
    const remote = props.getRemote()
    if (remote === undefined) {
      setError(t('unavailable'))
      const timer = setTimeout(() => { setAttempt((value) => value + 1) }, 500)
      return () => { clearTimeout(timer) }
    }
    let alive = true
    setError('')
    void (async () => {
      try {
        const text = remoteText(await remote.specPreferences('get', '{}', new AbortController().signal))
        const value = JSON.parse(text) as Record<string, unknown>
        if (alive) {
          setGlobal(coerceGlobal(value))
          setSupported(typeof value.strict === 'boolean')
        }
      } catch (failure) {
        if (alive) setError(t('loadError', { message: remoteFailure(failure) }))
      }
    })()
    return () => { alive = false }
    // `attempt` re-runs the read until the lazily mounted Remote appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  useEffect(() => {
    if (workspaces.length === 0) {
      if (selected !== '') setSelected('')
      return
    }
    if (!workspaces.some((item) => item.workspaceId === selected)) setSelected(workspaces[0]!.workspaceId)
  }, [workspaces, selected])

  useEffect(() => {
    const item = workspaces.find((entry) => entry.workspaceId === selected)
    const remote = props.getRemote()
    if (item === undefined || remote === undefined) {
      setWorkspaceLanguage(null)
      setWorkspaceMaxParallel(null)
      return
    }
    let alive = true
    setWorkspaceLanguage(null)
    setWorkspaceMaxParallel(null)
    void (async () => {
      try {
        const text = remoteText(await remote.specConfig(rootOf(item), 'get', '{}', new AbortController().signal))
        const value = JSON.parse(text) as Record<string, unknown>
        if (alive) {
          setWorkspaceLanguage(value.language === 'en' ? 'en' : 'zh-CN')
          setWorkspaceMaxParallel(parallelOf(value.maxParallel))
        }
      } catch (failure) {
        if (alive) setError(t('loadError', { message: remoteFailure(failure) }))
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces, selected, attempt])

  useEffect(() => {
    const item = workspaces.find((entry) => entry.workspaceId === selected)
    const remote = props.getRemote()
    if (item === undefined || remote === undefined) {
      setIdle(null)
      return
    }
    let alive = true
    setIdle(null)
    void (async () => {
      try {
        const text = remoteText(await remote.specIdle(rootOf(item), 'status', '{}', new AbortController().signal))
        const value = JSON.parse(text) as { config?: unknown }
        const draft = coerceIdle(value.config)
        if (alive) setIdle(draft)
      } catch (failure) {
        if (alive) setError(t('loadError', { message: remoteFailure(failure) }))
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces, selected, attempt])

  const runSave = async (task: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await task()
      setStatus(t('saved'))
    } catch (failure) {
      setError(t('error', { message: remoteFailure(failure) }))
    } finally {
      setBusy(false)
    }
  }

  /** Copy the resolved Spec default into the Host so the agent reads the same language. */
  const syncSpecDefault = (value: Language, quiet = false): void => {
    const remote = props.getRemote()
    if (remote === undefined) return
    void (async () => {
      try {
        await remote.specPreferences('set', JSON.stringify({ defaultLanguage: value }), new AbortController().signal)
        setGlobal((current) => (current === null ? current : { ...current, language: value }))
      } catch (failure) {
        if (!quiet) setError(t('error', { message: remoteFailure(failure) }))
      }
    })()
  }

  // One silent sync after load keeps the profile default aligned with the
  // browser's resolved "follow" choice without touching it on every visit.
  useEffect(() => {
    if (global === null || synced.current) return
    synced.current = true
    const resolved = resolveSpecLanguage(dsh)
    if (global.language !== resolved) syncSpecDefault(resolved, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [global, dsh])

  const applyUiLanguage = (): void => {
    setKazeCommandLanguage(resolveUiLanguage(dsh))
  }

  const saveKazeLanguage = (choice: LanguageChoice): void => {
    setKazeLanguageChoice(choice)
    setKazeChoice(choice)
    applyUiLanguage()
    syncSpecDefault(resolveSpecLanguage(dsh))
    setStatus(t('saved'))
  }

  const saveUiLanguage = (choice: LanguageChoice): void => {
    setUiLanguageChoice(choice)
    setUiChoice(choice)
    applyUiLanguage()
    setStatus(t('saved'))
  }

  const saveSpecLanguage = (choice: LanguageChoice): void => {
    setSpecLanguageChoice(choice)
    setSpecChoice(choice)
    syncSpecDefault(resolveSpecLanguage(dsh))
    setStatus(t('saved'))
  }

  const saveToasts = (next: boolean): void => {
    setKazeToastsEnabled(next)
    setToasts(next)
    setStatus(t('saved'))
  }

  const saveGlobal = (patch: Partial<GlobalPreferences>): void => {
    const remote = props.getRemote()
    if (remote === undefined) return
    void runSave(async () => {
      const text = remoteText(await remote.specPreferences('set', JSON.stringify(patch), new AbortController().signal))
      const value = JSON.parse(text) as Record<string, unknown>
      setGlobal(coerceGlobal(value))
      setSupported(typeof value.strict === 'boolean')
    })
  }

  const saveWorkspaceLanguage = (next: SpecLanguage): void => {
    const item = workspaces.find((entry) => entry.workspaceId === selected)
    const remote = props.getRemote()
    if (remote === undefined || item === undefined) return
    void runSave(async () => {
      await remote.specConfig(rootOf(item), 'set', JSON.stringify({ language: next }), new AbortController().signal)
      setWorkspaceLanguage(next)
    })
  }

  const saveWorkspaceMaxParallel = (next: number): void => {
    const item = workspaces.find((entry) => entry.workspaceId === selected)
    const remote = props.getRemote()
    if (remote === undefined || item === undefined) return
    void runSave(async () => {
      await remote.specConfig(rootOf(item), 'set', JSON.stringify({ maxParallel: next }), new AbortController().signal)
      setWorkspaceMaxParallel(next)
    })
  }

  const editWindow = (index: number, patch: Partial<IdleWindow>): void => {
    if (idle === null) return
    setIdle({
      ...idle,
      peakWindows: idle.peakWindows.map((window, position) => (
        position === index ? { ...window, ...patch } : window
      )),
    })
  }

  const toggleDay = (index: number, day: number): void => {
    if (idle === null) return
    const window = idle.peakWindows[index]
    if (window === undefined) return
    const days = window.days.includes(day)
      ? window.days.filter((value) => value !== day)
      : [...window.days, day].sort((left, right) => left - right)
    editWindow(index, { days })
  }

  const saveIdle = (): void => {
    const item = workspaces.find((entry) => entry.workspaceId === selected)
    const remote = props.getRemote()
    if (idle === null || remote === undefined || item === undefined) return
    void runSave(async () => {
      const text = remoteText(await remote.specIdle(
        rootOf(item),
        'config',
        JSON.stringify({ config: idle }),
        new AbortController().signal,
      ))
      const value = JSON.parse(text) as { config?: unknown }
      const next = coerceIdle(value.config)
      if (next !== null) setIdle(next)
    })
  }

  const parallelOptions = Array.from({ length: MAX_PARALLEL - MIN_PARALLEL + 1 }, (_, index) => MIN_PARALLEL + index)
  const steerOptions = Array.from({ length: MAX_STEER - MIN_STEER + 1 }, (_, index) => MIN_STEER + index)
  const behaviorDisabled = busy || !supported
  const idleWindow = idle

  return (
    <div className="kaze-settings">
      <div className="kaze-settings-intro">
        <h4>{t('title')}</h4>
        <p>{t('intro')}</p>
      </div>

      <section className="kaze-settings-group">
        <h5>{t('globalGroup')}</h5>
        <Field label={t('kazeLanguage')} hint={t('kazeLanguageHint')}>
          <select value={kazeChoice} onChange={(event) => { saveKazeLanguage(event.target.value as LanguageChoice) }}>
            <option value="auto">{t('autoSystem')}</option>
            <option value="zh-CN">{t('languageZh')}</option>
            <option value="en">{t('languageEn')}</option>
          </select>
        </Field>
      </section>

      <section className="kaze-settings-group">
        <h5>{t('uiGroup')}</h5>
        <Field label={t('uiLanguage')} hint={t('uiLanguageHint')}>
          <select value={uiChoice} onChange={(event) => { saveUiLanguage(event.target.value as LanguageChoice) }}>
            <option value="auto">{t('followGlobal')}</option>
            <option value="zh-CN">{t('languageZh')}</option>
            <option value="en">{t('languageEn')}</option>
          </select>
        </Field>
        <Toggle label={t('toasts')} hint={t('toastsHint')} checked={toasts} disabled={false} onChange={saveToasts} />
      </section>

      <section className="kaze-settings-group">
        <h5>{t('voiceGroup')}</h5>
        <Field label={t('outputStyle')} hint={t('outputStyleHint')}>
          <select
            value={global?.outputStyle ?? FALLBACK_GLOBAL.outputStyle}
            disabled={busy || global === null}
            onChange={(event) => { saveGlobal({ outputStyle: event.target.value === 'standard' ? 'standard' : 'human' }) }}
          >
            <option value="standard">{t('voiceStandard')}</option>
            <option value="human">{t('voiceHuman')}</option>
          </select>
        </Field>
      </section>

      <section className="kaze-settings-group">
        <h5>{t('specGroup')}</h5>
        <Field label={t('specLanguage')} hint={t('specLanguageHint')}>
          <select value={specChoice} onChange={(event) => { saveSpecLanguage(event.target.value as LanguageChoice) }}>
            <option value="auto">{t('followGlobal')}</option>
            <option value="zh-CN">{t('languageZh')}</option>
            <option value="en">{t('languageEn')}</option>
          </select>
        </Field>
        <Field label={t('defaultMaxParallel')} hint={t('defaultMaxParallelHint')}>
          <select
            value={global?.maxParallel ?? FALLBACK_GLOBAL.maxParallel}
            disabled={busy || global === null}
            onChange={(event) => { saveGlobal({ maxParallel: Number(event.target.value) }) }}
          >
            {parallelOptions.map((value) => (
              <option key={value} value={value}>{t('tasks', { count: String(value) })}</option>
            ))}
          </select>
        </Field>
      </section>

      <section className="kaze-settings-group">
        <h5>{t('behaviorGroup')}</h5>
        {supported ? null : <p className="kaze-settings-note" data-tone="error">{t('unsupported')}</p>}
        <Toggle
          label={t('strict')}
          hint={t('strictHint')}
          checked={global?.strict ?? FALLBACK_GLOBAL.strict}
          disabled={behaviorDisabled}
          onChange={(next) => { saveGlobal({ strict: next }) }}
        />
        <Toggle
          label={t('validateOnWrite')}
          hint={t('validateOnWriteHint')}
          checked={global?.validateOnWrite ?? FALLBACK_GLOBAL.validateOnWrite}
          disabled={behaviorDisabled}
          onChange={(next) => { saveGlobal({ validateOnWrite: next }) }}
        />
        <Toggle
          label={t('validateOnTurnEnd')}
          hint={t('validateOnTurnEndHint')}
          checked={global?.validateOnTurnEnd ?? FALLBACK_GLOBAL.validateOnTurnEnd}
          disabled={behaviorDisabled}
          onChange={(next) => { saveGlobal({ validateOnTurnEnd: next }) }}
        />
        <Field label={t('steerLimit')} hint={t('steerLimitHint')}>
          <select
            value={global?.steerLimit ?? FALLBACK_GLOBAL.steerLimit}
            disabled={behaviorDisabled}
            onChange={(event) => { saveGlobal({ steerLimit: Number(event.target.value) }) }}
          >
            {steerOptions.map((value) => (
              <option key={value} value={value}>{t('tasks', { count: String(value) })}</option>
            ))}
          </select>
        </Field>
        <Toggle
          label={t('timeline')}
          hint={t('timelineHint')}
          checked={global?.timeline ?? FALLBACK_GLOBAL.timeline}
          disabled={behaviorDisabled}
          onChange={(next) => { saveGlobal({ timeline: next }) }}
        />
        <Toggle
          label={t('autoArchive')}
          hint={t('autoArchiveHint')}
          checked={global?.autoArchive ?? FALLBACK_GLOBAL.autoArchive}
          disabled={behaviorDisabled}
          onChange={(next) => { saveGlobal({ autoArchive: next }) }}
        />
      </section>

      <section className="kaze-settings-group">
        <h5>{t('newSpecGroup')}</h5>
        <p className="kaze-settings-note">{t('newSpecHint')}</p>
        <Field label={t('specType')}>
          <select
            value={global?.defaultSpecType ?? FALLBACK_GLOBAL.defaultSpecType}
            disabled={behaviorDisabled}
            onChange={(event) => { saveGlobal({ defaultSpecType: pick(event.target.value, SPEC_TYPES, FALLBACK_GLOBAL.defaultSpecType) }) }}
          >
            <option value="feature">{t('typeFeature')}</option>
            <option value="bugfix">{t('typeBugfix')}</option>
          </select>
        </Field>
        <Field label={t('specScope')}>
          <select
            value={global?.defaultSpecScope ?? FALLBACK_GLOBAL.defaultSpecScope}
            disabled={behaviorDisabled}
            onChange={(event) => { saveGlobal({ defaultSpecScope: pick(event.target.value, SPEC_SCOPES, FALLBACK_GLOBAL.defaultSpecScope) }) }}
          >
            <option value="brownfield">{t('scopeBrownfield')}</option>
            <option value="greenfield">{t('scopeGreenfield')}</option>
          </select>
        </Field>
        <Field label={t('specWorkflow')}>
          <select
            value={global?.defaultSpecWorkflow ?? FALLBACK_GLOBAL.defaultSpecWorkflow}
            disabled={behaviorDisabled}
            onChange={(event) => { saveGlobal({ defaultSpecWorkflow: pick(event.target.value, WORKFLOWS, FALLBACK_GLOBAL.defaultSpecWorkflow) }) }}
          >
            <option value="requirements-first">{t('workflowRequirements')}</option>
            <option value="design-first">{t('workflowDesignFirst')}</option>
            <option value="verify-first">{t('workflowVerifyFirst')}</option>
            <option value="bugfix">{t('workflowBugfix')}</option>
          </select>
        </Field>
        <Field label={t('specDetail')}>
          <select
            value={global?.defaultDesignDetail ?? FALLBACK_GLOBAL.defaultDesignDetail}
            disabled={behaviorDisabled}
            onChange={(event) => { saveGlobal({ defaultDesignDetail: pick(event.target.value, DETAILS, FALLBACK_GLOBAL.defaultDesignDetail) }) }}
          >
            <option value="comprehensive">{t('detailComprehensive')}</option>
            <option value="high">{t('detailHigh')}</option>
            <option value="low">{t('detailLow')}</option>
          </select>
        </Field>
        <Field label={t('specCapability')}>
          <input
            value={global?.defaultCapability ?? FALLBACK_GLOBAL.defaultCapability}
            placeholder="auth"
            disabled={behaviorDisabled}
            onChange={(event) => { saveGlobal({ defaultCapability: event.target.value }) }}
          />
        </Field>
        <Toggle
          label={t('steering')}
          hint={t('steeringHint')}
          checked={global?.steering ?? FALLBACK_GLOBAL.steering}
          disabled={behaviorDisabled}
          onChange={(next) => { saveGlobal({ steering: next }) }}
        />
      </section>

      <section className="kaze-settings-group">
        <h5>{t('workspaceGroup')}</h5>
        <Field label={t('workspace')}>
          <select
            value={selected}
            disabled={busy || workspaces.length === 0}
            onChange={(event) => { setSelected(event.target.value) }}
          >
            {workspaces.length === 0 ? <option value="">—</option> : null}
            {workspaces.map((item) => (
              <option key={item.workspaceId} value={item.workspaceId}>{item.title} — {item.path}</option>
            ))}
          </select>
        </Field>
        {workspaces.length === 0 ? (
          <p className="kaze-settings-hint">{t('noWorkspace')}</p>
        ) : (
          <>
            <Field label={t('workspaceLanguage')}>
              <select
                value={workspaceLanguage ?? 'zh-CN'}
                disabled={busy || workspaceLanguage === null}
                onChange={(event) => { saveWorkspaceLanguage(event.target.value === 'en' ? 'en' : 'zh-CN') }}
              >
                <option value="zh-CN">{t('languageZh')}</option>
                <option value="en">{t('languageEn')}</option>
              </select>
            </Field>
            <Field label={t('workspaceMaxParallel')}>
              <select
                value={workspaceMaxParallel ?? FALLBACK_GLOBAL.maxParallel}
                disabled={busy || workspaceMaxParallel === null}
                onChange={(event) => { saveWorkspaceMaxParallel(Number(event.target.value)) }}
              >
                {parallelOptions.map((value) => (
                  <option key={value} value={value}>{t('tasks', { count: String(value) })}</option>
                ))}
              </select>
            </Field>
            <p className="kaze-settings-hint">{t('workspaceHint')}</p>

            <h5>{t('capabilitiesGroup')}</h5>
            <button
              type="button"
              className="kaze-settings-btn"
              disabled={selected === ''}
              onClick={() => {
                const item = workspaces.find((entry) => entry.workspaceId === selected)
                const remote = getRemote()
                if (item === undefined || remote === undefined) return
                void (async () => {
                  try {
                    const text = remoteText(await remote.specCapabilities(rootOf(item), new AbortController().signal))
                    setCapabilities(JSON.parse(text) as CapabilityRow[])
                    const overviewText = remoteText(await remote.specOverview(rootOf(item), new AbortController().signal))
                    setOverview(JSON.parse(overviewText) as ProjectOverview)
                    setCapabilityNote('')
                  } catch (failure) {
                    setCapabilities([])
                    setCapabilityNote((failure as Error).message)
                  }
                })()
              }}
            >
              {t('loadCapabilities')}
            </button>
            {capabilityNote === '' ? null : <p className="kaze-settings-note">{capabilityNote}</p>}
            {capabilities.length === 0 ? (
              <p className="kaze-settings-note">{t('noCapabilities')}</p>
            ) : (
              <ul className="kaze-settings-list">
                {capabilities.map((row) => (
                  <li key={row.capability}>
                    <strong>{row.capability}</strong> · {row.requirements} requirements
                    {row.lastChange === '' ? '' : ` · ${row.lastChange}`}
                    {row.issues.length === 0 ? '' : ` · ${row.issues.length} ${t('capabilityIssues')}`}
                  </li>
                ))}
              </ul>
            )}
            {overview === null ? null : (
              <p className="kaze-settings-note">
                {t('rulesLabel')}: {overview.rules ? t('yes') : t('no')} · {t('steeringLabel')}: {overview.steering} · {t('analysisLabel')}: {overview.analysis} · {t('pbtLabel')}: {overview.pbtPassed}
              </p>
            )}

            <h5>{t('idleGroup')}</h5>
            <p className="kaze-settings-note">{t('idleHint')}</p>
            {idleWindow === null ? (
              <p className="kaze-settings-note">{t('loadError', { message: '—' })}</p>
            ) : (
              <>
                <Field label={t('idleMultiplier')} hint={t('idleMultiplierHint')}>
                  <input
                    type="number"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={idleWindow.idlePriceMultiplier}
                    disabled={busy}
                    onChange={(event) => { setIdle({ ...idleWindow, idlePriceMultiplier: numberOr(event.target.value, idleWindow.idlePriceMultiplier) }) }}
                  />
                </Field>
                <Field label={t('idlePeakCost')} hint={t('idlePeakCostHint')}>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={idleWindow.defaultPeakCost}
                    disabled={busy}
                    onChange={(event) => { setIdle({ ...idleWindow, defaultPeakCost: Math.max(0, numberOr(event.target.value, idleWindow.defaultPeakCost)) }) }}
                  />
                </Field>
                <p className="kaze-settings-hint">{t('peakWindows')}</p>
                {idleWindow.peakWindows.map((window, index) => (
                  <div className="kaze-settings-window" key={`${window.start}-${index}`}>
                    <div className="kaze-settings-days">
                      {DAYS.map((day) => (
                        <button
                          key={day}
                          type="button"
                          className="kaze-settings-day"
                          aria-pressed={window.days.includes(day)}
                          aria-label={t(`day${day}`)}
                          onClick={() => { toggleDay(index, day) }}
                        >
                          {t(`day${day}`)}
                        </button>
                      ))}
                    </div>
                    <input
                      type="time"
                      value={window.start}
                      aria-label={t('startTime')}
                      disabled={busy}
                      onChange={(event) => { editWindow(index, { start: event.target.value }) }}
                    />
                    <input
                      type="time"
                      value={window.end}
                      aria-label={t('endTime')}
                      disabled={busy}
                      onChange={(event) => { editWindow(index, { end: event.target.value }) }}
                    />
                    <button
                      type="button"
                      className="kaze-settings-btn"
                      disabled={busy || idleWindow.peakWindows.length <= 1}
                      aria-label={t('removeWindow')}
                      onClick={() => { setIdle({ ...idleWindow, peakWindows: idleWindow.peakWindows.filter((_, position) => position !== index) }) }}
                    >
                      −
                    </button>
                  </div>
                ))}
                <div className="kaze-settings-actions">
                  <button
                    type="button"
                    className="kaze-settings-btn"
                    disabled={busy}
                    onClick={() => { setIdle({ ...idleWindow, peakWindows: [...idleWindow.peakWindows, { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' }] }) }}
                  >
                    {t('addWindow')}
                  </button>
                  <button type="button" className="kaze-settings-btn" data-kind="primary" disabled={busy} onClick={saveIdle}>
                    {t('saveIdle')}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {status === '' ? null : <p className="kaze-settings-status" role="status">{status}</p>}
      {error === '' ? null : <p className="kaze-settings-status" data-tone="error" role="alert">{error}</p>}
    </div>
  )
}
