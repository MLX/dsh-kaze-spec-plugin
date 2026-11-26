# Portable Spec Flow — Overview

This pack implements the **spec-driven development process**
(`requirements → design → tasks → execution`) with portable prompt text. It is
host-agnostic: the host only needs file read/write, search, shell, and
(optionally) sub-agents and a question tool.

The process is intentionally **file-first**. Conversation is disposable; the
files under the spec directory are the durable state.

## Optional explore

`./explore.md` is a read-only pre-spec stance. It creates no artifact and
has no gate. Use it when the problem is still an idea; hand off to `/spec` or
`/vibe` only after the user chooses a direction.

`./research.md` is optional evidence-backed research for a decision that
the repository cannot settle. It writes `research.md` or a report, never a spec
phase, and must use the host's native web search/fetch tools.

`./acceptance.md` defines an optional `acceptance.md` with measurable
success criteria. It is a spec artifact, not a DSH session goal.

`./run.md` defines `/spec-run`, the explicit autonomous path: one DSH goal,
repeated apply → acceptance → FTA rounds, implementation-only remediation
between FTA runs, and a hard stop on the same Blocker or the round cap.

`./platform.md` is a shared reference for runtime/target-platform decisions and
platform-specific commands. It is not a command and creates no artifact; the
design and execute phases read it when a command or deployment is in scope.

`./living-specs.md` defines the optional capability record
`.kaze/specs/<capability>/spec.md`, maintained by `kaze_spec_merge`. It is the
project's accumulated behavior, not a per-feature phase.

`./completion.md` is the canonical acceptance → FTA → verification → capability →
done → delivery sequence used by `/spec-complete`, `/spec-apply --complete`,
`/spec-batch`, and `/spec-run`.

`./exec-context.md` defines the optional `exec/context.json` execution brief
(user intent, target/execution platform, baseline, owned files) that later waves
and FTA read instead of re-reading the whole spec.

`./rules.md` defines Hard Rules (`工程红线`) in the root `AGENTS.md` and the
design's `## Rules Check`; a constraint the gate must enforce lives there and
never in steering. `./analysis.md` defines the optional `/spec-analyze` report.
`./pbt.md` maps EARS criteria to correctness properties. `./steering.md` defines
the per-session `.kaze/steering` conventions, which are advisory and not
gate-checked.

`./delegation.md` defines the session boundary (creation vs execution), the
delegation matrix, the dispatch contract, and context hygiene. Execution never
runs in the creation session.

## Artifacts

```text
<spec-root>/<feature>/
├── requirements.md      # WHAT and WHY (EARS acceptance criteria)
├── design.md            # HOW (architecture, interfaces, properties)
├── tasks.md             # executable checklist + dependency waves
├── state.json           # machine-readable status (required by the engine)
├── clarify.md           # clarification ledger (required by the gates)
├── acceptance.md        # optional: measurable acceptance criteria
├── bugfix.md            # bug variant: current/expected/unchanged behavior
├── research.md          # optional: evidence-backed decision research
├── verification.md      # optional: formal or manual verification record
├── model.smt2           # optional: formal model for correctness-critical specs
├── delivery.md          # generated completion report
├── gates.json           # append-only acceptance/FTA/archive gate history
├── reviews/             # anchored review comments (per document)
└── exec/                # run state, context, and per-task evidence
```

The spec root is `.kaze/`.

## Language policy

- **Normative instructions are English.** Tool rules, stop conditions, file
  contracts, and validator literals stay English across every host.
- **Spec content language.** Use the injected `kaze:spec-context` block; write
  spec prose, headings, and EARS patterns in its `language` (`zh-CN` default,
  `en` for English). Task markers and task ids stay unchanged. The validator
  accepts both language variants. Read `.kaze/spec-config.json` only when the
  block is absent.
- **Answer in the user's language.** Chat replies follow the user; spec prose
  follows the workspace language setting above.
- **Exact literals stay as written.** The selected language's required
  headings/EARS patterns, task markers, task ids, command names, and JSON fields
  are not translated.
- **Quoted material stays quoted.** User text, review passages, and file content
  are never translated as part of control instructions.

English control language is deliberate: it is the most stable form for tool
use, format constraints, and cross-host portability. It does not make the
product English-only.

## Roles

| Role | Responsibility | Must not |
|---|---|---|
| Orchestrator | classify request, choose workflow, enforce checkpoints | write spec documents itself |
| Requirements Agent | produce/repair `requirements.md` | design implementation |
| Design Agent | produce/repair `design.md` | invent requirements |
| Task Agent | produce/repair `tasks.md` + DAG | implement code |
| Executor | implement exactly one task | change task status or spec scope |
| Verifier | check claims against files/tests | trust the executor's summary |

In a multi-session deployment the Orchestrator never writes spec documents
itself; the phase agents do. In a single-session deployment the root session
also plays the phase-agent role (see `./delegation.md`): orchestration and
authoring are two roles, not two required sessions. Either way the **phase
boundaries and file contracts must remain**.

## State machine

```text
classify
  ├─ feature / quick
  │    ├─ requirements-first → requirements → design → tasks → execute
  │    ├─ design-first       ┄ design ┄ requirements ┄ tasks ┄ execute
  │    │                      (┄ = document write order; the phase pointer
  │    │                       still moves requirements → design → tasks)
  │    └─ verify-first       ┄ requirements draft + model.smt2 + verification
  │                            ┄ requirements ┄ design ┄ tasks ┄ execute
  └─ bugfix                  → bugfix → design → tasks → execute

every route ends: execute → acceptance gate → FTA gate → done
```

The phase pointer still moves `requirements → design → tasks` for every
workflow; `design-first` and `verify-first` change the document order and the
inputs the requirements gate requires (`design.md`, or `model.smt2` +
`verification.md`).

Each transition is gated by the engine:

- requirements: required headings, at least one acceptance criterion per
  requirement, a clarification ledger with no open question, and resolvable
  requirement/criterion ids;
- design: required sections, a Testing Strategy, and `## Rules Check` when the
  workspace declares Project Rules;
- tasks: a valid DAG covering every required leaf, a `_Requirements: X.Y_` on
  every leaf that resolves to a declared criterion, brownfield
  migration/regression coverage, and bugfix regression/preservation coverage;
- execute: every required task completed with a schema-valid
  `exec/evidence/<task-id>.json`;
- done: a fresh acceptance decision, a fresh FTA decision, a valid
  `verification.md` when the spec is brownfield, a bugfix, or verify-first, and a
  capability merge record when a capability is set.

Owner, definition of done, checkpoint quality, and test attachment are review
criteria in the phase documents, not separate engine checks; `strict` mode only
upgrades validator warnings that exist. Apply the review checklist in the phase
document rather than assuming the engine can judge prose quality.

All creation paths start with the clarification protocol in `./clarify.md` and
record a workflow route (`requirements-first`, `design-first`, `verify-first`) and
a design detail level (`high`, `low`, `comprehensive`) on the spec.
`/spec` classic reviews each document after clarification; `/spec-flow` and the
`/spec` one-shot mode review only the final task plan. The verify-first procedure
lives in `./verify-first.md`.

## Host capability contract

| Capability | Required | Fallback |
|---|---|---|
| read/write files | yes | — |
| search (grep/glob) | yes | shell `grep`/`rg` |
| shell | yes | host's exec tool |
| ask user a question | recommended | plain-text question + wait |
| sub-agents | optional | sequential role play with fresh context |
| task status store | required | `tasks.md` checkboxes; `kaze_spec_task` mirrors it into `state.json` |

## Invariants

1. **Files win over memory.** If a summary and a file disagree, the file wins.
2. **One task, one executor.** Parallelism is per independent task, never per
   file that another task is editing.
3. **Traceability is mandatory.** Every task cites `Requirement <n>.<criterion>`;
   every property cites the requirements it validates.
4. **No silent scope growth.** New behavior becomes a new requirement, not a
   hidden implementation detail.
5. **Fail forward, but record it.** A failed task stays failed until a later
   attempt passes its checks; never mark it complete on a summary alone.
6. **Gates are decided by the engine, not the prose.** When the Kaze settings
   enable strict mode, validator warnings fail the gate too; a setting that
   turns validation off means the hook is skipped, not that gates pass.

## Placeholders used in this pack

| Placeholder | Meaning |
|---|---|
| `{{FEATURE}}` | kebab-case feature id |
| `{{SPEC_ROOT}}` | `.kaze` |
| `{{READ_TOOL}}` / `{{WRITE_TOOL}}` | host file tools |
| `{{SEARCH_TOOL}}` | grep/glob tool |
| `{{SHELL_TOOL}}` | command execution tool |
| `{{ASK_TOOL}}` | user question tool, if any |
| `{{SUBAGENT_TOOL}}` | sub-agent dispatch tool, if any |
| `{{MAX_PARALLEL}}` | max parallel tasks per wave: `.kaze/spec-config.json` `maxParallel` (default 3, range 1-8) |
