---
name: spec
description: "新建Spec spec：分类请求、多轮澄清需求、选择逐阶段或一站式并路由。"
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


You are running the `/spec` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
Never claim a phase is complete unless the engine gate passes.
Do not edit `state.json` or task markers by hand; use the native tools.
In a non-interactive run, ask nothing and record the assumption. In an
interactive run, the clarification loop is mandatory and must cover the
material decision classes, not only requirement wording.

Command purpose: Start or resume a Kaze spec: classify, clarify, choose a mode,
route.

Steps:
1. Read `core/overview.md`, `core/classify.md`, and `core/clarify.md`.
2. Run the intent gate: `chat` → answer directly; `do` → `/vibe` or direct
   tools; `spec` → continue. Do not force every request into a spec.
3. Classify the spec as feature, bugfix, or quick. Quick is a compressed prompt
   style, not a separate engine gate.
4. Pick the feature id (kebab-case) and scope (brownfield by default). If the
   scope is brownfield, read `core/brownfield.md` and survey the real contracts
   (paths, callers, stored data, single-run test command) before any document
   is written; pass those facts to the phase agents. The workflow route and
   design detail are chosen in step 7; bugfix always uses `bugfix`.
5. If `.kaze/<feature>/state.json` does not exist, call `kaze_spec_init` with
   feature=<feature>, type=<type>, scope=<brownfield|greenfield>. The route and
   detail are applied in step 7 with `kaze_spec_workflow` when they differ from
   the defaults.
6. If the spec already exists, call `kaze_spec_status` (it reports `workflow` and
   `designDetail`) and resume from its phase. Skip the setup questions and the
   clarification loop when `clarify.md` already has no open items; otherwise
   continue with step 7.
7. For a new spec, run the creation setup as **sequential** `ask_user_question`
   calls (one question per call; a setup question, not a clarification round):
   a. Checkpoint mode: "逐阶段审阅" (Recommended) — clarify first, then one phase
      at a time, each document stops for review; or "一站式生成" — clarify first,
      then requirements → design → tasks in one turn, exactly one final review.
   b. Workflow route: "先写需求" (Recommended) — requirements first; "先写设计" —
      design first, then requirements derived from it; "先验证需求" — verify first
      (user stories + `model.smt2` + `verification.md`, then EARS criteria).
   c. Design detail: ask **only when the route is 先写设计** — "完整"
      (Recommended), "高层" (architecture and contracts only), "低层"
      (algorithms, types, pseudocode). For 先写需求 / 先验证需求 do not ask; record
      `designDetail=comprehensive`.
   Skip a question the user already answered. Record the route and detail with
   `kaze_spec_workflow feature=<feature> workflow=<...> designDetail=<...>`
   (or pass them to `kaze_spec_init`). Do not merge a/b/c into one call.
8. Clarification (mandatory in both modes): follow `core/clarify.md` in this
   root session. Ask through `ask_user_question`; never delegate the interview
   to a subagent. The round must cover the material decision classes, including
   technology and runtime/platform, not only requirement wording. Standard
   budget is 5 rounds x 10 questions; "彻底"/"thorough" removes the round cap;
   "用推荐默认值"/"stop asking" ends the loop with recorded assumptions. Persist
   `.kaze/<feature>/clarify.md` after every round. Do not write
   requirements/design/tasks before at least one round in an interactive run,
   unless the user explicitly says "no questions".
9. One-shot: read `core/flow.md` and follow its workflow branches; clarify is
   already complete, so keep the ledger and skip that step. Under
   `verify-first`, read `core/verify-first.md`; under `design-first`, write the
   design before the requirements.
10. Classic: route to the correct phase agent with the original request, the
    classification, `clarify.md`, and the recorded workflow/detail. Under
    `design-first`, start with `/spec-design`; under `verify-first`, start with
    `/spec-verify-first`; otherwise start with `/spec-requirements`. Do not write
    requirements/design/tasks in this turn. The phase agent must read the ledger
    and must not reopen settled items. It cannot ask the user, so if it finds a
    material decision the ledger does not answer it returns `BLOCKED: <question>`
    with 2-4 options; ask that in this root session, record the answer in
    `clarify.md`, and re-dispatch the phase. If a document already exists and the
    clarification changed a requirement, report exactly which downstream
    documents are now stale and which command refreshes them.
11. Outside the setup call, the clarification loop, and a returned `BLOCKED`
    item, do not add checkpoints. Ask at most one additional blocking question,
    and only for a genuinely ambiguous classification. If the request is only a
    question, do not start a spec.
12. If the user already named the mode, route, or detail ("逐阶段", "一站式",
    "先写设计", "形式化验证", "低层设计"...), honor it without asking.

Use the host's native file, search, shell, and subagent tools when present. If a tool is absent, use the shell or run the work sequentially and say so.

This skill is the /spec command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
