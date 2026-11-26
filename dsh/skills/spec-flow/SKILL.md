---
name: spec-flow
description: "一站式Spec flow（one-shot spec）：多轮澄清后一次性生成 requirements、design、tasks，最后只做一次计划评审。"
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


You are running the `/spec-flow` command in a Kaze spec flow.

Read `core/overview.md`, `core/classify.md`, `core/clarify.md`, and
`core/flow.md`, then follow `core/flow.md` exactly. It is the one-shot variant:
multi-round clarification, then requirements/bugfix → design → tasks, with
exactly one final plan review and no per-phase "continue?" checkpoints.
Division of labor with `/spec-quick`: flow supports all three workflow routes
(requirements-first / design-first / verify-first) and the multi-round clarify
budget; quick is the fixed requirements-first, single-round (2–4 question)
compressed variant of the same pipeline.

If the user has not named a workflow route, ask it first with one
`ask_user_question` call: 先写需求 / 先写设计 / 先验证需求. Ask the design detail
(完整 / 高层 / 低层) in a second call **only when 先写设计** was chosen; otherwise
record `comprehensive`. There is no checkpoint-mode question here: `/spec-flow`
is one-shot. Record the answers with `kaze_spec_workflow` (or `kaze_spec_init`).
Under `verify-first`, follow `core/verify-first.md`; under `design-first`, write
the design before the requirements.

Keep the engine authoritative:

- `kaze_spec_validate` after every document write;
- `kaze_spec_gate` before claiming a phase is complete;
- `kaze_spec_advance` only after the gate passes;
- never edit `state.json` or task markers by hand.

This is a creation session. Do not execute tasks here: the final review's
"Start execution in a new session" only prints the handoff command
(`/spec-apply feature=<feature>`). Run `apply`/`complete` in a fresh session
(`core/delegation.md`).

Never delegate the clarification interview to a subagent: DSH rejects a live
child's `ask_user_question` with `DELEGATED_CALLER`, so the root session asks and
the ledger carries the answers. Use subagents only for read-only exploration or
research.

If a spec already exists, call `kaze_spec_status` and resume from its phase;
never restart or rewrite an approved document.

This skill is the /spec-flow command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
