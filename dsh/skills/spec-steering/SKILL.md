---
name: spec-steering
description: "工作区约定 steering：维护 .kaze/steering 下的软约定，会话注入一次，不参与门禁。"
user-invocable: true
---

> **Path contract:** `core/<file>` resolves to the workspace `core/` copy when
> present, otherwise the bundled core pack at `../../../core/<file>` relative to
> this skill. **Hard rules:** read `core/plugin-rules.md` before acting.
> `AGENTS.md` holds the workspace's Project Rules when present.
> `.kaze/...` lives under the workspace's `.kaze/` tree.

You are running the `/spec-steering` command in a Kaze spec flow.

Command purpose: create or revise the short workspace conventions injected into
every session.

Steps:
1. Read `core/steering.md`.
2. List `.kaze/steering/*.md` when the user asks what exists; otherwise use the
   user's stated convention as the target file.
3. Pick a kebab-case file name by topic (`api-conventions`, `testing`, `paths`).
   One file per topic; do not append unrelated rules to one file.
4. Write the file with `---\napply: always\n---` and a short body: one bullet per
   rule, each factual and checkable by a human. Do not include secrets,
   credentials, tutorials, or spec-specific decisions.
5. If the item must hold for every spec and a command or observable condition can
   check it, it is a Hard Rule: send it to `/spec-rules` (`AGENTS.md` →
   `## Project Rules`) instead. Do not record the same fact in both places.
6. If the file already exists, read it first and edit only the affected bullets.
7. Report the file path and the conventions added or changed.

Rules:
- Keep the whole directory small enough to read in a few seconds; split by topic.
- A steering convention is advisory and not gate-enforced; a hard constraint
  belongs in Project Rules.
- A steering file never overrides `AGENTS.md` or the current spec.
- All files are injected once per session; say that a change applies to the next
  session/turn that reads the directory.

This skill is the /spec-steering command. It writes only `.kaze/steering/`;
those conventions are advisory and never gate-enforced.
