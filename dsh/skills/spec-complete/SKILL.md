---
name: spec-complete
description: "完成交付 complete：验收、FTA、推进到 done 并生成 delivery。"
user-invocable: true
---

> **Path contract:** `core/<file>` resolves to the workspace `core/` copy when
> present, otherwise the bundled core pack at `../../../core/<file>` relative to
> this skill. **Hard rules:** read `core/plugin-rules.md` before acting.
> `AGENTS.md` holds the workspace's Project Rules when present.
> `.kaze/...`
> and every spec artifact named below (`state.json`, `requirements.md`,
> `design.md`, `tasks.md`, `acceptance.md`, `delivery.md`, `gates.json`,
> `research.md`, `verification.md`, `bugfix.md`, `reviews/`, `exec/`, `batch/`,
> `idle-queue.json`, `idle-config.json`, `spec-config.json`) live under the
> workspace's `.kaze/` tree, never relative to this skill directory.


You are running the `/spec-complete` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, do not ask questions: choose the safest reasonable
default and state the assumption.

Command purpose: Verify acceptance, run FTA, advance the spec to done, and build delivery.
The canonical sequence is `core/completion.md`; this command is its attended
entry point. If the steps below disagree with that file, `core/completion.md`
wins.

Session boundary: run this in a **fresh execution session**, never in the
session that created the spec. If this conversation already contains the spec's
clarify/requirements/design work, stop and tell the user to start a new session
with `/spec-complete feature=<feature>`. Read state and documents from disk. See
`core/delegation.md`.

Delegation: dispatch FTA and acceptance evidence gathering to read-only
subagents; the acceptance and gate decisions stay in this session. Do not paste
requirement documents or test output into the main context.

This command does not implement tasks. If required tasks are incomplete, stop
and tell the user to run `/spec-apply`.

Arguments:
- `feature=<name>`: the spec to complete.
- `--apply`: execute ready tasks first, using the `/spec-apply` rules, then
  continue with completion. This merges apply and complete for one spec.
- `--idle` or `--defer-optional`: before executing, enqueue optional tasks with
  `kaze_spec_idle` action=defer and skip them now.
- `--unattended`: never ask a question; skip acceptance with a recorded reason
  when `acceptance.md` is absent, run FTA, and stop on the first blocker. This
  is the single-spec unattended completion mode. For a batch that also executes
  tasks, use `/spec-batch --unattended`.

Steps:
1. Read requirements.md (or bugfix.md), design.md, tasks.md, state.json,
   gates.json, and acceptance.md if it exists.
2. If `--apply` is set, execute ready tasks now (same rules as `/spec-apply`);
   if `--idle` is set, call `kaze_spec_idle` action=defer first. Stop on the
   first blocked or failed task. Then confirm every required task is completed.
   If not, stop and report exactly which tasks remain; do not record acceptance
   or FTA.
3. Acceptance decision:
   - If `acceptance.md` exists, verify every Success Criterion against concrete
     evidence (command output, file/line, observed behavior). Check only the
     criteria you verified. A criterion covered only by optional tasks is not
     verified here: it needs evidence from at least one required task. If every
     criterion passes, call
     `kaze_spec_gate_record` gate=acceptance status=approved with `details` and
     `evidence`. If any criterion fails, record status=failed with `details`,
     a non-empty `reason`, and `return_to=execute` (or `design` when the
     criterion itself is wrong, or `tasks` when the plan lacks the covering
     task), then stop and report the gaps. If a criterion
     neither fails nor can be evidenced in this environment, ask the user to
     record it as skipped with a reason, or record status=failed with a
     `return_to`; never approve it without evidence.
   - If `acceptance.md` does not exist and `--unattended` (or a non-interactive
     run) is set, record gate=acceptance status=skipped with reason
     "unattended: acceptance.md absent; acceptance explicitly skipped".
     Otherwise ask whether to skip acceptance and record the answer with a
     non-empty reason. Never record an approval without criteria.
4. FTA:
   - With `--unattended` (or a non-interactive run), run FTA. Otherwise ask:
     "Run FTA adversarial verification now?" and offer Run FTA / Skip.
   - If run, follow `core/fta.md`: inspect the requirements/design/tasks and
     the implementation diff for Omission, Commission, Drift, and Regression.
     Record gate=fta status=approved with the verdict and evidence when no
     Blocker survives the evidence bar, or status=failed with the verdict, a
     non-empty reason, and `return_to` (`design` for a spec change, `tasks` for
     a plan change, `execute` for an implementation-only fix). On failure, stop
     and surface every Blocker finding.
   - If skipped, record gate=fta status=skipped with a non-empty reason.
5. If the spec is a brownfield feature, a bugfix, or verify-first and
   `verification.md` is missing or malformed, write it with the exact commands
   run, their observed output, and any manual checks. For a verify-first spec,
   append the new results and preserve the recorded Assertion Map and model
   evidence; never overwrite them. Do not invent evidence.
   Greenfield feature specs may omit it.
6. Capability (see `core/living-specs.md`):
   - If the spec records a `capability`, call `kaze_spec_merge` before done. A
     reported conflict stops completion until the capability spec is edited or
     the merge is forced:
     `kaze_spec_merge { feature: "<feature>", force: true }`.
   - If it has no capability but `.kaze/specs` exists, ask once (unless
     `--unattended`) whether this spec should update a capability. On yes, call
     `kaze_spec_capability` then `kaze_spec_merge`; on no or unattended, leave
     it unset and say so in the report.
7. Call `kaze_spec_advance` to `done`. The host rebuilds `delivery.md` as part
   of the phase transition. Auto-archive on done prunes the idle queue; do not
   trigger archive while the queue still has entries.
   - If the result contains `autoArchive.archived: true`, the profile setting
     already moved the spec to `.kaze/archive/<archive-id>/`; **skip step 8**
     and report that path (the report was built before the move).
   - If `autoArchive.archived` is false, report the archive failure but do not
     treat done as failed.
8. Only when the spec is still active, call `kaze_spec_delivery` to confirm or
   rebuild the report, then report its path, gate history, and residual risks.
9. Mention that `kaze_spec_archive` can move the spec to `.kaze/archive/`.
   Archive only when the user asks.
10. Do not edit implementation code in this command. If acceptance or FTA fails,
    return to the user with the gaps instead of patching them here. Use the
    recorded `return_to` in your closing instructions: change the spec
    (`/spec-refine` or `/spec-design`), the plan (`/spec-tasks`), or the
    implementation (`/spec-apply`), then run `/spec-complete` again.

Host capabilities:
- If Agent Team is enabled and `--apply` is used, create one team task per ready
  task and spawn subagents by independent write scope; wait for evidence before
  updating `tasks.md`. If Team is disabled, use single-agent execution.
- Use native web search, terminal, changes review, and worktree tools only when
  they are available. If a related plugin is disabled, use the documented
  fallback and never require it to be enabled.
- Do not create, merge, or remove a worktree unless the user explicitly asked.

This skill is the /spec-complete command. Spec root is `.kaze`; the engine owns
the phase pointer, the gates, and the auto-archive setting.
