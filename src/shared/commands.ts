/** Bilingual Kaze command catalog shared by the client menu and Host injection. */
export type KazeLanguage = 'zh-CN' | 'en'

export interface KazeCommandText {
  /** Displayed command token (Chinese or English). */
  readonly name: string
  readonly description: string
}

export interface KazeCommand {
  /** Stable English id used by the skill files and internal prompts. */
  readonly id: string
  readonly zh: KazeCommandText
  readonly en: KazeCommandText
}

/**
 * Menu order is intentional: entry points first (most frequent first), then the
 * spec workflow in phase order, then routine operations and maintenance.
 */
export const KAZE_COMMANDS: readonly KazeCommand[] = [
  // Entry points; the wish flow leads, followed by the spec and direct-coding entries.
  { id: 'spec-wish', zh: { name: '开始许愿', description: '把模糊、简短的许愿整理成可直接执行的提示词，写明目标、非目标、约束、验收标准与验证方式' }, en: { name: 'Start Wish', description: 'Turns a vague wish into a ready-to-use prompt that states the goal, non-goals, constraints, acceptance criteria, and verification.' } },
  { id: 'spec', zh: { name: '新建Spec', description: '新建 Spec 流程：先判断请求类别并多轮澄清需求，再选择逐阶段审阅或一站式生成' }, en: { name: 'New Spec', description: 'Starts the spec flow: classifies the request, clarifies requirements over several rounds, then offers step-by-step review or one-shot generation.' } },
  { id: 'spec-quick', zh: { name: '快速Spec', description: '新建快速 Spec 流程，通过 2 到 4 个关键问题，快速产出 Spec、需求、设计与任务文档' }, en: { name: 'Quick Spec', description: 'Starts the quick spec flow: two to four key questions quickly produce the spec, requirements, design, and task documents.' } },
  { id: 'spec-flow', zh: { name: '一站式Spec', description: '先多轮澄清需求，再一次性生成需求、设计与任务文档，最后只做一次计划评审' }, en: { name: 'One-shot Spec', description: 'Clarifies requirements over several rounds, generates the requirements, design, and task documents in one pass, then asks for one plan review.' } },
  { id: 'spec-verify-first', zh: { name: '验证优先Spec', description: '先写需求初稿与 SMT 模型，验证一致性与完整性后再生成正式需求、设计与任务，并记录验证方式' }, en: { name: 'Verify-First Spec', description: 'Writes a requirements draft and an SMT model first, verifies consistency and completeness, then produces the formal requirements, design, and tasks, recording how the model was checked.' } },
  { id: 'spec-rules', zh: { name: '工程红线', description: '维护工作区根 AGENTS.md 的“Project Rules / 工程红线”小节：可检查、不可违背的工程约束，每条设计必须回执 compliant 或 exception，设计门禁强制校验' }, en: { name: 'Hard Rules', description: 'Maintains the Project Rules section of the workspace AGENTS.md: checkable, non-negotiable constraints that every design must answer as compliant or exception, enforced by the design gate.' } },
  { id: 'spec-steering', zh: { name: '工作区约定', description: '维护 .kaze/steering 下的工作区约定：路径、命名、构建与测试命令、常见坑位等软约定，会话启动注入一次，不参与门禁' }, en: { name: 'Steering Conventions', description: 'Maintains the workspace conventions under .kaze/steering: paths, naming, build and test commands, and recurring pitfalls, injected once per session and not gate-enforced.' } },
  { id: 'spec-bugfix', zh: { name: '新建Bugfix', description: 'Bug快速修复流程，先记录当前、期望与不变的行为，规划任务按探索测试、修复、回归排序' }, en: { name: 'New Bugfix', description: 'The quick bugfix flow: first records the current, expected, and unchanged behavior, then orders the tasks as exploration test, fix, and regression.' } },
  { id: 'vibe', zh: { name: '氛围编程', description: '经典氛围编程流程，直接修改代码并完成验证。先明确目标与验收检查，只读取决定性文件，改动保持最小，再执行可证伪的检查与常规测试' }, en: { name: 'Vibe Coding', description: 'The classic vibe-coding flow: change the code directly and verify it. First state the goal and acceptance checks, read only the decisive files, keep the change minimal, then run a falsifying check and the usual tests.' } },

  // Main spec workflow, in phase order.
  { id: 'spec-explore', zh: { name: '探索需求', description: '只读探索，先了解代码与相关约束，给出问题、可能方案与风险，最后给出做、缓还是不做的建议' }, en: { name: 'Explore Requirements', description: 'Read-only exploration: first studies the code and related constraints, then presents the problem, possible approaches, and risks, and finally recommends whether to build, defer, or not do it.' } },
  { id: 'spec-research', zh: { name: '深度探索', description: '进行复杂的深度研究探索，多角度检索并交叉验证，无法证实的结论明确标注' }, en: { name: 'Deep Research', description: 'Runs complex, in-depth research: searches from several angles, cross-verifies the findings, and clearly marks conclusions that cannot be confirmed.' } },
  { id: 'spec-requirements', zh: { name: '编写需求', description: '编写需求文档或 Bugfix 文档，整理用户故事和 EARS 验收标准表述' }, en: { name: 'Write Requirements', description: 'Writes the requirements document or the bugfix document, organizing user stories and EARS acceptance criteria.' } },
  { id: 'spec-analyze', zh: { name: '需求分析', description: '按 INCOSE 维度复核需求：歧义、冲突、缺口、不可测与逃生条款，产出 analysis.md 并给出待确认问题' }, en: { name: 'Analyze Requirements', description: 'Reviews requirements for ambiguity, conflicts, gaps, untestable criteria, and escape clauses, writes analysis.md, and lists the questions to settle.' } },
  { id: 'spec-design', zh: { name: '编写设计', description: '编写设计文档，说明架构、接口、数据模型、权衡取舍、错误处理与测试策略' }, en: { name: 'Write Design', description: 'Writes the design document covering architecture, interfaces, data models, trade-offs, error handling, and testing strategy.' } },
  { id: 'spec-pbt', zh: { name: '属性测试', description: '把 EARS 验收标准映射为正确性属性，补齐设计中的属性章节，生成属性测试任务与测试桩，并记录属性覆盖' }, en: { name: 'Property Tests', description: 'Maps EARS acceptance criteria to correctness properties, completes the design property section, creates property-test tasks and stubs, and records coverage.' } },
  { id: 'spec-tasks', zh: { name: '编写任务', description: '编写任务文档，将工作拆分为可执行的任务，并理清任务之间的依赖，拆分为多个可并行实现的波次' }, en: { name: 'Write Tasks', description: 'Writes the task document: splits the work into executable tasks, maps their dependencies, and divides them into waves that can be implemented in parallel.' } },
  { id: 'spec-apply', zh: { name: '执行任务', description: '并行执行当前已经就绪的任务' }, en: { name: 'Execute Tasks', description: 'Executes the tasks that are currently ready, in parallel.' } },
  { id: 'spec-code-review', zh: { name: 'Code Review', description: 'Review 指定的改动范围，列出可复现且由本次改动引入的、确实会被触发的问题' }, en: { name: 'Code Review', description: 'Reviews the specified change range and lists the reproducible problems that this change introduced and that will actually be triggered.' } },
  { id: 'spec-comments', zh: { name: '落实评审意见', description: '将评审意见逐条修改到指定 Spec 文档的对应位置后重新校验' }, en: { name: 'Apply Review Comments', description: 'Applies each review comment to the corresponding place in the specified spec document, then validates the document again.' } },
  { id: 'spec-acceptance', zh: { name: '定义验收', description: '编写一个用户可见目标、可度量的成功标准与验证方式，明确「完成」的判定标准' }, en: { name: 'Define Acceptance', description: 'Writes one user-visible goal, measurable success criteria, and verification methods, making clear what counts as done.' } },
  { id: 'spec-fta', zh: { name: 'FTA 审查', description: '调查需求文档与实际改动，排查遗漏、越界、漂移与回归等问题' }, en: { name: 'FTA Review', description: 'Investigates the requirements document and the actual changes, checking for omissions, out-of-scope work, drift, regressions, and similar issues.' } },
  { id: 'spec-complete', zh: { name: '完成交付', description: '逐条核对验收标准，执行 FTA 并将 Spec 推进至完成状态，生成交付报告' }, en: { name: 'Complete & Deliver', description: 'Checks each acceptance criterion, runs FTA, advances the spec to done, and generates the delivery report.' } },
  { id: 'spec-run', zh: { name: '自主跑完', description: '从当前 Spec 状态开始，创建一个 DeepSeek Harness goal 并自动循环：执行任务、核对验收、运行 FTA；FTA 失败时只修实现并重跑，直到无 Blocker 且回归无新增失败' }, en: { name: 'Auto Run', description: 'Starts one DeepSeek Harness goal from the current spec state and loops task execution, acceptance, and FTA; on failure it fixes only the implementation and re-runs until no blocker and no new regression remains.' } },
  { id: 'spec-delivery', zh: { name: '生成交付报告', description: '依据 Spec 当前状态、任务、验收、验证记录、FTA 结论与门禁历史生成交付报告' }, en: { name: 'Build Delivery', description: 'Generates the delivery report from the spec’s current state, tasks, acceptance, verification record, FTA verdict, and gate history.' } },

  // Routine operations and maintenance.
  { id: 'spec-status', zh: { name: 'Spec状态', description: '查看 Spec 当前阶段、已有文档、任务总数，以及进行中与就绪的任务' }, en: { name: 'Spec Status', description: 'Shows the spec’s current phase, the documents in place, the total task count, and the tasks in progress or ready.' } },
  { id: 'spec-list', zh: { name: 'Spec列表', description: '列出全部在用 Spec，含类型、工作流、阶段与更新时间' }, en: { name: 'List Specs', description: 'Lists every active spec with its type, workflow, phase, and update time.' } },
  { id: 'spec-sync', zh: { name: '同步Spec', description: '以实际 Spec 文件为准校正 Spec 状态，并报告推断出的阶段、任务数，以及缺失或不合规的文档' }, en: { name: 'Sync Spec', description: 'Corrects the spec state against the actual spec files, and reports the inferred phase, task counts, and any missing or non-compliant documents.' } },
  { id: 'spec-refine', zh: { name: '精修Spec', description: '仅修改选中文本所在的章节并重新校验，标题、EARS 写法、任务标记与结构保持不变' }, en: { name: 'Refine Spec', description: 'Edits only the section containing the selected text and validates again; headings, EARS wording, task markers, and structure stay unchanged.' } },
  { id: 'spec-rename', zh: { name: '重命名Spec', description: '重命名 Spec 并更新指向其自身的路径引用与评审文件后重新校验' }, en: { name: 'Rename Spec', description: 'Renames a spec, updates the path references and review files that point to it, then validates again.' } },
  { id: 'spec-batch', zh: { name: '批量执行', description: '多个 Spec 依次执行并完成，支持无人值守运行' }, en: { name: 'Batch Run', description: 'Runs and completes several specs in sequence, with support for unattended runs.' } },
  { id: 'spec-archive', zh: { name: '归档Spec', description: '归档已完成的 Spec 或恢复 Spec' }, en: { name: 'Archive Spec', description: 'Archives a completed spec, or restores a spec.' } },
  { id: 'spec-memory', zh: { name: '沉淀记忆', description: '提炼值得长期保留的项目经验，例如构建测试命令、路径约定、常见坑与明确偏好，确认后可更新到AGENTS.md' }, en: { name: 'Distill Memory', description: 'Distills project experience worth keeping long-term, such as build and test commands, path conventions, common pitfalls, and explicit preferences; after confirmation, it can be written to AGENTS.md.' } },
  { id: 'spec-summarize', zh: { name: '交接总结', description: '简明交接说明，涵盖所用技术、改动的文件、已解决与未解决的问题、Spec 阶段及下一步动作' }, en: { name: 'Summarize Handoff', description: 'A concise handoff covering the technologies used, the files changed, the issues resolved and still open, the spec phase, and the next action.' } },
]

export const KAZE_COMMAND_ALIASES: ReadonlyMap<string, string> = new Map([
  ...KAZE_COMMANDS.flatMap((command): [string, string][] => [
    [command.id, command.id],
    [command.zh.name, command.id],
    [command.en.name, command.id],
    [command.en.name.toLowerCase(), command.id],
  ]),
  // Legacy English label kept as an alias after the Vibe Coding rename.
  ['Vibe', 'vibe'],
  // Legacy display names kept as aliases after the rules/steering rename.
  ['项目规约', 'spec-rules'],
  ['Project Rules', 'spec-rules'],
  ['project rules', 'spec-rules'],
  ['项目约定', 'spec-steering'],
  ['Steering Files', 'spec-steering'],
  ['steering files', 'spec-steering'],
])

export function commandTexts(language: KazeLanguage): readonly (KazeCommandText & { id: string })[] {
  return KAZE_COMMANDS.map((command) => ({ id: command.id, ...(language === 'en' ? command.en : command.zh) }))
}
