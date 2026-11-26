# Spec Actions (Generate / Implement / Refine)

These are the three user actions a host should expose around the spec flow.

## 1. Generate

Input: a plain-language request, plus optional file context.

Prompt:

```text
Create or update the spec for: {{request}}

Use the spec directory {{SPEC_ROOT}}/{{FEATURE}}.
Follow the workflow state in state.json.
If this is the first document, call `kaze_spec_init` to create the directory,
`state.json`, and `config.json`.
Do not implement code in this action.
```

Host behavior:

- set the session mode to `spec` if the host has modes;
- attach the referenced files as context;
- run the current phase agent (requirements/design/tasks);
- stop at the phase gate.

## 2. Implement one sub-task

Input: a task id and its text from `tasks.md`.

Prompt:

```text
Implement exactly this sub-task:

```text
{{taskId}} {{taskText}}
```

Before editing, read requirements.md and design.md.
If the sub-task is already implemented, say so and stop.
Set the sub-task to in progress with `kaze_spec_task` { feature, id, status: "in_progress" }.
Implement only this sub-task.
Run its verification command.
When it passes, record "completed" with `kaze_spec_task`; on failure record
"failed" with the blocker and report it.
Do not touch other tasks.
```

Rules:

- one sub-task per invocation;
- status transitions go through `kaze_spec_task`, never a hand-edited marker;
- never mark `[x]` on a summary alone;
- if the task fails, record `failed` and report the failure;
- do not change task order or wording.

## 3. Refine a selected passage

Input: `path`, `selectedText`, `userRequest`, optional `contextFiles`.

Prompt:

```text
Refine the spec document at {{path}}.

Only the section that contains this text may change:

```text
{{selectedText}}
```

The user's refinement request:

```text
{{userRequest}}
```

Edit only {{path}}. Keep the document's required headings and format.
Do not change unrelated sections.
If the request is a question, answer it by tightening the relevant passage.
```

Host behavior:

- attach the target document and any context files;
- validate the result with `kaze_spec_validate`;
- if the phase is `done`, stop: done is terminal, so the refinement needs a new
  feature or bugfix spec (or restoring a clean copy from the archive);
- if the document's phase already passed, re-run `kaze_spec_gate` for it;
- if an acceptance or FTA gate already exists, the edit makes its approval
  stale — `/spec-complete` must re-verify and re-record it;
- if the document is `requirements.md`, re-check traceability to design/tasks and
  update them rather than leaving stale references.

## 4. Rename a spec

Input: the current feature id and the new feature id.

Steps:

1. Run the engine rename, which moves the directory and updates the spec's own
   path references and persisted review files:
   `kaze_spec_rename` with `{ feature: "<old>", to: "<new>" }`
2. Scan the repository for references to `.kaze/<old>` that name this spec and
   update only those. Leave unrelated text, task status, and document structure
   unchanged.
3. Validate the renamed spec and report every file changed.

Do not recreate the spec, rewrite its content, or drop review comments.

## 5. Archive and restore

Input: a done spec, or an archived spec id.

Steps:

1. `kaze_spec_archive` with `{ feature }` requires `phase=done`; use
   `force=true` only when the user explicitly wants to archive unfinished work.
   A spec bound to a `capability` merges its accepted requirements first; a
   merge conflict blocks the archive (resolve with
   `kaze_spec_merge { feature, force: true }` or by editing the capability). A
   forced archive of unfinished work skips that merge.
2. The engine re-checks the done gate, merges the bound capability, rebuilds
   `delivery.md` at the live path, moves `.kaze/<feature>/` to
   `.kaze/archive/YYYY-MM-DD-<feature>/`, writes `archive.json`, and prunes
   the spec's idle-queue entries.
3. `kaze_spec_restore` accepts the archive id or the original feature name. A
   restored spec keeps the phase it had when archived (usually `done`); restore
   is for inspection or re-delivery, not for reopening work.
4. Never delete a spec as part of archive. Archive must remain reversible.
   New work after `done` is a new bugfix or feature spec.

## 6. Phase completion rules

The host, not the model, owns phase transitions:

```text
requirements complete when:
  - requirements.md exists (bugfix.md for a bugfix spec)
  - every requirement has a user story and at least one criterion
  - design-first: design.md also exists and was recorded first
  - verify-first: model.smt2 has an assertion and verification.md records it
  - `kaze_spec_validate` passes

design complete when:
  - design.md exists
  - required sections exist
  - correctness properties are present or explicitly ruled out
  - `## Rules Check` covers every project rule
  - `kaze_spec_validate` passes

tasks complete when:
  - tasks.md exists
  - every task has a requirement reference and a definition of done
  - the DAG parses and every required leaf appears once
  - `kaze_spec_validate` passes

done also requires:
  - every required task checked off
  - an acceptance decision (approved, or skipped with a reason)
  - an FTA decision (approved, or skipped with a reason)
  - verification.md for a brownfield feature, a bugfix, or a verify-first spec
  - acceptance/FTA approvals still matching the current documents
```

A model may *propose* that a phase is complete; the host verifies before
advancing `state.json`, and `kaze_spec_advance` reports the first blocking step.
