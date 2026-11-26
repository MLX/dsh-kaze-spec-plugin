# Steering Files

Steering files are short, long-lived project conventions that every session
should read. They live under:

```text
.kaze/steering/<name>.md
```

The Kaze menu labels this command **Steering Conventions** (`工作区约定`).
`/spec-steering` creates, revises, or lists them. The Host injects every file in
that directory once per session, so keep them short and factual.

## Where content goes

One home per fact: never record the same convention in both places.

| Content | Home | Enforced by |
| --- | --- | --- |
| Non-negotiable constraint every spec must obey, checkable by a command or observable condition | `AGENTS.md` → `## Project Rules` (`/spec-rules`) | design gate `## Rules Check`, per rule id |
| Path, naming, command, or pitfall convention for humans and agents alike, not gate-checked | `.kaze/steering/<topic>.md` (this command) | advisory, injected once per session |
| Decision that holds only for one feature | that spec's documents | the spec gates |

A session reads steering files only when the "Inject workspace conventions"
setting is on, and only once at session start. A constraint that must hold
belongs in Project Rules, not here.

## What belongs here

- path and module conventions ("API handlers live in `src/api/handlers/`");
- naming and error-shape rules;
- build, test, and single-run commands;
- recurring pitfalls and their workaround;
- language or framework constraints the user stated.

Do not put secrets, credentials, long tutorials, or spec-specific decisions
here. A decision belongs in the spec; a constraint for every spec belongs in
`AGENTS.md`'s Project Rules; a convention for humans and agents alike belongs
here.

## Shape

```markdown
---
apply: always
---

# API Conventions

- Every handler validates its payload with the shared schema.
- Errors use `{ code, message, details }`, never a bare string.
```

`apply` is informational today: all files are injected once per session. Do not
write a large file; split by topic.

## Precedence

1. The user's direct instruction.
2. Root `AGENTS.md` and Project Rules.
3. The current feature's spec documents.
4. Steering files.

When steering contradicts a spec, the spec wins for that feature and the
conflict is reported instead of silently resolved.
