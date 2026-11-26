# Project Rules

Project Rules are the workspace's non-negotiable engineering constraints. They
are not a second constitution file: they live in the root `AGENTS.md` under:

```markdown
## Project Rules

- R1: Public APIs stay backward compatible within a major version.
  - Applies to: `src/api/**`
  - Check: `npm run test:contract`
- R2: No new runtime dependency without a license review.
```

The Kaze menu labels this command **Hard Rules** (`工程红线`). The section
heading stays `## Project Rules`; `## 项目规约` and `## 工程红线` are accepted
for existing workspaces, and new documents use `## Project Rules`.

`/spec-rules` creates, revises, lists, or removes these entries. Keep each rule
short, testable, and scoped; a rule that cannot be checked is guidance, not a
rule.

## Design check

When the workspace has a Project Rules section, `design.md` must contain:

```markdown
## Rules Check

- R1: compliant — contract tests added in task 4.2.
- R2: exception — no new dependency; rationale recorded in research.md.
```

Every rule is listed with `compliant` or `exception`. An exception needs a
one-line rationale; without it the check is incomplete.

The design gate fails when Project Rules exist and `## Rules Check` is missing.
The older `## Constitution Check` heading is still accepted for existing specs,
but new documents use Rules Check.

## Not here

- Path, naming, build/test command, and pitfall conventions that the gate does
  not enforce belong in `.kaze/steering/` (`/spec-steering`). The two places
  hold different content; one fact lives in one place only. `./steering.md`
  defines the split.
- A decision that holds for one feature belongs in that spec's documents.

## Rules

- Rules live in `AGENTS.md`; never create a second rules file.
- A rule is not a style preference: it must be observable or command-checkable.
- Do not silently drop a rule; mark it removed with a reason in the same edit.
- Do not invent rules the user did not state.
