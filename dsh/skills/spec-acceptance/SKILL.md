---
name: spec-acceptance
description: "定义验收 acceptance：编写可测量的 acceptance.md 成功标准。"
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


You are running the `/spec-acceptance` command in a Kaze spec flow.

Spec root is **.kaze**. Read the workspace's `AGENTS.md` when present, `core/acceptance.md`,
requirements.md, and design.md before acting.
This command writes one file only: `.kaze/<feature>/acceptance.md`.

Command purpose: define the spec-level acceptance contract.

`done` is terminal: if the spec phase is `done`, stop and tell the user to create
a new feature or bugfix spec instead of editing this one.

Steps:
1. Resolve the feature from the argument or the active spec.
2. Read requirements.md (or bugfix.md) and design.md.
3. Write `.kaze/<feature>/acceptance.md` with:
   - `## Goal` — one user-visible outcome;
   - `## Success Criteria` — measurable checkboxes;
   - `## Verification` — how each criterion is checked; a zero exit code is
     not sufficient;
   - optional `## References`.
4. Do not duplicate every requirement; capture the acceptance bar.
5. Do not create or modify requirements.md, design.md, tasks.md, `state.json`,
   or task markers.
6. Call `kaze_spec_validate` and report the file path.
7. The acceptance decision is recorded later: `/spec-complete` verifies each
   criterion and records `kaze_spec_gate_record gate=acceptance`. Do not record
   an approval here without evidence.
8. Close with `Next: /spec-complete feature=<feature>` when tasks are complete,
   or the owning phase command otherwise.

This file is not a DSH session goal. Do not call `create_goal` or create a
`goal.md`.

This skill is the /spec-acceptance command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
