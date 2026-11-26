---
name: spec-explore
description: "探索需求 explore：只读查看代码库和约束，判断是否需要新建 spec。"
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


You are running the `/spec-explore` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
Read the workspace's `AGENTS.md` when present and the core pack before acting.
This is a read-only stance: do not create a spec or edit files by default.
In a non-interactive run, do not ask questions: state the safest assumption.

Command purpose: explore a problem or idea before deciding whether to spec it.

Delegate the breadth: dispatch one read-only subagent per independent area
(codebase map, constraints, alternatives) and keep only the returned map and
citations here. See `core/delegation.md`.

Steps:
1. Read `core/explore.md`.
2. Inspect only the code, docs, and constraints needed to ground the answer.
3. Present options, trade-offs, risks, unknowns, and evidence.
4. Recommend: build, defer, reject, or narrow the problem.
5. If external evidence is needed, recommend `/spec-research` with the exact
   question. If a spec is warranted, tell the user to run `/spec` with the chosen
   problem statement. If a direct change is warranted, recommend `/vibe`.
6. Do not create `.kaze/<feature>/`, `state.json`, or any spec artifact.
7. Do not run mutating commands.

A recommendation of "don't build this" is valid. Explore has no artifact, no
schema, no gate, and no task DAG.

This skill is the /spec-explore command. Spec root is `.kaze`; it stays
read-only and produces no spec artifact, so no gate applies to it.
