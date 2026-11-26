---
name: spec-bugfix
description: "新建Bugfix bugfix：运行 bugfix 工作流（bug condition + preservation）。"
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


You are running the `/spec-bugfix` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, ask nothing and record the assumption. In an
interactive run, a missing `clarify.md` gets one round before the fix is
designed.

Command purpose: Run the bugfix workflow (bug condition + preservation).

Session boundary: this command writes specs, so it runs in the creation
session. Execution happens in a fresh session: do not implement code here.

Steps:
1. Read `core/bugfix.md`, `core/clarify.md`, and `core/brownfield.md`, and
   inspect the real failure (files, callers, current tests, the single-run test
   command).
2. If `.kaze/<feature>/state.json` does not exist, call `kaze_spec_init` with
   feature=<feature>, type=bugfix, scope=brownfield. The engine forces the
   bugfix workflow; do not pass another route.
3. If `clarify.md` is absent, run one `ask_user_question` round: reproduction
   steps, expected behavior, and whether existing tests may change to match the
   fix. Skip facts the workspace already answers. Persist the answers in
   `.kaze/<feature>/clarify.md`; in a non-interactive run record the assumptions
   there instead (the requirements gate requires the ledger).
4. Write `bugfix.md` with Current/Expected/Unchanged behavior, then
   `kaze_spec_validate` and `kaze_spec_gate` phase=requirements; call
   `kaze_spec_advance` to=requirements when the gate passes.
5. Write `design.md` with `## Bug Details`, `## Expected Behavior`,
   `## Hypothesized Root Cause`, `## Correctness Properties` (fix-checking and
   preservation), `## Fix Implementation`, and `## Testing Strategy`; state
   `isBugCondition(X)` with examples. Run `kaze_spec_validate`, `kaze_spec_gate`
   phase=design, then `kaze_spec_advance` to=design.
6. Write `tasks.md`: exploration test (must fail on the unfixed code) → fix →
   preservation → regression, with `_Requirements: X.Y_` references and a valid
   `## Task Dependency Graph`. Run `kaze_spec_validate`, `kaze_spec_gate`
   phase=tasks, then `kaze_spec_advance` to=tasks.
7. Present one plan summary and ask for one feedback round. Apply feedback to
   the affected document, re-validate, re-gate, and advance to the furthest
   completed phase (never call `advance` backward).
8. Stop. Do not implement the fix, run acceptance/FTA, or advance to done.
   End with the exact handoff:
   `Start a new session in this workspace and run /spec-apply feature=<feature>`.
   Acceptance, FTA, done, and delivery are `/spec-complete` work there.

Hard stops:
- A gate still fails after two fix attempts: report the exact errors.
- The reproduction contradicts the expected behavior: ask once with evidence.
- `BLOCKED: <question>` from a phase agent: ask it in this root session, record
  the answer in `clarify.md`, then re-run that phase.

This skill is the /spec-bugfix command. Spec root is `.kaze`; the engine owns
the phase pointer and the gates.
