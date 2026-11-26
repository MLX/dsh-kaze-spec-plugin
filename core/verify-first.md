# Verify-First Workflow

Use this route when correctness matters more than speed, or when the user says
"verify first", "形式化验证", "验证需求", or picks "验证优先". The requirements are
modelled and checked before the design or tasks exist.

The engine records `workflow=verify-first`. Its requirements gate requires
`model.smt2` and `verification.md` in addition to `requirements.md`; a missing or
empty model blocks the phase.

## Order

```text
clarify
  → requirements draft (user stories only, no acceptance criteria yet)
  → model.smt2
  → check the model (z3 when available; a documented manual check otherwise)
  → requirements.md with EARS criteria translated from the checked assertions
  → design.md
  → tasks.md
```

Design and tasks follow the normal requirements-first rules once the formal
check passes.

## Requirements draft

Write `requirements.md` with `## Introduction`, `## Glossary`, and one
`### Requirement N` per coherent capability. Include only the user story per
requirement — no acceptance criteria yet, because the checked assertions will
produce them.

Keep the draft small enough to model: 3-8 requirements is typical. Split
capabilities instead of modelling a whole product.

## Model (`model.smt2`)

Write SMT-LIB2 that encodes the essential state, not the UI:

- `declare-sort` / `declare-datatype` for the domain entities;
- `declare-fun` for state variables and events;
- `assert` for background axioms (one per invariant);
- one named assertion per acceptance criterion:

```smt2
; Requirement 1.1 — a submitted order is never empty
(assert (! (forall ((o Order)) (=> (submitted o) (> (item-count o) 0))) :named req_1_1))
```

Rules:

- every assertion gets a `:named` id that maps to a requirement clause;
- every acceptance criterion has exactly one named assertion; the assertion id
  must contain the criterion id (`req_1_1` or `AC1_1` for criterion `1.1`);
- brownfield: each `SHALL CONTINUE TO` criterion also gets its own named
  preservation assertion (for example `req_1_2` for criterion `1.2`), verified
  with the new ACs so a regression is a model conflict, not a surprise at runtime;
- the model ends with `(check-sat)` and has at least one declaration
  (`declare-sort`, `declare-datatypes`, `declare-fun`, or `declare-const`);
- no assertion may depend on UI text, timing, or file paths;
- keep the model self-contained; no imports and no solver-specific extensions
  beyond core SMT-LIB2;
- the model is a working artifact, not a proof: it must be small enough for the
  user to review.

## Check

1. Prefer `z3` when it is on `PATH`: run `z3 -smt2 .kaze/<feature>/model.smt2`
   once, non-interactively.
2. If `z3` is absent, check the model by reading it against the draft:
   every requirement has one named assertion, no assertion contradicts another,
   and every state transition is covered. Say explicitly that the manual check
   was used.
3. If the check reports a contradiction or a gap, fix the draft or the model and
   check again. Do not continue with a known contradiction.
4. Never install Python or a Python package to run a solver; the workflow must
   work with whatever `z3` (if any) the host already has.

### Reading the z3 result

- `sat` → the model is consistent: the named assertions can hold together.
  Record `PASS` in `verification.md` (listing any gap the model deliberately
  leaves open).
- `unsat` → a contradiction: some named assertions (or background axioms)
  cannot hold together. Record `FAIL` with the conflicting assertion names. To
  locate the culprit, check each `:named` assertion in isolation — comment the
  others out (or copy the assertion into a scratch model) and re-run; the
  assertion that turns an otherwise `sat` model `unsat` is the conflict.

## Verification record (`verification.md`)

Write it during the check, not after the design. Required sections:

```markdown
# Verification — <feature>

## Method

z3 -smt2 .kaze/<feature>/model.smt2 (version) — or “manual review only (z3 unavailable)”.

## Result

PASS | PASS (manual) | FAIL — one line per finding.

## Assertion Map

| Assertion | Requirement | Meaning |
|---|---|---|
| req_1_1 | 1.1 | <the invariant in plain language> |

## Gaps and Uncertainties

Anything the model does not cover, and why that is acceptable.
```

The Method must name `z3` or state that the check was manual. A manual Result
must say `manual` (for example `PASS (manual)`); do not present a manual review
as machine verification. The Assertion Map must have one row for every acceptance
criterion.

`verification.md` is also the completion evidence file: the done gate requires
it for a verify-first spec. Append the build/test commands and results when the
implementation is verified, and extend the Assertion Map instead of replacing
it; rebuild the record only when it is missing or malformed, and never
overwrite the planning-time model evidence with a later summary.

The requirements gate runs a structural preflight on `model.smt2`: it requires
`(check-sat)`, a declaration, at least one `:named` assertion (one per criterion),
balanced parentheses, and a named assertion for every criterion. `## Method`,
`## Result`, and `## Assertion Map` are required for verify-first. A missing or
malformed section fails the gate; `kaze_spec_verify` refuses to record a
baseline for a model that fails this preflight.

`kaze_spec_verify` records a baseline hash of `requirements.md` + `model.smt2`.
The design and done gates compare it with the current files: a change after the
recorded check makes `verification.md` stale. The design and tasks gates report
a stale baseline as a **warning** (strict mode upgrades it to a failure); the
done gate fails on it. After a change, re-run the check and call
`kaze_spec_verify` again.

## Translate to requirements

Turn each checked assertion into exactly one EARS criterion, keeping the same
clause number as the assertion name (`req_1_1` → `1.1`). If the model gained or
lost a clause during the check, renumber before the design starts and say so.

## Then continue

Write `design.md` normally. If a design decision invalidates an assertion, update
the model, re-check, update `verification.md`, and only then continue. The
requirements gate must still pass (`requirements.md` + `model.smt2` +
`verification.md`).

## Non-goals

- No proof of the implementation, only of the stated requirements.
- No separate solver UI, no Python, no external service.
- No model for a trivial wording-only change.
