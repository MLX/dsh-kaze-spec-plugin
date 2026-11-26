---
name: spec-batch
description: "批量执行 batch：顺序执行一个或多个 spec 的 apply + complete；支持无人值守。"
user-invocable: true
---

> **Path contract:** `core/<file>` resolves to the workspace `core/` copy when
> present, otherwise the bundled core pack at `../../../core/<file>` relative to
> this skill. **Hard rules:** read `core/plugin-rules.md` before acting.
> `AGENTS.md` holds the workspace's Project Rules when present.
> `.kaze/...`
> and every spec artifact named below (`state.json`, `requirements.md`,
> `design.md`, `tasks.md`, `acceptance.md`, `delivery.md`, `gates.json`,
> `research.md`, `verification.md`, `bugfix.md`, `model.smt2`, `reviews/`,
> `exec/`, `batch/`, `idle-queue.json`, `idle-config.json`, `spec-config.json`)
> live under the workspace's `.kaze/` tree, never relative to this skill directory.


You are running the `/spec-batch` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present, `core/execute.md`, `core/acceptance.md`,
`core/fta.md`, and `core/review-verify.md` before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.

Command purpose: finish one or more specs sequentially. `/spec-complete --apply`
and `/spec-run` each merge execution and completion for a single spec; this is
the only orchestrator that runs several specs sequentially. The canonical
completion sequence is `core/completion.md`; this section only adds batch and
idle deltas.

Arguments:
- `features=a,b,c` or `feature=a`: specs to process. If omitted, process every
  active spec under `.kaze` whose phase is not `done`.
- `--unattended`: never ask a question mid-run. Use the unattended defaults
  below; stop on the first blocker instead of guessing.
- `--dry-run`: list the resolved specs and their phase/task counts, then stop
  without writing spec state or a report.
- `--max-tasks=N`: optional cap on tasks executed per spec. If the cap is hit
  before all required tasks complete, report a blocker and stop that spec.
- `--complete`: default off. Off: each spec only advances to
  `kaze_spec_advance` to `execute` and then stops. On: after execution,
  continue through the acceptance → FTA → done completion sequence for each
  spec.
- `--idle`: process the idle queue instead of ordinary specs. This mode requires
  the current Beijing time to be idle; at peak, report the next idle window and
  stop without running anything.
- `--defer-optional`: while executing a spec, enqueue its optional tasks via
  `kaze_spec_idle` action=defer instead of executing them now.
- `--worktree`: create and enter a native Git worktree for each spec before
  running it. Requires the DSH `create_worktree` and `working_directory` tools.
  Do not merge, remove, or rebase the worktree; report its path and branch.
- `--resume`: continue the last batch from `.kaze/batch/last.json` instead of
  resolving features again. Specs recorded `done`/`skipped` are not repeated; the
  first `blocked`/`pending` spec is retried. Without a readable `last.json`,
  stop and say so.

Safety rules:
- Process specs **sequentially**. Never run two specs in parallel.
- Stop the batch on the first Blocker, failed gate, failed command, or missing
  evidence. Do not skip a blocker and continue.
- Do not git commit, push, delete, archive, or change scope in this command.
- Never fabricate acceptance, FTA, verification, or test evidence. If evidence
  cannot be produced, stop and report the blocker.
- Unattended means "no confirmation", not "no safety". It still stops on a
  blocker.
- In an unattended run, if a decision is genuinely ambiguous and no safe default
  exists, record the blocker and stop; do not ask.

Idle-queue mode (`--idle`):

Automatic idle execution is a host schedule, not a Kaze timer: create a DSH
scheduled task for `/spec-batch --idle` at an idle window. Kaze itself never
spawns turns. Holiday pricing is intentionally window/weekend-only.

Recommended DSH schedule (Beijing time, weekdays 20:00):

```text
DTSTART;TZID=Asia/Shanghai:20261125T200000
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=20;BYMINUTE=0
```

Prompt: `Run /spec-batch --idle --unattended in this workspace. Do not ask
questions; stop on the first blocker and report the batch report path.`

Add `--complete` only if the scheduled run may finish specs without a human
acceptance decision (unattended acceptance is recorded as skipped when absent).
Do not schedule inside a peak window; the run checks Beijing time and exits with
`nextIdle` if it is not idle.

Queue rules: `kaze_spec_idle` action=add is only for optional tasks; never
enqueue a required task. Auto-archive on done prunes the idle queue, so do not
trigger archive while the queue still has entries.

0. Recover interrupted work first: call `kaze_spec_idle` action=prune to drop
   entries whose spec/task disappeared (for example after an archive), then reset
   any entry with status `running` or `failed` whose `updatedAt` is older than
   60 minutes to `queued` with `kaze_spec_idle` action=update, and record the
   resets in the report.
1. Call `kaze_spec_idle` action=status. If `idle` is false, report `nextIdle`
   and stop. If `validation.ok` is false, run `prune` once and re-check; if it is
   still false, stop and report every conflict.
2. For each queue entry with status `queued`, in queue order:
   - check readiness first: call `kaze_spec_tasks` include_optional=true and
     confirm the entry's task is dependency-ready (a required prerequisite may
     have been completed after the defer). If it is not ready, skip this entry
     for this round — record the skip and its reason in the report and continue
     with the next entry; stop only when no entry in the whole queue is ready;
   - set its status to `running` with `kaze_spec_idle` action=update;
   - execute the task in its spec, collect evidence, and mark it completed
     with `kaze_spec_task`;
   - set the entry status to `done` on success, or `failed` with a blocker on
     failure. Stop the batch on the first failure.
3. Do not run acceptance/FTA/done for queue-only execution. Optional tasks are
   already excluded from completion gates. If `--idle` is combined with
   `--complete`, run completion per spec only after all of that spec's queued
   tasks finish.
4. Write the batch report with queue results and the next queued entry.
5. Do not execute unqueued specs in `--idle` mode.

Worktree mode (`--worktree`):

1. Check that the native `create_worktree` and `working_directory` tools are
   available. If they are missing, stop and tell the user to enable
   **Change requests & worktrees**; do not fall back silently.
2. Process one spec at a time. Before entering, remember the source checkout
   root and its `.kaze` directory.
3. Call `create_worktree` with `name: "kaze-<feature>-<UTC timestamp>"`; it
   creates the branch, checks out the worktree, and moves this session's
   working directory into it. If the workspace is not a Git checkout, stop with
   that blocker.
4. Copy the source `.kaze` tree into the worktree if it is not already there
   (`cp -a <repositoryRoot>/.kaze/. <path>/.kaze/`). The worktree starts from
   HEAD, so uncommitted source changes are intentionally not copied.
5. Run this spec's apply + complete steps with the Session now inside the
   worktree. Kaze tools use the Session working directory, so `state.json`,
   `tasks.md`, gates, and delivery stay isolated in the worktree.
6. Write the batch report under the worktree's `.kaze/batch/`, then use
   `working_directory` to cd back to the source checkout root, even when the
   spec is blocked.
7. Copy the report and `last.json` back to the source checkout's `.kaze/batch/`
   after exit, so `--resume` works from the source workspace. A resumed worktree
   batch re-enters a new worktree only for the remaining specs; never reuse a
   worktree that already has a report from a different run.
   Leave the worktree and branch in place; report both paths. Never merge,
   remove, or rebase it automatically.

Per-spec procedure:

1. Call `kaze_spec_status`. If the phase is `done`, record it as skipped in the
   batch summary and move to the next spec.
2. Execute tasks:
   - If `--defer-optional` is set, call `kaze_spec_idle` action=defer
     feature=<feature> first; do not execute the deferred optional tasks.
   - Call `kaze_spec_tasks` ready=true. If the user asked for optional tasks,
     include_optional=true; otherwise required tasks only.
   - Take `maxParallel` from the injected `kaze:spec-context` block (default 3)
     and pick up to that many ready tasks that do not edit the same files. Use
     the host's native subagent/task tool when available; otherwise run
     sequentially.
   - For each task: set `in_progress` with `kaze_spec_task`, do the work, collect
     concrete evidence, then set `completed`; on failure keep `in_progress` or
     set `failed` and stop this spec.
   - Repeat until no ready tasks remain. If `--max-tasks=N` is reached before
     completion, stop and report a blocker.
   - Call `kaze_spec_sync`, then `kaze_spec_advance` to `execute`.
   - If any required task remains incomplete, record a blocker and stop.
   - Without `--complete`, stop here: record the spec as `pending` (phase
     `execute`) in the summary and move to the next spec.
3. With `--complete`, acceptance:
   - If `acceptance.md` exists, verify every Success Criterion against concrete
     evidence. Edit only criteria you actually verified, then call
     `kaze_spec_gate_record` gate=acceptance status=approved with `details` and
     `evidence`. If any criterion fails, record status=failed with `details`, a
     non-empty `reason`, and `return_to=execute` (or `design` when the criterion
     itself is wrong, or `tasks` when the plan lacks the covering task); stop.
   - If `acceptance.md` does not exist:
     - with `--unattended`, call `kaze_spec_gate_record` gate=acceptance
       status=skipped with reason `unattended: acceptance.md absent; acceptance
       explicitly skipped`;
     - otherwise ask whether to skip acceptance, and record the answer with a
       non-empty reason if skipped.
4. With `--complete`, FTA:
   - With `--unattended`, run FTA. Otherwise ask "Run FTA now?" and honor the
     answer.
   - Inspect requirements/design/tasks and the implementation diff for Omission,
     Commission, Drift, and Regression. Record gate=fta approved with the verdict
     and evidence, or failed with the verdict, a non-empty reason, and
     `return_to` (`design`, `tasks`, or `execute`).
   - On FAIL, stop the batch and surface every Blocker finding.
   - Do not record an FTA approval without a real verdict and evidence.
5. With `--complete`, verification:
   - If the spec is a brownfield feature, a bugfix, or verify-first and
     `verification.md` is missing or malformed, write it from the exact commands
     run and their observed output. For a verify-first spec, append the new
     results and preserve the recorded Assertion Map and model evidence; never
     overwrite them. If no real command or manual check exists,
     stop with a blocker; do not invent a report.
6. With `--complete`, capability: if the spec records a `capability`, call
   `kaze_spec_merge`
   before done; a conflict is a blocker (resolve with
   `kaze_spec_merge force=true` or by editing the capability spec). If no
   capability is set and `.kaze/specs` exists, ask once in an attended run
   whether this spec should update a capability; in unattended mode skip the
   merge and record that the capability was not updated.
7. With `--complete`, advance to done:
   - Call `kaze_spec_advance` to `done`; the host builds `delivery.md`.
   - If the result contains `autoArchive.archived: true`, the spec is already at
     `.kaze/archive/<archive-id>/`; report that path and do not call
     `kaze_spec_delivery`.
   - Otherwise call `kaze_spec_delivery` to confirm/rebuild it.
8. Record one summary row for this spec and continue to the next spec only when
   there is no blocker.

Batch report:
- Unless `--dry-run`, write `.kaze/batch/<UTC timestamp>-report.md` with:
  - mode (`attended` or `unattended`), started/finished timestamps;
  - requested features and resolved features;
  - a table: feature, phase before, tasks completed/total, acceptance status,
    FTA status, delivery path/freshness, result;
  - blockers with exact evidence;
  - specs not started because the batch stopped;
  - the next action for each blocked spec;
  - starvation hint: a spec that stays blocked makes every subsequent run stop
    at the same place; when the same blocker repeats across runs, use this
    report's next-action hint to intervene manually before the next scheduled
    run.
- Also write `.kaze/batch/last.json` for `--resume`:
  ```json
  {
    "schema": 1,
    "startedAt": "…",
    "finishedAt": "…",
    "complete": false,
    "features": [
      { "feature": "a", "result": "done" },
      { "feature": "b", "result": "blocked", "blocker": "…" }
    ],
    "nextFeature": "b"
  }
  ```
  Update it after every spec so an interrupted batch always has a resume point.
  `result` is `done`, `skipped`, `blocked`, or `pending`.
- Do not put dot-prefixed files inside `.kaze`.
- Do not archive specs. Leave done specs for the user or `/spec-archive`. The
  one exception is the profile's **archive on done** setting: when it is on, the
  advance already moved the spec, so record the archived path instead of
  treating it as a blocker.

Host capabilities:
- Specs run sequentially even when Agent Team is enabled. Inside one spec, if
  Team is enabled, create one team task per ready task and spawn subagents by
  independent write scope; if Team is disabled, run sequentially.
- Use native web search, terminal, changes review, and worktree tools only when
  available. If a related plugin is disabled, use the fallback and never require
  it. With `--worktree`, creation is explicitly requested for each spec; still
  never merge, remove, or rebase the worktree automatically.

This skill is the /spec-batch command. Spec root is `.kaze`; it may run apply and
complete steps, but every phase transition still goes through the host gates.
