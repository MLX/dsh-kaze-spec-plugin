# Acceptance Contract

`acceptance.md` is an optional spec-level acceptance record. It is not a DSH
session goal and it is not a second planning system.

Use it when "tests pass" is not enough to decide whether the feature actually
satisfied the request.

Path:

```text
.kaze/<feature>/acceptance.md
```

The completion gate requires an acceptance decision: approve every criterion, or
record a `skipped` gate with a reason. `/spec-apply` checks it before asking for
FTA; `/spec-fta` uses it when present.

## Creation and ownership

- The **Task Agent drafts `acceptance.md` during the tasks phase**, while the
  criteria are still fresh; it is reviewed together with the plan.
- `/spec-acceptance` can create or update the file independently at any point
  before the acceptance gate is recorded; after the gate, an edit makes the
  approval stale and `/spec-complete` must re-verify and re-record it.
- The acceptance decision itself is recorded by the execution session with
  `kaze_spec_gate_record` (`gate=acceptance`); the root session owns it.

## Outcomes

The acceptance gate has exactly three outcomes:

- **approved** — every Success Criterion verified against concrete evidence;
  record `status=approved` with non-empty `details` (and `evidence`).
- **failed** — a criterion is not met or cannot be evidenced; record
  `status=failed` with a non-empty reason and `return_to` pointing at the
  rework target: `execute` for an implementation gap, `tasks` for a plan gap,
  `design` for a wrong criterion. Then stop and rework.
- **skipped** — only when `acceptance.md` is absent: in an attended session ask
  the user first; in an unattended run record `status=skipped` with reason
  `unattended: acceptance.md absent; acceptance explicitly skipped`. A skipped
  gate always needs a non-empty reason.

An unverifiable criterion is never approved: ask the user, and record the gate
as `failed` (evidence gap) or as an explicit `skipped` with the reason — never
check the box without evidence.

## Shape

```markdown
# Acceptance — <feature>

## Goal
One sentence describing the user-visible outcome.

## Success Criteria
- [ ] WHEN <trigger>, <observable result> (Requirements 1.1).
- [ ] <another independently checkable result> (Requirements 2.1).

## Verification
- Re-read this file before declaring completion.
- A command exiting with code 0 is not sufficient evidence.
- For each criterion, cite the observed result or mark it unverified.

## References
- Optional paths to requirements, design, or external evidence.
```

## Traceability

- Every Success Criterion cites the requirement it decides on:
  `(Requirements X.Y)`. The validator warns about a criterion without a
  citation and rejects a citation that resolves to no declared requirement.
- A criterion that is an overall bar (for example "no regression in the
  existing suite") and does not map to one requirement says so in one line
  instead of citing an id.
- Reconcile with the correctness record before recording the gate:
  - a criterion covered by a property (`**Validates: Requirements X.Y**` in
    `design.md`) is evidenced by that property's final `passed` record in
    `kaze_spec_pbt` (`./pbt.md`);
  - for a verify-first spec, a criterion is evidenced by its `:named`
    assertion and its row in the `verification.md` `## Assertion Map`
    (`./verify-first.md`);
  - criteria without a property or assertion need the manual check named in
    the `## Verification` section.
- Coverage follows the tasks-phase rule: every criterion is decided by at
  least one **required** task; a criterion covered only by optional tasks is a
  plan gap, not evidence.

## Rules

- Criteria are observable and measurable; avoid implementation details.
- Do not duplicate every requirement; capture the acceptance bar that matters.
- Do not rewrite requirements or design here.
- If a criterion cannot be verified, say so explicitly; do not check it.
- `acceptance.md` does not replace `verification.md` for formal or manual
  verification records.
- DSH `create_goal` remains the session goal; this file is the spec artifact.
