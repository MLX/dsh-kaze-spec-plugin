# Requirements Analysis

`/spec-analyze` is an optional, read-only review of an existing
`requirements.md` (or `bugfix.md`). It writes `analysis.md`; it does not rewrite
the requirements.

## When to use

- before a large design phase, when ambiguity is expensive;
- after clarification, as an independent second pass;
- when the user asks "analyze my requirements" / "检查需求".

Do not run it on a spec with no requirements document.

## Dimensions

Check every requirement block for:

- **Ambiguity** — vague adjectives without a bound ("fast", "robust"),
  undefined pronouns, unquantified "many";
- **Conflict** — two criteria that cannot both hold, or a criterion that
  contradicts the glossary;
- **Gap** — missing empty, error, boundary, concurrent, or repeated-input case;
- **Untestable** — no observable outcome, no measurable condition, no owner;
- **Escape clause** — "where possible", "if feasible", "as appropriate";
- **Compound** — one criterion containing two behaviors;
- **Traceability** — a user story with no criterion, or a criterion with no story.

Do not mention INCOSE/EARS to the user in chat; report findings plainly.

## `analysis.md`

```markdown
# Requirements Analysis — <feature>

## Findings

- F1 (ambiguity, 1.2): "quickly" has no bound. Suggest: under 200 ms p95.
- F2 (gap, 2.1): no behavior for an empty list.

## Open Questions

- Q1: Should a retry after a conflict reuse the same id?

## Decision

clean | needs-clarification | blocked — one sentence.
```

Rules:

- every finding names the requirement id and quotes the phrase;
- every finding has a concrete suggestion or question;
- `Decision` is `blocked` when a finding makes the design unsafe;
- the file is advisory: the design phase reads it and either fixes the wording
  or records why the finding is accepted.

## Gate

No gate of its own. When `analysis.md` has `Decision: blocked`, the design must
not start; fix the requirements and re-analyze. The design phase re-checks the
requirements it depends on.
