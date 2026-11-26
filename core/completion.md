# Completion Contract

This is the one completion sequence for a spec. `/spec-complete`,
`/spec-apply --complete`, `/spec-batch`, and `/spec-run` all follow it; their
own sections only describe entry points, arguments, and autonomous deltas. If a
command's wording disagrees with this file, this file wins.

## Preconditions

- `phase` is `tasks` or later, and every required task is completed with a valid
  `exec/evidence/<task-id>.json` record.
- `requirements.md` (or `bugfix.md`), `design.md`, and `tasks.md` pass
  `kaze_spec_validate`; `clarify.md` is present and has no open question.
- Acceptance and FTA decisions are recorded after the last document edit. A
  decision whose document hash no longer matches is stale and must be re-recorded.

## Steps

1. **Acceptance decision.** If `acceptance.md` exists, verify every Success
   Criterion against concrete evidence, check only the criteria you verified,
   then record `gate=acceptance status=approved` with `details` and `evidence`.
   If a criterion fails, record `status=failed` with a reason and `return_to`
   (`execute`, `design`, or `tasks`) and stop. If `acceptance.md` is absent, ask
   (or, only when `--unattended`, skip) and record `status=skipped` with a
   non-empty reason.
2. **FTA.** Run a read-only adversarial verifier per `core/fta.md`. Record
   `gate=fta` as `approved` (PASS, or PARTIAL with 0 Blockers), `failed` (any
   Blocker, with `return_to`), or `skipped` with a non-empty reason. Include
   `Blockers: N, Concerns: N, Notes: N` in `details`.
3. **Regression baseline.** For a brownfield feature or a bugfix spec, run the
   regression command resolved from `exec/context.json` (`regression_command`),
   `verification.md`, `clarify.md`, or the workspace's documented test command;
   never invent one. A check that is newly failing compared with the recorded
   baseline failures is a Blocker: fix it or record `gate=fta status=failed`
   with `return_to` before done. When no baseline can be resolved, the
   tasks-gate regression checkpoint and the FTA Regression category carry the
   check instead; state that fact in the delivery residual risks.
4. **Verification record.** For a brownfield feature, a bugfix, or a verify-first
   spec, ensure `verification.md` records `## Method` and `## Result`
   (PASS/FAIL/PARTIAL) with the exact commands and observed output. For
   verify-first, append to the existing record and extend its `## Assertion
   Map`; rebuild it only when it is missing or malformed, and never overwrite
   the planning-time model evidence. Never invent a command or result.
5. **Capability.** If `state.json` records a `capability`, call
   `kaze_spec_merge` before `done`. A merge conflict stops completion. The merge
   requires acceptance and FTA to be decided and the approvals to be fresh.
6. **Done.** Call `kaze_spec_advance` to `done`. Every gate is enforced; never
   bypass a failure. The done gate also fails when a recorded PBT property ends
   in a failed record; re-run it with `/spec-pbt` and record a passing result
   first. If the profile setting auto-archives the spec, report the archived
   path and skip step 7.
7. **Delivery.** Call `kaze_spec_delivery` to confirm or rebuild `delivery.md`.
   Report its path, the latest gate statuses, and residual risks.
8. **Archive (optional).** Only archive when the user asks (or the auto-archive
   setting already moved the spec). Archiving re-checks the done gate and merges
   the capability first; a stale approval blocks it.

## Failure and rework

- Acceptance failed: return to `execute` for implementation, `design` for a
  wrong criterion, or `tasks` for a plan gap; re-run this contract. A criterion
  covered only by optional tasks (the tasks-phase coverage rule) is such a plan
  gap: `return_to=tasks`.
- FTA failed: return to `execute` for an implementation-only fix, `tasks` for a
  plan change, or `design` when the spec must change; re-run this contract.
- Capability conflict: edit the capability spec or pass `force=true` only after
  a user decision; then resume at step 5.
- `done` is terminal. Do not edit documents, tasks, or scope after `done`; create
  a new feature or bugfix spec for new work. If a done spec was edited outside
  the engine, re-verify and re-record its gates, or restore a clean copy.

## Rules

- The only allowed skip is a missing `acceptance.md` recorded as `skipped` with a
  reason (or FTA skipped with a reason).
- Never force a gate; a failed gate stays failed until the cause is fixed.
- Completion never implements code. If tasks or acceptance fail, stop and report
  the exact rework path.
