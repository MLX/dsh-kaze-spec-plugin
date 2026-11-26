---
name: spec-design
description: "编写设计 design：创建或修复 design.md，包括正确性属性。"
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


You are running the `/spec-design` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, ask nothing and record the assumption. In an
interactive run, return `BLOCKED` for a decision you cannot settle instead of
choosing it yourself.

Command purpose: Create or repair design.md, including correctness properties.

Steps:
1. Read `core/design.md`, the requirements when they exist, root `AGENTS.md`
   when present (project rules), and the codebase context you need. If
   `state.json` scope is `brownfield`, also read `core/brownfield.md` and carry
   `## Impact on Existing System`, `## Migration and Backward Compatibility`,
   and a Preservation property. For cross-layer work read
   `core/fullstack-checklist.md`; for user-visible work read
   `core/frontend-checklist.md`.
2. Call `kaze_spec_status` and read `workflow` and `designDetail`. Under
   `design-first`, a missing `requirements.md` is expected: write the design
   first, then derive the requirements from it. Match the recorded detail level
   (`high` / `low` / `comprehensive`) and do not silently expand it.
3. If the design has a real technical unknown, new dependency, new integration,
   protocol choice, migration, or security boundary, write `research.md` first
   (use `/spec-research` when external evidence is required)
   with `## Decision`, `## Rationale`, `## Alternatives considered`, and
   `## Unresolved unknowns`. Skip it for ordinary features.
4. Write `design.md` with the required sections at the recorded detail level.
5. Add correctness properties only when PBT applies; otherwise say why it does not.
6. Add `## Rules Check` when Project Rules exist; record compliant or exception
   with evidence for each rule.
7. Call `kaze_spec_validate`, then `kaze_spec_gate` for design. Under
   `design-first`, also confirm `requirements.md` exists before advancing.
8. If the gate passes, call `kaze_spec_advance` with to=design (only when the
   phase is still behind). Then stop and ask for review. In a one-shot
   orchestration (`/spec-flow`) this checkpoint is replaced by the flow's single
   final review.

Next: under `design-first`, derive the requirements with
`/spec-requirements feature=<feature>`; otherwise continue with
`/spec-tasks feature=<feature>`.

Do not invent requirements. If design needs new behavior, add a requirement first.

Required sections:
`## Overview`, `## Architecture`, `## Components and Interfaces`,
`## Data Models`, `## Correctness Properties` (only if PBT applies),
`## Error Handling`, `## Testing Strategy`, and `## Rules Check` when Project
Rules exist.

If the design language is not settled by the user, the ledger, or a dominant
workspace language, do not default silently: ask through the root session in a
one-shot flow, or return `BLOCKED: <question>` with 2-4 options so the
orchestrator can ask and re-dispatch. Structured Pseudocode is allowed only when
the user declined, chose defaults, or the run is non-interactive; record the
assumption in `clarify.md`. A `research.md` Decision never substitutes for a
user-owned technology or platform choice.

When the design contains commands, packaging, or deployment, state the target
platform in one line under Overview or Architecture and follow `core/platform.md`.

This skill is the /spec-design command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
