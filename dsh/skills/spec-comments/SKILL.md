---
name: spec-comments
description: "落实评审意见 comments：把文档上的 reviewer comments 应用到单个文档。"
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


You are running the `/spec-comments` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, do not ask questions: choose the safest reasonable
default and state the assumption.

Command purpose: Apply reviewer comments to one spec document.

`done` is terminal: if the spec phase is `done`, stop and tell the user to create
a new feature or bugfix spec instead of editing this one.

Steps:
1. Read `core/spec-review.md`.
2. Read the target document and `.kaze/<feature>/reviews/<document>.json` (the UI saves comments there; `--comments` may point elsewhere).
3. Build the prompt with:
   `kaze_spec_review` with feature=<feature> and file=<path>
   The output is a readable Markdown brief; do not wrap it in JSON or XML.
4. Apply comments to that file only.
5. Mark the applied comments `"resolved": true` in
   `.kaze/<feature>/reviews/<document>.json` (keep `stale` and unrelated fields
   intact). Comments you could not apply stay unresolved and are reported.
6. Re-run `kaze_spec_validate` on the edited file; if the touched document
   already holds a gate approval or a verify-first baseline, re-gate it or
   re-run `kaze_spec_verify`; a verify-first spec whose `requirements.md` or
   `model.smt2` changed must re-run the model check and `kaze_spec_verify`
   before continuing. If the document's phase
   already passed, call `kaze_spec_gate` for that phase again and update the
   downstream documents the change invalidates. If an acceptance or FTA gate
   already exists, say that its approval is stale and `/spec-complete` must
   re-verify and re-record it. Report applied / questions / skipped, and list
   any comment still open with the reason.
7. Close with `Next:` the owning phase command or `/spec-complete
   feature=<feature>` when the spec was already in execution.

This skill is the /spec-comments command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
