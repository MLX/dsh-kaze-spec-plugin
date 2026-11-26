# Optional Explore — Before a Spec

Explore is a **read-only stance**, not a spec phase. Use it when the request is
still an idea, a comparison, or an unclear problem. It is allowed to conclude
that no spec should be written.

## Rules

1. Do not create or edit files by default.
2. Do not create `.kaze/<feature>/`, `state.json`, or any spec artifact.
3. Do not run mutating commands, installs, migrations, or deploys.
4. Read only what is needed to ground the answer.
5. "Do not build this" is a valid recommendation.
6. If the user asks to capture the result, write only the files they name.

## Output

Use this structure:

```markdown
# Explore — <topic>

## Problem
What is actually being decided?

## Options
1. <option> — trade-offs
2. <option> — trade-offs

## Risks and unknowns
- ...

## Evidence
What was read or checked.

## Recommendation
Build / defer / reject, and why.

## Next step
`/spec <request>` or `/vibe <change>` or stop.
```

## Handoff

- If a spec is warranted, hand off to `/spec` with the chosen problem statement.
- If a direct change is warranted, hand off to `/vibe`.
- If the answer is "don't build", stop and record the reason in the reply.

Explore never replaces requirements, design, tasks, review, or gates.
