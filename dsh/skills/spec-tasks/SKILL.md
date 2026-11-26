---
name: spec-tasks
description: "编写任务 tasks：创建或修复 tasks.md 和依赖图。"
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


You are running the `/spec-tasks` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, ask nothing and record the assumption. In an
interactive run, return `BLOCKED` for a decision you cannot settle instead of
choosing it yourself.

Command purpose: Create or repair tasks.md and its Task Dependency Graph.

Steps:
1. Read `core/tasks.md`, requirements, and design. If `state.json` scope is
   `brownfield`, also read `core/brownfield.md` and include the non-optional
   migration/compatibility task plus the no-regression checkpoint. For
   cross-layer work include `core/fullstack-checklist.md` checks; for UI work
   include `core/frontend-checklist.md` checks. Call `kaze_spec_status` first:
   under `verify-first`, `model.smt2` and `verification.md` are design inputs and
   a change that invalidates an assertion becomes a task.
2. Before writing, call `kaze_spec_sync` with feature=<feature>. Then write
   `tasks.md` with checkboxes, `_Requirements: X.Y_` references, optional test
   sub-tasks, checkpoints, and a valid `## Task Dependency Graph` JSON block.
   Every acceptance criterion must be covered by at least one required task;
   coverage by optional tasks alone is a validator warning and fails a strict
   gate. While writing `tasks.md`, also draft `acceptance.md` from the criteria
   you cite (format and ownership: `core/acceptance.md`; `/spec-acceptance`
   maintains it standalone).
3. Call `kaze_spec_validate`, then `kaze_spec_gate` for tasks.
4. If the gate passes, call `kaze_spec_advance` with to=tasks (only when the
   phase is still behind), then stop and ask for plan approval before
   executing. In a one-shot orchestration (`/spec-flow`) this checkpoint is
   replaced by the flow's single final review.
5. On approval, do not execute tasks in this creation session. Hand off exactly:
   `Start a new session in this workspace and run /spec-apply feature=<feature>`.
   Acceptance, FTA, done, and delivery are `/spec-complete` work in that
   session; see `core/delegation.md`.

Do not implement code in this turn.

If the design uses pseudocode or an unset language, do not choose one silently:
ask through the root session, or return `BLOCKED: which implementation language
should the tasks use?` with 2-4 options. Use Structured Pseudocode only when the
user declined, chose defaults, or the run is non-interactive, and record the
assumption. When a command is platform-sensitive, name the target platform and
the exact command in the task text (`core/platform.md`).

Minimal shape:

```markdown
# Implementation Plan: <feature>
## Overview
## Tasks
- [ ] 1. <foundation>
  - _Requirements: 1.1_
- [ ] 2. <feature>
  - [ ] 2.1 <implement>
    - _Requirements: 2.1_
  - [ ]* 2.2 <property test>
    - **Property 1: <title>**
    - **Validates: Requirements 2.1**
## Notes
## Task Dependency Graph
```json
{ "waves": [ { "id": 0, "tasks": ["1"] }, { "id": 1, "tasks": ["2.1"] }, { "id": 2, "tasks": ["2.2"] } ] }
```
```

Use only `- [ ] N.` / `- [ ] N.M`; do not use `## Task N` headings.

This skill is the /spec-tasks command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
