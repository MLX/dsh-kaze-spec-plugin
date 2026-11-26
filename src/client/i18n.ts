/** Kaze tab copy. English strings are the dictionary keys; Chinese is the default. */
import { kazeCommandLanguage } from './command-menu'

const zh: Record<string, string> = {
  'Looking for specs…': '正在查找 Spec…',
  'Open a workspace session to use Kaze.': '打开一个工作区会话后即可使用 Kaze。',
  'Pick a way to start, or ask the agent to draft one.': '选一种开始方式，或让 Agent 起草。',
  'Start': '开始',
  'Start Wish': '开始许愿',
  'Turn a vague wish into a ready-to-use prompt.': '把模糊的许愿整理成可直接使用的提示词。',
  'Wish → Prompt': '许愿 → 提示词',
  'Describe your wish': '描述你的许愿',
  'For example: add a login page with email and password': '例如：增加一个用邮箱和密码登录的页面',
  'Wish': '许愿',
  'Send to chat': '发送到对话',
  'Wishing…': '许愿中…',
  'Prompt ready': '提示词已就绪',
  'The prompt is filled in as /spec. Pick a route, or keep refining.': '提示词已按 /spec 填入对话输入框，可选择路线或继续补充。',
  'Keep refining': '继续补充',
  'Add more detail, then refine again.': '补充细节后再次整理。',
  'Next step': '下一步',
  'Choose a route': '选择路线',
  'Step-by-step review': '逐阶段审阅',
  'Clarify first, then write one document per phase.': '先澄清需求，再逐阶段产出文档。',
  'One-shot Spec': '一站式Spec',
  'Clarify once, then requirements, design, and tasks in one turn.': '澄清一次，一次性产出需求、设计、任务。',
  'Wish refinement failed': '提示词生成失败',
  'New Spec': '新建Spec',
  'Start from requirements and pass each phase gate.': '从需求开始，逐阶段过门禁。',
  'Requirements → Design → Tasks': '需求 → 设计 → 任务',
  'Quick Spec': '快速Spec',
  'One idea, smallest flow to a working spec.': '一句话想法，用最小流程跑通。',
  'Idea → Requirements': '想法 → 需求',
  'New Bugfix': '新建Bugfix',
  'Reproduce first, then fix and verify.': '先复现再修，验证后收尾。',
  'Reproduce → Fix → Verify': '复现 → 修复 → 验证',
  'Ask the agent': '让 Agent 处理',
  'Undo': '撤销',
  'Clear': '清空',
  'Confirm clear': '确认清空？',
  'Save failed': '保存失败',
  'Saving…': '保存中…',
  'Saved to .kaze': '已保存到 .kaze',
  'Local only': '仅本地',
  'Ready': '就绪',
  'Retry save': '重试保存',
  'Review comments cleared': '评审评论已清空',
  'Comment deleted': '评论已删除',
  'Comment restored': '评论已恢复',
  'Comments restored': '评论已恢复',
  'Delete': '删除',
  'Jump': '定位',
  'Edit': '编辑',
  'Resolve': '解决',
  'Reopen': '重新打开',
  'resolved': '已解决',
  'refine': '精修',
  'Add comment': '添加评论',
  'Send review': '发送评审',
  'Prompt': '提示词',
  'Copy': '复制',
  'open': '未解决',
  'total': '总计',
  'This document may have changed or been deleted on disk.': '这份文档可能已在磁盘上被修改或删除。',
  'Working…': '处理中…',
  'Could not read archived specs.': '无法读取已归档的 Spec。',
  'Could not read saved comments': '无法读取已保存的评论',
  'Expand to fullscreen': '全屏展开',
  'Contents': '目录',
  'The spec list is incomplete; too many entries.': 'Spec 列表不完整：条目过多。',
  'needs repair': '需修复',
  'Collapse tasks': '收起任务',
  'Expand tasks': '展开任务',
  'Collapse idle queue': '收起空闲队列',
  'Expand idle queue': '展开空闲队列',
  'Document outline': '文档大纲',
  'Document source': '文档源码',
  'Sync requirements, design, and tasks now': '立即同步需求、设计与任务',
  'Ask the agent to sync requirements, design, and tasks': '让 Agent 同步需求、设计与任务',
  'Run the validator now and list every issue': '立即运行校验并列出所有问题',
  'Ask the agent to run the validator': '让 Agent 运行校验',
  'Document': '文档',
  'How should this section change?': '这一节应如何修改？',
  'What should change here?': '这里要改什么？',
  'Idle cost is this fraction of peak cost': '空闲成本占高峰成本的比例',
  'Loading comments…': '正在加载评论…',
  'Loading specs…': '正在加载 Spec…',
  'Refine section': '精修本节',
  'select text to comment': '选中文本即可评论',
  'Sync': '同步',
  'Continue': '继续',
  'Validate': '校验',
  'Run all': '全部执行',
  'Queue': '空闲队列',
  'Review': '评审',
  'Find': '查找',
  'Preview': '预览',
  'Source': '源码',
  'Diff': '差异',
  'Tasks': '任务',
  'Timeline': '时间线',
  'Optional / deferred': '可选 / 延后',
  'required': '必需',
  'ready': '就绪',
  'Completion': '完成情况',
  'Acceptance': '验收',
  'FTA': 'FTA 审查',
  'Verification': '验证',
  'Delivery': '交付',
  'Gates': '门禁',
  'Build': '构建',
  'Build delivery.md now': '立即构建交付报告',
  'Archive': '归档',
  'Archive the spec': '归档Spec',
  'Confirm archive': '确认归档',
  'Rebuild delivery.md': '重建交付报告',
  'Advance to done': '推进到完成',
  'Run FTA and finish': '运行 FTA 审查并收尾',
  'Decide acceptance and finish': '决定验收并收尾',
  'Verify acceptance and finish': '验收并收尾',
  'Record verification and finish': '记录验证并收尾',
  'Fix FTA blockers, then re-run completion': '修复 FTA 审查问题后重新收尾',
  'Resolve FTA and finish': '处理 FTA 审查并收尾',
  'Cancel': '取消',
  'Back': '返回',
  'Create': '创建',
  'New spec': '新建 Spec',
  'Rename': '重命名',
  'Archived': '已归档',
  'Back to active specs': '返回活跃 Spec',
  'Filter archived specs': '筛选已归档的 Spec',
  'Active': '活跃',
  'Restore': '恢复',
  'Spec list': 'Spec 列表',
  'Feature': '功能',
  'Bugfix': '缺陷',
  'Bugfix specs are always brownfield.': '缺陷 Spec 固定为存量项目。',
  'Filter specs': '筛选Spec',
  'Refresh': '刷新',
  'Settings': '设置',
  'Sort by dependencies': '按依赖排序',
  'Run queue': '执行队列',
  'Idle queue': '空闲队列',
  'idle now': '空闲中',
  'peak': '高峰',
  'queued': '已排队',
  'No queued tasks. Tick a task in the task panel to defer it.': '队列为空。可在任务面板勾选任务加入空闲队列。',
  'Validation': '校验结果',
  'Retry': '重试',
  'Close': '关闭',
  'Dismiss validation report': '关闭校验结果',
  'Previous document': '上一篇文档',
  'Next document': '下一篇文档',
  'Rendered Markdown': '渲染视图',
  'Show source': '查看源码',
  'Side-by-side changes since this document was opened': '自打开以来的并排差异',
  'Find in document': '在文档中查找',
  'Review comments': '评审评论',
  'Open in DeepSeek Harness file preview': '在 DeepSeek Harness 文件预览中打开',
  'Copy the document path': '复制文档路径',
  'Copy review prompt': '复制评审提示',
  'Previous match': '上一个匹配',
  'Next match': '下一个匹配',
  'Close find': '关闭查找',
  'Rename this spec': '重命名此Spec',
  'Start a new spec': '开始新的 Spec',
  'Archive this completed spec': '归档此已完成Spec',
  'Refresh specs and document': '刷新Spec和文档',
  'Spec content language': 'Spec 内容语言',
  'Spec scope': 'Spec 范围',
  'Current spec phase': '当前Spec阶段',
  'Spec phase': 'Spec 阶段',
  'Completed tasks': '已完成任务',
  'Completion stages': '完成阶段',
  'No acceptance.md': '无 acceptance.md',
  'no acceptance.md': '无 acceptance.md',
  'no verification.md': '无 verification.md',
  'verification.md': 'verification.md',
  'generated': '自动生成',
  'approved': '已批准',
  'failed': '失败',
  'pending': '待处理',
  'skipped': '已跳过',
  'none': '无',
  'fresh': '最新',
  'stale': '过期',
  'missing': '缺失',
  'optional': '可选',
  'Not defined': '未定义',
  'Not run': '未运行',
  'Not required': '无需',
  'To record': '待记录',
  'Not generated': '待生成',
  'Build delivery report': '构建交付报告',
  'task': '任务',
  'done': '完成',
  'running': '执行中',
  'Feature name': 'Spec 名称',
  'New feature name': '新 Spec 名称',
  'Type': '类型',
  'Scope': '范围',
  'analysis': '分析',
  'Workflow route': '流程路线',
  'Requirements first': '先写需求',
  'Design first': '先写设计',
  'Verify first': '先验证需求',
  'Design detail': '设计详细度',
  'Comprehensive': '完整',
  'High level': '高层',
  'Low level': '低层',
  'Feature request (optional)': '需求描述（可选）',
  'Optional: describe what this spec builds': '可选：简述这个 Spec 要做什么',
  'Could not read': '无法读取',
  'Loading': '加载中',
  'No changes': '无变更',
  'Changes since opened': '自打开以来的变更',
  'Baseline': '基线',
  'Working copy': '工作副本',
  'Set baseline': '设为基线',
  'The working copy matches the baseline taken when this document was opened.': '当前文档与打开时记录的基线一致。',
  'Turn': '回合',
  'files': '个文件',
  'docs': '文档',
  'Comment': '评论',
  'Refine': '精修',
  'Line': '行',
  'Copy selection': '复制选区',
  'Refine this section': '精修本节',
  'No evidence recorded.': '暂无证据记录。',
  'Completion is unavailable': '完成情况不可用',
  'The Host Remote may be offline.': 'Host Remote 可能离线。',
  'Unknown Host failure': '未知的 Host 失败。',
  'Idle queue is unavailable': '空闲队列不可用',
  'If this stays empty, use Refresh or Continue.': '如果一直为空，请使用刷新或继续。',
  "The agent moves the directory, updates the spec's own path references, and validates the result.": 'Agent 会移动目录、更新 Spec 自身的路径引用并执行校验。',
  'Open the idle-time queue; tick tasks in the task panel to defer them': '打开空闲队列；在任务面板中勾选任务即可延后。',
  'Note': '备注',
  'Idle window is active.': '空闲时段进行中。',
  'Next idle': '下次空闲',
  'Next peak': '下次高峰',
  'Peak ends': '高峰结束',
  'Beijing time': '北京时间',
  'Set a peak cost to estimate idle cost': '设置高峰成本以估算空闲成本',
  'Peak → idle cost': '高峰 → 空闲成本',
  'Run queued tasks now (idle window is active)': '立即执行队列（空闲时段进行中）',
  'Queue is empty': '队列为空',
  'Idle window starts': '空闲时段开始于',
  'anchor moved': '锚点已移动',
  'Archive is armed. Click Confirm archive to move this spec; it can be restored later.': '归档已就绪。点击“确认归档”移动该 Spec；之后可以恢复。',
  'Collapse completion': '收起完成情况',
  'Expand completion': '展开完成情况',
  'Send the review prompt to the current conversation (runs through the agent)': '把评审提示发送到当前对话（由 Agent 执行）',
  'Close image preview': '关闭图片预览',
  'Loading document…': '正在加载文档…',
  "Open DeepSeek Harness's native changed-files review for this turn": '打开 DeepSeek Harness 本回合的原生变更文件评审',
  'View tasks.md': '查看任务文档',
  'Tick a task to add it to the idle queue; run the queue during an idle window.': '勾选任务即可加入空闲队列；在空闲时段执行队列。',
  'No tasks yet': '还没有任务',
  'Idle': '空闲',
  'Remove from the idle queue': '从空闲队列移除',
  'Ticked tasks wait in this queue; during an idle window, Run queue sends them to the agent as one batch.': '勾选的任务会排在这里；进入空闲时段后点“执行队列”，会把它们作为一批任务交给 Agent 执行。',
  'No specs yet': '还没有 Spec',
  'Select a spec': '选择 Spec',
  'No matching specs.': '没有匹配的 Spec。',
  'No archived specs.': '没有已归档的 Spec。',
  'No requirements.md yet': '还没有 requirements.md',
  'No design.md yet': '还没有 design.md',
  'No tasks.md yet': '还没有 tasks.md',
  'No bugfix.md yet': '还没有 bugfix.md',
  'Use Continue to have the agent write it, then refresh.': '点击“继续”让 Agent 编写，然后刷新。',
  'Execute every ready task — sends to the agent': '执行所有就绪任务（发送给 Agent）',
  'Open DeepSeek Harness Timeline for live agent tasks': '打开 DeepSeek Harness 时间线',
  'Queue this task for idle time': '将此任务加入空闲队列',
  'Brownfield feature specs must record verification.md before done.': '存量项目 Spec 完成前必须记录 verification.md。',
  'Generated from spec state; edits are overwritten when the report is rebuilt.': '由 Spec 状态生成；重建报告会覆盖手改。',
  'Document view': '文档视图',
  'Spec documents': 'Spec 文档',
  'Idle config JSON': '空闲配置 JSON',
  'Save settings': '保存设置',
  'Edit cost and note': '编辑成本与备注',
  'Remove from queue': '从队列移除',
  'Move up': '上移',
  'Move down': '下移',
  'errors': '个错误',
  'warnings': '个警告',
  'Save': '保存',
  'recorded': '已记录',
  'idle ×': '空闲 ×',
  'deps': '依赖',
  'Peak': '高峰',
  'Idle now': '空闲中',
  'No workspace selected': '未选择工作区',
  'checked': '已勾选',
  'now': '立即',
  'agent': 'Agent',
  'Execute': '执行',
  'Verify': '验证',
  'just now': '刚刚',
  'm ago': '分钟前',
  'h ago': '小时前',
  'd ago': '天前',
}

/** One space at every Chinese/Latin (letter or digit) boundary, applied consistently. */
function spaceCjk(text: string): string {
  return text
    .replace(/([\u3400-\u9fff])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([\u3400-\u9fff])/g, '$1 $2')
}

export function tr(text: string): string {
  if (kazeCommandLanguage() === 'en') return text
  const translated = zh[text]
  return spaceCjk(translated === undefined ? text : translated)
}

/**
 * Toast copy is written inline at each action site, often with dynamic values.
 * Translate the known shapes here once so every notification follows the UI
 * language without threading i18n keys through every call.
 */
const notificationPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Validation passed for (.+)$/, '校验通过：$1'],
  [/^Validation failed: (\d+) error\(s\), (\d+) warning\(s\); (.*)$/, '校验失败：$1 个错误，$2 个警告；$3'],
  [/^Validation failed: (.+)$/, '校验失败：$1'],
  [/^Delivery report built for (.+)$/, '交付报告已生成：$1'],
  [/^Delivery build failed: (.+)$/, '交付构建失败：$1'],
  [/^(\S+) synced$/, '$1 已同步'],
  [/^Sync failed: (.+)$/, '同步失败：$1'],
  [/^Renamed (.+) → (.+)$/, '已重命名 $1 → $2'],
  [/^Rename failed: (.+)$/, '重命名失败：$1'],
  [/^Archived (.+)$/, '已归档 $1'],
  [/^Archive failed: (.+)$/, '归档失败：$1'],
  [/^Restored (.+)$/, '已恢复 $1'],
  [/^Restore failed: (.+)$/, '恢复失败：$1'],
  [/^(.+) already exists\.$/, '$1 已存在。'],
  [/^Queued (.+) for idle time$/, '已将 $1 加入空闲队列'],
  [/^Removed (.+) from the idle queue$/, '已将 $1 从空闲队列移除'],
  [/^(.+) advanced to done$/, '$1 已推进到完成'],
  [/^Could not complete (.+): (.+)$/, '无法完成 $1：$2'],
  [/^Could not create (.+): (.*)$/, '无法创建 $1：$2'],
  [/^Cannot complete (.+?)( \(.+\))?: (.*)$/, '无法完成 $1$2：$3'],
  [/^Feature names use lowercase letters, digits, and dashes; start and end with a letter or digit\.$/, '名称使用小写字母、数字和短横线，并以字母或数字开头和结尾。'],
  [/^This issue is not in an available spec document\.$/, '该问题不在可用的 Spec 文档中。'],
  [/^(.+) has no tab action; the agent will run it\.$/, '$1 没有页签内动作，将由 Agent 执行。'],
  [/^No action available for (.+)\.$/, '$1 暂无可用动作。'],
  [/^Idle window is not active(.*)\.$/, '当前不在空闲时段$1。'],
  [/^Idle queue: (.+)$/, '空闲队列：$1'],
  [/^Create (.+) sent to chat$/, '已发送创建 $1 的任务到对话'],
  [/^Task (.+) sent to chat$/, '任务 $1 已发送到对话'],
  [/^Review sent for (.+)$/, '已发送 $1 的评审'],
  [/^Refine request sent to chat$/, '修改请求已发送到对话'],
  [/^Continue task sent to chat$/, '继续任务已发送到对话'],
  [/^Validation task sent to chat$/, '校验任务已发送到对话'],
  [/^Sync task sent to chat$/, '同步任务已发送到对话'],
  [/^Execution task sent to chat$/, '执行任务已发送到对话'],
  [/^Delivery build sent to chat$/, '交付构建已发送到对话'],
  [/^Completion task sent to chat$/, '收尾任务已发送到对话'],
  [/^Idle queue sent to chat$/, '空闲队列已发送到对话'],
  [/^Wish flow sent to chat$/, '许愿流程已发送到对话'],
  [/^Filled (\/\S+) into the chat box$/, '已把 $1 填入对话输入框'],
  [/^(.+) sent to chat$/, '$1 已发送到对话'],
  [/^Spec content language: (English|简体中文)$/, 'Spec 内容语言：$1'],
  [/^Language update failed: (.+)$/, '语言更新失败：$1'],
  [/^Could not save review comments: (.*)$/, '无法保存评论：$1'],
  [/^(.+) is not in an available spec document\.$/, '$1 不在可用的 Spec 文档中。'],
  [/^This surface has no chat composer\.$/, '此界面没有可用的对话输入框。'],
  [/^Describe the refinement first\.$/, '请先说明这一节要怎么改。'],
  [/^Saved comments are still loading\.$/, '已保存的评论还在加载。'],
  [/^Write the comment first\.$/, '请先写评论内容。'],
  [/^Comment added$/, '评论已添加'],
  [/^Comments restored$/, '评论已恢复'],
  [/^Review comments cleared$/, '评论已清空'],
  [/^Comment restored$/, '评论已恢复'],
  [/^Comment deleted$/, '评论已删除'],
  [/^Clipboard unavailable; select the text to copy it\.$/, '剪贴板不可用，请手动选择文本复制。'],
  [/^That name is reserved for a Kaze bookkeeping directory\.$/, '该名称为 Kaze 的保留目录名，请换一个。'],
  [/^That is already the current name\.$/, '这已经是当前名称。'],
  [/^Only done specs can be archived\. Advance the spec to done first\.$/, '只有已完成的 Spec 才能归档，请先推进到完成。'],
  [/^Archive armed\. Click Archive again to confirm\.$/, '归档已就绪，再次点击“归档”确认。'],
  [/^Add at least one open comment first\.$/, '请先添加至少一条未解决评论。'],
  [/^Review comments could not be saved; nothing was sent\.$/, '评论保存失败，未发送任何内容。'],
  [/^No ready tasks; check the dependency graph\.$/, '没有就绪任务，请检查任务依赖图。'],
  [/^Idle queue requires the native Kaze engine\.$/, '空闲队列需要原生 Kaze 引擎。'],
  [/^The idle queue has no runnable entries\.$/, '空闲队列没有可执行条目。'],
  [/^Baseline updated$/, '基线已更新'],
  [/^Idle config is not valid JSON\.$/, '空闲配置不是有效的 JSON。'],
  [/^Select text inside one paragraph to comment\.$/, '请在一个段落内选择文本后再评论。'],
  [/^Select text inside one paragraph to refine\.$/, '请先在同一段落内选中要精修的文字。'],
  [/^Path copied$/, '路径已复制'],
  [/^Selection copied$/, '选区已复制'],
  [/^Review prompt copied$/, '评审提示已复制'],
  [/^List task sent to chat$/, '列表任务已发送到对话'],
]

/** Localize a toast that was written at its action site. */
export function notificationText(text: string): string {
  if (kazeCommandLanguage() === 'en') return text
  for (const [pattern, replacement] of notificationPatterns) {
    if (pattern.test(text)) return text.replace(pattern, replacement)
  }
  return text
}

export function phaseText(phase: string): string {
  const labels: Record<string, string> = {
    initial: '初始',
    requirements: '需求',
    design: '设计',
    tasks: '任务',
    execute: '执行',
    done: '完成',
  }
  return kazeCommandLanguage() === 'en' ? (phase === '' ? 'unknown' : phase[0]!.toUpperCase() + phase.slice(1)) : (labels[phase] ?? phase)
}

export function scopeText(scope: string): string {
  if (kazeCommandLanguage() === 'en') return scope
  if (scope === 'brownfield') return '存量项目'
  if (scope === 'greenfield') return '全新项目'
  return '未知'
}

export function workflowText(workflow: string): string {
  if (kazeCommandLanguage() === 'en') return workflow
  if (workflow === 'design-first') return '先写设计'
  if (workflow === 'verify-first') return '先验证需求'
  if (workflow === 'bugfix') return '缺陷修复'
  if (workflow === 'requirements-first') return '先写需求'
  return workflow === '' ? '未知' : workflow
}

export function detailText(detail: string): string {
  if (kazeCommandLanguage() === 'en') return detail
  if (detail === 'high') return '高层'
  if (detail === 'low') return '低层'
  if (detail === 'comprehensive') return '完整'
  return detail === '' ? '未知' : detail
}

export function typeText(type: string): string {
  if (kazeCommandLanguage() === 'en') return type
  return type === 'bugfix' ? '缺陷' : '功能'
}

export function statusText(status: string): string {
  if (kazeCommandLanguage() === 'en') return status === '' ? 'none' : status
  const labels: Record<string, string> = {
    approved: '已批准', failed: '失败', pending: '待处理', skipped: '已跳过', none: '无',
    queued: '已排队', running: '执行中', done: '完成',
  }
  return labels[status] ?? (status === '' ? '无' : status)
}

export function gateName(name: string): string {
  if (kazeCommandLanguage() === 'en') return name
  if (name === 'acceptance') return '验收'
  if (name === 'fta') return 'FTA 审查'
  return name
}

export function actionText(id: string, fallback: string): string {
  if (kazeCommandLanguage() === 'en') return fallback
  const labels: Record<string, string> = {
    requirements: '编写需求',
    bugfix: '新建Bugfix',
    design: '编写设计',
    tasks: '编写任务',
    'tasks-empty': '补充必需任务',
    apply: '执行任务',
    acceptance: '定义验收',
    complete: '完成交付',
    'fta-fix': '修复 FTA 审查问题',
    rework: '返工修复',
    verification: '记录验证并收尾',
    done: '推进到完成',
    archive: '归档Spec',
    delivery: '生成交付报告',
    fta: 'FTA 审查',
    validate: '校验Spec文档',
  }
  return labels[id] ?? fallback
}

export function docText(doc: string): string {
  if (kazeCommandLanguage() === 'en') return doc
  const labels: Record<string, string> = { requirements: '需求', design: '设计', tasks: '任务', bugfix: '缺陷' }
  return labels[doc] ?? doc
}

export function docShortText(doc: string): string {
  if (kazeCommandLanguage() === 'en') return doc === 'requirements' ? 'Req' : doc[0]!.toUpperCase() + doc.slice(1)
  const labels: Record<string, string> = { requirements: '需求', design: '设计', tasks: '任务', bugfix: '缺陷' }
  return labels[doc] ?? doc
}

/** "Line 3" in the active UI language. */
export function lineText(line: number): string {
  return kazeCommandLanguage() === 'en' ? `Line ${line}` : `第 ${line} 行`
}

/** Compact calendar date for list rows: MM-DD this year, YYYY-MM-DD otherwise. */export function dateText(iso: string, now = Date.now()): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  const date = new Date(at)
  const current = new Date(now)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return date.getFullYear() === current.getFullYear() ? `${month}-${day}` : `${date.getFullYear()}-${month}-${day}`
}

export function relativeText(iso: string, now = Date.now()): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  if (kazeCommandLanguage() === 'en') {
    const delta = Math.max(0, now - at)
    const minute = 60_000
    if (delta < minute) return 'just now'
    if (delta < 60 * minute) return `${Math.floor(delta / minute)}m ago`
    if (delta < 24 * 60 * minute) return `${Math.floor(delta / (60 * minute))}h ago`
    return `${Math.floor(delta / (24 * 60 * minute))}d ago`
  }
  const delta = Math.max(0, now - at)
  const minute = 60_000
  if (delta < minute) return '刚刚'
  if (delta < 60 * minute) return `${Math.floor(delta / minute)} 分钟前`
  if (delta < 24 * 60 * minute) return `${Math.floor(delta / (60 * minute))} 小时前`
  return `${Math.floor(delta / (24 * 60 * minute))} 天前`
}

