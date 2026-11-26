---
name: spec-code-review
description: "Code Review code-review：只读审查具体 diff，报告可触发的 Blocker/Concern/Note。"
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


You are running the `/spec-code-review` command in a Kaze spec flow.

Spec root is **.kaze**. Read the workspace's `AGENTS.md` when present and `core/code-review.md` before
acting. This is a read-only code review.

Command purpose: report concrete defects in the requested change.

Dispatch a read-only reviewer subagent for the diff and its direct callers; the
root session keeps only findings with file:line and evidence. Do not paste the
diff or full files into the main context. See `core/delegation.md`.

Steps:
1. Resolve the scope the user named: uncommitted, commit, branch, PR, or files.
2. Inspect the complete change with the host's native changes review or
   `git diff` / `git diff --cached` / untracked files.
3. Read the affected call sites and tests before claiming impact.
4. Report only discrete, actionable, change-introduced, verifiable findings.
5. Use severity `Blocker`, `Concern`, or `Note`; no color emoji.
6. Format each finding as:

```text
<Severity> <file>:<line-range> — <trigger> → <impact>
Fix: <one minimal direction>
```

7. Sort Blocker → Concern → Note. If none remain, say so directly.
8. Do not edit, stage, commit, push, or open a PR unless the user explicitly
   asks for fixes.
9. Close with the rework path: Blocker → fix, then `/spec-apply` again and
   `/spec-complete`; spec-level finding → `/spec-refine` or `/spec-design`, then
   re-gate; no finding → `/spec-complete feature=<feature>` when the spec is
   ready, otherwise the owning phase command.

This skill is the /spec-code-review command. Spec root is `.kaze`; keep the phase gates and validator authoritative.
