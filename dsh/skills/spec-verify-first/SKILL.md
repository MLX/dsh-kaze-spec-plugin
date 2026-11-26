---
name: spec-verify-first
description: "验证优先 Spec：先写需求初稿与 SMT 模型，验证一致性与完整性后再生成正式需求。"
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
> `exec/`, `batch/`, `idle-queue.json`, `idle-config.json`,
> `spec-config.json`) live under the workspace's `.kaze/` tree, never relative
> to this skill directory.


You are running the `/spec-verify-first` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, ask nothing and record the assumption. In an
interactive run, the clarification round is mandatory before the draft.

Command purpose: Run the verify-first route: user stories, a formal model, a
recorded check, then EARS requirements.

Steps:
1. Read `core/verify-first.md`, `core/clarify.md`, and `core/requirements.md`.
2. If `.kaze/<feature>/state.json` does not exist, call `kaze_spec_init` with
   workflow=verify-first. If it exists with another workflow at `phase=initial`,
   call `kaze_spec_workflow` with workflow=verify-first; after any document is
   written the route is frozen, so create a new spec instead. Do not hand-edit state.
3. If `.kaze/<feature>/clarify.md` is absent or has open items, run the
   clarification loop from `core/clarify.md` in this root session first. Ask once
   about the correctness boundary: what must never happen, and what may be
   assumed. In a non-interactive run, write the assumptions to `clarify.md`
   instead; the requirements gate requires the ledger.
4. Write `requirements.md` with the user stories only (no acceptance criteria).
5. Write `model.smt2` per `core/verify-first.md`: one `:named` assertion per
   requirement clause, background axioms, no UI text or file paths. For a
   brownfield spec, give each `SHALL CONTINUE TO` clause its own preservation
   assertion. End with `(check-sat)` and at least one declaration; each named id
   must contain its criterion id (`req_1_1` or `AC1_1` for `1.1`).
6. Check the model:
   - if `z3` is available, run `z3 -smt2 .kaze/<feature>/model.smt2` once and
     capture the result;
   - otherwise check the model against the draft by reading it and say the check
     was manual;
   - record method, result, assertion map, and gaps in
     `.kaze/<feature>/verification.md`. Method must name z3 or a manual review;
     a manual Result must say `manual` (for example `PASS (manual)`) and must not
     claim machine verification. Never install Python or a Python package for a
     solver.
   - the model is structurally preflighted: `(check-sat)`, a declaration,
     `:named` assertions (one per criterion), balanced parentheses, and one named
     assertion for every criterion are required.
7. Translate every checked assertion into exactly one EARS criterion with the
   same clause number, then rewrite `requirements.md` with the EARS criteria.
8. Call `kaze_spec_validate`, then `kaze_spec_gate` with phase=requirements. The
   gate requires a structurally valid `model.smt2` and `verification.md` with
   Method, Result, and Assertion Map. Fix and re-check until it passes, then call
   `kaze_spec_advance` to requirements.
9. Call `kaze_spec_verify` to record the baseline hash of requirements + model.
   `kaze_spec_advance` to requirements already records it; call the tool again
   after any re-check that changes `model.smt2` or the EARS criteria.
10. Stop. Design is `/spec-design`; do not write it in this turn.

A design change that invalidates an assertion goes back through steps 5-9 and
updates `verification.md`; `kaze_spec_verify` refreshes the baseline. The design
and done gates warn/error when the inputs changed after the recorded check.

This skill is the /spec-verify-first command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
