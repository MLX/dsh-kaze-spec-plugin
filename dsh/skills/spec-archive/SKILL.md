---
name: spec-archive
description: "归档Spec archive：归档 done spec 或恢复归档 spec。"
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


You are running the `/spec-archive` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, do not ask questions: choose the safest reasonable
default and state the assumption.

Command purpose: Archive a completed spec, or restore an archived spec.

Steps:
1. If `restore=true`, call `kaze_spec_restore` with `feature=<archive-id-or-feature>`.
   A restored spec keeps the phase it had when archived (usually `done`); restore
   is for inspection, handoff, or re-delivery, not for reopening work. To change
   a done spec, create a new bugfix spec instead.
2. Otherwise call `kaze_spec_archive` with `feature=<feature>`.
   - It requires `phase=done`.
   - It re-checks the `done` gate before moving the spec; a document changed
     after approval blocks the archive until the approval is re-recorded.
   - Use `force=true` only when the user explicitly wants to archive unfinished
     work. A forced archive skips the capability merge so unaccepted behavior is
     never published.
   - A spec with a `capability` merges its accepted requirements first; a merge
     conflict blocks the archive. Resolve it by editing the capability spec or
     with `kaze_spec_merge { feature: "<feature>", force: true }`, then retry.
   - Queued idle entries for the spec are pruned automatically; report
     `idlePruned` when it is non-zero.
3. Report the archive id, path, phase, pruned queue entries, and Timeline
   retirement, or the restored path.
4. Never delete a spec. Archive is a reversible move.

Restore note: archiving a spec with a `capability` merges it into
`.kaze/specs/<capability>/spec.md` before the move. `kaze_spec_restore` restores
the spec directory only; it does **not** roll back that capability merge. Tell
the user to inspect the capability Change Log and edit the capability spec if
the restored behavior must be withdrawn.

Archive layout:

```text
.kaze/archive/YYYY-MM-DD-<feature>/
├── archive.json
├── state.json
├── config.json
├── requirements.md
├── design.md
├── tasks.md
└── reviews/
```

Do not rewrite documents as part of archive.

This skill is the /spec-archive command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
