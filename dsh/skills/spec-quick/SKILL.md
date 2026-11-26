---
name: spec-quick
description: "快速Spec quick：用压缩提示完成 requirements → design → tasks。"
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


You are running the `/spec-quick` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, ask nothing and record the assumption. In an
interactive run, the clarify step must cover implementation and directional
forks, not only requirement wording.

Command purpose: Run the quick/fast-task portfolio: Clarify → Requirements
(silent) → Design (silent) → Tasks → one plan review. Quick is the fixed
requirements-first, single-round variant: 2–4 questions, then requirements →
design → tasks in one turn. For the multi-round flow that supports all three
workflow routes, use `/spec-flow` instead.

Session boundary: this command writes specs, so it runs in the creation
session. Execution happens in a fresh session: do not implement code here.

Steps:
1. Read `core/fast-and-verify.md` and inspect the workspace (frameworks,
   conventions, existing contracts, single-run test command). Classify scope
   from real files: brownfield when existing code/data/contracts are touched.
2. Clarify with 2–4 high-impact questions covering user preferences, ambiguity,
   and implementation or directional forks (technology, runtime/platform,
   compatibility policy). Follow `core/clarify.md`'s fact-vs-decision rule: skip
   facts the workspace answers, never skip a material technology or platform
   choice. Persist the answers (or the recorded assumptions in a non-interactive
   run) in `.kaze/<feature>/clarify.md`; a missing or empty ledger is a done
   gate error, not a warning.
3. If `.kaze/<feature>/state.json` is absent, call `kaze_spec_init` with
   feature=<feature>, type=feature, scope=<brownfield|greenfield>, and
   workflow=requirements-first. Quick is a prompt style, not a separate engine
   gate; if the spec exists, resume from `kaze_spec_status`.
4. Write `requirements.md`, `design.md`, and `tasks.md` using the normal
   templates, scope rules, and DAG format. Do not write partial or placeholder
   documents.
5. For each document: call `kaze_spec_validate`, then `kaze_spec_gate` for that
   phase; call `kaze_spec_advance` to the phase when the gate passes. Advance in
   order (requirements → design → tasks); never call `advance` backward.
6. Present one concise plan summary (one line per top-level task) and ask for
   one feedback round. Route task feedback to tasks.md, design feedback to
   design/tasks, and scope feedback back through requirements; re-validate and
   re-gate every edited phase.
7. Stop after the review. Do not implement, run long-lived servers, or advance
   the spec to done. Hand off exactly:
   `Start a new session in this workspace and run /spec-apply feature=<feature>`.
   Acceptance, FTA, done, and delivery are `/spec-complete` work there.

If a gate fails after two fix attempts, stop and report the exact errors.

This skill is the /spec-quick command. Spec root is `.kaze`; the engine owns
the phase pointer and the gates.
