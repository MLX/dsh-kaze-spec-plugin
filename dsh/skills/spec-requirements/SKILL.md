---
name: spec-requirements
description: "编写需求 requirements：创建或修复 requirements.md / bugfix.md。"
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


You are running the `/spec-requirements` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, ask nothing and record the assumption. In an
interactive run with no ledger, run the clarification loop first.

Command purpose: Create or repair requirements.md (or bugfix.md).

Steps:
1. Read `core/requirements.md`, the workspace's `AGENTS.md` when present, the existing
   `.kaze/<feature>/`, and `.kaze/<feature>/clarify.md` when present. If
   `state.json` scope is `brownfield`, also read `core/brownfield.md` and survey
   the real existing contracts.
2. Call `kaze_spec_status` and read `workflow`. Under `verify-first`, follow
   `core/verify-first.md` and `/spec-verify-first` instead of this plain flow
   (the gate needs `model.smt2` and `verification.md`). Under `design-first`,
   read `design.md` first and derive the requirements from it.
3. If `clarify.md` is absent, run the clarification loop from `core/clarify.md`
   before writing: at least one round in an interactive root session covering
   the material decision classes (including technology and runtime/platform,
   even though the requirement prose keeps implementation out); if you are a
   subagent or the run is non-interactive, do not ask, record assumptions in
   `clarify.md`, and continue. Never delegate the interview to a subagent.
4. External facts: if a criterion depends on a legal limit, standard, vendor
   quota, or compatibility claim, either cite the workspace/user, run
   `/spec-research` (this phase may own `research.md`), or mark the claim
   `UNVERIFIED` with an assumption. Never state a guessed external fact as a
   firm `SHALL`.
5. Write `requirements.md` (or `bugfix.md`) in the required format, using the
   ledger decisions.
6. Run `kaze_spec_validate` with feature=<feature>.
7. Run `kaze_spec_gate` with feature=<feature> and phase=requirements.
8. If the gate passes, call `kaze_spec_advance` with to=requirements (only when
   the phase is still behind). Then stop and ask for review. In a one-shot
   orchestration (`/spec-flow`) this checkpoint is replaced by the flow's single
   final review. Do not start design in this turn.

Next: `/spec-design feature=<feature>`. Under `design-first`, the design already
exists and the requirements were derived from it; continue with
`/spec-tasks feature=<feature>` instead.

Requirements: user stories + EARS acceptance criteria; no implementation details.

Minimal shape:

```markdown
# Requirements Document
## Introduction
## Glossary
## Requirements
### Requirement 1: <title>
**User Story:** As a <role>, I want <capability>, so that <benefit>.
#### Acceptance Criteria
1.1 WHEN <trigger>, THE <system> SHALL <response>.
1.2 IF <condition>, THEN THE <system> SHALL <response>.
```

If the feature name or scope is unclear, state your assumption and proceed.

This skill is the /spec-requirements command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
