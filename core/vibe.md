# Direct Coding (Vibe Coding) — Quality Loop

Use this when the user asks for a direct code change without a spec.

The goal is not "type code quickly". It is **small, correct, verifiable change
with no scope drift**. Model speed never outranks evidence.

## 1. Goal contract

Restate the request in one sentence and list 2–5 acceptance checks. State what
is explicitly out of scope. If a requirement is genuinely ambiguous and a wrong
guess would be expensive, ask one blocking question; otherwise choose the
smallest safe assumption and say so.

## 2. Context, not a tour

Read only:

- the files that implement the behavior;
- the tests that already cover it;
- one or two nearby patterns worth matching.

Use grep/glob to find callers. Do not scan the whole repository "for context".
Do not propose a rewrite when the existing structure can absorb the change.

## 3. Baseline

If a fast check exists (unit test, lint, typecheck, `--help`, a smoke command),
run it before editing and keep the exact output. A failure caused by the current
change is not evidence that the change is good.

## 4. Smallest diff

Name the files you will touch before touching them. Prefer the smallest change
that satisfies the contract. Preserve existing style, naming, and error
handling.

Never invent:

- APIs, functions, flags, environment variables, or file paths;
- package behavior you have not read;
- test commands that do not exist.

If an API is uncertain, read its definition or run its help first.

## 5. Implement

- Keep one concern per edit.
- Do not add abstractions for a single use.
- Do not add placeholder implementations unless the user asked for a stub.
- Do not "fix" unrelated code; record it as an out-of-scope observation.
- Do not change generated files, lockfiles, or formatting outside the task
  without a reason.

## 6. Verify

Run the smallest check that can falsify the change, then the project's normal
test/lint/typecheck command when available. Report the exact command and result.

If the check fails:

1. diagnose the cause from the output;
2. make at most two focused correction attempts;
3. if it still fails, stop and report the blocker instead of guessing.

If no test exists, run an executable check that exercises the changed path and
state clearly what remains untested.

## 7. Drift review

Review the diff before reporting. Confirm:

- only intended files changed;
- no debug output, commented-out code, or temporary files remain;
- no new behavior beyond the goal contract;
- no formatting-only noise in unrelated files.

## 8. Report

Report:

- what changed;
- files touched;
- exact verification commands and outcomes;
- assumptions;
- residual risks or untested paths.

Do not claim "done" from a summary, a successful edit, or an unexecuted test.

## Stop conditions

Switch to the native Plan mode or `/spec`, or stop and ask, when:

- requirements conflict;
- the change needs a new public contract or a broad refactor;
- more than ~5 files would change without a plan;
- secrets, destructive operations, migrations, or production data are involved;
- the baseline is already failing for unrelated reasons.
