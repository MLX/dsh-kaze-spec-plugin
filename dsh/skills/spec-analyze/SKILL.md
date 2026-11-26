---
name: spec-analyze
description: "需求分析 analyze：按 INCOSE 维度复核需求，产出 analysis.md 并列出待确认问题。"
user-invocable: true
---

> **Path contract:** `core/<file>` resolves to the workspace `core/` copy when
> present, otherwise the bundled core pack at `../../../core/<file>` relative to
> this skill. **Hard rules:** read `core/plugin-rules.md` before acting.
> `AGENTS.md` holds the workspace's Project Rules when present.
> `.kaze/...`
> and every spec artifact named below (`state.json`, `requirements.md`,
> `design.md`, `tasks.md`, `acceptance.md`, `delivery.md`, `gates.json`,
> `research.md`, `analysis.md`, `verification.md`, `bugfix.md`, `reviews/`,
> `exec/`, `batch/`, `idle-queue.json`, `idle-config.json`, `spec-config.json`)
> live under the workspace's `.kaze/` tree, never relative to this skill
> directory.

You are running the `/spec-analyze` command in a Kaze spec flow.

Spec root is **.kaze**. Native DSH tools own engine state (`kaze_spec_*`).
In a non-interactive run, ask nothing; record questions in the report.

Command purpose: independently review an existing requirements document and
write `.kaze/<feature>/analysis.md`.

Steps:
1. Read `core/analysis.md` and `.kaze/<feature>/requirements.md` (or
   `bugfix.md`). If the document is absent, stop and say so.
2. Check every requirement block for ambiguity, conflict, gap, untestability,
   escape clauses, compound criteria, and story/criterion mismatch.
3. Write `analysis.md` with `## Findings`, `## Open Questions`, and
   `## Decision` (`clean` / `needs-clarification` / `blocked`). Every finding
   cites the criterion id, quotes the phrase, and gives a concrete suggestion.
4. Call `kaze_spec_validate`; fix structural errors in `analysis.md` (the
   validator checks the `## Findings` and `## Decision` headings and fails the
   design gate when `Decision` is `blocked`). Then manually verify beyond the
   validator: every finding cites a criterion id and a quote.
5. If `Decision` is `blocked`, tell the user the design must not start and name
   the findings to fix. Otherwise report the findings and let the user decide
   whether to revise the requirements.
6. Close with the rework path: revise the requirements with `/spec-refine`, then
   re-gate requirements and continue with `/spec-design`; when `clean`, continue
   directly with `/spec-design`.

Rules:
- Do not rewrite `requirements.md` in this command; findings are a review.
- Do not mention INCOSE/EARS in chat; report plainly.
- A finding without a quote or a criterion id is not a finding.
