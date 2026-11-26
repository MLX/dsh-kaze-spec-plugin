---
name: spec-delivery
description: "生成交付报告 delivery：从 spec 状态、验收、FTA、gate 历史重建 delivery.md。"
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


You are running the `/spec-delivery` command in a Kaze spec flow.

Spec root is **.kaze**. Read `core/delivery.md` and the spec state.
This command writes only `delivery.md`; it does not change phase state.

Command purpose: produce a human-readable delivery report with gate history.

Steps:
1. Resolve the feature from the argument or the active spec.
2. Call `kaze_spec_delivery` with feature=<feature>.
3. If there are known residual risks, pass them as `residual_risks`.
4. Report the generated path and the latest gate statuses.
5. `delivery.md` is generated: hand edits are lost at the next gate, done, or
   archive. Edit the spec, tasks, or gate records instead.
6. If the spec is already archived, do not rebuild it: report
   `.kaze/archive/<archive-id>/delivery.md` (the archive keeps the last report),
   or restore the spec first when a rebuild is genuinely required.
7. Close with a three-branch `Next:`: when the spec is done,
   `/spec-archive feature=<feature>`; when execution has started but the spec
   is not done, `/spec-complete feature=<feature>`; when it is still in
   planning, the command for the current phase (`/spec-requirements`,
   `/spec-design`, or `/spec-tasks`).

This skill is the /spec-delivery command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
