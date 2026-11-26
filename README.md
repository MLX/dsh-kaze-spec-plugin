# Kaze Spec

English | [中文](README.zh.md)

**Spec-driven development for DeepSeek Harness: wish-driven programming, one
click to real**

Turn a vague wish into a gated, reproducible delivery.

Clarify it, write requirements and design, split it into executable tasks, do
the work, prove acceptance, and keep the result as a living capability record.

Kaze is a DeepSeek Harness plugin for a familiar problem: the AI starts writing
before anyone has agreed on what “done” means.

You bring a wish, and Kaze turns it into a spec: a small set of files under
`.kaze/` that say what you want, how it will be built, what counts as done, and
what evidence proves it.

Close the chat whenever you like; the files stay.

## Why Kaze

Most coding assistants can write code from a sentence.

The hard part is keeping the request, design, tasks, implementation, and proof
of completion in agreement after hours and across sessions.

You probably recognize the failure modes: the AI runs off in the wrong
direction; a constraint from the first message disappears; nobody can say what
was actually verified; a new session loses the progress.

Kaze makes that consistency explicit and machine-checkable:

- **Files over conversation:** Requirements, design, tasks, state, gates,
  review comments, and execution evidence all live under `.kaze/`.
- **Every phase has a gate:** Before a phase moves, the engine checks document
  structure, traceability, task-DAG completeness, execution evidence, acceptance,
  and FTA.
- **Traceability is enforced:** Every leaf task cites the requirement and
  acceptance criterion it implements; every correctness property cites the
  criterion it verifies.
- **Planning and execution are separate:** The session that writes the spec
  cannot execute it; execution starts in a new session, from the files.
- **Completion needs evidence:** Acceptance and FTA decisions record concrete
  evidence and are bound to the document hashes they approved.
- **Results accumulate:** Accepted requirements can merge into a living
  capability spec under `.kaze/specs/`, so the next change starts from the
  project’s actual behavior.

## What you get

- **A guided way in:** Start with a vague wish, or jump straight into a full
  spec, a quick spec, a bugfix, or a direct code change.
- **A plan you can review:** Requirements, design, tasks, and the trade-offs
  behind them are files, not a wall of chat.
- **A workbench:** The right sidebar shows documents, tasks, validation, review
  comments, archive, and settings without making you read raw JSON.
- **A process you can finish:** Apply, batch, or run to completion; acceptance,
  FTA, delivery, and archive leave a record behind.

## Requirements

| Requirement | Notes |
|---|---|
| DeepSeek Harness `0.2.2-rc.5` or newer | None |
| Node.js 24.9 or newer | None |
| Git | Needed for `/spec-batch --worktree`. |
| DSH **Change requests & worktrees** | Optional; only for `--worktree`. |
| DSH **Agent Team** | Optional; Kaze works without it. |
| A DSH build with Timeline | Optional; only the Timeline handoff needs it. |

## Install

### From GitHub

In the Web UI: **Settings → Plugins → Add plugin → Install third-party
plugin**, then enter:

```text
github:MLX/dsh-kaze-spec-plugin
```

Pin a commit when you want a reproducible install:

```text
github:MLX/dsh-kaze-spec-plugin#<full-commit-sha>
```

Or from the CLI:

```bash
dsh plugin --profile <profile> add github:MLX/dsh-kaze-spec-plugin
dsh web
```

The explicit `git+https://github.com/MLX/dsh-kaze-spec-plugin.git` form also
works on pnpm; the built `lib/` is committed and there is no `prepare` script,
so a Git install does not need a build-script allowance.

### From a local checkout

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-kaze-spec-plugin
dsh web
```

The path must be absolute; in the Web UI, paste it into the same **Install
third-party plugin** dialog.

### First run

1. Restart DeepSeek Harness.
2. Start a **new session** in the workspace you want to use.
3. Choose **Kaze 规格驱动开发** in the mode selector.
4. Open the right sidebar and select **Kaze Spec-Driven Development**.
5. Type `/` to open the command menu.

You do not need to copy a workspace template: the command skills are part of the
plugin, and the plugin’s own hard rules live in `core/plugin-rules.md` and are
read only when a Kaze command runs; do not rename that file to `AGENTS.md`, because DSH
would treat it as a workspace instruction file and inject it into every session.

Workspace rules are separate: Kaze reads the workspace’s own `AGENTS.md` when it
exists, and `/spec-rules` maintains only that file.

## The basic loop

Three commands cover most days:

```text
/spec-wish I want to build a login page
/spec I want to build a login page
/spec-apply feature=login-page
```

`/spec-wish` only refines the wish; it does not write code or start a spec, and it
saves the refined prompt under `.kaze/wishes/`, so you can use it as the input
to `/spec`.

`/spec` is the guided creation flow: it asks the setup questions one at a time,
then runs the clarification rounds, and you end up with requirements, design,
and tasks; how many review stops you get depends on the mode you choose.

`/spec-apply` is execution: run it in a **new session**; it reads the files,
works through ready tasks, and records evidence, and it does not run acceptance
or FTA unless you add `--complete`.

If you only remember one rule: **plan in one session, execute in another**.

## Pick the right entry

| Your situation | Use |
|---|---|
| A vague idea | `/spec-wish` |
| A full spec with review stops | `/spec` |
| A small spec, fast | `/spec-quick` |
| Clarify once, then all planning documents in one pass | `/spec-flow` |
| Verify the requirements before designing | `/spec-verify-first` |
| A bug | `/spec-bugfix` |
| A direct code change | `/vibe` |
| Just want to explore an idea | `/spec-explore` |
| Need evidence for a hard decision | `/spec-research` |

The menu labels are localized, but the inserted token is always the stable ASCII
command id. DSH only recognizes ASCII slash names.

## The spec model

### Phases

| Phase | What it means | Main document |
|---|---|---|
| `initial` | Created and clarifying | `clarify.md` |
| `requirements` | What and why | `requirements.md` or `bugfix.md` |
| `design` | How, including the trade-offs | `design.md` |
| `tasks` | Small executable pieces and their waves | `tasks.md` |
| `execute` | Implementation and evidence | `tasks.md` + `exec/` |
| `done` | Acceptance and FTA recorded | `delivery.md` |

`done` is terminal: phases only move forward, and archive is a reversible move, not a
delete.

### Routes

All routes share the same phase pointer. They differ in what gets written first:

```text
requirements-first   requirements.md --> design.md --> tasks.md
design-first         design.md --> requirements.md --> tasks.md
verify-first         stories + model.smt2 + verification.md
                     --> requirements.md --> design.md --> tasks.md
bugfix               bugfix.md --> design.md --> tasks.md
```

A quick spec is a compressed requirements-first flow, not a separate engine
route.

### Gates

A gate is a checklist the engine actually runs:

| Gate | What it checks |
|---|---|
| requirements | Required headings, at least one acceptance criterion per requirement, a clarification ledger with no open question, resolvable requirement and criterion ids. Verify-first also needs `model.smt2` and a recorded check. |
| design | Required sections, including `## Trade-offs`; a testing strategy; and a `## Rules Check` when the workspace declares project rules. |
| tasks | A DAG that covers every required leaf, a resolvable `_Requirements: X.Y_` on every leaf, brownfield migration/regression coverage, and bugfix preservation/regression coverage. |
| execute | Every required task is complete, with a schema-valid `exec/evidence/<task-id>.json`. |
| done | A fresh acceptance decision, a fresh FTA decision, valid `verification.md` where required, and a capability merge when the spec has a capability. |

Strict mode turns validator warnings into gate failures; turning a validation
hook off skips that hook; it does not make a gate pass.

Every design must say which option it chose, which alternatives it rejected, why
it chose what it chose, and what would make it reconsider.

A missing `## Trade-offs` fails the design gate. Chinese headings `## 权衡` and
`## 取舍` are accepted.

A gate approval is tied to the document hashes it approved.

If you edit the document afterwards, the approval is stale, so re-gate before
moving on.

### Session boundary

Planning and execution are different jobs: the creation session stops after
the plan review; the execution session starts from the files.

| Session | Commands | Work |
|---|---|---|
| Creation (planning) | `/spec`, `/spec-quick`, `/spec-flow`, `/spec-verify-first`, `/spec-bugfix` | Write documents, run gates, hold the plan review; then stop. |
| New execution session | `/spec-apply`, `/spec-complete`, `/spec-batch`, `/spec-run` | Read `.kaze/`, implement, write evidence, run acceptance and FTA, reach `done`. |

The engine enforces this with the session id in `state.json`; if the current
session is the one that created the spec, task changes, acceptance/FTA records,
capability merges, and advancing to `execute` or `done` are rejected.

### Language

- Normative prompts and tool contracts are English.
- Spec prose follows the workspace `language`: `zh-CN` by default, `en` also
  supported; the injected `kaze:spec-context` block states the setting.
- Chinese headings and EARS patterns are expected when `language=zh-CN`; task
  markers and task ids never change.
- The menu and UI are localized; the inserted command token stays ASCII.

## Workflow at a glance

```text
wish / issue / idea
        |
        v
/spec-wish  (refine only; no code)
        |
        v
/spec  /spec-quick  /spec-flow  /spec-verify-first  /spec-bugfix
        |
        v
clarify.md  (multi-round; root session only)
        |
        v
requirements.md  -->  design.md  -->  tasks.md
        |                 |                 |
        +------ gates ----+------ gates ----+
                          |
                          v
              execute  (fresh session)
                          |
                          v
          acceptance  -->  FTA  -->  done
                          |
                          v
                     delivery.md
```

## Commands

Arguments are optional unless noted.

A missing `feature=<id>` means “the active spec” when the command supports it.

### Entry points

| Command | Arguments | What it does |
|---|---|---|
| `/spec-wish` | `[wish text]` | Refines a vague wish into an executable prompt. Writes `.kaze/wishes/<slug>.md`; does not implement or start a spec. |
| `/spec` | `[request]` | Full guided creation: classify, setup questions one at a time, multi-round clarification, then route to step-by-step or one-shot planning. |
| `/spec-quick` | `[request]` | Smallest complete flow: 2–4 questions, then requirements, design, and tasks in one turn, with one plan review. |
| `/spec-flow` | `[request]` | Multi-round clarification, then requirements → design → tasks in one pass, with exactly one final plan review. |
| `/spec-verify-first` | `[request]` | Verify-first route: user stories, `model.smt2`, check, `verification.md`, then EARS requirements, design, and tasks. |
| `/spec-rules` | `[rule or change]` | Maintains the workspace’s `## Project Rules` section. Every design must answer each rule as compliant or exception; the design gate enforces it. |
| `/spec-steering` | `[convention or change]` | Maintains advisory workspace conventions in `.kaze/steering/*.md`, injected once per session. Not gate-enforced. |
| `/spec-bugfix` | `[bug description]` | Bugfix route: records current, expected, and unchanged behavior; orders tasks as exploration test → fix → preservation → regression. |
| `/vibe` | `[task]` | Direct coding: goal contract, minimal context, smallest diff, falsifying check, usual tests, drift review. No spec artifact. |

### Planning

| Command | Arguments | What it does |
|---|---|---|
| `/spec-explore` | `[topic or question]` | Read-only exploration. Produces options, trade-offs, risks, unknowns, and a build/defer/reject recommendation. No artifact or gate. |
| `/spec-research` | `[question]` | Evidence-backed research for a decision the repository cannot settle; writes `research.md` or a report and marks unverifiable claims. |
| `/spec-requirements` | `feature=<id>` | Writes or repairs `requirements.md`, or `bugfix.md` for a bugfix spec. Organizes user stories and EARS acceptance criteria. |
| `/spec-analyze` | `feature=<id>` | Independent requirements review for ambiguity, conflict, gaps, untestable criteria, escape clauses, and story/criterion mismatch. Writes `analysis.md`. |
| `/spec-design` | `feature=<id>` | Writes `design.md` at the recorded detail level: architecture, interfaces, data models, correctness properties, trade-offs, errors, and testing strategy. |
| `/spec-pbt` | `feature=<id>` | Maps acceptance criteria to correctness properties, adds property-test tasks and stubs, and records outcomes with `kaze_spec_pbt`. |
| `/spec-tasks` | `feature=<id>` | Writes `tasks.md`: executable leaves, `_Requirements: X.Y_` traceability, a dependency DAG, and parallel waves. |
| `/spec-acceptance` | `feature=<id>` | Writes `acceptance.md`: one user-visible goal, measurable success criteria, and verification methods. |
| `/spec-fta` | `feature=<id>` | Independent failure-tree-style review of requirements versus actual changes: commission, drift, regressions, omissions. |
| `/spec-delivery` | `feature=<id>` | Builds `delivery.md` from state, tasks, acceptance, verification, FTA, and gate history. |

### Execution and completion

| Command | Arguments | What it does |
|---|---|---|
| `/spec-apply` | `feature=<id> [--idle or --defer-optional] [--complete] [--unattended]` | Executes ready tasks in waves, records evidence, and stops before acceptance/FTA unless `--complete` is set; fresh session only. |
| `/spec-code-review` | `[range or target]` | Reviews a change range and reports reproducible problems introduced by that change, with file and line evidence. |
| `/spec-comments` | `feature=<id> [document] [--comments <path>]` | Applies anchored reviewer comments to one document, marks resolved comments, re-validates, and re-gates if needed. |
| `/spec-complete` | `feature=<id> [--apply] [--idle or --defer-optional] [--unattended]` | Runs the completion sequence: verify tasks, acceptance, FTA, capability merge, advance to done, and delivery. |
| `/spec-run` | `feature=<id> [--max-rounds=N]` | Creates one DSH goal and autonomously loops apply → acceptance → FTA, fixing only implementation and tests until zero Blockers and no new regression. The only command that creates a goal. `--max-rounds` defaults to 12, capped at 64. |
| `/spec-batch` | `[feature=a or features=a,b,c] [--dry-run] [--max-tasks=N] [--complete] [--unattended] [--idle] [--defer-optional] [--worktree] [--resume]` | Runs several specs sequentially. `--complete` closes each spec; `--worktree` uses a native Git worktree per spec; `--resume` continues `.kaze/batch/last.json`. |

### Operations

| Command | Arguments | What it does |
|---|---|---|
| `/spec-status` | `[feature=<id>]` | Shows phase, documents, task totals, in-progress tasks, and ready tasks. |
| `/spec-list` | None | Lists active specs with type, workflow, phase, and update time. |
| `/spec-sync` | `[feature=<id>]` | Reconciles `state.json` with the files and task markers, then reports the inferred phase and any missing or malformed documents. |
| `/spec-refine` | `[selected passage or instruction]` | Edits only the section containing the selection, preserving headings, EARS wording, task markers, and structure; re-validates afterward. |
| `/spec-rename` | `feature=<old> to=<new>` | Renames a spec and updates its own path references and review files. Rejected at `execute` and `done`. |
| `/spec-archive` | `feature=<id> [force=true]` or `restore=true feature=<id>` | Archives a completed spec under `.kaze/archive/YYYY-MM-DD-<feature>`, or restores one. `force=true` is explicit and skips the capability merge. |
| `/spec-memory` | `[observation]` | Distills durable project experience and proposes where it belongs: a checkable project rule, a steering convention, or nothing. Never edits without confirmation. |
| `/spec-summarize` | None | Produces a concise handoff: technology, files changed, resolved/open issues, spec phase, and next action. |

### Things worth knowing

- **`/spec` asks setup questions one at a time:** Checkpoint mode, route, then
  design detail only for design-first. It will not merge them into one form.
- **`/spec-rules` changes the workspace, not the plugin:** The plugin’s rules are
  in `core/plugin-rules.md`; the workspace’s rules are in its own `AGENTS.md`.
- **`/spec-flow` stops after `tasks.md`:** Its single review can start an
  execution session, but it does not execute in the creation session.
- **`/spec-run` is the only goal-creating command:** Run it in a fresh execution
  session; it is unattended by default and blocks when it cannot safely choose.
- **`/spec-batch` is sequential:** Do not run two specs in parallel; worktree
  mode needs DSH’s `create_worktree` and `working_directory` tools.
- **`/spec-archive` never deletes:** Restoring does not undo a capability merge
  that already happened.
- **`/spec-refine` and `/spec-comments` preserve the rest of the file:** They
  change only the selected section or the comments you asked to apply.

### Recipes

```text
/spec-wish I want to build a login page
/spec I want to build a login page
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

The tab’s empty state can also start a wish:

- **Start Wish** opens the wish box.
- **Wish** puts `/spec <refined prompt>` in the composer, so the refined wish
  lands on `/spec` instead of a phase command.
- **Send to chat** sends the raw wish as `/spec-wish <wish>`.
- The follow-up offers keep-refining plus `/spec`, `/spec-quick`, and
  `/spec-flow`.
- Without a subagent service, the same `/spec-wish` send is used.

## The workbench

Open the right sidebar tab when you want to see what is going on.

| Area | What it does |
|---|---|
| Empty state | **Start Wish** opens the wish box; the other entry points route to `/spec`, `/spec-quick`, and `/spec-flow`. |
| Phase timeline | Shows the six phases and the document state for each. |
| Document view | Preview, source, and a since-opened diff; search, line jump, copy, and external links. |
| Review | Select text to add an anchored comment; comments persist in `reviews/<doc>.json`; send the generated brief into the conversation for `/spec-comments`. |
| Tasks | Progress, per-task status, run controls, ready/queued view, idle deferral, and a Timeline handoff when the Timeline service is present. |
| Validation | Lists errors and warnings; selecting one opens the document at the line. |
| Completion | Summarizes tasks, acceptance, FTA, and the next valid action. |
| Archive and capabilities | Browse archived specs and living capability records. |
| Settings | Global language, workspace language, parallelism, strict mode, hooks, Timeline, archive, new-spec defaults, and the idle queue. |

## Where the files live

```text
<workspace>/
├── .kaze/
│   ├── spec-config.json           # language, maxParallel, strict defaults
│   ├── idle-config.json           # idle windows and price multiplier
│   ├── idle-queue.json            # deferred optional tasks
│   ├── steering/                  # advisory workspace conventions
│   ├── wishes/                    # refined wishes from /spec-wish
│   ├── specs/<capability>/spec.md # living capability records
│   ├── batch/last.json            # resumable /spec-batch state
│   ├── archive/YYYY-MM-DD-<feature>/
│   └── <feature>/
│       ├── state.json             # authoritative phase and history
│       ├── config.json            # spec id, type, scope, route, detail
│       ├── clarify.md             # decisions, assumptions, rounds, open items
│       ├── requirements.md        # feature requirements (EARS)
│       ├── bugfix.md              # bugfix variant: current/expected/unchanged
│       ├── design.md              # architecture, interfaces, properties, tests
│       ├── tasks.md               # leaf tasks with _Requirements_ and DAG
│       ├── acceptance.md          # measurable acceptance criteria
│       ├── analysis.md            # optional requirements analysis
│       ├── research.md            # optional evidence-backed research
│       ├── verification.md        # optional formal/manual verification record
│       ├── model.smt2             # optional SMT model for verify-first specs
│       ├── delivery.md            # generated delivery report
│       ├── gates.json             # append-only human gate decisions
│       ├── reviews/               # anchored review comments per document
│       └── exec/
│           ├── context.json       # execution brief and regression baseline
│           ├── run.json           # autonomous run state
│           └── evidence/<task-id>.json
```

The spec root is always `.kaze/`, with paths relative to the workspace; copying
`.kaze/` to another workspace keeps the specs.

## Configuration

### Profile defaults

Set these under **Plugins → Kaze**:

| Setting | Default | Effect |
|---|---|---|
| Kaze default language | Follow system | Language for new workspaces without their own config |
| Interface and command language | Follow global | Menu, tab, and button language |
| Default Spec language | Follow global | New spec prose language (`zh-CN` or `en`) |
| Default parallel tasks | 3 | Cap on independent tasks per execution wave (1–8) |
| Answer style | Human (`说人话`) | Reply voice; document structure and evidence never change |
| Strict mode | Off | Warnings fail phase gates |
| Check after edits | On | Validate a spec document after write/edit |
| Check when a turn ends | On | Recheck touched specs and steer one correction |
| Reminders per turn | 5 | Cap on repeated corrections (1–10) |
| Sync to timeline | On | Project tasks into the DSH Timeline when available |
| Archive when done | Off | Move finished specs to `.kaze/archive` |
| New-spec defaults | feature / brownfield / requirements-first / comprehensive | Used when a new spec does not choose its own defaults |
| Default capability | empty | Optional capability id for new specs |
| Inject workspace conventions | On | Inject `.kaze/steering/*.md` once per session |

### Workspace config

```json
{
  "language": "zh-CN",
  "maxParallel": 3
}
```

`zh-CN` is the default; `en` is supported. Chinese and English headings/EARS are
both accepted. Task markers and ids never change.

### Idle queue

The idle queue defers optional tasks: window times use Beijing time, the
configured price multiplier applies outside peak windows, and you can set it in
the Kaze settings page or with `kaze_spec_idle`.

## Modules

### Runtime entry points

| Module | Role |
|---|---|
| `lib/index.js` | Plugin identity; the functional Host half is a separate entry. |
| `lib/host.js` | Host service: tools, hooks, Remote methods, guards, context injection, and the embedded skill fallback. |
| `lib/skills.js` | Preset-scoped registration of the embedded skill bodies into the Kaze skill catalog. |
| `lib/client.js` | Web Client entry: tab, settings slot, command menu, Remote mount. |
| `lib/client.mermaid.js` | On-demand Mermaid chunk; loaded only when a document contains a diagram. |
| `cordis.patch.yml` | Main bundle patch: Host, identity, embedded skills, and the Kaze preset. |

### Host modules (`src/host/`)

| Module | Responsibility |
|---|---|
| `index.ts` | The `KazeSpecHost` service: registers tools, hooks, guards, prompt context, and the typed Remote surface; resolves live workspace roots. |
| `tools.ts` | Definitions for all `kaze_spec_*` tools, including the fresh-session guard and auto-archive behavior. |
| `hooks.ts` | Validates a spec document after write/edit and at turn end; steers a bounded correction when errors remain. |
| `guard.ts` | Denies `todo_write`, `team_task_create`, and `team_task_update` while a spec is executing. |
| `skill-injection.ts` | Resolves every localized or ASCII command alias to the embedded generated skill body, and injects `.kaze/steering` once per session. |
| `skill-content.ts` | Uses DSH’s native `<skill_content>` renderer when available; ships a pinned fallback matching DSH `0.2.2-rc.5`. |
| `spec-context.ts` | Injects the `kaze:spec-context` block with language, `maxParallel`, and strict mode. |
| `output-style.ts` | Renders the optional humanized answer style as one instruction per conversation. |
| `preferences.ts` | Reads and normalizes profile-wide defaults from the `kaze-spec` row. |
| `typert-compat.ts` | Adapts the Remote service binding across cordis/DSH generations. |
| `spec-runtime.ts` | Cached synchronous snapshot of `.kaze` facts for prompt assembly and guards. |

### Spec engine (`src/host/spec/`)

| Module | Responsibility |
|---|---|
| `state.ts` | The state machine: init, workflow, scope, advance, gates (including the design `## Trade-offs` check), task updates, validation, verification, PBT, rename, repair, project overview, and event history. |
| `validator.ts` | Structural and semantic lint for every spec document, EARS patterns, traceability, DAG shape, and evidence schema. |
| `paths.ts` | Canonical paths, phases, task states, types, scopes, workflows, and design detail values. |
| `settings.ts` | Reads and writes `.kaze/spec-config.json`. |
| `living.ts` | Lists capability specs and merges accepted requirements with change logs and conflict detection. |
| `archive.ts` | Archives, restores, and lists specs; refuses to reopen `done` implicitly. |
| `archive-timeline.ts` | Coordinates archive with Timeline retirement. |
| `delivery.ts` | Completion summary, gate records, document hashes, and `delivery.md` generation. |
| `idle.ts` | Idle windows, price multiplier, queue mutations, and readiness calculations. |
| `queue.ts` | Queue entry validation and ordering helpers. |
| `tasks.ts` | Parses `tasks.md`, the dependency DAG, and ready-task sets. |
| `timeline.ts` | Projects `tasks.md` into one native Timeline tree without making it a second source of truth. |
| `review.ts` | Builds the Markdown review brief from anchored comments. |
| `lock.ts` | Per-spec lock handling. |
| `errors.ts` | Typed spec errors with stable codes. |

### Client modules (`src/client/`)

| Module | Responsibility |
|---|---|
| `index.tsx` | Registers the sidebar tab type, settings slot, locale dictionaries, command menu, and Remote mount; follows the DSH interface language. |
| `tab.tsx` | The workbench: spec chooser, phase timeline, documents, preview/source/diff, search, comments, tasks, validation, archive, capabilities, idle queue, completion. |
| `KazeSettings.tsx` | The **Plugins → Kaze** settings page across global, profile, and workspace scopes. |
| `model.ts` | Pure document model: blocks, sections, anchors, comments, diffs, task progress, and search. |
| `face.ts` | Adapter over the native Remote and workspace files; safe fallbacks when the Host is still mounting. |
| `contribution.ts` | Hand-written typed Typert Remote descriptors for the engine and review methods. |
| `remote-info.ts` | Lazy Remote info assembly with caller-supplied Zod. |
| `command-menu.ts` | Localized menu rows, aliases, and the stable ASCII token inserted into the composer. |
| `i18n.ts` | Tab and panel text for Chinese and English. |
| `language.ts` | Language choice resolution across DSH, Kaze global, and workspace scopes. |
| `markdown.tsx` | Safe Markdown rendering as React elements; never `innerHTML`. |
| `mermaid.tsx` | Lazy Mermaid loading, theme sync, fit control, and error fallback. |
| `mermaid-render.ts` | The Mermaid chunk entry with strict security and light/dark themes. |
| `styles.ts` | One scoped stylesheet using DSH design tokens. |
| `icons.tsx` | Inline SVG icons; no icon package or external assets. |
| `types.ts` | Shared Client-side types. |
| `toasts.ts` | Browser-local operation notices. |
| `diagnostics.ts` | Non-fatal Client error reporting. |

### Shared modules (`src/shared/`)

| Module | Responsibility |
|---|---|
| `commands.ts` | The bilingual command catalog and alias map shared by the Client menu and Host injection. |
| `spec-dirs.ts` | Feature-id validation and reserved directory names. |
| `review-brief.ts` | Shared review-brief formatting. |

### Content and configuration

| Path | Contents |
|---|---|
| `core/` | Portable prompt documents: `plugin-rules.md`, overview, flow, clarification, requirements, design, tasks, execution, acceptance, FTA, delivery, run, PBT, verify-first, brownfield, bugfix, research, rules, steering, platform, delegation, and checklists. |
| `src/skills/` | Preset-scoped plugin that registers the embedded skill bodies with `ctx.skills.register`. |
| `src/shared/skills.generated.ts` | Generated skill bodies; the authoring source is `dsh/skills/*/SKILL.md`. |
| `dsh/skills/` | Authoring Markdown sources kept in the repository; excluded from the package and compiled into `src/shared/skills.generated.ts`. |
| `locale/` | Bundle title, description, and detail document for the plugin page. |
| `host/locale/` | Host entry title and description. |
| `docs/` | Detail documents and the preview image used by the plugin page. |
| `vendor/` | Pinned Typert protocol source used only to build the Host bundle, plus its license. |

### Build and test modules

| Path | Responsibility |
|---|---|
| `scripts/build.mjs` | Builds the runtime bundles and writes the type declarations. |
| `scripts/generate-skills.mjs` | Generates `src/shared/skills.generated.ts` from the Markdown sources. |
| `scripts/test.mjs` | Bundles and runs the Node test suite in isolated processes. |
| `scripts/verify.mjs` | Release checks: manifest, bundles, command/skill parity, tool definitions, core, locale, README coverage, leak scan, and size. |
| `test/` | Engine, workflow, settings, hooks, guard, face, menu, idle, living, traceability, closure, completion, embedded skill registration, and end-to-end tests. |

## Development

### Prerequisites

- Node.js 24.9+
- npm or pnpm
- Git

### Build

```bash
npm install
npm run build
```

The build uses esbuild: it regenerates `src/shared/skills.generated.ts` from
`dsh/skills/*/SKILL.md` and builds both `lib/host.js` (fallback) and
`lib/skills.js` (preset registration).

Mermaid is a development dependency and is emitted as the on-demand
`lib/client.mermaid.js` chunk.

The Host build bundles the pinned Typert protocol from `vendor/`, so it does not
need a local DSH installation.

If `dsh/skills` is absent (an installed package or a source kit without the
authoring directory), the build keeps the committed generated module instead of
regenerating it.

### Test and verify

```bash
npm test
npm run verify
```

`npm test` runs the suite; pass names to select a subset:

```bash
npm test engine workflow completion
```

`npm run verify` is a read-only release gate: it checks the manifest, runtime
bundles, command/skill pairs, tool definitions, core docs, locale files, README
coverage in English and Chinese, excluded files, local absolute paths,
credential-like values, and package size.

### Install a development build

```bash
dsh plugin --profile <profile> add /absolute/path/to/this/repository
dsh web
```

Restart DSH after changing `lib/`, `core/`, or `dsh/skills`; run `npm run build`
after changing skill sources.

A running Host keeps the modules it loaded at startup.

New Client code needs a page reload, and a rebuilt bundle needs a restart before
a new session sees it.

### Release checklist

1. Update `version` in `package.json`.
2. Run `npm run build`, `npm test`, and `npm run verify`.
3. Review `git status`; only intended source, content, and `lib/` changes belong
   in the commit.
4. Commit `lib/`, `src/shared/skills.generated.ts`, and the source together. The
   GitHub install path does not run a build, so the bundles must be present in
   the repository.
5. Tag the release and install the pinned commit:

   ```bash
   dsh plugin --profile <profile> add \
     "github:MLX/dsh-kaze-spec-plugin#<full-commit-sha>"
   ```

## Compatibility and limits

- The Host binding feature-detects the cordis root, so a later compatible DSH
  release does not automatically need a rebuild; a release that changes the
  Typert, slot, or skill contracts does.
- The native Timeline is optional: without it, the Timeline button is absent
  and execution continues; the plugin never throws because the service is missing.
- `/spec-batch --worktree` requires DSH’s native worktree tools; without them,
  the command stops cleanly and explains why.
- Agent Team is optional; Kaze’s own subagent dispatch and sequential fallback
  do not require it.
- A running DSH process keeps the Host it loaded at startup; after replacing
  `lib/`, restart DSH and open a new session.
- The Mermaid chunk is loaded on first use; a strict network policy is not an
  issue: the chunk ships inside the package.

## License

MIT


