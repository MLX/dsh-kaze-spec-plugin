# Autonomous Run Loop

`/spec-run` is the explicit autonomous entry. It creates one DSH goal and lets
the goal-round driver continue the same execution session until the spec is
done, the goal is blocked, or the round budget is exhausted. It does not change
the default one-turn behavior of `/spec-apply`, `/spec-complete`, or
`/spec-batch`.

## Entry and session boundary

- Run `/spec-run` in a **fresh execution session**, never in the session that
  wrote the spec.
- The first turn must contain a direct human command. The DSH goal tools reject
  a goal created by a subagent, a scheduler, or a plugin background action.
- Use the injected `kaze:spec-context` block for `language` and `maxParallel`;
  answer the user in the configured language and cap one writer wave at
  `maxParallel`. Read `.kaze/spec-config.json` only when the block is absent.

## One goal per run

Create the goal only after the preflight checks pass. The preflight checklist:

- session boundary: this is a fresh execution session, not the spec's recorded
  creator session;
- the phase is `tasks` or later and `tasks.md` has at least one required task;
- the regression baseline is resolvable (see Run state below);
- the DSH goal tools are available (`get_goal` and `create_goal` respond);
- the `[kaze-spec-run:<feature>]` marker does not collide with an existing
  active goal for another feature.

Replace `<feature>` with
the actual feature id and put this marker at the start of the objective:

```text
[kaze-spec-run:<feature>]
```

The marker identifies the goal as a Kaze run. Use it to avoid adopting a goal
that belongs to a different feature.

Template:

```text
[kaze-spec-run:<feature>] Drive Kaze spec <feature> to done. Read
core/plugin-rules.md, core/run.md (workspace copy, else the bundled Kaze core
pack), and .kaze/<feature>/exec/run.json at the start of every round; follow
the /spec-run loop. Execute required tasks with evidence; verify every acceptance
criterion; run FTA read-only. On FTA FAIL, fix only implementation and tests,
record .kaze/<feature>/exec/evidence/fta-round-<n>.json, and re-run acceptance
and FTA. Stop only when FTA has 0 Blockers, the brownfield regression baseline
has no new failures, every acceptance criterion is checked, and
kaze_spec_advance to done succeeds; then build delivery and mark this goal
complete. Never edit requirements.md, design.md, or tasks.md text, or the
acceptance criteria, to make a gate pass; task status updates with
kaze_spec_task and evidence-backed acceptance checkboxes are allowed. Never
force a gate. The only allowed gate skip is the documented unattended
acceptance skip when acceptance.md is absent. Never call kaze_spec_archive
directly, commit, push, or change the spec scope. If the same Blocker
fingerprint persists for 3 goal rounds, the round cap is reached, or a fix
requires a spec change, mark the goal blocked with the concrete reason.
```

Goal lifecycle rules:

- No current goal: `create_goal` with the objective and `max_goal_rounds`
  (plugin convention: default 12, capped at 64).
- Same marker and `active`: when `roundsStarted >= maxGoalRounds` the budget is
  exhausted. Call `update_goal action=blocked` with the reason
  `budget-exhausted` when the engine accepts it (it rejects `blocked` before
  the configured minimum round count); otherwise record the exhausted budget
  in `exec/run.json` and stop the round, reporting that the cap is spent and
  can be raised with `/goal edit` or spent on a new `/spec-run`. Otherwise use
  the goal. If `activation` is `disarmed` after a
  session resume or fork, `update_goal action=resume` in the direct-human entry
  turn.
- Same marker and `blocked`: `update_goal action=resume` when `roundsStarted <
  maxGoalRounds`; otherwise stop and report the exhausted budget.
- Same marker and `paused`: stop and ask the user to resume it with
  `/goal resume`; the model cannot resume a durable paused goal.
- Same marker and `complete`: if the spec is done, report and stop; otherwise
  create a new goal.
- A goal without this feature's marker: stop. Never replace another goal.
- Call `get_goal` immediately before every `update_goal` and copy the exact
  `goal_id` and `revision`. A stale revision is retried once after `get_goal`.

If the goal tools are unavailable or `create_goal` fails, stop and report the
tool error. Do not fall back to a one-turn `/spec-apply`.

## Run state

Keep a small, explicit state file so a later round does not depend on chat
history:

```text
.kaze/<feature>/exec/run.json
```

Shape:

```json
{
  "schema": 1,
  "feature": "user-auth",
  "entry": "spec-run",
  "goalId": "goal-...",
  "goalRevision": 1,
  "startedAt": "2026-11-25T02:00:00.000Z",
  "round": 0,
  "maxRounds": 12,
  "status": "running",
  "baseline": { "command": "pnpm test", "result": "pass", "failures": [], "at": "..." },
  "lastFta": { "verdict": "FAIL", "blockers": 2, "fingerprint": "...", "at": "..." },
  "sameBlockerRounds": 1,
  "blockedReason": null,
  "remediations": []
}
```

Rules:

- Update it after every task wave, gate decision, and remediation.
- `round` mirrors `get_goal().roundsStarted`; the goal is authoritative.
- `baseline` is the no-regression command and its observed result. For a
  brownfield feature or bugfix spec, resolve it from `exec/context.json`
  (`regression_command`), `verification.md`, `clarify.md`, or the workspace's
  documented test command. Never invent a command. If none exists, stop before
  creating the goal with `regression-baseline-unavailable`. Store the failing
  check names in `failures` so a newly failing check is a set difference, not a
  raw exit-code comparison.
- `lastFta.fingerprint` is a stable string of the sorted Blocker signatures
  (`class|file:line|requirement`); it is compared across rounds, not hashed for
  security.
- The file is advisory run state. `state.json`, `tasks.md`, and `gates.json`
  remain authoritative.

## Round procedure

At the start of every goal round:

1. `get_goal`; confirm the marker, phase, and revision. Read `exec/run.json`,
   `state.json`, `tasks.md`, `gates.json`, `acceptance.md`, and
   `verification.md` from disk.
2. `kaze_spec_status`. If the phase is `done`, mark the goal complete if it is
   still active and report the delivery path.
3. If the spec is earlier than `tasks`, or `tasks.md` has no required tasks,
   stop and tell the user to finish planning. Do not create spec documents.
4. Update `exec/run.json` with the current round and status.

### A. Execute required tasks

- Call `kaze_spec_tasks` with `ready=true`; required tasks only.
- Pick up to `maxParallel` ready tasks that do not edit the same files.
- For each task: set `in_progress` with `kaze_spec_task`, dispatch one executor
  subagent, and wait for evidence. The executor writes
  `exec/evidence/<task-id>.json` with files, commands, and results.
- Mark `completed` only from evidence; on failure keep `in_progress` or set
  `failed` and record the blocker.
- A `failed` task is not terminal: in a later round reopen it with
  `kaze_spec_task status=in_progress` and dispatch it again with a narrower
  scope, within the retry budget of 2 attempts per task (`./delegation.md`).
  When the budget is exhausted, follow Section C's `needs-spec-change` path
  for the recorded blocker.
- After the wave call `kaze_spec_sync`. Advance to `execute` only when every
  required task is complete and the phase is behind `execute`.
- If a blocker remains, apply the progress guard: compare the current blocker
  fingerprint with `lastFta.fingerprint`; on a match increment
  `sameBlockerRounds` in `exec/run.json`, on a change reset it to 1. When the
  same fingerprint persists for 3 admitted goal rounds, mark the goal blocked
  with that reason. Otherwise end the turn with
  the goal active and let the next goal round continue.

Do not try to finish the whole spec in one turn. Persist after each wave.

### B. Acceptance and FTA

When every required task is complete:

1. If `acceptance.md` exists, verify every Success Criterion against concrete
   evidence. Check a criterion only when evidence exists, then call
   `kaze_spec_validate`. If all pass, record
   `kaze_spec_gate_record gate=acceptance status=approved` with `details` and
   `evidence`. If any fails, record `status=failed` with a non-empty reason and
   treat the gap as a Blocker.
2. If `acceptance.md` is absent, record `kaze_spec_gate_record gate=acceptance
   status=skipped` with reason `unattended: acceptance.md absent; acceptance
   explicitly skipped`.
3. Dispatch a read-only adversarial verifier subagent per `core/fta.md`. It
   returns Omission / Commission / Drift / Regression findings with evidence
   and a verdict. Do not paste the spec or diff into the main context.
4. Record `kaze_spec_gate_record gate=fta status=failed` with `details`, a
   non-empty `reason`, and `return_to` (the earliest affected task id, or
   `execute`) when at least one Blocker survives the evidence bar. Record
   `status=approved` with the verdict and evidence when no Blocker survives. A
   `PARTIAL` verdict with 0 Blockers is approvable; report its Concerns and
   Notes as residual risks.
5. Run the regression command and compare its failing checks with
   `baseline.failures`. A check that is newly failing is a Blocker. Record the
   exact command and output.
6. For a brownfield feature, a bugfix, or a verify-first spec, ensure
   `verification.md` records the exact commands, observed output, and manual
   checks, then call `kaze_spec_validate`. For verify-first, append to the
   existing record and extend its Assertion Map; rebuild it only when it is
   missing or malformed, and never overwrite the planning-time model evidence.
   Never invent evidence.

### C. Remediation between FTA runs

FTA stays read-only. Fixing happens in the orchestrator, not in the verifier.

- For each Blocker, identify the owning completed task and the file scope.
- If the owning task exists and the fix does not change requirements, design,
  tasks, or acceptance criteria: reopen it with `kaze_spec_task in_progress`,
  dispatch one writer subagent per independent file scope, fix implementation
  and tests, run the task's verification command, refresh
  `exec/evidence/<task-id>.json`, write
  `exec/evidence/fta-round-<n>.json`, then mark the task `completed` again and
  call `kaze_spec_sync`.
- If no task owns the gap, or the fix requires changing requirements, design,
  tasks, or acceptance criteria: do not edit the spec. Record
  `status=needs-spec-change` and the concrete finding in `exec/run.json`, then
  stop the round and report. If the same condition persists for 3 admitted goal
  rounds, mark the goal blocked.
- After the fixes pass, re-run acceptance (the task markers changed, so the
  approval hash moved), then re-run FTA. Never mark FTA approved without a
  fresh verdict.

### D. Done and delivery

When acceptance, FTA, and the regression check are clean:

1. If the state records a `capability`, call `kaze_spec_merge` before done. A
   conflict stops the run; do not force it. Record the conflict in
   `exec/run.json` as `status=needs-spec-change` with the finding, stop the
   round, and report the conflicting titles; if the conflict persists for 3
   admitted goal rounds, mark the goal blocked with the reason
   `capability-merge-conflict`.
2. Call `kaze_spec_advance` to `done`. If a gate fails, fix the cause and retry;
   if the cause is a spec change, use the spec-change blocker path.
3. If the advance auto-archived the spec because of the Kaze setting, report the
   archived path and do not call delivery on the missing directory. Otherwise
   call `kaze_spec_delivery`.
4. Write `status=done` in `exec/run.json`, then call `update_goal complete` with
   the exact id and revision.
5. Report tasks, gates, verification commands, delivery path, residual risks,
   goal id/revision/rounds, and whether auto-archive ran.

## Stop and blocked conditions

Done:

- FTA has 0 Blockers (PASS, or PARTIAL with no Blocker);
- the brownfield/bugfix regression baseline has no new failures;
- every acceptance criterion is checked, or acceptance was skipped with the
  documented reason;
- `kaze_spec_advance` to `done` passes and delivery is built, or the advance
  auto-archived the spec.

Blocked:

- the same Blocker fingerprint persists for 3 admitted goal rounds;
- the goal round cap is exhausted;
- a capability merge conflict persists for 3 admitted goal rounds
  (`capability-merge-conflict`);
- a fix requires a spec change the user has not approved;
- an environment blocker (missing tool, command, or service) persists for 3
  admitted goal rounds;
- a goal-tool authority or revision error cannot be resolved.

The `update_goal blocked` call is rejected before the configured minimum round
count. Record the blocker in `exec/run.json` and stop the early round; do not
try to bypass the threshold.

"0 problems" means **0 Blockers**, not 0 Concerns or Notes. Report unresolved
Concerns and Notes as residual risks. A stricter bar requires a new user
decision; do not silently widen the stop condition.

## Safety rules

- FTA and code review are read-only. Never let the verifier edit files.
- Do not edit task text, order, or dependencies, and do not edit requirements,
  design, or acceptance criteria to make a gate pass. `kaze_spec_task` status
  updates and acceptance checkboxes backed by evidence are the only allowed spec
  edits.
- Never force, skip, or re-record a gate without a fresh evidence-backed
  decision. The only allowed skip is the documented unattended acceptance skip.
- Do not call `kaze_spec_archive` directly, commit, push, delete, or change
  scope. Auto-archive on done follows the Kaze setting. Do not create a worktree
  unless the user explicitly asked for one.
- Do not ask questions mid-run. If a user decision is required, stop and report
  the exact blocker.
- Use subagents for execution, FTA, and repeated read-only work. Never run two
  writers on the same file. If subagents are unavailable, run sequentially.
- Do not mirror spec tasks into `todo_write` or the Team board; the Host denies
  those tools while a spec is in the execute phase.
