# Phase 1 — Requirements

Produce `{{SPEC_ROOT}}/{{FEATURE}}/requirements.md` (or `bugfix.md` in the
bugfix workflow). Requirements describe **observable behavior**, not
implementation.

## Process

1. Read the user's request verbatim and the workspace context that matters.
2. If `state.json` scope is `brownfield`, read `./brownfield.md`, survey
   the real existing contracts, and add `## Existing System Survey` plus
   `SHALL CONTINUE TO` preservation clauses before writing ordinary criteria.
3. Identify actors, external events, states, and outcomes.
4. Before writing a criterion that depends on an external fact (a legal limit,
   a standard clause, a vendor quota, a compatibility claim), settle it:
   - the workspace or the user already gives the fact → cite it;
   - the fact is external and material → run `./research.md` via
     `/spec-research` (this phase may own `research.md`) and cite the source;
   - research is impossible or declined → mark the claim `UNVERIFIED`, record
     it as an assumption in `clarify.md`, and do not present it as a firm
     `SHALL` (use `WHERE` / an explicit assumption sentence).
5. Write one user story per coherent capability.
6. Write acceptance criteria in EARS.
7. Self-check against the quality rules.
8. Write the file, validate it, then stop at the phase checkpoint.

Never invent a legal, quota, standards, or compatibility fact. The validator
warns about `UNVERIFIED` claims in `requirements.md`; an unverified external
fact that becomes a criterion is a defect, not a detail.

Do not ask requirement questions unless a missing answer changes observable
behavior. Technology, runtime/platform, compatibility, security, and test-bar
decisions are still asked — through `./clarify.md`, in the clarification loop —
even though this document keeps implementation out. If you must ask a
requirement question here, ask at most three questions in one turn and offer
concrete options.

## Workflow variants

### Verify-first (`workflow=verify-first`)

Do not write acceptance criteria on the first pass. Write the user stories, then
follow `./verify-first.md`: `model.smt2`, the check, `verification.md`, and only
then translate the checked assertions into EARS criteria. The engine blocks the
requirements gate until `model.smt2` and `verification.md` exist.

### Design-first (`workflow=design-first`)

Read the approved `design.md` first and derive the requirements from it:

- one requirement per user-visible capability the design enables;
- acceptance criteria describe observable behavior, not the design's internals;
- mark a requirement that the design does not cover as a gap, and fix the design
  before writing the criterion;
- the engine blocks the requirements gate until `design.md` exists.

## EARS patterns

Use exactly one pattern per criterion.

| # | Pattern | Form |
|---|---|---|
| 1 | Ubiquitous | `THE <system> SHALL <response>` |
| 2 | Event-driven | `WHEN <trigger>, THE <system> SHALL <response>` |
| 3 | State-driven | `WHILE <state>, THE <system> SHALL <response>` |
| 4 | Unwanted event | `IF <condition>, THEN THE <system> SHALL <response>` |
| 5 | Optional feature | `WHERE <option>, THE <system> SHALL <response>` |
| 6 | Complex | `[WHERE] [WHILE] [WHEN/IF] THE <system> SHALL <response>` |

Complex-clause order is fixed: `WHERE → WHILE → WHEN/IF → THE → SHALL`.

## Quality rules

**Clarity**

- active voice; name the actor;
- no vague words: quickly, adequate, reasonable, user-friendly, robust;
- no pronouns: it/them/they → name the system or component;
- one behavior per criterion.

**Testability**

- every condition is observable or measurable;
- include units and tolerances where relevant;
- no escape clauses: where possible, if feasible, as appropriate;
- do not write negative-only statements unless the negative is the requirement
  (e.g. "SHALL NOT store the password in plaintext").

**Completeness**

- define every domain term in a glossary before using it;
- cover the empty, error, boundary, concurrent, and repeated-input cases;
- distinguish "must" from "may";
- keep implementation choices out; those belong in `design.md`, and the user's
  choice itself is recorded in `clarify.md`.

## Traceability

- Requirements are numbered `Requirement 1`, `Requirement 2`, …
- Criteria are numbered `1.1`, `1.2`, …
- Every later task and property cites these ids.
- Renumbering is forbidden after design starts; append instead.

## Template

```markdown
# Requirements — {{FEATURE}}

## Introduction

<one paragraph: the problem, the user, and the outcome>

## Glossary

- **Term**: definition.
- **Term_With_Underscore**: definition.

## Requirements

### Requirement 1: <capability>

**User Story:** As a <role>, I want <capability>, so that <benefit>.

#### Acceptance Criteria

1.1 WHEN <trigger>, THE <system> SHALL <response>.
1.2 WHILE <state>, THE <system> SHALL <response>.
1.3 IF <unwanted event>, THEN THE <system> SHALL <response>.

### Requirement 2: <capability>

...
```

## Bugfix variant

When `specType=bugfix`, write `bugfix.md` instead:

```markdown
# Bugfix — {{FEATURE}}

## Introduction

<the bug, its impact, and the intended fix scope>

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN <condition>, THE system <incorrect behavior>.
1.2 ...

### Expected Behavior (Correct)

2.1 WHEN <condition>, THE system SHALL <correct behavior>.
2.2 ...

### Unchanged Behavior (Regression Prevention)

3.1 WHEN <condition>, THE system SHALL CONTINUE TO <preserved behavior>.
3.2 ...
```

The bug condition is later formalized in `design.md` as `isBugCondition(X)`.

## Phase gate

Before leaving this phase:

- [ ] `clarify.md` exists and has no open question (the requirements gate
  requires the clarification ledger);
- [ ] every requirement has a user story and at least one criterion;
- [ ] every criterion follows one EARS pattern;
- [ ] every term is defined or obvious;
- [ ] error/boundary cases are covered;
- [ ] no implementation detail leaked in;
- [ ] `kaze_spec_validate` (or the host's linter) passes.

Stop and ask the user to review. Do not start `design.md` in the same turn. In
a one-shot flow (`/spec-flow` or the `/spec` one-shot mode) this pause is
skipped; the single final plan review covers it. On pass, the orchestrator
calls `kaze_spec_advance` to `requirements`.
