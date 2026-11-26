/** Native port of the spec document linter. */
import { accessSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { detectDoc, type DocName, type SpecType } from './paths.js'
import { parseTasks } from './tasks.js'

export interface SpecIssue {
  readonly file: string
  readonly message: string
}

export interface ValidationReport {
  readonly errors: readonly SpecIssue[]
  readonly warnings: readonly SpecIssue[]
  readonly ok: boolean
}

export function validationText(report: ValidationReport): string {
  const lines = [
    ...report.warnings.map((issue) => `WARN  ${basename(issue.file)}: ${issue.message}`),
    ...report.errors.map((issue) => `ERROR ${basename(issue.file)}: ${issue.message}`),
    '',
    `${report.errors.length} error(s), ${report.warnings.length} warning(s)`,
  ]
  return lines.join('\n')
}

function trimLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+$/, ''))
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** Bilingual suffix for gate/validator messages added by the hardening work. */
const ZH_MESSAGES: Array<[RegExp, string]> = [
  [/^missing clarify\.md/, '缺少 clarify.md；请记录澄清台账（决策/假设/轮次）或假设'],
  [/^Missing required heading: # Clarification Ledger/, '缺少必需标题：# Clarification Ledger / 澄清记录'],
  [/^Missing required section: ## Decisions/, '缺少必需章节：## Decisions / 决策'],
  [/^Missing required section: ## Assumptions/, '缺少必需章节：## Assumptions / 假设'],
  [/^Missing required section: ## Rounds/, '缺少必需章节：## Rounds / 轮次'],
  [/^clarify\.md has no ## Open section/, 'clarify.md 没有 ## Open 章节；即使为空也要记录'],
  [/designDetail=low expects/, 'designDetail=low 需要伪代码/类型与前后置条件或不变式'],
  [/designDetail=high contains/, 'designDetail=high 出现大段代码块；高层设计应停留在契约层'],
  [/^completed tasks without exec\/evidence/, '已完成的必做任务缺少 exec/evidence/<task>.json 证据'],
  [/^properties without a passed kaze_spec_pbt record/, '有属性没有通过的 kaze_spec_pbt 记录'],
  [/^spec has no capability/, 'Spec 没有设置 capability；能力事实源不会更新'],
  [/unresolved review comment\(s\)/, '仍有未解决的评审评论；完成前请解决或关闭'],
  [/^requirements\.md or model\.smt2 changed after the verification record/, '需求或模型在验证记录之后发生了变化；请重跑验证并调用 kaze_spec_verify'],
  [/^verification record is stale at done/, 'done 阶段验证基线已过期；用 kaze_spec_restore 恢复干净副本、强制归档，或新建 bugfix/feature 规格；kaze_spec_verify 在 done 阶段无法运行'],
  [/^verification\.md Result must start with PASS/, 'verification.md 的 Result 必须以 PASS 开头；请重跑模型检查、修复矛盾，并再次调用 kaze_spec_verify'],
  [/^property test\(s\) recorded failed/, '属性测试最终记录为 failed；请通过 /spec-pbt 重跑并记录 kaze_spec_pbt status=passed 后再完成'],
  [/^no verification baseline recorded/, '没有记录验证基线；验证后请调用 kaze_spec_verify'],
  [/^design-first order: design\.md was recorded after/, 'design-first 顺序错误：design.md 在 requirements.md 之后创建'],
  [/^design-first order: design\.md was created after/, 'design-first 顺序可疑：design.md 的创建时间晚于 requirements.md'],
  [/^the workspace declares Project Rules; design\.md is missing/, '工作区声明了 Project Rules，但 design.md 缺少 ## Rules Check'],
  [/^Rules Check does not cover/, 'Rules Check 没有覆盖全部工程红线；逐条写明 compliant/exception'],
  [/^design\.md is missing ## Trade-offs/, 'design.md 缺少 ## Trade-offs / ## 权衡：写清所选方案、被否决的替代方案与理由'],
  [/^Missing required section: ## Trade-offs/, '缺少必需章节：## Trade-offs / ## 权衡'],
  [/^requirements analysis is blocked/, '需求分析结论为 blocked；修复需求后再设计'],
  [/^requirements analysis is needs-clarification/, '需求分析结论为 needs-clarification；确认发现项后再设计'],
  [/^analysis\.md is older than requirements\.md/, 'analysis.md 早于 requirements.md；请重跑 /spec-analyze'],
  [/^research\.md has unresolved unknowns/, 'research.md 仍有未解决未知项；请在设计中回应或引用'],
  [/^acceptance criterion does not cite its requirement/, '有验收标准没有引用对应需求；补上 (Requirements X.Y)'],
  [/^requirements contain UNVERIFIED/, '需求中还有未验证的外部事实；引用 research.md 或降级为假设'],
  [/^acceptance criteria without a property or Example-based entry/, '有验收标准既没有属性也没有 Example-based 说明'],
  [/^property test path does not exist yet/, '属性测试文件尚不存在；生成测试桩或移除 Test 链接'],
  [/^the specification changed after the FTA gate/, 'FTA 之后规格文档发生变化；请重新记录 FTA'],
  [/^requirements\/design\/tasks\/acceptance changed after the acceptance gate/, 'acceptance 之后文档发生变化；请重新记录验收'],
  [/^survey lists .* but .* preservation/, '调研条目数多于保持条款数；每个受影响合同补一条 SHALL CONTINUE TO'],
  [/^survey path does not exist/, '调研路径不存在；No path, no claim'],
  [/^survey bullet has no file path/, '调研条目没有文件路径；补上 `path:line`'],
  [/^migration\/compatibility task should name the old reader/, '迁移任务应点名旧读取方（调用方/解析器/加载器），不能只写新写入方'],
  [/^scope marker .* conflicts with state\.json scope/, '文档 scope 标记与 state.json 冲突；只保留一个事实源'],
  [/^scope is unknown; brownfield/, 'scope 未知；brownfield 检查已跳过，请用 kaze_spec_scope 设置'],
  [/^model\.smt2 is missing \(check-sat\)/, 'model.smt2 缺少 (check-sat)'],
  [/^model\.smt2 has no declare-/, 'model.smt2 缺少 declare-sort/declare-datatype/declare-fun/declare-const'],
  [/^model\.smt2 has no :named/, 'model.smt2 没有 :named 断言（每个验收标准一条）'],
  [/^model\.smt2 has unbalanced/, 'model.smt2 括号不平衡'],
  [/^no named assertion covers acceptance criterion/, '有验收标准没有对应的 named 断言'],
  [/^verification\.md is missing ## Assertion Map/, 'verification.md 缺少 ## Assertion Map / ## 断言映射'],
  [/^## Method \/ ## 方法 must name z3/, '## Method / ## 方法 必须写明 z3 或人工检查'],
  [/^manual verification must mark/, '人工验证必须在 ## Result 中标注人工'],
]

/** Append a Chinese translation when the message has one. */
export function bilingual(message: string): string {
  for (const [pattern, zh] of ZH_MESSAGES) {
    if (!pattern.test(message)) continue
    return message.includes(zh) ? message : `${message} / ${zh}`
  }
  return message
}

class Report {
  readonly errors: SpecIssue[] = []
  readonly warnings: SpecIssue[] = []

  error(file: string, message: string): void {
    this.errors.push({ file, message: bilingual(message) })
  }

  warn(file: string, message: string): void {
    this.warnings.push({ file, message: bilingual(message) })
  }

  result(): ValidationReport {
    return { errors: this.errors, warnings: this.warnings, ok: this.errors.length === 0 }
  }
}

function requireHeading(
  lines: readonly string[],
  pattern: RegExp,
  report: Report,
  file: string,
  message: string,
  severity: 'error' | 'warning' = 'error',
): void {
  if (!lines.some((line) => pattern.test(line))) {
    if (severity === 'error') report.error(file, message)
    else report.warn(file, message)
  }
}

/** Read the optional per-document scope marker from the first non-empty line. */
function scopeMarker(text: string): 'brownfield' | 'greenfield' | undefined {
  for (const line of trimLines(text)) {
    if (line.trim() === '') continue
    const match = /^<!--\s*scope:\s*(brownfield|greenfield)\s*-->$/.exec(line.trim())
    return match?.[1] as 'brownfield' | 'greenfield' | undefined
  }
  return undefined
}

/** Bullets under the Existing System Survey heading, with 1-based line numbers. */
function surveyBullets(lines: readonly string[]): Array<{ line: number; text: string }> | undefined {
  const start = lines.findIndex((line) => /^##\s+(?:Existing System Survey|现有系统调研|现有系统调查)\s*$/.test(line))
  if (start < 0) return undefined
  const bullets: Array<{ line: number; text: string }> = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (/^##\s/.test(line)) break
    if (/^\s*[-*]\s+\S/.test(line)) bullets.push({ line: index + 1, text: line })
  }
  return bullets
}

function preservationClauses(lines: readonly string[]): number {
  return lines.filter((line) => /(?:SHALL CONTINUE TO|应继续|必须继续|继续保持不变|不破坏现有)/i.test(line)).length
}

/** Path-like tokens in one survey bullet; URLs, globs, and placeholders are skipped. */
function surveyPathTokens(text: string): string[] {
  const tokens: string[] = []
  const source = text.split('\\').join('/')
  const pattern = /(?:^|[\s`(])((?:\.{0,2}\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*(?::\d+(?:-\d+)?)?)/g
  const knownRootExtensions = new Set([
    'json', 'md', 'toml', 'yaml', 'yml', 'lock', 'txt', 'xml', 'sln', 'csproj', 'gradle',
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'java', 'kt', 'rb', 'php',
    'cs', 'c', 'h', 'cpp', 'swift', 'sh', 'ps1', 'sql', 'css', 'scss', 'html', 'vue', 'svelte',
  ])
  for (const match of source.matchAll(pattern)) {
    const raw = match[1]!
    if (raw.includes('://') || raw.includes('*') || raw.includes('<') || raw.includes('>')) continue
    const token = raw.replace(/:(\d+)(?:-\d+)?$/, '')
    if (!/\.[A-Za-z0-9]{1,8}$/.test(token)) continue
    if (!token.includes('/')) {
      const extension = /\.([A-Za-z0-9]+)$/.exec(token)?.[1]?.toLowerCase()
      if (extension === undefined || !knownRootExtensions.has(extension)) continue
    }
    tokens.push(token.replace(/^\.\//, ''))
  }
  return tokens
}

/** Every survey bullet must name a real file; "no path, no claim". */
async function surveyPathIssues(
  dir: string,
  text: string,
  file: string,
): Promise<{ errors: SpecIssue[]; warnings: SpecIssue[] }> {
  const errors: SpecIssue[] = []
  const warnings: SpecIssue[] = []
  const bullets = surveyBullets(trimLines(text))
  if (bullets === undefined) return { errors, warnings }
  const root = resolve(dir, '..', '..')
  const checked = new Set<string>()
  for (const bullet of bullets) {
    const tokens = surveyPathTokens(bullet.text)
    if (tokens.length === 0) {
      warnings.push({ file, message: `line ${bullet.line}: survey bullet has no file path (add \`path:line\`)` })
      continue
    }
    for (const token of tokens) {
      const key = token.toLowerCase()
      if (checked.has(key)) continue
      checked.add(key)
      if (checked.size > 50) return { errors, warnings }
      try {
        await stat(resolve(root, token))
      } catch {
        errors.push({ file, message: `line ${bullet.line}: survey path does not exist: ${token}` })
      }
    }
  }
  return { errors, warnings }
}

function validateRequirements(text: string, report: Report, file: string, scope: string): void {
  const lines = trimLines(text)
  requireHeading(lines, /^# (?:Requirements Document|需求文档)$/, report, file, 'Missing required heading: # Requirements Document / # 需求文档')
  requireHeading(lines, /^## (?:Introduction|引言)$/, report, file, 'Missing required section: ## Introduction / ## 引言')
  requireHeading(lines, /^## (?:Glossary|术语表|词汇表)$/, report, file, 'Missing recommended section: ## Glossary / ## 术语表', 'warning')
  requireHeading(lines, /^## (?:Requirements|需求)$/, report, file, 'Missing required section: ## Requirements / ## 需求')

  const strict = /^### (?:Requirement|需求)\s+\d+[:：]/
  const loose = /^### (?:Requirement|需求)\b/
  const requirementNumbers: number[] = []
  let totalCriteria = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    if (loose.test(line) && !strict.test(line)) {
      report.error(file, `line ${index + 1}: malformed requirement heading; expected '### Requirement N: Title' or '### 需求 N: 标题'`)
    }
    if (!strict.test(line)) continue
    const numberMatch = /^### (?:Requirement|需求)\s+(\d+)[:：]/.exec(line)
    const number = numberMatch === null ? Number.NaN : Number(numberMatch[1])
    if (Number.isFinite(number)) {
      if (requirementNumbers.includes(number)) {
        report.error(file, `line ${index + 1}: duplicate requirement number ${number}`)
      }
      requirementNumbers.push(number)
    }
    let end = lines.length
    for (let next = index + 1; next < lines.length; next += 1) {
      if (lines[next]!.startsWith('### ')) {
        end = next
        break
      }
    }
    const block = lines.slice(index + 1, end)
    if (!block.some((item) => /\*\*(?:User Story|用户故事)[:：]\*\*/i.test(item))) {
      report.warn(file, `line ${index + 1}: requirement block is missing **User Story:** or **用户故事：**`)
    }
    const hasCriteriaHeading = block.some((item) => /^####\s+(?:Acceptance Criteria|验收标准)$/i.test(item))
    if (!hasCriteriaHeading) {
      report.error(file, `line ${index + 1}: requirement block is missing #### Acceptance Criteria / #### 验收标准`)
      continue
    }
    const criteria = block.filter((item) => /^\s*(?:\d+(?:\.\d+)?\.?|-)\s+/.test(item))
    totalCriteria += criteria.length
    if (criteria.length === 0) {
      report.error(file, `line ${index + 1}: requirement has no acceptance criteria`)
      continue
    }
    const ids = new Set<string>()
    for (const item of criteria) {
      const match = /^\s*(\d+)\.(\d+)\s+/.exec(item)
      if (match === null) {
        report.warn(file, `line ${index + 1}: acceptance criterion is not numbered X.Y`)
        continue
      }
      const id = `${match[1]}.${match[2]}`
      if (ids.has(id)) report.error(file, `line ${index + 1}: duplicate acceptance criterion ${id}`)
      ids.add(id)
      if (Number.isFinite(number) && Number(match[1]) !== number) {
        report.error(file, `line ${index + 1}: criterion ${id} belongs to Requirement ${match[1]}, not Requirement ${number}`)
      }
    }
    if (!criteria.some((item) => /\b(?:WHEN|IF|WHILE|WHERE|THE|SHALL)\b/i.test(item) || /(?:当|如果|在).*(?:应|必须)|应(?:继续|当|在|不)/.test(item))) {
      report.warn(file, `line ${index + 1}: acceptance criteria do not use EARS (WHEN/IF/SHALL or 当/如果/应)`)
    }
  }
  if (requirementNumbers.length === 0) {
    report.error(file, "Requirements section has no '### Requirement N:' / '### 需求 N：' heading")
  } else {
    const unique = [...new Set(requirementNumbers)].sort((left, right) => left - right)
    if (unique.some((number, offset) => number !== offset + 1)) {
      report.warn(file, `requirement numbers are not contiguous from 1: ${unique.join(', ')}`)
    }
    if (totalCriteria === 0) report.error(file, 'requirements document has no acceptance criteria')
  }
  if (scope === 'brownfield') {
    requireHeading(lines, /^## (?:Existing System Survey|现有系统调研|现有系统调查)$/, report, file, 'Missing required brownfield section: ## Existing System Survey / ## 现有系统调研')
    const bullets = surveyBullets(lines)
    if (bullets !== undefined && bullets.length === 0) {
      report.warn(file, 'Existing System Survey has no bullet entries; record one contract per bullet with a real path')
    }
    const clauses = preservationClauses(lines)
    if (!/(?:SHALL CONTINUE TO|应继续|必须继续|继续保持不变|不破坏现有)/i.test(text)) {
      report.error(file, 'Brownfield requirements are missing a SHALL CONTINUE TO / 应继续 preservation clause')
    } else if (bullets !== undefined && bullets.length > clauses) {
      report.warn(
        file,
        `survey lists ${bullets.length} contract bullet(s) but ${clauses} preservation clause(s) exist; add one SHALL CONTINUE TO clause per touched contract`,
      )
    }
  }
  if (/\bUNVERIFIED\b/i.test(text) || /未验证|未经核实/.test(text)) {
    report.warn(
      file,
      'requirements contain UNVERIFIED external claims; cite research.md or record the assumption in clarify.md',
    )
  }
}

function validateDesign(text: string, report: Report, file: string, specType: string | null, scope: string, detail = 'comprehensive'): void {
  const lines = trimLines(text)
  if (detail === 'low') {
    const hasCode = /```/.test(text) && /(?:PRECONDITION|POSTCONDITION|INVARIANT|precondition|postcondition|invariant|pseudocode)/i.test(text)
    if (!hasCode) {
      report.warn(file, 'designDetail=low expects pseudocode/types with preconditions or invariants; none were found')
    }
  } else if (detail === 'high') {
    let codeLines = 0
    let inside = false
    for (const line of lines) {
      if (/^```/.test(line)) {
        inside = !inside
        continue
      }
      if (inside) codeLines += 1
    }
    if (codeLines > 20) {
      report.warn(file, `designDetail=high contains a ${codeLines}-line code block; keep high-level design at contracts, not implementations`)
    }
  }
  const bugfixDesign =
    specType === 'bugfix' ||
    (specType === null &&
      lines.some(
        (line) =>
          /^##\s+(?:Bug Details|Hypothesized Root Cause|Fix Implementation|缺陷详情|推测根因|修复实现)$/i.test(line) ||
          /^###\s+(?:Bug|Fault) Condition$|^###\s+(?:缺陷|故障)条件$/i.test(line),
      ))
  const required: ReadonlyArray<readonly [string, 'error' | 'warning']> = bugfixDesign
    ? [
        ['Overview|概述', 'error'],
        ['Glossary|术语表|词汇表', 'warning'],
        ['Bug Details|缺陷详情|问题详情', 'error'],
        ['Expected Behavior|预期行为|正确行为', 'error'],
        ['Hypothesized Root Cause|推测根因|假设根因', 'error'],
        ['Correctness Properties|正确性属性', 'error'],
        ['Fix Implementation|修复实现', 'error'],
        ['Testing Strategy|测试策略', 'error'],
      ]
    : [
        ['Overview|概述', 'error'],
        ['Architecture|架构', 'error'],
        ['Components and Interfaces|组件与接口|组件和接口', 'error'],
        ['Data Models|数据模型', 'error'],
        ['Correctness Properties|正确性属性', 'warning'],
        ['Error Handling|错误处理', 'warning'],
        ['Testing Strategy|测试策略', 'error'],
      ]
  for (const [name, severity] of required) {
    const pattern = new RegExp(`^##\\s+(?:${name})$`, 'i')
    if (!lines.some((line) => pattern.test(line))) {
      if (severity === 'error') report.error(file, `Missing required section: ## ${name}`)
      else report.warn(file, `Missing recommended section: ## ${name}`)
    }
  }

  const index = lines.findIndex((line) => /^## (?:Correctness Properties|正确性属性)$/.test(line))
  if (index === -1) return
  let end = lines.length
  for (let next = index + 1; next < lines.length; next += 1) {
    if (lines[next]!.startsWith('## ')) {
      end = next
      break
    }
  }
  const block = lines.slice(index + 1, end)
  const strict = /^(?:### )?(?:Property|属性)\s*\d+[:：]/
  const loose = /^(?:### )?(?:Property|属性)\b/
  const properties: number[] = []
  for (let offset = 0; offset < block.length; offset += 1) {
    const line = block[offset]!
    if (loose.test(line) && !strict.test(line)) {
      report.error(file, `line ${index + offset + 2}: malformed property heading; expected 'Property N: Title' or '属性 N：标题'`)
    }
    if (strict.test(line)) properties.push(offset)
  }
  if (properties.length === 0) {
    report.warn(file, "Correctness Properties section has no 'Property N:' / '属性 N：' heading")
  }
  properties.forEach((start, position) => {
    const stop = position + 1 < properties.length ? properties[position + 1]! : block.length
    const chunk = block.slice(start, stop).join('\n')
    if (!/\*\*(?:Validates|验证)[:：]\s*(?:Requirements|需求)\s+[\d.,\s]+\*\*/.test(chunk)) {
      report.warn(file, `line ${index + start + 2}: property is missing '**Validates: Requirements X.Y**' / '**验证：需求 X.Y**'`)
    }
  })
  if (scope === 'brownfield' && !bugfixDesign) {
    requireHeading(lines, /^## (?:Impact on Existing System|对现有系统的影响)$/, report, file, 'Missing required brownfield section: ## Impact on Existing System / ## 对现有系统的影响')
    requireHeading(lines, /^## (?:Migration and Backward Compatibility|迁移与向后兼容|迁移和向后兼容)$/, report, file, 'Missing required brownfield section: ## Migration and Backward Compatibility / ## 迁移与向后兼容')
    if (!/(?:Preservation|保持|保留|不破坏)/i.test(text)) {
      report.error(file, 'Brownfield design is missing a Preservation / 保持 property')
    }
  }
  requireHeading(lines, /^##\s+(?:Trade-offs|权衡|取舍)\s*$/, report, file, 'Missing required section: ## Trade-offs / ## 权衡')
}

function validateTasks(text: string, report: Report, file: string, specType: string | null, scope: string): void {
  const lines = trimLines(text)
  requireHeading(lines, /^# (?:Implementation Plan|实施计划|实现计划)/, report, file, 'Missing required heading: # Implementation Plan / # 实施计划')
  requireHeading(lines, /^## (?:Overview|概述)$/, report, file, 'Missing recommended section: ## Overview / ## 概述', 'warning')
  if (!lines.some((line) => /^## (?:Tasks|任务)$/.test(line))) {
    report.warn(file, 'Missing recommended section: ## Tasks / ## 任务')
  }

  lines.forEach((line, index) => {
    if (/^#{2,3} (?:Task|任务) \d+/.test(line)) {
      report.error(file, `line ${index + 1}: tasks must use '- [ ] N. Description', not ##/### headings`)
    }
  })

  const start = lines.findIndex((line) => /^## (?:Tasks|任务)$/.test(line))
  if (start !== -1) {
    let end = lines.length
    for (let next = start + 1; next < lines.length; next += 1) {
      if (lines[next]!.startsWith('## ')) {
        end = next
        break
      }
    }
    const top = /^- \[([ xX~!-])\]\*? \d+\./
    const sub = /^\s*- \[([ xX~!-])\]\*? \d+\.\d+/
    const anyCheck = /^\s*- \[([ xX~!-])\]/
    const badCheck = /^\s*- \[([^\] ])\]/
    for (let index = start + 1; index < end; index += 1) {
      const line = lines[index]!
      if (badCheck.test(line) && !anyCheck.test(line)) {
        report.error(file, `line ${index + 1}: malformed checkbox; use [ ] [x] [-] [~] or [!]`)
        continue
      }
      if (!anyCheck.test(line)) continue
      const indent = line.length - line.trimStart().length
      if (indent === 0) {
        if (!top.test(line)) report.error(file, `line ${index + 1}: task line must match '- [ ] N. Description'`)
      } else if (!sub.test(line)) {
        report.error(file, `line ${index + 1}: sub-task line must match '- [ ] N.M Description'`)
      }
    }
  }

  if (!lines.some((line) => /^## (?:Notes|备注)$/.test(line))) {
    report.warn(file, 'Missing recommended section: ## Notes / ## 备注')
  }

  const dag = lines.findIndex((line) => /^## (?:Task Dependency Graph|任务依赖图|依赖图)$/.test(line))
  if (dag === -1) {
    report.error(file, 'Missing required section: ## Task Dependency Graph / ## 任务依赖图')
    return
  }
  let end = lines.length
  for (let next = dag + 1; next < lines.length; next += 1) {
    if (lines[next]!.startsWith('## ')) {
      end = next
      break
    }
  }
  const section = lines.slice(dag + 1, end).join('\n')
  const match = /```json\s*\n?([\s\S]*?)```/.exec(section)
  if (match === null) {
    report.error(file, 'Task Dependency Graph is missing a ```json block')
    return
  }
  const raw = match[1]!.trim()
  if (raw === '') {
    report.error(file, 'Task Dependency Graph JSON block is empty')
    return
  }
  let graph: unknown
  try {
    graph = JSON.parse(raw)
  } catch (error) {
    report.error(file, `Task Dependency Graph contains invalid JSON: ${(error as Error).message}`)
    return
  }
  if (typeof graph !== 'object' || graph === null) {
    report.error(file, "Task Dependency Graph must contain a non-empty 'waves' array")
    return
  }
  const waves = (graph as { waves?: unknown }).waves
  if (!Array.isArray(waves) || waves.length === 0) {
    report.error(file, "Task Dependency Graph must contain a non-empty 'waves' array")
    return
  }
  const ids = waves.filter((wave): wave is { id?: unknown } => typeof wave === 'object' && wave !== null).map((wave) => wave.id)
  if (ids.length !== waves.length || ids.some((id, index) => id !== index)) {
    report.error(file, `wave ids must be contiguous from 0: ${JSON.stringify(ids)}`)
  }
  const seen: string[] = []
  for (const wave of waves) {
    if (typeof wave !== 'object' || wave === null || !Array.isArray((wave as { tasks?: unknown }).tasks)) {
      report.error(file, `malformed wave entry: ${JSON.stringify(wave)}`)
      continue
    }
    seen.push(...(wave as { tasks: unknown[] }).tasks.map((value) => String(value)))
  }
  if (new Set(seen).size !== seen.length) report.error(file, 'a task appears in more than one wave')
  const uncovered = parseTasks(text)
    .filter((task) => task.leaf && !task.optional && !seen.includes(task.id))
    .map((task) => task.id)
  if (uncovered.length > 0) report.error(file, `Task Dependency Graph does not cover: ${uncovered.join(', ')}`)
  if (scope === 'brownfield' && specType !== 'bugfix') {
    if (!/^- \[[ xX]\]\s+\d+(?:\.\d+)?\.?\s.*(?:migrat|compatib|迁移|兼容)/im.test(text)) {
      report.error(file, 'Brownfield tasks are missing a non-optional migration/compatibility task')
    } else {
      const migrationTasks = lines.filter((line) =>
        /^- \[[ xX]\]\s+\d+(?:\.\d+)?\.?\s.*(?:migrat|compatib|迁移|兼容)/im.test(line),
      )
      const namesReader = migrationTasks.some((line) =>
        /(?:read|load|parse|consumer|caller|reader|读取|解析|调用方|旧格式|旧数据|legacy)/i.test(line),
      )
      if (!namesReader) {
        report.warn(
          file,
          'migration/compatibility task should name the old reader (callers, parsers, loaders), not only the new writer',
        )
      }
    }
    if (!/(no regression|existing test|regression|回归)/i.test(text)) {
      report.error(file, 'Brownfield tasks are missing a no-regression checkpoint')
    }
  }
  if (specType === 'bugfix') {
    const taskLines = lines.filter((line) => /^\s*- \[[ xX~!-]\]/.test(line))
    if (taskLines.length === 0) {
      report.error(file, 'bugfix tasks.md has no checkbox tasks')
    } else {
      if (!/_(?:Requirements|需求)[:：]/.test(text)) {
        report.error(file, 'bugfix tasks must cite _Requirements: X.Y_')
      }
      if (!taskLines.some((line) => /(?:regression|回归)/i.test(line))) {
        report.error(file, 'bugfix tasks are missing a regression task/checkpoint')
      }
      if (!taskLines.some((line) => /(?:preserv|保持|不变|unchanged)/i.test(line))) {
        report.error(file, 'bugfix tasks are missing a preservation task/checkpoint')
      }
    }
  }
}

function validateAcceptance(text: string, report: Report, file: string): void {
  const lines = trimLines(text)
  requireHeading(lines, /^# (?:Acceptance|验收)(?:\s|$)/, report, file, 'Missing required heading: # Acceptance / # 验收', 'warning')
  requireHeading(lines, /^## (?:Goal|目标)$/, report, file, 'Missing required section: ## Goal / ## 目标', 'warning')
  requireHeading(lines, /^## (?:Success Criteria|成功标准|验收标准)$/, report, file, 'Missing required section: ## Success Criteria / ## 成功标准')
  requireHeading(lines, /^## (?:Verification|验证)$/, report, file, 'Missing required section: ## Verification / ## 验证')
  const criteria = lines.filter((line) => /^\s*- \[[ xX]\]\s+/.test(line))
  if (criteria.length === 0) {
    report.warn(file, 'Success Criteria has no checkbox items')
  } else if (!criteria.every((line) => /(?:Requirements|需求)\s+\d+(?:\.\d+)?/i.test(line))) {
    report.warn(file, 'an acceptance criterion does not cite its requirement; add (Requirements X.Y)')
  }
}

function validateClarify(text: string, report: Report, file: string): void {
  const lines = trimLines(text)
  requireHeading(lines, /^#\s+(?:Clarification Ledger|澄清记录|澄清台账)\b/, report, file, 'Missing required heading: # Clarification Ledger / # 澄清记录')
  requireHeading(lines, /^##\s+(?:Decisions|决策)\s*$/, report, file, 'Missing required section: ## Decisions / ## 决策')
  requireHeading(lines, /^##\s+(?:Assumptions|假设)\s*$/, report, file, 'Missing required section: ## Assumptions / ## 假设')
  requireHeading(lines, /^##\s+(?:Rounds|轮次)\s*$/, report, file, 'Missing required section: ## Rounds / ## 轮次', 'warning')
  if (!/^##\s+(?:Open|待处理)\s*$/m.test(text)) {
    report.warn(file, 'clarify.md has no ## Open section; record open questions even when empty')
    return
  }
  const start = lines.findIndex((line) => /^##\s+(?:Open|待处理)\s*$/.test(line))
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (/^##\s/.test(line)) break
    const item = /^\s*[-*]\s+(.+)$/.exec(line)
    if (item === null) continue
    const value = item[1]!.trim()
    if (/^(?:none|n\/a|无|暂无|没有)[.!。]?$/i.test(value)) continue
    report.error(file, `clarify.md still has an open question: ${value.slice(0, 120)}`)
  }
}

function validateAnalysis(text: string, report: Report, file: string): void {
  const lines = trimLines(text)
  requireHeading(lines, /^#\s+(?:Requirements Analysis|需求分析)\b/, report, file, 'Missing required heading: # Requirements Analysis / # 需求分析', 'warning')
  requireHeading(lines, /^##\s+(?:Findings|发现)\s*$/, report, file, 'Missing required section: ## Findings / ## 发现')
  requireHeading(lines, /^##\s+(?:Open Questions|未决问题)\s*$/, report, file, 'Missing recommended section: ## Open Questions / ## 未决问题', 'warning')
  requireHeading(lines, /^##\s+(?:Decision|结论)\s*$/, report, file, 'Missing required section: ## Decision / ## 结论')
}

/** Verification records are evidence, not a prose checkbox. */
function validateVerification(text: string, report: Report, file: string, workflow: string): void {
  const lines = trimLines(text)
  requireHeading(lines, /^#\s+(?:Verification|验证)(?:\s|—|$)/, report, file, 'Missing required heading: # Verification / # 验证')
  const method = lines.findIndex((line) => /^##\s+(?:Method|方法)\s*$/.test(line))
  const result = lines.findIndex((line) => /^##\s+(?:Result|结果)\s*$/.test(line))
  if (method < 0) report.error(file, 'Missing required section: ## Method / ## 方法')
  if (result < 0) report.error(file, 'Missing required section: ## Result / ## 结果')
  const sectionText = (start: number): string => {
    if (start < 0) return ''
    const stop = lines.findIndex((line, index) => index > start && /^##\s/.test(line))
    return lines.slice(start + 1, stop < 0 ? lines.length : stop).join('\n').trim()
  }
  if (method >= 0 && sectionText(method) === '') report.error(file, '## Method / ## 方法 is empty')
  if (result < 0 || sectionText(result) === '') {
    if (result >= 0) report.error(file, '## Result / ## 结果 is empty')
  } else {
    const methodText = sectionText(method)
    const resultText = sectionText(result)
    if (!/(?:PASS|FAIL|通过|失败|PARTIAL|部分)/i.test(resultText)) {
      report.error(file, '## Result / ## 结果 must state PASS, FAIL, or PARTIAL / 通过、失败或部分通过')
    }
    const solver = /\bz3\b/i.test(methodText)
    const manual = /(?:\bmanual\b|人工|手工|手動)/i.test(methodText)
    if (!solver && !manual && !/(?:\bcommand\b|命令)/i.test(methodText)) {
      if (workflow === 'verify-first') {
        report.error(file, '## Method / ## 方法 must name z3 or state that the check was manual')
      } else {
        report.warn(file, '## Method / ## 方法 should name the solver, command, or manual check')
      }
    }
    if (workflow === 'verify-first' && manual && !/(?:\bmanual\b|人工|手工|手動)/i.test(resultText)) {
      report.error(file, 'manual verification must mark ## Result as manual / 人工验证必须在结果中标注人工')
    }
    if (workflow === 'verify-first' && solver && !/(?:\-smt2|smt2|command|命令)/i.test(methodText)) {
      report.warn(file, '## Method / ## 方法 names z3 but not the exact -smt2 command')
    }
  }
  if (workflow === 'verify-first' && !/^##\s+(?:Assertion Map|断言映射)\s*$/m.test(text)) {
    report.error(file, 'verification.md is missing ## Assertion Map / ## 断言映射')
  }
}

function validateResearch(text: string, report: Report, file: string): void {
  const lines = trimLines(text)
  requireHeading(lines, /^## (?:Decision|决策)$/, report, file, 'Missing required section: ## Decision / ## 决策')
  requireHeading(lines, /^## (?:Rationale|理由|依据)$/, report, file, 'Missing required section: ## Rationale / ## 理由')
  requireHeading(lines, /^## (?:Alternatives considered|备选方案|替代方案)$/, report, file, 'Missing required section: ## Alternatives considered / ## 备选方案')
  requireHeading(lines, /^## (?:Evidence|证据)$/, report, file, 'Missing required section: ## Evidence / ## 证据', 'warning')
  if (!/https?:\/\//i.test(text)) {
    report.warn(file, 'research.md records no source URL; cite at least one primary source')
  }
  requireHeading(lines, /^## (?:Unresolved unknowns|未解决问题|未决问题)$/, report, file, 'Missing recommended section: ## Unresolved unknowns / ## 未解决问题', 'warning')
}

/** Whether a named section has real content (not "none"/"无"). */
function sectionHasContent(lines: readonly string[], heading: RegExp): boolean {
  const start = lines.findIndex((line) => heading.test(line))
  if (start < 0) return false
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (/^##\s/.test(line)) break
    const text = line.replace(/^[-*]\s*/, '').trim()
    if (text !== '' && !/^(?:none|n\/a|无|暂无|没有)[.!。]?$/i.test(text)) return true
  }
  return false
}

function validateBugfix(text: string, report: Report, file: string): void {
  const lines = trimLines(text)
  const required: ReadonlyArray<readonly [RegExp, string]> = [
    [/^## (?:Introduction|引言)$/, '## Introduction / ## 引言'],
    [/^## (?:Bug Analysis|缺陷分析|问题分析)$/, '## Bug Analysis / ## 缺陷分析'],
    [/^### (?:Current Behavior \(Defect\)|当前行为（缺陷）|当前行为\(缺陷\))$/, '### Current Behavior (Defect) / ### 当前行为（缺陷）'],
    [/^### (?:Expected Behavior \(Correct\)|预期行为（正确）|预期行为\(正确\))$/, '### Expected Behavior (Correct) / ### 预期行为（正确）'],
    [/^### (?:Unchanged Behavior \(Regression Prevention\)|不变行为（防回归）|不变行为\(防回归\))$/, '### Unchanged Behavior (Regression Prevention) / ### 不变行为（防回归）'],
  ]
  for (const [pattern, display] of required) {
    if (!lines.some((line) => pattern.test(line))) report.error(file, `Missing required section: ${display}`)
  }
  const designOnly = /(technical context|implementation details|architecture|components and interfaces|data models)/i
  lines.forEach((line, index) => {
    const match = /^#{2,3}\s+(.+)$/.exec(line)
    if (match !== null && designOnly.test(match[1]!)) {
      report.warn(file, `line ${index + 1}: design-only section '${match[1]}' does not belong in bugfix.md`)
    }
  })
}

export function validateDocument(text: string, doc: DocName, specType: string | null = null, scope = 'unknown', detail = 'comprehensive'): ValidationReport {
  const report = new Report()
  const file = `${doc}.md`
  const marker = scopeMarker(text)
  if (marker !== undefined && scope !== 'unknown' && marker !== scope) {
    report.error(file, `scope marker <!-- scope: ${marker} --> conflicts with state.json scope "${scope}"`)
  }
  const effective = marker ?? scope
  if (effective === 'unknown' && (doc === 'requirements' || doc === 'design' || doc === 'tasks')) {
    report.warn(
      file,
      'scope is unknown; brownfield survey, migration, and preservation checks are skipped. Set it with kaze_spec_scope',
    )
  }
  switch (doc) {
    case 'requirements':
      validateRequirements(text, report, file, effective)
      break
    case 'design':
      validateDesign(text, report, file, specType, effective, detail)
      break
    case 'tasks':
      validateTasks(text, report, file, specType, effective)
      break
    case 'bugfix':
      validateBugfix(text, report, file)
      break
  }
  return report.result()
}

/** Acceptance-criterion ids (X.Y) declared in requirements.md. */
export function requirementCriterionIds(text: string): Set<string> {
  const ids = new Set<string>()
  let current = ''
  for (const line of trimLines(text)) {
    const heading = /^###\s+(?:Requirement|需求)\s+(\d+)[:：]/.exec(line)
    if (heading !== null) {
      current = heading[1]!
      continue
    }
    const criterion = /^(\d+)\.(\d+)\s+/.exec(line.trim())
    if (current !== '' && criterion !== null && criterion[1] === current) {
      ids.add(`${criterion[1]}.${criterion[2]}`)
    }
  }
  return ids
}

/** Remove SMT comments and string bodies so structural scans only see code. */
function smtCode(text: string): string {
  let out = ''
  let inString = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!
    if (inString) {
      if (char === '"' && text[index - 1] !== '\\') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === ';') {
      while (index < text.length && text[index] !== '\n') index += 1
      out += '\n'
      continue
    }
    out += char
  }
  return out
}

export interface ModelReport {
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
  readonly named: readonly string[]
}

/**
 * Structural SMT-LIB preflight. This is not a solver: it catches models that
 * cannot possibly represent the requirements (no (check-sat), no declarations,
 * no named assertion, unbalanced parentheses).
 */
export function validateModel(text: string): ModelReport {
  const errors: string[] = []
  const warnings: string[] = []
  const code = smtCode(text)
  if (code.trim() === '') errors.push('model.smt2 is empty')
  if (!/\(check-sat\b/.test(code)) errors.push('model.smt2 is missing (check-sat)')
  if (!/\(declare-(?:sort|datatypes?|fun|const)\b/.test(code)) {
    errors.push('model.smt2 has no declare-sort/declare-datatype/declare-fun/declare-const')
  }
  if (!/\(assert\b/.test(code)) errors.push('model.smt2 has no (assert ...) constraint')
  const named = [...code.matchAll(/:named\s+([A-Za-z_][A-Za-z0-9_.-]*)/g)].map((match) => match[1]!)
  if (named.length === 0) errors.push('model.smt2 has no :named assertion (one per acceptance criterion)')
  const seen = new Set<string>()
  for (const id of named) {
    if (seen.has(id)) errors.push(`model.smt2 has a duplicate :named id: ${id}`)
    seen.add(id)
  }
  let balance = 0
  for (const char of code) {
    if (char === '(') balance += 1
    if (char === ')') balance -= 1
  }
  if (balance !== 0) errors.push(`model.smt2 has unbalanced parentheses (${balance > 0 ? `${balance} unclosed` : `${-balance} extra close`})`)
  if (!named.some((id) => /^(?:BA\d+|AC|REQ)/i.test(id))) {
    warnings.push('model.smt2 :named ids do not look like BA/AC/REQ ids; keep the assertion-to-requirement mapping readable')
  }
  return { errors, warnings, named }
}

/** Every acceptance criterion must have one named assertion in the model. */
export function modelCoverageIssues(model: string, criteria: ReadonlySet<string>): SpecIssue[] {
  if (criteria.size === 0) return []
  const named = validateModel(model).named
  const issues: SpecIssue[] = []
  for (const id of criteria) {
    const [requirement, criterion] = id.split('.')
    if (requirement === undefined || criterion === undefined) continue
    const pattern = new RegExp(`(?:^|[^0-9])${requirement}[_.-]${criterion}(?![0-9])`)
    if (!named.some((name) => pattern.test(name))) {
      issues.push({ file: 'model.smt2', message: `no named assertion covers acceptance criterion ${id}` })
    }
  }
  return issues
}

/** The Assertion Map must name every acceptance criterion. */
function verificationMapIssues(verification: string, requirements: string): SpecIssue[] {
  const criteria = requirementCriterionIds(requirements)
  if (criteria.size === 0) return []
  const lines = verification.split(/\r?\n/)
  const start = lines.findIndex((line) => /^##\s+(?:Assertion Map|断言映射)\s*$/.test(line))
  if (start < 0) return []
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s/.test(lines[index]!)) {
      end = index
      break
    }
  }
  const block = lines.slice(start + 1, end).join('\n')
  return [...criteria]
    .filter((id) => {
      const [requirement, criterion] = id.split('.')
      if (requirement === undefined || criterion === undefined) return true
      return !new RegExp(`(?:^|[^0-9])${requirement}[._-]${criterion}(?![0-9])`).test(block)
    })
    .map((id) => ({ file: 'verification.md', message: `## Assertion Map does not cover acceptance criterion ${id}` }))
}

/** Every task cites existing criteria; uncovered criteria are reported. */
function taskTraceability(
  text: string,
  known: ReadonlySet<string>,
  file: string,
): { errors: SpecIssue[]; warnings: SpecIssue[] } {
  const lines = trimLines(text)
  const errors: SpecIssue[] = []
  const warnings: SpecIssue[] = []
  // Reuse the parser's optional test (star marker or "(optional)" prefix), keyed
  // by the same 1-based line numbers the starts scan produces.
  const optionalByLine = new Map(parseTasks(text).map((task) => [task.line, task.optional]))
  const starts: number[] = []
  lines.forEach((line, index) => {
    if (/^\s*- \[[ xX~!-]\]\*?\s+\d+(?:\.\d+)?\.?\s/.test(line)) starts.push(index)
  })
  const indentOf = (line: string): number => line.length - line.trimStart().length
  const referenced = new Set<string>()
  const requiredReferenced = new Set<string>()
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index]!
    const indent = indentOf(lines[start]!)
    let end = lines.length
    let parent = false
    for (let next = start + 1; next < lines.length; next += 1) {
      if (!/^\s*- \[[ xX~!-]\]/.test(lines[next]!)) continue
      const nextIndent = indentOf(lines[next]!)
      if (nextIndent > indent) {
        parent = true
        continue
      }
      end = next
      break
    }
    const block = lines.slice(start, end).join('\n')
    const annotation = /_(?:Requirements|需求)[:：]\s*([^_\n]+)_/.exec(block)
    if (annotation === null) {
      // A parent task is a grouping heading; its leaf tasks carry the contract.
      if (!parent) errors.push({ file, message: `line ${start + 1}: task is missing _Requirements: X.Y_` })
      continue
    }
    const ids = [...annotation[1]!.matchAll(/(\d+)\.(\d+)/g)].map((match) => `${match[1]}.${match[2]}`)
    if (ids.length === 0) {
      if (!parent) errors.push({ file, message: `line ${start + 1}: task requirement annotation has no X.Y id` })
      continue
    }
    const requiredTask = !(optionalByLine.get(start + 1) ?? false)
    for (const id of ids) {
      referenced.add(id)
      if (requiredTask) requiredReferenced.add(id)
      if (known.size > 0 && !known.has(id)) {
        errors.push({ file, message: `line ${start + 1}: task references unknown requirement ${id}` })
      }
    }
  }
  if (known.size > 0) {
    const uncovered = [...known].filter((id) => !referenced.has(id))
    if (uncovered.length > 0) {
      const shown = uncovered.slice(0, 8).join(', ')
      errors.push({
        file,
        message: `acceptance criteria not covered by any task: ${shown}${uncovered.length > 8 ? ` (+${uncovered.length - 8} more)` : ''}`,
      })
    }
    // A criterion whose only covering tasks are optional would silently skip the
    // work: advisory here, a gate failure under strict mode.
    const optionalOnly = [...known].filter((id) => referenced.has(id) && !requiredReferenced.has(id))
    if (optionalOnly.length > 0) {
      const shown = optionalOnly.slice(0, 8).join(', ')
      warnings.push({
        file,
        message: `acceptance criteria covered only by optional tasks: ${shown}${optionalOnly.length > 8 ? ` (+${optionalOnly.length - 8} more)` : ''}`,
      })
    }
  }
  return { errors, warnings }
}

/** Every acceptance criterion is covered by a property or explicitly example-based. */
function propertyCoverageIssues(requirements: string, design: string, file: string): SpecIssue[] {
  const ids = requirementCriterionIds(requirements)
  if (ids.size === 0) return []
  if (!/^##\s+(?:Correctness Properties|正确性属性)\s*$/m.test(design)) return []
  if (/(?:not applicable|不适用|ruled out)/i.test(design)) return []
  const covered = new Set<string>()
  for (const match of design.matchAll(/\*\*(?:Validates|验证)[:：]\s*(?:Requirements|需求)\s+([^*]+)\*\*/g)) {
    for (const id of match[1]!.matchAll(/(\d+)\.(\d+)/g)) covered.add(`${id[1]}.${id[2]}`)
  }
  const example = new Set<string>()
  const lines = design.split(/\r?\n/)
  const start = lines.findIndex((line) => /^##\s+(?:Example-based Criteria|示例测试标准|示例覆盖)\s*$/.test(line))
  if (start >= 0) {
    for (let index = start + 1; index < lines.length; index += 1) {
      if (/^##\s/.test(lines[index]!)) break
      for (const id of lines[index]!.matchAll(/(\d+)\.(\d+)/g)) example.add(`${id[1]}.${id[2]}`)
    }
  }
  const uncovered = [...ids].filter((id) => !covered.has(id) && !example.has(id))
  if (uncovered.length === 0) return []
  const shown = uncovered.slice(0, 8).join(', ')
  return [{
    file,
    message: `acceptance criteria without a property or Example-based entry: ${shown}${uncovered.length > 8 ? ` (+${uncovered.length - 8} more)` : ''}`,
  }]
}

/** Property references must resolve to a declared acceptance criterion. */
function propertyTargetIssues(requirements: string, design: string, file: string): SpecIssue[] {
  const known = requirementCriterionIds(requirements)
  if (known.size === 0) return []
  const errors: SpecIssue[] = []
  for (const match of design.matchAll(/\*\*(?:Validates|验证)[:：]\s*(?:Requirements|需求)\s+([^*]+)\*\*/g)) {
    for (const id of match[1]!.matchAll(/(\d+)\.(\d+)/g)) {
      const key = `${id[1]}.${id[2]}`
      if (!known.has(key)) errors.push({ file, message: `property validates unknown acceptance criterion ${key}` })
    }
  }
  return errors
}

/** Acceptance references must resolve to a declared requirement or criterion. */
function acceptanceTargetIssues(requirements: string, acceptance: string, file: string): SpecIssue[] {
  const criteria = requirementCriterionIds(requirements)
  if (criteria.size === 0) return []
  const requirementsOnly = new Set([...criteria].map((id) => id.split('.')[0]!))
  const errors: SpecIssue[] = []
  for (const line of acceptance.split(/\r?\n/)) {
    if (!/^\s*- \[[ xX]\]\s+/.test(line)) continue
    const citation = /(?:Requirements|需求)\s+([\d.,\s]+)/i.exec(line)
    if (citation === null) continue
    for (const id of citation[1]!.matchAll(/\d+(?:\.\d+)?/g)) {
      const value = id[0]
      const valid = value.includes('.') ? criteria.has(value) : requirementsOnly.has(value)
      if (!valid) errors.push({ file, message: `acceptance criterion cites unknown requirement ${value}` })
    }
  }
  return errors
}

export async function validateDirectory(dir: string, specTypeHint?: SpecType | null): Promise<ValidationReport> {
  const report = new Report()
  let specType: string | null = specTypeHint ?? null
  let scope = 'unknown'
  let detail = 'comprehensive'
  let workflow = ''
  try {
    const state = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8')) as { specType?: unknown; scope?: unknown; designDetail?: unknown; workflow?: unknown }
    if (typeof state.specType === 'string') specType = state.specType
    if (state.scope === 'brownfield' || state.scope === 'greenfield') scope = state.scope
    if (state.designDetail === 'high' || state.designDetail === 'low' || state.designDetail === 'comprehensive') {
      detail = state.designDetail
    }
    if (typeof state.workflow === 'string') workflow = state.workflow
  } catch {
    // A spec without state still gets structural linting.
  }
  let names: string[]
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith('.md')).sort()
  } catch {
    return report.result()
  }
  const texts = new Map<DocName, string>()
  let analysisText = ''
  let researchText = ''
  let acceptanceText = ''
  let verificationText = ''
  for (const name of names) {
    const text = await readFile(join(dir, name), 'utf8')
    if (name === 'acceptance.md') {
      acceptanceText = text
      const single = new Report()
      validateAcceptance(text, single, name)
      for (const issue of single.errors) report.errors.push({ file: join(dir, name), message: issue.message })
      for (const issue of single.warnings) report.warnings.push({ file: join(dir, name), message: issue.message })
      continue
    }
    if (name === 'verification.md') {
      verificationText = text
      const single = new Report()
      validateVerification(text, single, name, workflow)
      for (const issue of single.errors) report.errors.push({ file: join(dir, name), message: issue.message })
      for (const issue of single.warnings) report.warnings.push({ file: join(dir, name), message: issue.message })
      continue
    }
    if (name === 'research.md') {
      researchText = text
      const single = new Report()
      validateResearch(text, single, name)
      for (const issue of single.errors) report.errors.push({ file: join(dir, name), message: issue.message })
      for (const issue of single.warnings) report.warnings.push({ file: join(dir, name), message: issue.message })
      continue
    }
    if (name === 'analysis.md') {
      analysisText = text
      const single = new Report()
      validateAnalysis(text, single, name)
      for (const issue of single.errors) report.errors.push({ file: join(dir, name), message: issue.message })
      for (const issue of single.warnings) report.warnings.push({ file: join(dir, name), message: issue.message })
      continue
    }
    if (name === 'clarify.md') {
      const single = new Report()
      validateClarify(text, single, name)
      for (const issue of single.errors) report.errors.push({ file: join(dir, name), message: issue.message })
      for (const issue of single.warnings) report.warnings.push({ file: join(dir, name), message: issue.message })
      continue
    }
    const doc = detectDoc(name)
    if (doc === null) continue
    texts.set(doc, text)
    const single = validateDocument(text, doc, specType, scope, detail)
    for (const issue of single.errors) report.errors.push({ file: join(dir, name), message: issue.message })
    for (const issue of single.warnings) report.warnings.push({ file: join(dir, name), message: issue.message })
    if (doc === 'requirements') {
      const effective = scopeMarker(text) ?? scope
      if (effective === 'brownfield') {
        const paths = await surveyPathIssues(dir, text, join(dir, name))
        report.errors.push(...paths.errors)
        report.warnings.push(...paths.warnings)
      }
    }
  }
  if (specType !== 'bugfix' && texts.has('requirements') && texts.has('tasks')) {
    const trace = taskTraceability(
      texts.get('tasks')!,
      requirementCriterionIds(texts.get('requirements')!),
      join(dir, 'tasks.md'),
    )
    report.errors.push(...trace.errors)
    report.warnings.push(...trace.warnings)
  }
  if (texts.has('requirements') && acceptanceText !== '') {
    report.errors.push(...acceptanceTargetIssues(
      texts.get('requirements')!,
      acceptanceText,
      join(dir, 'acceptance.md'),
    ))
  }
  if (workflow === 'verify-first' && verificationText !== '' && texts.has('requirements')) {
    report.errors.push(...verificationMapIssues(verificationText, texts.get('requirements')!))
  }
  if (texts.has('requirements') && texts.has('design')) {
    report.errors.push(...propertyTargetIssues(
      texts.get('requirements')!,
      texts.get('design')!,
      join(dir, 'design.md'),
    ))
    const coverage = propertyCoverageIssues(
      texts.get('requirements')!,
      texts.get('design')!,
      join(dir, 'design.md'),
    )
    report.warnings.push(...coverage)
    const designFile = join(dir, 'design.md')
    if (analysisText !== '') {
      const decision = /^##\s+(?:Decision|结论)\s*$[\s\S]*?^([^\n#]+)/m.exec(analysisText)?.[1]?.trim() ?? ''
      if (/\bblocked\b|阻塞/i.test(decision)) {
        report.errors.push({ file: designFile, message: 'requirements analysis is blocked; fix requirements before designing' })
      } else if (/needs-clarification|待澄清|需澄清/i.test(decision)) {
        report.warnings.push({ file: designFile, message: 'requirements analysis is needs-clarification; confirm the findings before designing' })
      }
      try {
        const analysisStat = await stat(join(dir, 'analysis.md'))
        const requirementsStat = await stat(join(dir, 'requirements.md'))
        if (analysisStat.mtimeMs < requirementsStat.mtimeMs) {
          report.warnings.push({ file: join(dir, 'analysis.md'), message: 'analysis.md is older than requirements.md; re-run /spec-analyze' })
        }
      } catch {
        // A missing file already has its own finding.
      }
    }
    if (researchText !== '' && sectionHasContent(trimLines(researchText), /^##\s+(?:Unresolved unknowns|未解决问题|未决问题)\s*$/)) {
      report.warnings.push({ file: join(dir, 'design.md'), message: 'research.md has unresolved unknowns; address or cite them in the design' })
    }
    for (const issue of designTestPathIssues(designFile, texts.get('design')!, dir)) {
      report.warnings.push(issue)
    }
  }
  return report.result()
}

/** Property test links must point at a real file. */
function designTestPathIssues(file: string, design: string, dir: string): SpecIssue[] {
  const issues: SpecIssue[] = []
  const root = resolve(dir, '..', '..')
  for (const match of design.matchAll(/\*\*Test:\s*([^*\n]+?)\*\*/g)) {
    const target = match[1]!.split('::')[0]!.trim()
    if (target === '' || /^https?:/i.test(target)) continue
    const absolute = resolve(root, target)
    issues.push({ file, message: `property test path does not exist yet: ${target}` })
    // stat is async; use a synchronous existence probe via fs.accessSync.
    try {
      accessSync(absolute)
      issues.pop()
    } catch {
      // keep the warning
    }
  }
  return issues
}

