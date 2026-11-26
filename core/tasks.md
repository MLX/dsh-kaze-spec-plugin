# Phase 3 — Tasks

Produce `{{SPEC_ROOT}}/{{FEATURE}}/tasks.md`. Tasks are executable units of
work, ordered for incremental progress, each with a definition of done.

## Process

1. Read `requirements.md` and `design.md`. If `state.json` scope is
   `brownfield`, read `./brownfield.md`: the plan needs a non-optional
   migration/compatibility task and a no-regression checkpoint.
2. Take the implementation language from the design, the ledger, or the
   workspace. If the design is still Structured Pseudocode and the user has not
   chosen, ask through the root session (or return `BLOCKED`) with 2-4 concrete
   options. Keep Structured Pseudocode only when the user declines, chose
   "用推荐默认值", or the run is non-interactive; record that assumption. Do not
   pick a language the user did not accept.
3. Decompose the design into coding tasks. No task may be "write documentation",
   "deploy", "gather feedback", or "run the app manually". Under
   `verify-first`, a design change that invalidates a `model.smt2` assertion adds
   a task to update the model, re-check it, and update `verification.md`.
4. Add tests as sub-tasks under the implementation they verify.
5. Add checkpoints at natural integration points.
6. Build the dependency graph.
7. Call `kaze_spec_sync` before writing, then write the file, validate it, and
   stop at the phase checkpoint.

## Format

```markdown
# Implementation Plan — {{FEATURE}}

## Overview

<one paragraph>

## Tasks

- [ ] 1. <foundation task>
  - <step>
  - _Requirements: 1.1, 1.2_

- [ ] 2. <feature task>
  - [ ] 2.1 <implement component>
    - <step>
    - _Requirements: 2.1_

  - [ ]* 2.2 <write property test for component>
    - **Property 1: <title>**
    - **Validates: Requirements 2.1**

- [ ] 3. Checkpoint — all tests pass; stop and ask if anything is unclear.
```

Rules:

- maximum two levels: task `N`, sub-task `N.M`;
- every checkbox item must be code, config, or test work;
- `*` marks an optional sub-task (usually tests); top-level tasks are never
  optional;
- every task cites at least one requirement;
- a script, migration, or init task names its second-run check — a repeat run
  is a no-op — as the definition of done, not just a successful first run;
- the validator checks each task's `_Requirements: X.Y_`, rejects an id that is
  not declared in `requirements.md`, and rejects a criterion that no task
  covers; the coverage rule requires every acceptance criterion to be covered
  by at least one **required** task — a criterion covered only by optional
  (`*`) sub-tasks is a warning and fails the gate in strict mode;
- while writing `tasks.md`, the Task Agent also drafts `acceptance.md` from the
  criteria it cites (creation timing and format: `core/acceptance.md`);
  `/spec-acceptance` can create or revise it standalone;
- checkpoints are their own top-level task;
- no "and also" mega-tasks; split them;
- when a command is platform-sensitive, name the target platform and the exact
  verification command in the task text (`./platform.md`); never leave a bash
  block in a Windows-only task.

## Dependency graph

Append a `## Task Dependency Graph` section (the engine looks for this exact
heading) containing a fenced JSON block:

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3"] }
  ]
}
```

Rules:

- every incomplete leaf task appears exactly once;
- parent tasks never appear;
- tasks that write the same file must be in different waves;
- setup/types/interfaces go early;
- tests go after the code they test;
- checkpoints get their own wave;
- wave ids are contiguous from 0;
- tasks in wave `N` wait for all tasks in waves `0..N-1`.

If the host cannot run waves, still write the graph: it documents intent and
makes a later parallel executor possible.

## Phase gate

Engine-enforced (a failure blocks the phase):

- [ ] every leaf task has `_Requirements: X.Y_` and every id is declared in
  `requirements.md`;
- [ ] every acceptance criterion is covered by at least one required task
  (optional-only coverage is a warning, and a failure in strict mode);
- [ ] the DAG is valid JSON, covers every required leaf, and has contiguous wave
  ids;
- [ ] brownfield work includes a non-optional migration/compatibility task and
  a no-regression checkpoint (see `./brownfield.md`);
- [ ] bugfix work includes a regression task and a preservation task;
- [ ] `kaze_spec_validate` passes.

Review checklist (the agent checks it; the engine cannot judge it):

- [ ] every task has a verifiable definition of done;
- [ ] every platform-sensitive task names its target platform and exact command;
- [ ] cross-layer work includes the relevant checks from
  `./fullstack-checklist.md`;
- [ ] UI work includes the relevant states/accessibility checks from
  `./frontend-checklist.md`;
- [ ] tests are attached to the work they verify;
- [ ] checkpoints exist.

Stop and ask the user to approve the plan before executing. Execution is a
separate phase and must not start in the same turn. In a one-shot flow
(`/spec-flow` or the `/spec` one-shot mode) this pause is skipped; the single
final plan review covers it. On pass, the orchestrator calls
`kaze_spec_advance` to `tasks`.
