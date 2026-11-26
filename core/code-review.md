# Code Review

A read-only review of a concrete change. It is not a spec-document review and
not a refactor proposal.

## Scope

Follow the scope the user named: uncommitted worktree, commit, branch, PR/MR, or
specific files. Do not silently replace an explicit target with the current
diff.

For uncommitted work, inspect staged + unstaged + untracked changes. Use the
host's native changes review where available; otherwise use `git diff`,
`git diff --cached`, and read untracked files.

Read the applicable `AGENTS.md` and the surrounding call sites before claiming
cross-component impact.

## Calibration

Report only findings that are:

- a discrete, actionable defect;
- introduced by the requested change when a base is supplied;
- concretely triggerable, with the input/state/path and impact;
- verified against the current code, not assumed.

Ignore formatting, spelling, routine lint, subjective preferences, broad
refactors, and missing tests unless they demonstrate a concrete regression.

## Severity

- `Blocker` — correctness, security, data loss, auth bypass, a broken public
  contract, or a change that silences a signal to pass a check: a new lint or
  type suppression, a loosened or deleted assertion, an empty `catch`, or a
  skipped test.
- `Concern` — likely bug, performance risk, compatibility risk, or missing
  error handling that could affect users.
- `Note` — maintainability observation, no required action.

Do not use color emoji.

## Finding format

```text
<Severity> <file>:<line-range> — <trigger> → <impact>
Fix: <one minimal direction>
```

Include the shortest useful line range. Do not paste large before/after blocks
unless the user asks for a structured report.

## Output

- Every qualifying finding, sorted Blocker → Concern → Note.
- If no actionable issue remains, say so directly.
- Read-only: do not edit, stage, commit, push, or open a PR unless the user
  explicitly asks for fixes.
