---
name: spec-wish
description: "开始许愿 wish：把简短、模糊的许愿整理成可直接执行的提示词，保持原意和语言。"
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
> `idle-queue.json`, `idle-config.json`, `spec-config.json`, `wishes/`) live
> under the workspace's `.kaze/` tree, never relative to this skill directory.


You are running the `/spec-wish` command in a Kaze spec flow.

Spec root is **.kaze**. Read the workspace's `AGENTS.md` when present and use the injected
`kaze:spec-context` block for the workspace settings.
In a non-interactive run, do not ask questions: make the safest reasonable
assumptions and state them only if they affect the refined prompt.

Command purpose: turn a short, vague "wish" into a precise, executable prompt
for a coding assistant. This command refines the request; it does not implement
it, answer it, or start a spec.

Steps:
1. Read the user's wish. Preserve its intent and language. Do not introduce a
   technology, framework, dependency, or product requirement the user did not
   imply.
2. Identify the goal, target user, observable outcome, in-scope behavior,
   explicit non-goals, constraints, integration points, acceptance criteria,
   and verification. Infer only when the workspace makes the answer clear; mark
   genuine assumptions as assumptions in the refined prompt.
3. If a missing decision would materially change what gets built, ask at most
   two short questions. If the wish is clear enough, do not ask.
4. Write one refined prompt in the user's language. Use this structure when it
   fits:
   - objective and user-visible outcome;
   - scope and non-goals;
   - constraints and compatibility requirements;
   - acceptance criteria, preferably EARS or Chinese EARS;
   - verification commands or checks;
   - relevant files/modules to inspect, if already known.
5. Keep the refined prompt concise (roughly 800–1200 Chinese characters or the
   equivalent English length). Prefer concrete behavior over methodology.
6. Persist the refined result to `.kaze/wishes/<slug>.md` (kebab-case slug from
   the wish): the refined prompt plus its recorded assumptions. Overwriting an
   existing file with the same slug is allowed.
7. Do not output commentary, a plan, code, or an answer to the wish. Output only
   the refined prompt in a fenced block, followed by one short fork line in the
   user's language: a bug report continues with `/spec-bugfix`; a feature
   continues with `/spec`, which folds these recorded assumptions into its
   first clarify round instead of asking them again; a direct code change
   continues with `/vibe`.
8. If the user asks for a spec after refinement, hand the refined prompt to
   `/spec` rather than creating documents in this command.

Rules:
- Do not turn an ambiguous wish into a large speculative feature set.
- Do not add "best practices" that are not relevant to the requested outcome.
- Keep exact file paths, API names, flags, and error messages only when they are
  present in the user's request or verified in the workspace.
- If the wish is a bug report, preserve the reproduction and expected/actual
  behavior; do not rewrite it into a feature request.

This skill is the /spec-wish command. Spec root is `.kaze`; it refines prompts
only and never implements the wish.
