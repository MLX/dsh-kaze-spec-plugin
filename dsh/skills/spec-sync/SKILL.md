---
name: spec-sync
description: "同步Spec sync：用磁盘文件校正 state.json。"
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


You are running the `/spec-sync` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, do not ask questions: choose the safest reasonable
default and state the assumption.

Command purpose: Re-validate and synchronize state.json with the files.

Steps:
1. Run `kaze_spec_validate` with feature=<feature>.
2. Run `kaze_spec_sync` with feature=<feature>.
3. Report the inferred phase, task counts, and any invalid/missing document.
Do not rewrite documents in this command.
4. If the sync advanced a phase, close with `Next:` the owning phase command
   (`/spec-requirements`, `/spec-design`, `/spec-tasks`, `/spec-apply`). If a
   document is invalid or
   missing, report the exact fix; `kaze_spec_repair` is read-only by default and
   cannot rewrite state for you. Only for a damaged `state.json` phase, pass an
   explicit `phase=` to record a `repair-phase` reset (a done spec refuses).
   If it reports an `in_progress` task whose writer stopped, give the exact
   `kaze_spec_task` reset command from the issue.

This skill is the /spec-sync command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
