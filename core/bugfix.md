# Bugfix Workflow

Use when existing behavior is wrong. The goal is a **minimal, provably safe**
fix: change behavior only where the bug condition holds.

## Phase 1 — Bugfix requirements (`bugfix.md`)

Three sections only:

```markdown
# Bugfix — {{FEATURE}}

## Introduction

## Bug Analysis

### Current Behavior (Defect)
1.1 WHEN <condition>, THE system <incorrect behavior>.

### Expected Behavior (Correct)
2.1 WHEN <condition>, THE system SHALL <correct behavior>.

### Unchanged Behavior (Regression Prevention)
3.1 WHEN <condition>, THE system SHALL CONTINUE TO <preserved behavior>.
```

Rules:

- each defect clause has a corresponding correct clause for the same condition;
- unchanged behavior must be concrete and testable;
- no design or implementation content in this file.

## Phase 2 — Bugfix design (`design.md`)

Required headings (the design gate checks them):

```markdown
# Design Document

## Overview

## Bug Details

## Expected Behavior

## Hypothesized Root Cause

## Correctness Properties

### Property 1: Fix checking
_For any_ X where isBugCondition(X), the fixed behavior holds.

**Validates: Requirements 2.1**

### Property 2: Preservation
_For any_ X where NOT isBugCondition(X), F_original(X) == F_fixed(X).

**Validates: Requirements 3.1**

## Fix Implementation

## Testing Strategy
```

Also state `isBugCondition(X)` with examples, rank the root-cause hypotheses,
and describe the smallest fix with files/functions. The preservation property is
the key safety net:

```text
FOR ALL X WHERE NOT isBugCondition(X):
  ASSERT F_original(X) == F_fixed(X)
```

## Phase 3 — Bugfix tasks (`tasks.md`)

Order:

1. Write an exploration test that **fails on the unfixed code** and proves the
   bug condition.
2. Run it on unfixed code and record the counterexample.
3. Implement the minimal fix.
4. Write the preservation property test.
5. Run fix + preservation + regression suites.
6. Checkpoint.

The tasks file also needs a `## Task Dependency Graph` JSON block that covers
every required leaf, and at least one task whose text names the regression suite
and one that names preservation / unchanged behavior; the tasks gate enforces
both.

Do not write the fix before the failing exploration test. Do not "fix" the test
to make it pass.

## Phase 4 — Execute and verify

- The executor must read `bugfix.md`, `design.md`, and `tasks.md`.
- The exploration test's failure on unfixed code is expected; record it.
- After the fix, the same test must pass.
- Preservation tests must pass on both the fixed and a reference/original
  implementation when possible.
- If the root cause hypothesis is refuted, stop and re-hypothesize; do not pile
  on speculative changes. Update the `## Hypothesized Root Cause` and
  `## Fix Implementation` sections of `design.md`, re-validate, and re-gate the
  design phase. Existing gate approvals become stale;
  `/spec-complete` re-verifies and re-records them.

## Completion

The done gate requires a `verification.md` record for a bugfix, with
`## Method` and `## Result`; it also requires the task plan and execution
evidence. Report:

- the confirmed bug condition;
- the counterexample observed on unfixed code;
- the fix and why it is minimal;
- preservation evidence;
- regression results;
- any behavior that remains intentionally unchanged.
