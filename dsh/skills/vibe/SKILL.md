---
name: vibe
description: "氛围编程（Vibe Coding）：不建 spec 文档，直接改代码并验证。"
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


You are running the `/vibe` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and `core/vibe.md` before acting.
Do not edit `state.json` or task markers by hand; use the native tools.
Never claim success without evidence.

Command purpose: a direct code change with the quality loop: goal contract,
small context, smallest diff, executable verification, drift review.

This is not a session mode. It does not override DSH plan mode, permissions, or
sandbox policy. If the session is in plan mode, exit it through the native plan
approval first, then use `/vibe`.

Steps:
1. Restate the goal and 2–5 acceptance checks; state non-goals and assumptions.
2. Read only the files, callers, and tests that decide the change. Match nearby patterns.
3. If a fast baseline check exists, run it and keep the exact output.
4. Name the files to change; make the smallest correct diff. Do not invent APIs, paths, flags, or commands.
5. Run the smallest falsifying check, then the normal test/lint/typecheck. Report exact commands and output.
6. On failure, diagnose and attempt at most two focused corrections; otherwise stop and report the blocker.
7. Review the diff for scope drift, debug leftovers, and unrelated edits.
8. Report changed files, evidence, assumptions, and residual risk.

Do not create spec documents unless the user asks. If the task needs a broad
refactor, more than ~5 files, or conflicting requirements, stop and recommend
the native Plan mode (exit plan mode through DSH's approval) or `/spec`.

This skill is the /vibe command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
