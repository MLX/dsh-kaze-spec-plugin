---
name: spec-run
description: "自主跑完 run：创建一个 DSH goal，循环执行任务、验收与 FTA，失败修复后重跑，直到无 Blocker 且回归无新增失败。"
user-invocable: true
---

> **Path contract:** `core/<file>` resolves to the workspace `core/` copy when
> present, otherwise the bundled core pack at `../../../core/<file>` relative to
> this skill. **Hard rules:** read `core/plugin-rules.md` before acting.
> `AGENTS.md` holds the workspace's Project Rules when present.
> `.kaze/...`
> and every spec artifact named below (`state.json`, `requirements.md`,
> `design.md`, `tasks.md`, `acceptance.md`, `delivery.md`, `gates.json`,
> `research.md`, `verification.md`, `bugfix.md`, `reviews/`, `exec/`,
> `exec/run.json`, `exec/evidence/`, `batch/`, `idle-queue.json`,
> `idle-config.json`, `spec-config.json`) live under the workspace's `.kaze/`
> tree, never relative to this skill directory.

You are running the `/spec-run` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`); the
DSH goal tools own continuation. Read `AGENTS.md` when present,
`core/run.md`, `core/execute.md`, `core/acceptance.md`, `core/fta.md`, and
`core/delegation.md` before acting. Never claim a phase is complete unless the
engine gate passes. Do not edit `state.json` or task markers by hand; use the
native tools.

Command purpose: drive one spec to done autonomously through one DSH goal. This
is the only command that intentionally creates a goal and lets goal rounds
repeat the apply → acceptance → FTA loop. The canonical completion sequence is
`core/completion.md`; goal rounds add the autonomous repair loop on top. It does not change the default
one-turn behavior of `/spec-apply`, `/spec-complete`, or `/spec-batch`.

Session boundary: run this in a **fresh execution session**. If this
conversation contains the spec's clarify/requirements/design work, stop and tell
the user to start a new session with `/spec-run feature=<name>`; do not create a
goal here. Read state and documents from disk; never rely on the creation
conversation.

Arguments:

- `feature=<name>`: the spec to run.
- `--max-rounds=N`: optional positive integer goal-round cap; default 12,
  capped at 64. `create_goal` receives this as `max_goal_rounds`.
- `--unattended` is implied: never ask a question mid-run. Choose the safest
  documented default; if a user decision is required, block and report.

Steps:

1. Use the injected `kaze:spec-context` block for `language` and `maxParallel`.
   Answer the user in that language. Cap one writer wave at `maxParallel`
   (default 3). Read `core/run.md`; if the workspace `core/` copy lacks it, read
   the bundled copy named by the path contract.
2. If `feature` is missing or empty, stop and report
   `/spec-run feature=<name> [--max-rounds=N]`; do not create a goal. Call
   `kaze_spec_status`. If the spec is missing, stop. If the phase is
   `done`, report the delivery path and stop without creating a goal. If the
   phase is earlier than `tasks`, or `tasks.md` has no required tasks, stop and
   tell the user to finish planning first. Read `tasks.md`, `state.json`,
   `gates.json`, `acceptance.md`, `verification.md`, and `exec/context.json`
   when present.
3. Resolve the regression baseline before creating the goal. For a brownfield
   feature or bugfix spec, use `exec/context.json` `regression_command`, then
   `verification.md`, `clarify.md`, or the workspace's documented test command.
   Do not invent a command. If no baseline exists, stop with
   `regression-baseline-unavailable` and tell the user what to record. For a
   greenfield spec, record `baseline: null` and say regression is not
   applicable.
4. Goal setup:
   - Call `get_goal`.
   - No goal: call `create_goal` with the marker objective from `core/run.md`
     and `max_goal_rounds`.
   - Same marker, `active`: if `roundsStarted >= maxGoalRounds`, stop and report
     the exhausted budget; otherwise use it. If `activation` is `disarmed` after
     a resume or fork, call `update_goal action=resume` with the exact id and
     revision.
   - Same marker, `blocked`: call `update_goal action=resume` when
     `roundsStarted < maxGoalRounds`; otherwise stop and report the exhausted
     budget.
   - Same marker, `paused`: stop and tell the user to resume it with
     `/goal resume`. The tool rejects a model-driven resume of a durable paused
     goal.
   - Same marker, `complete`: if the spec is done, report and stop; otherwise
     create a new goal.
   - A goal without this feature's marker: stop. Never replace another goal.
   - If `get_goal` is unavailable or fails, or `create_goal` fails, stop and
     report the tool error. Do not fall back to a plain one-turn `/spec-apply`.
5. Initialize or refresh `.kaze/<feature>/exec/run.json` per `core/run.md`.
   Mirror `round` from `get_goal().roundsStarted`; the goal is authoritative.
6. Call `get_goal` at the start of every round. If it is missing, `paused`, or
   its marker names another feature, stop. Then run one bounded round per turn:
   - **Execute:** call `kaze_spec_tasks` with `ready=true` (required tasks
     only). Pick up to `maxParallel` ready tasks with disjoint files. Set
     `in_progress` with `kaze_spec_task`, dispatch one executor subagent per
     task, and wait for `exec/evidence/<task-id>.json`. Mark `completed` only
     from evidence; on failure record the blocker. A failed task is reopened in
     a later round with `kaze_spec_task in_progress` (retry budget 2 per task;
     exhausted → `needs-spec-change`, see Repair). After the wave call
     `kaze_spec_sync`; advance to `execute` only when every required task is
     complete and the phase is behind `execute`. If work remains, persist and
     end the turn with the goal active; the next goal round continues.
   - **Complete:** when all required tasks are complete, verify
     `acceptance.md` (or record the documented unattended skip), dispatch a
     read-only FTA verifier per `core/fta.md`, run the regression baseline, and
     write or refresh `verification.md` for a brownfield or bugfix spec; for a
     verify-first spec, rebuild it only when missing or malformed, appending to
     the recorded Assertion Map and model evidence, never overwriting them.
     Record `kaze_spec_gate_record` for acceptance and FTA with concrete details
     and evidence, and call `kaze_spec_validate` after editing
     `acceptance.md` or `verification.md`. Compare the regression run with the
     recorded `baseline.failures`; a newly failing check is a Blocker. On FAIL,
     record `gate=fta status=failed` with a non-empty reason and `return_to`
     (earliest affected task id, or `execute`).
   - **Repair:** on FTA FAIL, fix only implementation and tests. Reopen the
     owning completed task with `kaze_spec_task in_progress` — each task has a
     total retry budget of 2 across rounds; once exhausted, record
     `needs-spec-change` and stop the round — dispatch one
     writer per independent file scope, record
     `exec/evidence/fta-round-<n>.json` (and refresh
     `exec/evidence/<task-id>.json`), append it to `remediations` in
     `exec/run.json`, verify, and mark the task completed again. Call
     `kaze_spec_sync`, then re-run acceptance (the task markers changed) and
     re-run FTA. If no task owns the gap, or the fix requires changing
     requirements, design, tasks, or acceptance criteria, do not edit the spec;
     record `needs-spec-change` and stop the round.
   - **Done:** if a capability is recorded, call `kaze_spec_merge` before done;
     a conflict stops the run. Call `kaze_spec_advance` to `done`. If the
     advance auto-archived the spec, report the archived path and skip
     `kaze_spec_delivery`; otherwise call `kaze_spec_delivery`. Then call
     `update_goal complete` with the exact id and revision. Call `get_goal`
     immediately before `update_goal` and retry once on a stale revision.
7. Apply the progress guard every round:
   - Build a stable fingerprint from the sorted Blocker signatures
     (`class|file:line|requirement`). If the same fingerprint persists for 3
     admitted goal rounds, call `update_goal blocked` with the concrete finding
     and stop.
   - If the same non-spec environment blocker persists for 3 admitted goal
     rounds, block the same way.
   - If `roundsStarted >= maxGoalRounds`, stop and report the exhausted budget.
     Do not call `blocked` before 3 admitted rounds; the tool rejects it.
8. Persist `exec/run.json` after every wave, gate, and remediation. Do not rely
   on conversation memory. Keep the report short: tasks completed/failed, gates
   recorded, exact verification commands and results, residual risks, goal
   id/revision/rounds, and the next action.

Stop conditions (all must hold for done):

- FTA verdict is PASS, or PARTIAL with 0 Blockers;
- the brownfield/bugfix regression baseline has no new failures;
- every acceptance criterion is checked, or acceptance was skipped with the
  documented reason;
- `kaze_spec_advance` to `done` passes and delivery is built, or the advance
  auto-archived the spec.

"0 problems" means 0 Blockers, not 0 Concerns or Notes. Report unresolved
Concerns and Notes as residual risks; do not silently widen the stop condition.

Rules:

- FTA and code review are read-only. The verifier never edits files.
- Do not edit task text, order, or dependencies, and do not edit requirements,
  design, or acceptance criteria to make a gate pass. Use `kaze_spec_task` for
  task status and check acceptance boxes only with evidence.
- Never force a gate. The only allowed skip is the documented unattended
  acceptance skip when `acceptance.md` is absent.
- Do not call `kaze_spec_archive` directly, commit, push, delete, or change
  scope. Auto-archive on done follows the Kaze setting. Do not create a worktree
  unless the user explicitly asked for one.
- Do not ask questions mid-run. If a user decision is required, stop and report
  the exact blocker.
- Use the host's native subagent tool for execution and FTA; run sequentially if
  it is unavailable. Never require Agent Team.
- Never run two writers on the same file. Never mark a task complete from a
  prose summary alone.
- Do not mirror spec tasks into `todo_write` or the Team board; the Host denies
  those tools while a spec is in the execute phase.

This skill is the `/spec-run` command. Spec root is `.kaze`; the goal is one
autonomous run, and every phase transition still goes through the host gates.
