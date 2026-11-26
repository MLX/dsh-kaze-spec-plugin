---
name: spec-pbt
description: "属性测试 pbt：把 EARS 验收标准映射为正确性属性，补齐属性覆盖并生成测试任务与桩。"
user-invocable: true
---

> **Path contract:** `core/<file>` resolves to the workspace `core/` copy when
> present, otherwise the bundled core pack at `../../../core/<file>` relative to
> this skill. **Hard rules:** read `core/plugin-rules.md` before acting.
> `AGENTS.md` holds the workspace's Project Rules when present.
> `.kaze/...`
> and every spec artifact named below (`state.json`, `requirements.md`,
> `design.md`, `tasks.md`, `acceptance.md`, `delivery.md`, `gates.json`,
> `research.md`, `analysis.md`, `verification.md`, `bugfix.md`, `reviews/`,
> `exec/`, `batch/`, `idle-queue.json`, `idle-config.json`, `spec-config.json`)
> live under the workspace's `.kaze/` tree, never relative to this skill
> directory.

You are running the `/spec-pbt` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
In a non-interactive run, ask nothing; record assumptions.

Command purpose: map acceptance criteria to correctness properties and keep the
mapping auditable.

`done` is terminal: if the spec phase is `done`, stop and tell the user to create
a new feature or bugfix spec instead of editing this one.

Steps:
1. Read `core/pbt.md`, `requirements.md`, and `design.md`.
2. Decide applicability. If it does not apply, say why in the design's Testing
   Strategy and stop; do not create empty properties.
3. For each acceptance criterion, classify it as **property** or **example-based**
   and record it:
   - properties go under `## Correctness Properties` with `_For any_ ...`,
     a domain, and `**Validates: Requirements X.Y**`;
   - the rest go under `## Example-based Criteria` with the id and one reason.
4. Update `design.md` Testing Strategy: generator library, minimum 100 cases per
   property, and the command that runs them.
5. Add one property-test task per uncovered property in `tasks.md` with
   `_Requirements: X.Y_` and `**Validates**`; do not overwrite existing tasks.
6. When the language and test framework are known, generate a stub file per
   property in the project's test directory. Never overwrite an existing test.
7. Call `kaze_spec_validate`; fix coverage warnings by adding properties or
   Example-based entries. If `design.md` or `tasks.md` already passed its gate,
   call `kaze_spec_gate` for design and tasks again after the edit. If an
   acceptance or FTA gate exists, tell the user its approval is stale and
   `/spec-complete` must re-verify and re-record it.
8. Record executed results with `kaze_spec_pbt` when the user runs them. On
   `failed`, decide whether the property or the implementation is defective, fix
   that side, and rerun; write the counterexample into the `example` field and
   into `verification.md`. On `unexpected_pass`, investigate the cause first,
   then record it.
9. Close with `Next:` `/spec-design` or `/spec-tasks` for a spec still being
   written, or `/spec-apply` / `/spec-complete` for a spec already in execution.

Rules:
- A property weaker than its criterion is a defect; fix the property.
- A passing property is evidence, not formal verification; say so.
- Do not change requirements to make a property easier.
