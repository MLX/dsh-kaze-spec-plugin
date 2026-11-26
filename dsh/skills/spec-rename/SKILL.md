---
name: spec-rename
description: "重命名Spec rename：重命名 spec 并更新自身路径引用。"
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


You are running the `/spec-rename` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, do not ask questions: choose the safest reasonable
default and state the assumption.

Command purpose: Rename one spec and keep its own references consistent.

Rename is a planning-time operation: the engine rejects it at `execute` and
`done`, because rewriting paths would invalidate approvals. At those phases
create a new spec instead.

Steps:
1. Read `core/spec-actions.md` §Rename.
2. Run:
   `kaze_spec_rename` with feature=<old> and to=<new>
3. Search the repository for `.kaze/<old>` references that name this spec and
   update only those. Do not rewrite unrelated prose, task status, or headings.
4. Validate the renamed spec with
   `kaze_spec_validate` with feature=<new>.
5. Report the new path, every file changed, and any reference you could not
   update safely.

Do not delete review comments, recreate the spec, or change document content
beyond path references.

This skill is the /spec-rename command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
