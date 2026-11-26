# Kaze Spec

[English](README.md) | 中文

**面向 DeepSeek Harness 的规格驱动开发：许愿式编程，一键成真**

把一句模糊的许愿，变成有门禁、可复现的交付。

先澄清，再写需求与设计，拆成可执行任务，完成实现，证明验收，并把结果沉淀为持续演进的能力记录。

Kaze 是一个 DeepSeek Harness 插件，专门解决“事情还没想清楚，AI 已经动手写代码”这个常见问题。

用起来可以很简单：你许个愿，Kaze 把它整理成一份 Spec，不复杂，就是 `.kaze/` 下的一组文件，写清楚要做什么、准备怎么做、什么算完成、拿什么证明。

聊完的会话可以关掉，文件会留下。

## 为什么 Kaze

大多数编码助手都能根据一句话写出代码。

真正难的是：几个小时、几个会话之后，请求、设计、任务、实现和完成证据还能对得上。

你大概也遇到过：说一句，AI 写一堆，方向不对；聊到一半，开头说的限制忘了；代码改了，没人说得清到底验没验；换个会话，进度全没了。

Kaze 把这种一致性变成明确、可被机器检查的东西：

- **文件优先于对话：** 需求、设计、任务、状态、门禁、评审意见和执行证据全部落在 `.kaze/`。
- **每个阶段都有门禁：** 引擎在阶段推进前检查文档结构、可追溯性、任务 DAG 完整性、执行证据、验收和 FTA。
- **强制可追溯：** 每个叶子任务都要引用它实现的需求验收标准；每条正确性属性都要引用它验证的标准。
- **规划与执行分离：** 写 Spec 的会话不能直接执行它；执行必须在新会话中读取文件后开始。
- **完成必须有证据：** 验收和 FTA 决策会记录具体证据，并绑定到批准时的文档哈希。
- **成果持续存在：** 被接受的需求可以合并到 `.kaze/specs/` 下的能力 Spec，下一次修改从项目真实积累的行为出发。

## 你能得到什么

- **一个清楚的入口：** 可以只整理一个模糊的许愿，也可以直接开完整 Spec、快速 Spec、Bugfix，或者干脆直接改代码。
- **一份能评审的计划：** 需求、设计、任务、权衡取舍都在文件里，不在聊天记录里。
- **一个工作台：** 右侧边栏可以看文档、任务、校验、评审意见、归档和设置，不用对着 JSON。
- **一套能收尾的流程：** 执行、批量或自动跑完；验收、FTA、交付和归档都会留下记录。

## 环境要求

| 要求 | 说明 |
|---|---|
| DeepSeek Harness `0.2.2-rc.5` 或更新 | 无 |
| Node.js 24.9 或更新 | 无 |
| Git | `/spec-batch --worktree` 需要。 |
| DSH **Change requests & worktrees** | 可选；只用于 `--worktree`。 |
| DSH **Agent Team** | 可选；没有也能用。 |
| 带 Timeline 的 DSH 构建 | 可选；只有 Timeline 交接需要。 |

## 安装

### 从 GitHub 安装

Web UI：**Settings → Plugins → Add plugin → Install third-party plugin**，输入：

```text
github:MLX/dsh-kaze-spec-plugin
```

需要固定版本时：

```text
github:MLX/dsh-kaze-spec-plugin#<完整 commit>
```

或者用 CLI：

```bash
dsh plugin --profile <profile> add github:MLX/dsh-kaze-spec-plugin
dsh web
```

显式的 `git+https://github.com/MLX/dsh-kaze-spec-plugin.git` 形式在 pnpm 下也可以用；`lib/` 已经提交，也没有 `prepare` 脚本，所以 Git 安装不需要 build-script 授权。

### 从本地目录安装

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-kaze-spec-plugin
dsh web
```

路径必须是绝对路径；Web UI 里把路径粘贴到同一个 **Install third-party plugin** 对话框即可。

### 第一次用

1. 重启 DeepSeek Harness。
2. 在工作区里开一个**新会话**。
3. 在模式选择器里选 **Kaze 规格驱动开发**。
4. 打开右侧边栏，选 **Kaze Spec-Driven Development**。
5. 输入 `/`，打开命令菜单。

不需要复制工作区模板：命令 skill 是插件自带的，插件自己的硬规则在 `core/plugin-rules.md`，只有运行 Kaze 命令时才读；不要把那个文件改名成 `AGENTS.md`，DSH 会把它当成工作区指令，每个会话都注入。

工作区规则是另一回事：工作区里有 `AGENTS.md` 时，Kaze 会读它，`/spec-rules` 也只维护那个文件。

## 最基本的流程

大多数时候，三个命令就够了：

```text
/spec-wish 我想实现一个登录页面
/spec 我想实现一个登录页面
/spec-apply feature=login-page
```

`/spec-wish` 只整理许愿，不写代码，也不启动 Spec；整理好的提示词会存到 `.kaze/wishes/`，你可以直接拿它去跑 `/spec`。

`/spec` 是引导创建流程：它会一个个问设置问题，然后开始多轮澄清，最后你会拿到需求、设计、任务；中间停几次，取决于你选的模式。

`/spec-apply` 是执行，要在一个**新会话**里跑；它读文件、做就绪任务、写证据，不加 `--complete` 的话，不会顺手做验收和 FTA。

如果只记一条规则：**规划在一个会话，执行换一个会话**。

## 什么时候用哪个

| 你的情况 | 用哪个 |
|---|---|
| 只有一句模糊想法 | `/spec-wish` |
| 想完整走一遍，阶段性地看文档 | `/spec` |
| 想快一点，问几个问题就出文档 | `/spec-quick` |
| 澄清一次，然后一轮写完规划文档 | `/spec-flow` |
| 想先把需求验证一遍再设计 | `/spec-verify-first` |
| 是修 bug | `/spec-bugfix` |
| 只是个小改动 | `/vibe` |
| 只想先看看值不值得做 | `/spec-explore` |
| 需要给一个难决策找证据 | `/spec-research` |

菜单文字会本地化，但插入的 token 始终是稳定的 ASCII 命令 id；DSH 只认 ASCII 斜杠名。

## Spec 模型

### 阶段

| 阶段 | 含义 | 主要文档 |
|---|---|---|
| `initial` | 已创建，澄清中 | `clarify.md` |
| `requirements` | 做什么、为什么 | `requirements.md` 或 `bugfix.md` |
| `design` | 怎么做，包括权衡 | `design.md` |
| `tasks` | 拆成能执行的小任务和波次 | `tasks.md` |
| `execute` | 实现和证据 | `tasks.md` + `exec/` |
| `done` | 验收和 FTA 已记录 | `delivery.md` |

`done` 是终点：阶段只能向前走，归档是可逆的移动，不是删除。

### 路线

所有路线共用同一个阶段指针，区别是先写什么：

```text
requirements-first   requirements.md --> design.md --> tasks.md
design-first         design.md --> requirements.md --> tasks.md
verify-first         stories + model.smt2 + verification.md
                     --> requirements.md --> design.md --> tasks.md
bugfix               bugfix.md --> design.md --> tasks.md
```

快速 Spec 是压缩版的 requirements-first，不是另一条引擎路线。

### 门禁

门禁就是引擎真的会跑的检查清单：

| 门禁 | 检查什么 |
|---|---|
| requirements | 必需标题齐不齐；每条需求有没有至少一个验收标准；澄清记录还有没有未决问题；需求/标准 id 能不能对上。verify-first 还要 `model.smt2` 和检查记录。 |
| design | 必需章节齐不齐，包括 `## Trade-offs`；有没有测试策略；工作区声明了项目规则时，有没有 `## Rules Check`。 |
| tasks | DAG 有没有覆盖所有必需叶子；每个叶子有没有可解析的 `_Requirements: X.Y_`；brownfield 有没有迁移/回归覆盖；bugfix 有没有保持/回归覆盖。 |
| execute | 必需任务是不是都完成了，每个任务有没有 schema 合法的 `exec/evidence/<task-id>.json`。 |
| done | 有没有新的验收决策和 FTA 决策；该有 `verification.md` 的有没有；Spec 有 capability 时有没有合并。 |

严格模式会把校验警告当成门禁失败；关掉一个校验钩子只是跳过它，不会让门禁自动变松。

每个设计都要写清楚：选了哪个方案、否决了哪些替代方案、为什么选它、什么情况下会重新考虑。

缺 `## Trade-offs` 会被设计门禁拒绝；中文标题 `## 权衡` 和 `## 取舍` 也接受。

门禁批准绑定的是文档哈希。

批准之后又改了文档，批准就会过期，要继续就得重新门禁。

### 会话边界

规划和执行是两种工作：创建会话在计划评审后停下；执行会话从文件开始。

| 会话 | 命令 | 工作 |
|---|---|---|
| 创建会话（规划） | `/spec`、`/spec-quick`、`/spec-flow`、`/spec-verify-first`、`/spec-bugfix` | 写文档、跑门禁、做计划评审；然后停止。 |
| 新的执行会话（执行） | `/spec-apply`、`/spec-complete`、`/spec-batch`、`/spec-run` | 读 `.kaze/`、实现、写证据、跑验收和 FTA、直到 `done`。 |

引擎会用 `state.json` 里的会话 id 检查这件事；如果当前会话就是创建这个 Spec 的会话，任务变更、验收/FTA 记录、能力合并，以及推进到 `execute` 或 `done` 都会被拒绝。

### 语言

- 规范性提示词和工具契约是英文。
- Spec 正文跟随工作区 `language`：默认 `zh-CN`，也支持 `en`；注入的 `kaze:spec-context` 块会说明当前设置。
- `language=zh-CN` 时，中文标题和 EARS 写法是预期；任务标记和任务 id 永远不变。
- 菜单和 UI 会本地化，但插入的命令 token 保持 ASCII。

## 流程图

```text
许愿 / 问题 / 想法
        |
        v
/spec-wish  （只整理提示词，不写代码）
        |
        v
/spec  /spec-quick  /spec-flow  /spec-verify-first  /spec-bugfix
        |
        v
clarify.md  （多轮澄清；只在根会话）
        |
        v
requirements.md  -->  design.md  -->  tasks.md
        |                 |                 |
        +------ gate ------+------ gate ------+
                          |
                          v
              execute  （新的执行会话）
                          |
                          v
          acceptance  -->  FTA  -->  done
                          |
                          v
                     delivery.md
```

## 命令

除特别说明外，参数可选。

支持的命令里，省略 `feature=<id>` 表示“当前活动 Spec”。

### 入口

| 命令 | 参数 | 作用 |
|---|---|---|
| `/spec-wish` | `[许愿文本]` | 把模糊的许愿整理成可执行提示词，写入 `.kaze/wishes/<slug>.md`；不实现、不启动 Spec。 |
| `/spec` | `[请求]` | 完整引导创建：分类、逐个设置问题、多轮澄清，然后进入逐阶段或一站式规划。 |
| `/spec-quick` | `[请求]` | 最小完整流程：2–4 个问题，然后一轮内完成需求、设计、任务，只做一次计划评审。 |
| `/spec-flow` | `[请求]` | 多轮澄清，然后一轮内完成需求 → 设计 → 任务，只做一次最终计划评审。 |
| `/spec-verify-first` | `[请求]` | 验证优先路线：用户故事、`model.smt2`、检查、`verification.md`，然后 EARS 需求、设计与任务。 |
| `/spec-rules` | `[规则或修改]` | 维护工作区的 `## Project Rules`。每个设计必须逐条回答 compliant 或 exception；设计门禁强制检查。 |
| `/spec-steering` | `[约定或修改]` | 维护 `.kaze/steering/*.md` 中的建议性工作区约定，每个会话注入一次，不参与门禁。 |
| `/spec-bugfix` | `[缺陷描述]` | Bugfix 路线：记录当前、期望、不变行为；任务顺序为探索测试 → 修复 → 保持 → 回归。 |
| `/vibe` | `[任务]` | 直接编码：目标契约、最小上下文、最小 diff、可证伪检查、常规测试、漂移检查。不产生 Spec 产物。 |

### 规划

| 命令 | 参数 | 作用 |
|---|---|---|
| `/spec-explore` | `[主题或问题]` | 只读探索。给出选项、权衡、风险、未知项，以及做/缓/不做的建议。无产物、无门禁。 |
| `/spec-research` | `[问题]` | 为仓库无法决定的问题做有证据的研究；写 `research.md` 或报告，无法证实的结论明确标注。 |
| `/spec-requirements` | `feature=<id>` | 编写或修复 `requirements.md`；bugfix Spec 则写 `bugfix.md`。整理用户故事和 EARS 验收标准。 |
| `/spec-analyze` | `feature=<id>` | 按歧义、冲突、缺口、不可测标准、逃生条款、故事/标准不匹配等维度独立复核需求，写 `analysis.md`。 |
| `/spec-design` | `feature=<id>` | 按记录的详细度写 `design.md`：架构、接口、数据模型、正确性属性、权衡取舍、错误处理和测试策略。 |
| `/spec-pbt` | `feature=<id>` | 把验收标准映射为正确性属性，补充属性测试任务和桩，用 `kaze_spec_pbt` 记录结果。 |
| `/spec-tasks` | `feature=<id>` | 写 `tasks.md`：可执行叶子、`_Requirements: X.Y_` 追溯、依赖 DAG、并行波次。 |
| `/spec-acceptance` | `feature=<id>` | 写 `acceptance.md`：一个用户可见目标、可度量的成功标准和验证方式。 |
| `/spec-fta` | `feature=<id>` | 独立进行故障树式评审，对照需求与实际改动检查遗漏、越界、漂移、回归。 |
| `/spec-delivery` | `feature=<id>` | 依据状态、任务、验收、验证、FTA 和门禁历史生成 `delivery.md`。 |

### 执行与完成

| 命令 | 参数 | 作用 |
|---|---|---|
| `/spec-apply` | `feature=<id> [--idle 或 --defer-optional] [--complete] [--unattended]` | 按波次执行就绪任务，记录证据；未设置 `--complete` 时在验收/FTA 前停止，且只能在新会话运行。 |
| `/spec-code-review` | `[范围或目标]` | 评审指定改动范围，只报告本次改动引入、可复现且会被触发的文件/行问题。 |
| `/spec-comments` | `feature=<id> [文档] [--comments <路径>]` | 把锚定评审意见落实到一份文档，标记已解决意见，重新校验，必要时重新门禁。 |
| `/spec-complete` | `feature=<id> [--apply] [--idle 或 --defer-optional] [--unattended]` | 执行完成序列：核对任务、验收、FTA、能力合并、推进到 done、生成交付。 |
| `/spec-run` | `feature=<id> [--max-rounds=N]` | 创建一个 DSH goal，自动循环执行 → 验收 → FTA；FTA 之间只修实现和测试，直到 0 个 Blocker 且无新增回归。唯一会创建 goal 的命令。`--max-rounds` 默认 12，上限 64。 |
| `/spec-batch` | `[feature=a 或 features=a,b,c] [--dry-run] [--max-tasks=N] [--complete] [--unattended] [--idle] [--defer-optional] [--worktree] [--resume]` | 顺序执行多个 Spec。`--complete` 逐个完成；`--worktree` 为每个 Spec 使用原生 Git worktree；`--resume` 从 `.kaze/batch/last.json` 继续。 |

### 运维

| 命令 | 参数 | 作用 |
|---|---|---|
| `/spec-status` | `[feature=<id>]` | 显示阶段、文档、任务总数、进行中和就绪任务。 |
| `/spec-list` | 无 | 列出活动 Spec 的类型、流程、阶段和更新时间。 |
| `/spec-sync` | `[feature=<id>]` | 用文件和任务标记校正 `state.json`，报告推断阶段以及缺失或不规范的文档。 |
| `/spec-refine` | `[选中的段落或指令]` | 只修改选中内容所在的章节，保留标题、EARS 写法、任务标记和结构；之后重新校验。 |
| `/spec-rename` | `feature=<旧名> to=<新名>` | 重命名 Spec，并更新它自身的路径引用和评审文件。`execute` 和 `done` 阶段拒绝。 |
| `/spec-archive` | `feature=<id> [force=true]` 或 `restore=true feature=<id>` | 把已完成的 Spec 归档到 `.kaze/archive/YYYY-MM-DD-<feature>`，或恢复一个归档。`force=true` 是显式操作，会跳过能力合并。 |
| `/spec-memory` | `[观察]` | 提炼值得长期保留的项目经验，建议放入可检查的项目规则、steering 约定，或什么都不做。未经确认不会写入。 |
| `/spec-summarize` | 无 | 生成简明交接：所用技术、改动文件、已解决/未解决问题、Spec 阶段和下一步动作。 |

### 几个值得知道的事

- **`/spec` 的设置问题是逐个问的：** 先问检查点模式，再问路线，只有先写设计时才问设计详细度；不会合并成一个表单。
- **`/spec-rules` 改的是工作区，不是插件：** 插件规则在 `core/plugin-rules.md`；工作区规则在工作区自己的 `AGENTS.md`。
- **`/spec-flow` 在 `tasks.md` 后停止：** 唯一一次评审可以启动新的执行会话，但它不会在创建会话里执行。
- **`/spec-run` 是唯一创建 goal 的命令：** 在新执行会话里跑；它默认无人值守，遇到无法安全默认的决策就阻塞。
- **`/spec-batch` 是顺序的：** 不要并行跑两个 Spec；worktree 模式需要 DSH 的 `create_worktree` 和 `working_directory` 工具。
- **`/spec-archive` 从不删除：** 恢复不会回滚已经发生的能力合并。
- **`/spec-refine` 和 `/spec-comments` 不重写整个文件：** 它们只改选中段落或你要求落实的意见。

### 命令示例

```text
/spec-wish 我想实现一个登录页面
/spec 我想实现一个登录页面
/spec-status feature=login-page
/spec-analyze feature=login-page
/spec-comments feature=login-page requirements.md
/spec-apply feature=login-page
/spec-complete feature=login-page --apply
/spec-run feature=login-page --max-rounds=20
/spec-batch features=login-page,search-cache --complete --unattended
/spec-batch --dry-run
/spec-archive restore=true feature=2026-11-25-login-page
```

标签页空状态也可以开始许愿：

- **开始许愿** 打开许愿框。
- **许愿** 把 `/spec <整理后的提示词>` 放进输入框，让整理后的许愿落到 `/spec`，而不是某个阶段命令。
- **发送到对话** 把原始许愿作为 `/spec-wish <许愿>` 发送。
- 后续选项可以继续精修，也可以切到 `/spec`、`/spec-quick`、`/spec-flow`。
- 没有 subagent 服务时，仍使用同样的 `/spec-wish` 发送方式。

## 右侧工作台

想看看现在发生了什么，就打开右侧边栏。

| 区域 | 作用 |
|---|---|
| 空状态 | **开始许愿** 打开许愿框；其他入口路由到 `/spec`、`/spec-quick`、`/spec-flow`。 |
| 阶段时间线 | 显示六个阶段以及每个阶段的文档状态。 |
| 文档视图 | 预览、源码、打开后的 diff；搜索、行号跳转、复制、外部链接。 |
| 评审 | 选中文本添加锚定意见；意见保存到 `reviews/<doc>.json`；可以把生成的简报送进对话，交给 `/spec-comments`。 |
| 任务 | 进度、单任务状态、运行控制、就绪/排队视图、空闲推迟；Timeline 服务存在时可交接。 |
| 校验 | 列出错误和警告；点击后打开对应文档行。 |
| 完成 | 汇总任务、验收、FTA 和下一个合法动作。 |
| 归档与能力 | 浏览归档 Spec 和活能力记录。 |
| 设置 | 全局语言、工作区语言、并行度、严格模式、钩子、Timeline、归档、新 Spec 默认值和空闲队列。 |

## 文件都在哪

```text
<workspace>/
├── .kaze/
│   ├── spec-config.json           # 语言、maxParallel、严格模式等默认值
│   ├── idle-config.json           # 空闲时段和价格倍数
│   ├── idle-queue.json            # 被推迟的可选任务
│   ├── steering/                  # 建议性工作区约定
│   ├── wishes/                    # /spec-wish 产出的整理后许愿
│   ├── specs/<capability>/spec.md # 活能力记录
│   ├── batch/last.json            # 可恢复的 /spec-batch 状态
│   ├── archive/YYYY-MM-DD-<feature>/
│   └── <feature>/
│       ├── state.json             # 权威阶段和历史
│       ├── config.json            # Spec id、类型、范围、路线、详细度
│       ├── clarify.md             # 决策、假设、轮次、未决项
│       ├── requirements.md        # 功能需求（EARS）
│       ├── bugfix.md              # bugfix 变体：当前/期望/不变行为
│       ├── design.md              # 架构、接口、属性、测试
│       ├── tasks.md               # 带 _Requirements_ 和 DAG 的叶子任务
│       ├── acceptance.md          # 可度量的验收标准
│       ├── analysis.md            # 可选的需求分析
│       ├── research.md            # 可选的有证据研究
│       ├── verification.md        # 可选的形式化/人工验证记录
│       ├── model.smt2             # verify-first Spec 的可选 SMT 模型
│       ├── delivery.md            # 生成的交付报告
│       ├── gates.json             # 只追加的人工门禁决策
│       ├── reviews/               # 每份文档的锚定评审意见
│       └── exec/
│           ├── context.json       # 执行简报和回归基线
│           ├── run.json           # 自主运行状态
│           └── evidence/<task-id>.json
```

Spec 根目录始终是 `.kaze/`，路径相对于工作区；把 `.kaze/` 复制到另一个工作区，Spec 就跟着走了。

## 配置

### Profile 默认值

在 **Plugins → Kaze** 里设置：

| 设置 | 默认值 | 影响 |
|---|---|---|
| Kaze 默认语言 | 跟随系统 | 没有自己配置的新工作区使用的语言 |
| 界面和命令语言 | 跟随全局 | 菜单、标签页、按钮语言 |
| 默认 Spec 语言 | 跟随全局 | 新 Spec 正文语言（`zh-CN` 或 `en`） |
| 默认并行任务数 | 3 | 一个执行波次最多并行的独立任务数（1–8） |
| 回答风格 | 说人话 | 回复口吻；文档结构和验证证据不变 |
| 严格模式 | 关闭 | 警告会变成阶段门禁失败 |
| 编辑后检查 | 开启 | 写入/编辑 Spec 文档后立即校验 |
| 每轮结束时检查 | 开启 | 复查本轮改过的 Spec，并提醒一次修正 |
| 每轮最多提醒次数 | 5 | 同一问题重复提醒的上限（1–10） |
| 同步到时间线 | 开启 | 可用时把任务投影到 DSH Timeline |
| 完成后自动归档 | 关闭 | 完成 Spec 移到 `.kaze/archive` |
| 新 Spec 默认值 | feature / brownfield / requirements-first / comprehensive | 新建 Spec 未单独指定时使用 |
| 默认 capability | 空 | 新 Spec 可选的能力 id |
| 注入工作区约定 | 开启 | 每会话注入一次 `.kaze/steering/*.md` |

### 工作区配置

```json
{
  "language": "zh-CN",
  "maxParallel": 3
}
```

默认 `zh-CN`，也支持 `en`；中英文标题/EARS 都接受，任务标记和 id 永远不变。

### 空闲队列

空闲队列用于推迟可选任务：时间窗口按北京时间算，高峰窗口之外应用配置的价格倍数；可以在 Kaze 设置页或通过 `kaze_spec_idle` 配置。

## 模块

### 运行时入口

| 模块 | 作用 |
|---|---|
| `lib/index.js` | 插件身份；功能性的 Host 半部分是另一个入口。 |
| `lib/host.js` | Host 服务：工具、钩子、Remote 方法、守卫、上下文注入，以及内嵌 skill 回退。 |
| `lib/skills.js` | 把内嵌 skill 正文注册到 Kaze skill catalog 的预设级插件。 |
| `lib/client.js` | Web Client 入口：标签页、设置槽、命令菜单、Remote 挂载。 |
| `lib/client.mermaid.js` | 按需加载的 Mermaid chunk；只有文档包含图表时才加载。 |
| `cordis.patch.yml` | 主组合包 patch：Host、身份、内嵌 skill 和 Kaze 预设。 |

### Host 模块（`src/host/`）

| 模块 | 职责 |
|---|---|
| `index.ts` | `KazeSpecHost` 服务：注册工具、钩子、守卫、提示词上下文和带类型的 Remote 接口；解析活动工作区根目录。 |
| `tools.ts` | 所有 `kaze_spec_*` 工具的定义，包括新会话守卫和自动归档行为。 |
| `hooks.ts` | 在写入/编辑后和轮次结束时校验 Spec 文档；仍有错误时给出有上限的修正提醒。 |
| `guard.ts` | Spec 执行期间拒绝 `todo_write`、`team_task_create`、`team_task_update`。 |
| `skill-injection.ts` | 把每个本地化或 ASCII 命令别名解析为内嵌生成的 skill 正文，并每会话注入一次 `.kaze/steering`。 |
| `skill-content.ts` | 可用时使用 DSH 原生 `<skill_content>` 渲染器；内置与 DSH `0.2.2-rc.5` 匹配的固定回退。 |
| `spec-context.ts` | 注入 `kaze:spec-context` 块，包含语言、`maxParallel` 和严格模式。 |
| `output-style.ts` | 把可选的说人话风格渲染为每个会话一条指令。 |
| `preferences.ts` | 从 `kaze-spec` 行读取并规范化 profile 级默认值。 |
| `typert-compat.ts` | 在 cordis/DSH 不同代际之间适配 Remote 服务绑定。 |
| `spec-runtime.ts` | 为提示词组装和守卫提供 `.kaze` 事实的同步缓存快照。 |

### Spec 引擎（`src/host/spec/`）

| 模块 | 职责 |
|---|---|
| `state.ts` | 状态机：init、workflow、scope、advance、门禁（包括设计的 `## Trade-offs` 检查）、任务更新、校验、验证、PBT、重命名、修复、项目概览和事件历史。 |
| `validator.ts` | 对所有 Spec 文档做结构和语义校验：EARS 模式、可追溯性、DAG 形状、证据 schema。 |
| `paths.ts` | 规范路径、阶段、任务状态、类型、范围、流程和设计详细度。 |
| `settings.ts` | 读写 `.kaze/spec-config.json`。 |
| `living.ts` | 列出能力 Spec，合并被接受的需求，并处理变更日志和冲突。 |
| `archive.ts` | 归档、恢复、列出 Spec；不会隐式重新打开 `done`。 |
| `archive-timeline.ts` | 协调归档与 Timeline 退役。 |
| `delivery.ts` | 完成摘要、门禁记录、文档哈希和 `delivery.md` 生成。 |
| `idle.ts` | 空闲时段、价格倍数、队列修改和就绪计算。 |
| `queue.ts` | 队列条目校验和排序辅助。 |
| `tasks.ts` | 解析 `tasks.md`、依赖 DAG 和就绪任务集合。 |
| `timeline.ts` | 把 `tasks.md` 投影为一棵原生 Timeline 树，不制造第二个事实源。 |
| `review.ts` | 根据锚定意见生成 Markdown 评审简报。 |
| `lock.ts` | 单 Spec 锁处理。 |
| `errors.ts` | 带稳定错误码的类型化 Spec 错误。 |

### Client 模块（`src/client/`）

| 模块 | 职责 |
|---|---|
| `index.tsx` | 注册侧边栏标签页类型、设置槽、语言字典、命令菜单和 Remote 挂载；跟随 DSH 界面语言。 |
| `tab.tsx` | 工作台：Spec 选择、阶段时间线、文档、预览/源码/diff、搜索、评审、任务、校验、归档、能力、空闲队列、完成。 |
| `KazeSettings.tsx` | **Plugins → Kaze** 设置页，覆盖全局、profile 和工作区作用域。 |
| `model.ts` | 纯文档模型：块、章节、锚点、意见、diff、任务进度和搜索。 |
| `face.ts` | 原生 Remote 和工作区文件的适配层；Host 仍在挂载时提供安全回退。 |
| `contribution.ts` | 手写的引擎与评审方法 Typert Remote 描述。 |
| `remote-info.ts` | 使用调用方提供的 Zod 懒组装 Remote 信息。 |
| `command-menu.ts` | 本地化菜单行、别名，以及插入输入框的稳定 ASCII token。 |
| `i18n.ts` | 标签页和面板的中英文文本。 |
| `language.ts` | 在 DSH、Kaze 全局和工作区之间解析语言选择。 |
| `markdown.tsx` | 用 React 元素安全渲染 Markdown；从不使用 `innerHTML`。 |
| `mermaid.tsx` | 懒加载 Mermaid、主题同步、适配控制和错误回退。 |
| `mermaid-render.ts` | Mermaid chunk 入口，严格安全和明暗主题。 |
| `styles.ts` | 一份使用 DSH 设计 token 的作用域样式表。 |
| `icons.tsx` | 内联 SVG 图标；不引入图标包或外部资源。 |
| `types.ts` | 共享的 Client 端类型。 |
| `toasts.ts` | 浏览器本地的操作提示。 |
| `diagnostics.ts` | 非致命的 Client 错误上报。 |

### Shared 模块（`src/shared/`）

| 模块 | 职责 |
|---|---|
| `commands.ts` | 命令的双语目录和别名映射，供 Client 菜单和 Host 注入共用。 |
| `spec-dirs.ts` | feature id 校验和保留目录名。 |
| `review-brief.ts` | 共享的评审简报格式。 |

### 内容与配置

| 路径 | 内容 |
|---|---|
| `core/` | 可移植提示词文档：`plugin-rules.md`、overview、flow、clarification、requirements、design、tasks、execution、acceptance、FTA、delivery、run、PBT、verify-first、brownfield、bugfix、research、rules、steering、platform、delegation 和各类检查清单。 |
| `src/skills/` | 用 `ctx.skills.register` 注册内嵌 skill 正文的预设级插件。 |
| `src/shared/skills.generated.ts` | 生成的内嵌 skill 正文；作者源文件是 `dsh/skills/*/SKILL.md`。 |
| `dsh/skills/` | 仓库中的 Markdown 作者源；不随包发布，构建时编译进 `src/shared/skills.generated.ts`。 |
| `locale/` | 插件页的标题、描述和详情文档。 |
| `host/locale/` | Host 入口标题和描述。 |
| `docs/` | 插件页使用的详情文档和预览图。 |
| `vendor/` | 只用于构建 Host bundle 的固定 Typert protocol 源码及其许可证。 |

### 构建与测试模块

| 路径 | 职责 |
|---|---|
| `scripts/build.mjs` | 构建运行时 bundle，并生成类型声明。 |
| `scripts/generate-skills.mjs` | 从 Markdown 源生成 `src/shared/skills.generated.ts`。 |
| `scripts/test.mjs` | 打包并在独立进程中运行 Node 测试。 |
| `scripts/verify.mjs` | 发布检查：manifest、bundle、命令/skill 对齐、工具定义、core、locale、README 覆盖、泄漏扫描和包大小。 |
| `test/` | 引擎、流程、设置、钩子、守卫、face、菜单、空闲队列、活能力、可追溯性、闭环、完成、内嵌 skill 注册和端到端测试。 |

## 开发

### 前置条件

- Node.js 24.9+
- npm 或 pnpm
- Git

### 构建

```bash
npm install
npm run build
```

构建使用 esbuild：它会从 `dsh/skills/*/SKILL.md` 重新生成 `src/shared/skills.generated.ts`，并同时构建 `lib/host.js`（回退）和 `lib/skills.js`（预设注册）。

Mermaid 是开发依赖，会被输出为按需加载的 `lib/client.mermaid.js` chunk。

Host 构建从 `vendor/` 打包固定的 Typert protocol，因此不需要本地 DSH 安装。

如果 `dsh/skills` 不存在（已安装的包，或没有作者源目录的源码包），构建会保留已提交的生成模块，而不是重新生成。

### 测试与校验

```bash
npm test
npm run verify
```

`npm test` 会运行测试；也可以按名称选择子集：

```bash
npm test engine workflow completion
```

`npm run verify` 是只读的发布门禁：它会检查 manifest、运行时 bundle、命令/skill 对、工具定义、core 文档、locale 文件、中英文 README 覆盖、被排除文件、本机绝对路径、疑似凭据和包大小。

### 安装开发构建

```bash
dsh plugin --profile <profile> add /absolute/path/to/this/repository
dsh web
```

修改 `lib/`、`core/` 或 `dsh/skills` 后要重启 DSH；修改 skill 源文件后先运行 `npm run build`。

运行中的 Host 会保留启动时加载的模块。

Client 改动需要刷新页面，重新构建的 bundle 需要重启后由新会话加载。

### 发布清单

1. 更新 `package.json` 的 `version`。
2. 运行 `npm run build`、`npm test`、`npm run verify`。
3. 检查 `git status`；提交里只应包含预期的源码、内容和 `lib/` 改动。
4. 把 `lib/`、`src/shared/skills.generated.ts` 和源码一起提交。GitHub 安装路径不会执行构建，所以 bundle 必须在仓库里。
5. 打标签，并安装固定 commit：

   ```bash
   dsh plugin --profile <profile> add \
     "github:MLX/dsh-kaze-spec-plugin#<full-commit-sha>"
   ```

## 兼容性与限制

- Host 绑定会探测 cordis root，因此后续兼容的 DSH 版本不一定需要重新构建；如果新版本改变了 Typert、slot 或 skill 契约，则需要。
- 原生 Timeline 是可选的：没有它时 Timeline 按钮不出现，执行继续；插件不会因为服务缺失而抛错。
- `/spec-batch --worktree` 需要 DSH 原生 worktree 工具；没有时会干净停止并说明原因。
- Agent Team 是可选的；Kaze 自己的 subagent 调度和顺序回退不依赖它。
- 运行中的 DSH 进程会保留启动时加载的 Host；替换 `lib/` 后要重启 DSH 并打开新会话。
- Mermaid chunk 在首次使用时加载；严格的网络策略不会影响它：chunk 就在包内。

## 许可证

MIT




