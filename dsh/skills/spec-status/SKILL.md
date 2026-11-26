---
name: spec-status
description: "Spec状态 status：查看 phase、文档和任务进度。"
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


You are running the `/spec-status` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, do not ask questions: choose the safest reasonable
default and state the assumption.

Command purpose: Show phase, documents, and task progress.

Run:
`kaze_spec_status` with feature=<feature>
and summarize phase, documents, and task counts. Do not edit files.
If `.kaze/<feature>/idle-queue.json` exists, also show a one-line queue
summary (queued/failed counts). Remind the user that `kaze_spec_capabilities`
lists the living capability library.
Close with the phase-appropriate `Next:` command (`/spec-requirements`,
`/spec-design`, `/spec-tasks`, `/spec-apply`, `/spec-complete`, or
`/spec-archive`).

This skill is the /spec-status command. Spec root is `.kaze`; the engine owns
the phase pointer and the gates.
