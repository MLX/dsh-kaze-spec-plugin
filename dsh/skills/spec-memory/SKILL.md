---
name: spec-memory
description: "沉淀记忆 memory：提炼可长期保留的项目经验，按硬约束与软约定分流到 AGENTS.md 或 .kaze/steering。"
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
> `steering/`, `idle-queue.json`, `idle-config.json`, `spec-config.json`) live
> under the workspace's `.kaze/` tree, never relative to this skill directory.


You are running the `/spec-memory` command in a Kaze spec flow.

Read the workspace's `AGENTS.md` when present and the recent conversation. This command captures durable
project memory, not task state.

Command purpose: propose concise, project-scoped lessons, each routed to the one
place where it belongs.

Rules:
1. Default to proposing only. Do not edit `AGENTS.md` or `.kaze/steering/`
   unless the user explicitly confirms in this turn.
2. Save only project-scoped, durable, non-obvious facts:
   - build/test/lint commands;
   - naming and path conventions;
   - recurring pitfalls or environment quirks;
   - explicit user preferences for this repository.
3. Route every candidate and name its target in the proposal:
   - checkable constraint that every spec must obey → root `AGENTS.md` →
     `## Project Rules`, using the next free `R<N>` id (`/spec-rules`);
   - path, naming, build/test command, or pitfall the gate does not check →
     `.kaze/steering/<topic>.md` (`/spec-steering`);
   - a decision that holds only for the current feature → that spec's documents,
     not project memory.
4. Read both the workspace's `AGENTS.md` when present and `.kaze/steering/*.md` before proposing; skip any
   fact already recorded in either place. One fact lives in one place.
5. Do not save:
   - code structure recoverable from files;
   - git history or diffs;
   - transient task state or current branch;
   - generic advice or cross-project preferences;
   - anything already in `AGENTS.md` or `.kaze/steering/`.
6. If the user explicitly says "remember this", propose the exact entry and its
   target, and ask for confirmation before writing.
7. If nothing is durable, say exactly:

```text
Nothing to save.
```

8. When confirmed, write a short dated entry to the routed target with:
   - the rule or convention;
   - why it matters;
   - when to apply it.
   Report the path written and why that target was chosen.

Do not write code, specs, or memory to other files unless the user names the
file.

This skill is the /spec-memory command. Spec root is `.kaze`; it proposes
durable lessons and routes each to its single home (`AGENTS.md`, steering, or
the current spec).
