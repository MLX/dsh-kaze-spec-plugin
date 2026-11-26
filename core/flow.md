# One-Shot Spec Flow

Create the complete spec in one turn: clarify, then requirements/bugfix,
design, and tasks, ending with exactly one plan review. There are no per-phase
"continue?" checkpoints. This is the one-shot variant; `/spec` classic runs the
same clarification first, then stops after each phase document for review.

## Preconditions

- Spec root is `.kaze`; `state.json` is authoritative and the engine tools
  (`kaze_spec_*`) own it.
- Read `core/plugin-rules.md`, `AGENTS.md` when present, `core/overview.md`,
  `core/classify.md`, and `core/clarify.md` before acting.
- Use the injected `kaze:spec-context` block: answer the user in their language,
  write spec prose in its `language` (`zh-CN` default, `en`). Read
  `.kaze/spec-config.json` only when the block is absent.
- Non-interactive: ask nothing; record assumptions and continue.

## Phase movement

`kaze_spec_advance` only moves forward. When the spec already exists at or past
a target phase, update that document in place, validate it, and gate it; never
call `advance` backward. A resume at `phase=tasks` may still refresh
requirements and design; that does not change the phase.

## Workflow branches

The steps below assume `requirements-first`. Two routes reorder the work; the
phase pointer still moves requirements → design → tasks, so after both
requirements and design exist call `advance` to the furthest completed phase.

- **design-first** — after clarify, write `design.md` first (step 7), then derive
  `requirements.md` from it (step 5, design-first variant). Validate and advance
  to `requirements` only when both documents exist.
- **verify-first** — after clarify, write the user stories, `model.smt2`, the
  check, and `verification.md` first (`core/verify-first.md`), then translate the
  checked assertions into EARS criteria (step 5), then design and tasks. The
  requirements gate blocks without the model and the verification record.

## Steps

1. Intent gate (`chat` / `do` / `spec`). Only `spec` continues. If a spec
   already exists, call `kaze_spec_status` and resume from its phase; never
   restart or rewrite an approved document.
2. Choose type (`feature`/`bugfix`), feature id (kebab-case), scope
   (`brownfield` default), workflow (`requirements-first`, `design-first`,
   `verify-first`, or `bugfix`), and design detail (`high`/`low`/
   `comprehensive`). Call `kaze_spec_init` when `.kaze/<feature>/state.json` is
   absent; call `kaze_spec_workflow` when the route or depth is decided later.
3. Brownfield: read `core/brownfield.md`; survey real contracts (paths, callers,
   stored data, single-run test command). If a surveyed fact contradicts the
   request, ask once with evidence and stop until resolved.
4. Clarify: follow `core/clarify.md`. Ask through the native user-question tool
   in this session; never delegate the interview to a subagent. Cover the
   material decision classes — goal, scope, data, technology, runtime/platform,
   compatibility, security, test bar — not only requirement wording. Standard
   budget is 5 rounds x 10 questions; "彻底"/"thorough" removes the round cap;
   "用推荐默认值"/"stop asking" ends the loop with recorded assumptions.
   Persist `.kaze/<feature>/clarify.md` after every round. If this flow is
   entered from `/spec` after its clarification loop, or `clarify.md` already
   has no open items, skip this step and keep the existing ledger.
5. Requirements: write `requirements.md` (or `bugfix.md`) from the request,
   survey, answers, and ledger, following `core/requirements.md`. Under
   `verify-first`, follow `core/verify-first.md` first: draft user stories, write
   `model.smt2`, check it, write `verification.md`, then translate the checked
   assertions into EARS criteria. Under `design-first`, derive the requirements
   from the approved `design.md`. When the document already exists, update it in
   place from the ledger instead of discarding approved content. Validate, fix,
   gate (`phase=requirements`), and advance (`to=requirements`) only when the
   current phase is still behind.
6. Post-draft analysis: scan the draft per `core/clarify.md`; ask only material
   ambiguities (one round by default), incorporate them in place, re-validate,
   and re-gate. Do not renumber requirements after this point.
7. Design: write `design.md` per `core/design.md` at the recorded `designDetail`
   (high / low / comprehensive). Under `design-first`, this step runs before
   step 5 and must be complete before the requirements are derived. Add
   `research.md` only for a real unknown, never to self-approve a user-owned
   technology or platform choice. State the target platform when commands or
   deployment matter. If the language or stack is still open, ask once here
   (this session can ask) and record the answer in `clarify.md`. Validate, gate,
   and advance to design only when the current phase is still behind — and only
   under `requirements-first`; under `design-first` do not advance here, since
   the requirements gate needs both documents. Advance to the furthest
   completed phase only after both exist.
8. Tasks: call `kaze_spec_sync`, then write `tasks.md` per `core/tasks.md`
   (DAG, `_Requirements: X.Y_`, optional test sub-tasks, brownfield
   no-regression checkpoint). Under `verify-first`, include a task that
   re-checks `model.smt2` when the design changes. Validate, gate, and advance to
   tasks only when the current phase is still behind.
9. Final review: one `ask_user_question` call, three choices, in the user's
   language:
   - Approve - spec is ready
   - Revise - I have feedback
   - Start execution in a new session
   "Revise": apply every item to the affected documents, re-validate, re-gate,
   and ask the same review again. "Start execution": do **not** run tasks in this
   session; reply with the exact handoff
   (`Start a new session in this workspace and run /spec-apply feature=<feature>`)
   and stop. "Approve": stop with a short summary.
10. Stop. Do not implement code in this session; do not advance to done, run
    acceptance/FTA, or build delivery.

## Hard stops

- A gate still fails after two fix attempts: record `return_to=<phase>` on the
  failed gate, stop, report the exact errors, and give the resume command.
- The survey contradicts the request, or two answers contradict each other:
  ask once with evidence, then stop until resolved.
- A phase returns `BLOCKED: <question>`: ask it once in this session with 2-4
  options, record the answer in `clarify.md`, then re-run that phase. Never
  resolve a `BLOCKED` item by default.
- Context or time runs short: finish the current document, persist the ledger
  and state, and stop with a one-line resume command. Never leave a malformed
  or partial document.

## Boundaries

- Do not ask "continue to design?" or "continue to tasks?"; the gates are the
  checkpoint. Only the clarification rounds and the final review talk to the
  user.
- Subagents cannot ask the user (DSH rejects a live child with
  `DELEGATED_CALLER`); use them only for read-only exploration or research, and
  bring a `BLOCKED` question back to this session.
- Do not mirror spec tasks into `todo_write` or the Team board; the Host denies
  those tools while a spec is in the execute phase.
- If the design needs new behavior, add a requirement first, then update design
  and tasks; never renumber after design starts.

## Final summary

Report the feature id and phase, documents written, gate results, decisions and
assumptions from `clarify.md`, open risks, and the exact next command
(`/spec-apply`, `/spec-complete`, or a revision request).
