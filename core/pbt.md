# Property-Based Testing from EARS

EARS gives a behavior statement; a property gives a universal claim. This
procedure maps one to the other and keeps the mapping auditable.

## When it applies

Use for pure functions, parsers/serializers, data transformations, algorithms,
protocols, and business rules with a large input space. Skip for UI layout,
IaC, simple CRUD, configuration validation, and side-effect-only work — say why
in the Testing Strategy.

## Mapping (per criterion)

For each acceptance criterion, choose exactly one:

- **property** — the criterion quantifies over inputs and can become
  `For any X where precondition, invariant`. Write it under
  `## Correctness Properties` with `**Validates: Requirements X.Y**`.
- **example-based** — the criterion is a single scenario, a UI state, or an
  external integration. List it under `## Example-based Criteria` with the id
  and a one-line reason.

No criterion may be silently absent: the validator warns about any criterion
that is neither covered by a property nor listed as example-based.

Common patterns:

| Criterion shape | Property |
|---|---|
| encode/decode, render/parse, save/load | round trip |
| normalize, dedupe, sort | idempotence / invariant |
| filter, page, subset | size or set relation |
| optimized path | equivalence with a reference implementation |
| invalid input | typed error, never a crash |

## `/spec-pbt` procedure

1. Read `requirements.md` and `design.md`.
2. Fill `## Correctness Properties` from the criteria; each property has
   `_For any_ ...`, a domain, and `**Validates: Requirements X.Y**`.
3. Add `## Example-based Criteria` for the rest.
4. Update `design.md`'s Testing Strategy to name the generator library and a
   minimum of 100 cases per property.
5. Add property test tasks to `tasks.md` with `_Requirements: X.Y_` and a
   `**Validates**` line; mark test sub-tasks `*` only when the user allows
   optional tests.
6. For a known language/test framework, generate a stub per property under the
   project's test directory; never overwrite an existing test file.
7. Record executed outcomes with `kaze_spec_pbt`; the record is evidence, not a
   proof.

## Honesty rules

- A passing property is evidence, not formal verification.
- A property that is weaker than its criterion is a defect in the property.
- Do not generate a test stub for a property the design does not state.
- Do not change a requirement to make a property easier; fix the property.

## Failure loop

1. On a failed property, first decide whether the **property** or the
   **implementation** is wrong: re-read the criterion the property validates.
2. Property defect (too weak, wrong domain, wrong invariant): fix the property,
   re-run it, and re-record the outcome with `kaze_spec_pbt`.
3. Implementation defect: fix the implementation, re-run the property, and
   re-record. Do not weaken the property to make the code pass.
4. Write every counterexample into the `example` field of `kaze_spec_pbt` and
   list it under the manual checks of `verification.md`.
5. **Unexpected pass**: a property that previously failed turns `passed`
   without a corresponding fix — investigate before recording it (a broken
   generator or a silently weakened property is the usual cause). Record an
   unexplained pass as `unexpected_pass`, not `passed`.
6. Before done, `/spec-complete` reconciles the records: every property
   declared in the design ends with a final `passed` record. The done gate
   warns when a property has no record at all and **fails** when a property's
   final record is `failed`; re-run the property and record a passing result
   before advancing to done.
