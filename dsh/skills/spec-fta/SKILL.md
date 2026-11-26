---
name: spec-fta
description: "FTA 审查 fta：只读对抗式检查遗漏、越界、漂移和回归。"
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


You are running the `/spec-fta` command in a Kaze spec flow.

Spec root is **.kaze**. Read the workspace's `AGENTS.md` when present and `core/fta.md` before acting.

This is an adversarial verification: do not edit code, build, or commit. It does
record the FTA decision, so `/spec-fta` alone is a complete gate step and the
user does not need a second command to persist the verdict.

Command purpose: find where the implementation drifts from the user's intent.

Dispatch a read-only adversarial verifier subagent; it returns Omission /
Commission / Drift / Regression findings with evidence, and the root session
records the gate decision. Do not paste the spec or diff into the main context.
See `core/delegation.md`.

Steps:
1. Read requirements.md (or bugfix.md), design.md, tasks.md, and
   `acceptance.md` if present.
2. Read the spec's `.kaze/<feature>/exec/context.json` if present; use its
   `user_intent` verbatim. Otherwise derive a proxy from the requirements
   Introduction and User Stories and say so.
3. Inspect the implementation diff with the host's native changes review or
   `git diff`. Read every file you cite.
4. Look for four classes: Omission, Commission, Drift, Regression.
5. Report each finding with severity `Blocker`, `Concern`, or `Note` (no color
   emoji), the requirement or intent quote, `file:line` evidence, impact, and one
   minimal remediation direction.
6. End the report with:

```text
Verdict: PASS | FAIL | PARTIAL
Blockers: N, Concerns: N, Notes: N
```

7. Record the decision with `kaze_spec_gate_record`:
   - PASS or PARTIAL: `gate=fta status=approved`, `details` = the verdict and
     counts, `evidence` = the strongest `file:line` proofs.
   - FAIL: `gate=fta status=failed`, `reason` = the verdict and the blocker
     titles, `return_to` = `design` when the spec must change, `tasks` when the
     task plan must change, `execute` when only the implementation must change.
8. If the gate was recorded FAIL, stop the completion step and surface every
   Blocker finding. Close with the exact rework path:
   - spec-level blocker: `/spec-refine` or `/spec-design`, then re-gate;
   - implementation-level blocker: fix it, then `/spec-apply` again;
   - after the rework: `/spec-complete feature=<feature>`.
   Do not auto-fix and re-run inside this command.
9. If the verdict was PASS or PARTIAL, close with
   `Next: /spec-complete feature=<feature>` (or, when called from
   `/spec-complete`, return the verdict and continue there).

Rules:
- Do not propose new requirements; report the gap.
- Do not record an approval without a real verdict and evidence.
- A skipped FTA must be recorded by the caller with a non-empty reason.

This skill is the /spec-fta command. Spec root is `.kaze`; the engine owns the
phase pointer and the gates.
