---
name: spec-rules
description: "工程红线 hard rules：维护 AGENTS.md 中可检查、不可违背的工程约束；设计逐条回执，设计门禁强制。"
user-invocable: true
---

> **Path contract:** `core/<file>` resolves to the workspace `core/` copy when
> present, otherwise the bundled core pack at `../../../core/<file>` relative to
> this skill. **Hard rules:** read `core/plugin-rules.md` before acting.
> `AGENTS.md` holds the workspace's Project Rules when present.
> `.kaze/...`
> and spec artifacts live under the workspace `.kaze/` tree.

You are running the `/spec-rules` command in a Kaze spec flow.

Command purpose: maintain the workspace's Hard Rules (`Project Rules`) and keep
the design check honest.

Steps:
1. Read `core/rules.md`, then the root `AGENTS.md` when present.
2. Parse the `## Project Rules` section; `## 项目规约` and `## 工程红线` are
   accepted aliases. If it is absent, create it after the user states at least
   one rule; do not invent rules.
3. For each rule record: id (`R1`, `R2`, ...), the rule in one testable sentence,
   the path or area it applies to, and how it is checked (command or observable
   condition). A rule that cannot be checked is guidance, not a rule.
4. To add, revise, or remove a rule, edit only that section of `AGENTS.md`. Keep
   existing ids stable; a removed rule gets a one-line reason in the same edit.
5. When the user only asks to view the rules, list them and stop.
6. If the item is really a soft convention — a path, naming, build/test command,
   or pitfall the gate does not check — do not add it here. Say it belongs in
   `.kaze/steering/` and point to `/spec-steering`; one fact lives in one place.
7. Tell the user that every design must now contain `## Rules Check` (or
   `## 规约检查`) with `compliant` / `exception` per rule, and that the design
   gate enforces its presence.
8. If a `design.md` already exists, re-run `kaze_spec_gate` phase=design and
   report any rule that the existing design does not cover. A rules change after
   the design gate does not re-approve the design by itself.

Rules:
- Never create a second rules file; `AGENTS.md` is the only place.
- A rule is a constraint, not a task or a style preference.
- Hard Rules are gate-enforced; steering is advisory. Never mirror one in the
  other.
- Do not weaken a rule silently; record the change and the reason.

This skill is the /spec-rules command. It edits only `AGENTS.md`
`## Project Rules`; the design gate enforces the per-rule check.
