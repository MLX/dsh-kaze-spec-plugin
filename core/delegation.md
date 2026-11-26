# Delegation and Session Boundaries

Context is the scarce resource. The main session keeps decisions and evidence;
subagents do the reading, writing, and repeated work.

## Session boundary

| Work | Session |
|---|---|
| wish, explore, clarify, requirements, design, tasks | the **creation session** (may use subagents for read-only exploration) |
| apply, complete, run, batch, FTA, code review | a **fresh execution session** started after the spec is approved |

Rules:

- Never run `/spec-apply`, `/spec-complete`, `/spec-batch`, `/spec-run`, or
  inline task execution in the session that wrote the spec. If this
  conversation contains the clarify/requirements/design work, stop and tell the
  user to start a new session with the exact command, e.g.
  `Start a new session in this workspace and run /spec-apply feature=<name>`.
- `/spec-run` is the only command that creates a DSH goal. The goal rounds stay
  in the same execution session; they do not return to the creation session.
- The execution session reads `.kaze/<feature>/state.json`, `tasks.md`,
  `clarify.md`, `design.md`, and `exec/context.json` **from disk**. It never
  relies on the creation conversation.
- If a fresh session is impossible (the host cannot open one), say so and ask
  the user before continuing; do not silently pollute the creation context.
- For specs created by `kaze_spec_init`, the native tools enforce this boundary:
  the creation session cannot change tasks, record acceptance/FTA, merge a
  capability, or advance to `execute`/`done` (`KAZE_SPEC_SESSION`). A spec
  created before this field, or from the tab, stays prompt-guarded.

## Delegation matrix

| Work | Delegate? | Why |
|---|---|---|
| codebase exploration / "where is X" | yes, read-only subagent | bulk reading, returns a map |
| external research angles | yes, one subagent per angle | parallel evidence gathering |
| implement one spec task | yes, one executor per task | isolation, fresh context |
| run a task's verification | inside that executor | evidence belongs with the change |
| repeated mechanical checks (lint, scan, baseline) | yes, one subagent per group | avoids main-context churn |
| independent review / FTA | yes, read-only adversarial subagent | no authorship bias |
| clarification interview | **no** — root only | a child cannot ask (`DELEGATED_CALLER`) |
| write requirements/design/tasks | no, root (or the phase agent routed by `/spec`) | needs the ledger and judgments |
| acceptance decision, gate decision, final summary | no, root | accountable decisions |

## Dispatch contract

Every executor prompt contains only:

1. task id and the task text;
2. the verbatim requirement clause(s) it satisfies, not just numbers;
3. the design section pointer with a one-line excerpt;
4. the files it owns;
5. the target platform and exact verification command;
6. stop rule: do not touch other tasks, do not change `tasks.md`/`state.json`,
   stop and explain if the task is impossible; return `BLOCKED` with a rollback
   plan before a destructive or irreversible operation.

The return is short: files changed, commands and results, requirement ids,
blockers. No file dumps.

## Context hygiene

- Do not paste whole documents or command output into the main session; keep the
  task id, status, path, and one-line evidence.
- Use `exec/context.json` instead of re-reading the spec for every dispatch.
- After each wave, persist status with `kaze_spec_task`/`kaze_spec_sync`; later
  turns resume from disk, not from chat history.
- If the main context still grows, stop the wave, persist, and continue in a new
  session with the same feature id.
- Parallelism: write tasks up to `maxParallel` from the injected
  `kaze:spec-context` block; read-only subagents up to 5. Never run two writers
  on the same file.

## Failure handling

- A failed task has a retry budget of **2 attempts in total**. A retry reopens
  the task in a later round with `kaze_spec_task status=in_progress` and
  dispatches it again with a narrower scope; a `BLOCKED` question does not
  consume the budget (`./clarify.md`, `./execute.md`). When the budget is
  exhausted the task stays `failed` with the blocker recorded, and the run
  follows the blocker → `needs-spec-change` path: record it and stop the round.
  There is no `needs_user` task status; a user decision is a
  blocker reported to the root session.
- A subagent that cannot finish must return the blocker, not a summary that
  sounds complete.
- A retry must converge on the root cause. A bypass that only silences the
  failing check is a deviation with a follow-up task, not a fix; record it and
  keep the task honest.
- Never mark a task complete from a subagent's prose; require its evidence.
