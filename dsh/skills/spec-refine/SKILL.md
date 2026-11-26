---
name: spec-refine
description: "精修Spec refine：只修改选中的 spec 段落或章节。"
user-invocable: true
---

> **Path contract:** `core/<file>` resolves to the workspace `core/` copy when
> present, otherwise the bundled core pack at `../../../core/<file>` relative to
> this skill. **Hard rules:** read `core/plugin-rules.md` before acting.
> `AGENTS.md` holds the workspace's Project Rules when present.
> `.kaze/...`
> and every spec artifact named below (`state.json`, `requirements.md`,
> `design.md`, `tasks.md`, `acceptance.md`, `delivery.md`, `gates.json`,
> `research.md`, `verification.md`, `bugfix.md`, `model.smt2`, `reviews/`, `exec/`, `batch/`,
> `idle-queue.json`, `idle-config.json`, `spec-config.json`) live under the
> workspace's `.kaze/` tree, never relative to this skill directory.


You are running the `/spec-refine` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and `core/spec-actions.md` before acting.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, do not ask questions: choose the safest reasonable
default and state the assumption.

Command purpose: Refine one selected passage/section without changing the rest.

`done` is terminal: if the spec phase is `done`, stop and tell the user to create
a new feature or bugfix spec instead of editing this one.

Steps:
1. Read the target document and the section named by the selected text.
2. Change only the section that contains the selected passage. A heading
   selection means that whole section.
3. Keep the document's required headings, EARS wording, task status markers,
   and structure. Do not rewrite unrelated sections.
4. If the request is a question, answer it by tightening the relevant text.
5. Call `kaze_spec_validate`; if the touched document already holds a gate
   approval or a verify-first baseline, re-gate it or re-run
   `kaze_spec_verify`; a verify-first spec whose `requirements.md` or
   `model.smt2` changed must re-run the model check and `kaze_spec_verify`
   before continuing. If the edited document is `requirements.md`,
   `design.md`, or `tasks.md` and its phase already passed, call
   `kaze_spec_gate` for that phase again and update the downstream documents the
   change invalidates (design/tasks quoting a changed requirement, task
   references, acceptance criteria). Never leave a downstream document quoting
   superseded text. When an acceptance or FTA gate already exists, tell the user
   its approval is now stale and that `/spec-complete` must re-verify and
   re-record it.
6. Report what changed, the validator result, the gate result, and every
   downstream file updated. Close with `Next:` the owning phase command
   (`/spec-requirements`, `/spec-design`, `/spec-tasks`) or
   `/spec-complete feature=<feature>` when the spec was already in execution.

Do not edit unrelated files. Downstream consistency edits are required when the
change invalidates them; they are not scope growth.

This skill is the /spec-refine command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
