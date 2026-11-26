# Brownfield Scope

Kaze records the project scope once in `state.json`:

```json
{
  "scope": "brownfield"
}
```

`scope` is `brownfield`, `greenfield`, or `unknown` (legacy specs). Do not put a
scope marker in every document.

## Choosing the scope

- `kaze_spec_init` defaults to `brownfield`; this is the safe default.
- Pass `scope=greenfield` only for a truly empty project.
- `bugfix` is always brownfield.
- For an existing spec, run `kaze_spec_scope { feature, scope }` to correct it.
- State the classification in the first clarification round so the user can
  correct it without a separate question.

When in doubt, use brownfield. A wrong `greenfield` silently disables every
compatibility check below.

## Optional per-document marker

`state.json` is the single source of truth, so documents do not need a scope
marker. When a document is copied out of the spec tree (a review snippet, a
standalone lint), add the marker as its first line so the checks still apply:

```markdown
<!-- scope: brownfield -->
```

- A marker that disagrees with `state.json` is reported as an error; fix one of
  them instead of leaving two truths.
- With no marker and no state, the scope is `unknown` and the validator warns
  that brownfield checks are skipped.
- The marker is not translated and stays exactly `brownfield` / `greenfield`.

## Brownfield requirements

Survey the real files before writing anything. Collect, each fact with a
concrete path (and a line range where useful):

- data and persistence contracts: schemas, migrations, on-disk formats, config
  shapes, version fields, sample values that must keep loading;
- interface contracts: exported symbols, routes, event payloads, CLI flags, and
  their real call sites (count them);
- behavior today's users and tests rely on, plus the single-run test command;
- conventions: naming, error handling, build commands.

`requirements.md` must include:

```markdown
## Existing System Survey
- src/path.ts:10-40 — current contract and its real callers
```

and a preservation clause for **every existing contract the feature touches**
(at least one overall):

```text
WHEN <existing scenario>, THE <System> SHALL CONTINUE TO <existing behavior>.
```

The survey must be grounded in real files, not names or guesses. The validator
checks this:

- every bullet must name a path (relative to the workspace root) that exists on
  disk — `No path, no claim`;
- the number of `SHALL CONTINUE TO` clauses must cover the number of survey
  bullets; fewer clauses produce a warning;
- a bullet with no path produces a warning.

If the survey contradicts the request, stop and report the conflict before
designing.

## Brownfield design

`design.md` must include:

```markdown
## Impact on Existing System
## Migration and Backward Compatibility
```

and a Preservation property:

```text
Property N: Preservation
For any existing data/caller, the changed system SHALL produce the same observable result.
**Validates: Requirements X.Y**
```

Migration must state how old data is read, how versions are distinguished, the
migration step, and the rollback.

## Brownfield tasks

`tasks.md` must include:

- a non-optional migration/compatibility task that updates the readers of old
  data, not only the writers of the new shape (name the caller, parser, or
  loader; a task that only mentions the new writer gets a warning);
- a no-regression checkpoint that runs the existing suite and compares it with
  the baseline.

## Execution

Before changing code:

1. Run the existing suite once and record the baseline.
2. Record the build/test commands and compatibility picture in
   the spec's `.kaze/<feature>/exec/context.json` when the spec spans multiple waves.
3. After each wave, re-run the baseline and report newly failing tests as
   regressions. Do not adjust existing tests to fit the new behavior unless the
   user explicitly chose that in `clarify.md`.

If the change cannot preserve an existing contract, stop and report the
breaking decision; do not invent a migration the design does not specify.
