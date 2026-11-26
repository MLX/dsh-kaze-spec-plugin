# Review, Analyze, and Verify

A cross-cutting checklist, not a phase: the state machine has no "review"
stage. **Trigger and timing**: run this checklist when `workflow=verify-first`
or when the design declares formal correctness properties — once while design
is being written, and again before completion or archive. Its outputs are the
review notes (written to `.kaze/<feature>/reviews/` as anchored comments) and
the recorded conclusions (gate evidence via `kaze_spec_gate_record`, or the
verification record for the model checks).

## A. Requirements analysis (interactive)

Interactive revision of `requirements.md`; see also `./analysis.md`, which is
the read-only `/spec-analyze` report over the draft (this section revises,
`analysis.md` only reports). When `analysis.md` exists, start from its
`## Findings` instead of re-deriving them.

1. Read `requirements.md`.
2. For each criterion, ask:
   - is the trigger observable?
   - is the response measurable?
   - is the actor named?
   - is there a missing boundary/error case?
3. Classify each issue:
   - **auto-resolvable** — the intent is clear; propose the minimal wording fix;
   - **needs-user** — two reasonable interpretations produce different behavior.
4. Apply auto-resolvable fixes directly.
5. Ask the user only the `needs-user` questions, with concrete options.
6. Write the answers back into `requirements.md`.
7. Update `design.md` and `tasks.md` if the change affects them.

Never rewrite a criterion that already contains the clarification.

## B. Format validation

Run `kaze_spec_validate` on every document.
Fix all errors before proceeding. Warnings may be accepted with a note.

Checks:

- required headings present;
- requirement/criterion numbering is contiguous and unique;
- EARS pattern matches the sentence shape;
- every task cites an existing requirement;
- DAG JSON parses and every leaf appears once;
- bugfix files use the three-section structure;
- no absolute paths in document links.

## C. Verify-first (SMT)

Use this only when the feature is a protocol, state machine, parser, money/auth
flow, or another case where "all inputs" matters.

### C1. Requirements v1

Write `requirements.md` with user stories only; no acceptance criteria yet.

### C2. Formal model

Write `model.smt2`:

```smt2
; sorts
(declare-sort State 0)
(declare-sort Outcome 0)

; events and state
(declare-const event_a Bool)
(declare-const event_b Bool)

; background axioms
(assert (not (and event_a event_b)))   ; at most one primary event

; acceptance criteria as named assertions
(assert (! (=> event_a (= outcome ok)) :named AC1_1))
(assert (! (=> event_b (= outcome error)) :named AC2_1))

(check-sat)
```

Rules:

- one named assertion per acceptance criterion;
- each assertion is `guard → postcondition`;
- background axioms are named `BA0`, `BA1`, …;
- do not encode implementation details that the requirements do not state.

### C3. Run checks

Use a solver (z3) to check:

1. **Consistency** — are all criteria satisfiable together?
2. **Completeness** — is there an input state with no defined outcome?
3. **Conflicts** — can two criteria fire together with contradictory outcomes?

If a gap is found, add a criterion to the model and re-run. Repeat until the
model reports no uncovered state (no gap) and no two assertions fire together
with contradictory outcomes (no conflict) — the same bar `./verify-first.md`
applies before recording the baseline.

### C4. Translate back to EARS

For each verified assertion, write the corresponding EARS criterion in
`requirements.md`. Include criteria added during verification.

### C5. Verification record

Write `verification.md` with the shape defined in `./verify-first.md`
(`## Method`, `## Result`, `## Assertion Map`) and record the baseline with
`kaze_spec_verify`. Do not use a second template here; the requirements gate
validates the `verify-first.md` shape.

Do not mention solver internals to the user; describe results in plain language.

## D. Cross-layer and frontend acceptance

For cross-layer changes, check `./fullstack-checklist.md`: contract,
trust boundary, data ownership, transactions, migration, asynchrony, rollback,
and unverified boundaries.

For user-visible changes, check `./frontend-checklist.md`: states,
accessibility, responsive overflow, reduced motion, and real-surface
validation. If browser validation is unavailable, say so explicitly.

## E. Adversarial and code review

Before completion or archive, consider:

- `/spec-fta` — read-only adversarial check for Omission, Commission, Drift,
  and Regression; verdict `PASS`, `FAIL`, or `PARTIAL` with `Blocker`,
  `Concern`, and `Note` findings.
- `/spec-code-review` — read-only review of the concrete diff, limited to
  change-introduced, triggerable, evidence-backed defects.

Both are optional for small changes and recommended for cross-layer,
brownfield, high-risk, or long-running specs.

## F. Post-change validation

For a substantial change (3+ files or multiple behaviors), run an independent
validation pass:

- decompose the user request into claims;
- for each claim, find the change in the diff and the check that proves it;
- run the project's tests yourself; do not trust the executor's report;
- output `VALIDATION_VERDICT: PASS` or `FAIL (<n> claims)`.

Write the verdict to disk, not only into the chat: record the claims, the
checks, and the verdict line in
`.kaze/<feature>/exec/evidence/validation.json`. Reference it from the gate
evidence when the verdict feeds an approval.

On FAIL, apply at most one minimal correction pass and stop. Do not loop.
