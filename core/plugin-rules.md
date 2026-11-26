# Kaze Plugin Rules

These rules belong to the plugin, not to the workspace. DeepSeek Harness never
loads this file automatically: `AGENTS.md` is the only workspace
instruction-file candidate, and this file is deliberately not one of them. It
enters context only when a Kaze command reads it, so a session that never runs
`/spec-*` or `/vibe` never pays for it.

Read this file once at the start of every Kaze command. It is the plugin's hard
rules; the workspace's own `AGENTS.md` `## Project Rules` remains a separate
source with its own gate (`core/rules.md`).

Spec root: `.kaze/`.

Commands are DSH skills bundled with the plugin; invoke them from the Kaze menu:

```bash
/spec-wish
/spec
/spec-quick
/spec-flow
/spec-verify-first
/spec-rules
/spec-steering
/spec-bugfix
/vibe
/spec-explore
/spec-research
/spec-requirements
/spec-analyze
/spec-design
/spec-pbt
/spec-tasks
/spec-apply
/spec-code-review
/spec-comments
/spec-acceptance
/spec-fta
/spec-complete
/spec-run
/spec-delivery
/spec-status
/spec-list
/spec-sync
/spec-refine
/spec-rename
/spec-batch
/spec-archive
/spec-memory
/spec-summarize
```

Rules:

1. Use the native DSH `kaze_spec_*` tools for state, validation, tasks, review,
   rename, and Timeline projection. File and subagent tools stay native.
2. Persist state in `.kaze/<feature>/state.json`; never rely on conversation memory.
3. Call `kaze_spec_validate` after every document write and `kaze_spec_gate`
   before claiming a phase is complete. With strict mode on, warnings fail the
   gate as well; never bypass a failed gate. A missing/empty `clarify.md`, an
   open question, a requirement with no acceptance criterion, a leaf task with
   no resolvable `_Requirements: X.Y_`, and malformed `verification.md` or
   `exec/evidence/*.json` are gate errors, not suggestions.
4. Read the core pack (`core/` in the workspace, or the plugin's bundled `core/`).
5. Never invent an API, path, flag, package, or command. Read its definition or
   run its help first; if it cannot be verified, say so.
6. Keep the diff minimal and in scope. Record unrelated findings instead of
   fixing them silently. Preserve the existing structure and formatting: a diff
   that only reformats is not acceptable, and a task never removes existing
   behavior to make its own check pass.
7. Report exact verification commands and output. Do not claim success from a
   summary or an unexecuted test.
8. Normative prompts are English; answer the user in their language. Before
   writing spec documents, use the injected `kaze:spec-context` block: it states
   the workspace `language`, `maxParallel`, and `strict`. Write prose in that
   `language` (`zh-CN` default, `en` for English) with its headings and EARS
   patterns; task markers stay unchanged. Cap one execution wave at
   `maxParallel` (1-8, default 3). Read `.kaze/spec-config.json` only when the
   block is absent.
   Command names are localized by the Kaze menu; the inserted token is the
   stable id (`/spec-batch`, `/vibe`, etc.).
9. Every creation path clarifies before writing and records a workflow route
   (`requirements-first`, `design-first`, `verify-first`) plus a design detail
   level (`high`, `low`, `comprehensive`) via `kaze_spec_init` or
   `kaze_spec_workflow`; a bugfix-type spec records the engine-assigned
   `bugfix` route instead of a feature route. `/spec` asks the creation setup
   as separate calls —
   checkpoint mode, then route, then design detail only for design-first — and
   both checkpoint modes then run the multi-round `ask_user_question` loop from
   `core/clarify.md`. The
   round covers the material decision classes — goal, scope, data, technology,
   runtime/platform, compatibility, security, test bar — not only requirement
   wording. `/spec-flow` is the direct one-shot entry; it writes
   requirements → design → tasks with no per-phase checkpoints and exactly one
   final plan review. `verify-first` follows `core/verify-first.md` and the
   engine requires `model.smt2` + `verification.md` before the requirements
   gate. Clarification always stays in the root session; never delegate the
   interview to a subagent. A phase agent that cannot settle a decision returns
   `BLOCKED: <question>` with options; the root session asks and re-dispatches.
10. Name the target platform in every platform-sensitive task or dispatch prompt;
    never translate a command between shells from memory (`core/platform.md`).
11. Follow `core/delegation.md`: execute, research, review, and repeated
    read-only work go to subagents; the main session keeps decisions and
    evidence. Run `/spec-apply`, `/spec-complete`, `/spec-batch`, and
    `/spec-run` only in a fresh execution session, never in the session that
    created the spec. The native tools reject task changes, acceptance/FTA
    records, capability merges, and `advance` to `execute`/`done` when the
    current session is the spec's recorded creator (`KAZE_SPEC_SESSION`).
12. `done` is terminal: phases only move forward, the engine rejects task,
    document, scope, workflow, and capability changes at `done`, and archive
    re-checks the done gate before moving the spec. A gate approval is bound to
    the documents it approved; editing requirements/design/tasks/acceptance
    afterwards requires re-recording the gate. New work after done is a new
    bugfix or feature spec; never hand-edit `state.json` to reopen a spec. A
    failed gate should pass `return_to` so the next rework action is explicit.
13. Stop before a destructive or irreversible operation: deleting or emptying
    files or directories, rewriting stored data, schema migration, production
    writes, force-push, or host/CI configuration changes. Return
    `BLOCKED: <question>` with the rollback plan, and record that plan in the
    evidence `rollback` field after the user approves the operation.
14. Never silence a signal to make a check pass: no new lint or type
    suppression (`eslint-disable`, `oxlint-disable`, `@ts-ignore`,
    `@ts-expect-error`), no loosened or deleted existing assertion, no empty
    `catch`, no disabled or skipped test. A suppression you judge necessary is a
    waiver: record it with its reason and scope, and surface it in the report.
15. A retry must converge on the root cause. A temporary bypass is not a
    completed task: record it as a deviation with a follow-up task, or leave the
    task `failed`. Warnings are signals; locate the cause instead of muting it.

Native tools: `kaze_spec_list`, `kaze_spec_status`, `kaze_spec_init`,
`kaze_spec_workflow`, `kaze_spec_verify`, `kaze_spec_capability`,
`kaze_spec_capabilities`,
`kaze_spec_merge`, `kaze_spec_repair`, `kaze_spec_validate`, `kaze_spec_gate`,
`kaze_spec_advance`, `kaze_spec_tasks`, `kaze_spec_task`, `kaze_spec_sync`,
`kaze_spec_pbt`, `kaze_spec_review`, `kaze_spec_rename`,
`kaze_spec_gate_record`, `kaze_spec_delivery`, `kaze_spec_scope`,
`kaze_spec_archive`, `kaze_spec_restore`, `kaze_spec_timeline`,
`kaze_spec_idle`.
