---
name: spec-apply
description: "执行任务 apply：执行 ready tasks 并收集证据；支持 --complete/--idle/--unattended；完成由 /spec-complete 负责。"
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


You are running the `/spec-apply` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, do not ask questions: choose the safest reasonable
default and state the assumption.

Command purpose: Execute ready spec tasks one at a time, with evidence.

This command stops after execution by default. It does not verify acceptance,
run FTA, advance to done, or build delivery unless `--complete` is set. The
canonical completion sequence is `core/completion.md`.

Session boundary: run this in a **fresh session**. If this conversation created
the spec (clarify/requirements/design), stop and tell the user to start a new
session with `/spec-apply feature=<feature>`; do not execute here. Read state
and documents from disk. See `core/delegation.md`.

Arguments:
- `feature=<name>`: the spec to execute.
- `--idle` or `--defer-optional`: before executing, enqueue optional tasks with
  `kaze_spec_idle` action=defer and skip them now.
- `--complete`: merge execution with completion; after all required tasks pass,
  follow the completion rules below instead of stopping.
- `--unattended`: only meaningful with `--complete`; never ask questions, run
  FTA, and skip acceptance with a recorded reason when `acceptance.md` is absent.

Steps:
1. Read `core/execute.md`, `core/platform.md` (when tasks contain
   platform-sensitive commands), and `.kaze/<feature>/tasks.md`. For
   cross-layer/UI tasks, also apply `core/fullstack-checklist.md` and
   `core/frontend-checklist.md` as applicable. If `--idle` is set, call
   `kaze_spec_idle` action=defer feature=<feature> first; optional tasks are
   deferred to the idle queue and must not be executed now. Also read
   `.kaze/<feature>/exec/context.json` when present (regression command and
   execution context, see `core/exec-context.md`).
2. Call `kaze_spec_tasks` with feature=<feature> and ready=true.
   If the user explicitly asks for optional tasks, set include_optional=true.
3. Take `maxParallel` from the injected `kaze:spec-context` block (default 3,
   range 1-8) and pick up to that many ready tasks that do not edit the same
   files.
4. Read `core/delegation.md`. Dispatch **one subagent per ready task**; never
   implement a task inline. Repeated read-only work (baseline, scans,
   verification of several tasks) goes to separate read-only subagents in
   parallel. Each executor gets the task text, verbatim requirement excerpts,
   design pointer, owned files, platform, and the exact verification command;
   keep the orchestrator to status and evidence.
5. For each ready task: set `in_progress` with `kaze_spec_task`, dispatch one
   executor, and wait.
6. On evidence: set `completed`. On failure: keep `in_progress` or set `failed`
   and record the blocker; do not mark it complete from a summary. A failed task
   gets at most two narrower retries (see `core/execute.md`), then it stays
   failed and becomes a user decision.
7. Repeat until no ready tasks remain.
8. After all required tasks pass, call `kaze_spec_sync`, then
   `kaze_spec_advance` to `execute`.
9. If no ready tasks remain and required tasks are still incomplete, call
   `kaze_spec_repair`; when it reports an `in_progress` task whose writer stopped
   (older than 30 minutes), reset that task with `kaze_spec_task` to
   `not_started` (or `failed` with the blocker), record why, and run
   `/spec-apply` again. Otherwise report the exact blocker and stop; do not
   invent progress. Close with the rework path: fix the dependency/plan
   (`/spec-tasks`) or the implementation, then run `/spec-apply` again.
10. If `--complete` is set, follow `core/completion.md` now: acceptance →
    FTA → `verification.md` → **`kaze_spec_merge` when a capability is set** →
    `kaze_spec_advance` to `done` → delivery. Stop on the first failed gate.
    For a verify-first spec, treat `verification.md` as append-only: rebuild it
    only when missing or malformed, and preserve the recorded Assertion Map and
    model evidence. Auto-archive on done prunes the idle queue; do not trigger
    archive while the queue still has entries.
    If the advance reports `autoArchive.archived: true`, report the archive path
    and do not call `kaze_spec_delivery`. Otherwise stop after execution and
    tell the user to run `/spec-complete`.
11. Report completed/failed tasks, files changed, verification evidence, and
    whether completion ran. If it did not run, give the exact next command:
    `/spec-complete feature=<feature>`. If `--idle` was used, close with:
    Next: schedule or run `/spec-batch --idle`.

Use the host's native subagent/task tool when present; otherwise run tasks sequentially in one context.

If DSH Agent Team is enabled, create one team task per ready spec task, spawn one subagent per independent write scope, and wait for evidence before updating `tasks.md`. If Team is disabled or its tools are unavailable, run the same tasks sequentially; never require Team. `kaze_spec_task` and `kaze_spec_sync` project `tasks.md` into the native Timeline; keep `tasks.md` authoritative.
Do not ask questions in a non-interactive run; record a blocker and stop.

This skill is the /spec-apply command. Spec root is `.kaze`; execution stops
before completion.
