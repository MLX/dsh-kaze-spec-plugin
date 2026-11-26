# Phase 2 — Design

Produce `{{SPEC_ROOT}}/{{FEATURE}}/design.md`. The design says **how** the
system satisfies the requirements. It must be concrete enough that a different
engineer could implement it without re-reading the original request.

## Process

1. Read `requirements.md` (or `bugfix.md`) completely. If `analysis.md` exists
   and its `## Decision` says `blocked`, stop and return to the requirements
   phase instead of designing.
2. Inspect existing code, interfaces, and conventions that constrain the design.
   If `state.json` scope is `brownfield`, read `./brownfield.md`; the design must
   carry `## Impact on Existing System`, `## Migration and Backward
   Compatibility`, and a Preservation property derived from the survey.
3. Read the project rules from the workspace's root `AGENTS.md` when present,
   plus the core pack. Treat them as constraints on this design.
4. If the design has a real technical unknown, new dependency, new integration,
   protocol choice, migration, or security boundary, write `research.md` first:
   `## Decision`, `## Rationale`, `## Alternatives considered`, and
   `## Unresolved unknowns`. Do not add research for ordinary features.
   A Decision that changes the technology stack, a dependency, or the target
   platform is a user decision, not a research finding: cite the ledger, or
   return `BLOCKED` (see below) instead of self-approving it.
5. Choose the smallest architecture that satisfies the requirements.
6. Write the sections below in order.
7. If the change crosses layers, apply `./fullstack-checklist.md`. If it
   changes a user-visible surface, apply `./frontend-checklist.md`.
8. Assess whether property-based testing applies; if it does, write
   correctness properties.
9. Write the file, validate it, stop at the phase checkpoint.

Do not invent requirements. If the design needs behavior the requirements do not
cover, go back and add a requirement first.

## Required sections

1. **Overview** — 1–2 paragraphs: the approach and why it is the right one.
2. **Architecture** — components, responsibilities, boundaries, data flow.
3. **Components and Interfaces** — types, functions, APIs, error contracts.
4. **Data Models** — entities, fields, invariants, persistence, migration.
5. **Correctness Properties** — only if PBT applies (see below).
6. **Error Handling** — failure modes, retries, idempotency, user-visible errors.
7. **Testing Strategy** — unit, property, integration, end-to-end, and what is
   deliberately not tested.
8. **Trade-offs** — the chosen option, the rejected alternatives, the reason
   (lifetime, change probability, impact, reversibility, correction cost), and
   what would make you reconsider. If an existing component, module, or
   dependency could carry the behavior, say why it is not reused. When only one
   viable path exists, write one line saying so; the section is still required.

The design gate rejects a `design.md` without `## Trade-offs` (or `## 权衡` /
`## 取舍`), and `kaze_spec_validate` reports the same gap. Keep the heading and
answer it; do not reopen a settled decision just to fill the section.

Include a Mermaid diagram when relationships are non-trivial. When the design
contains commands, packaging, or a deployment step, state the target platform in
one line under Overview or Architecture and read `./platform.md` before writing
any command.

## Detail levels

Read `designDetail` from `kaze_spec_status` (or the `kaze_spec_init` result) and
match the requested depth; do not silently upgrade a `high` request into a full
design.

| Level | Produce | Omit |
|---|---|---|
| `high` | Overview, architecture with a Mermaid diagram, component responsibilities, data models, interfaces at contract level (types, endpoints, error shapes), key risks | function bodies, pseudocode, line-level algorithms |
| `low` | A 1-2 sentence Overview, the main algorithm or sequence (Mermaid), core interfaces/types as code, key functions with preconditions and postconditions, step-by-step pseudocode, one usage example | long prose, market or product background |
| `comprehensive` | Every required section at full depth | nothing |

A `low` design still names the target platform and still states data invariants.
A `high` design still rules correctness properties in or out.

## Design-first path

When `workflow=design-first`, the design is written before the requirements:
start from the user's technical vision, write `design.md` first, then derive
`requirements.md` from it with `./requirements.md`'s design-first variant.
The phase pointer starts at `initial` and moves to `requirements` only after
both documents exist — the engine's requirements gate requires `design.md` and
the requirements document together, and (by recorded creation order) the
design first. Under `/spec` classic, the review pause after the design is the
first checkpoint; the requirements review follows after both documents exist.
The design is not discarded when the requirements are written.

Rules:

- mark every interface and data model as new or changed;
- do not write acceptance criteria into the design; requirements own them;
- after the requirements exist, re-read the design and fix any drift, then run
  the normal gates;
- the design detail level still applies.

## Conditional research

`research.md` is optional and usually belongs to the design phase. Write it only
when the design depends on an unresolved technical choice. When the requirements
phase already produced one for an external fact, read it instead of repeating the
research. Required sections:

1. **Decision** — the choice made.
2. **Rationale** — why, with evidence.
3. **Alternatives considered** — what was rejected and why.
4. **Unresolved unknowns** — anything still blocking or risky.

If `research.md` exists, `kaze_spec_validate` checks those sections. It is a
design input, not a separate phase or command. A Decision that fixes the stack,
a dependency, or the target platform cites a `clarify.md` decision; a Decision
does not create user authority.

## Rules check (AGENTS.md)

The workspace's Project Rules are the `## Project Rules` section of the root
`AGENTS.md`, managed by `/spec-rules` and labelled Hard Rules
(`工程红线`) in the Kaze menu. They are not a second constitution file; do not
create one. Steering conventions under `.kaze/steering/` are separate, advisory,
and never satisfy this check.

When Project Rules exist, include:

```markdown
## Rules Check

- R1: compliant — evidence or the task that proves it.
- R2: exception — one-line rationale; the user accepted it.
```

If no Project Rules exist, omit the section and say so in the design summary.
The design gate fails when Project Rules exist and `## Rules Check` is missing.
The legacy `## Constitution Check` heading is accepted for existing specs.

A rule violation is a design error unless the user explicitly accepts the
exception.

## Language and notation

- If the user named a language, use it.
- Else if the workspace has a dominant language, use it and say so.
- Else if the ledger records an accepted assumption or the user chose
  "用推荐默认值", use Structured Pseudocode and say so.
- Else stop and return `BLOCKED: which implementation language should the design
  use?` with 2-4 options, or ask through the root session in a one-shot flow.
  Do not default silently in an interactive run.
- Never mix languages in one design without a reason.

Pseudocode uses explicit `INPUT`, `OUTPUT`, `PRECONDITION`, `POSTCONDITION`,
and `INVARIANT` where they clarify behavior.

## Correctness properties

Write this section only when the behavior is a good fit for property-based
testing: pure functions, parsers/serializers, data transformations, algorithms,
protocols, business rules with a large input space.

Skip it for IaC, UI layout, simple CRUD, configuration validation, and
side-effect-only operations. When skipped, say why in the Testing Strategy.

Each property must:

- be universally quantified (`For all` / `For any`);
- state the input domain and the expected invariant;
- cite the requirements it validates: `**Validates: Requirements 1.1, 1.3**`;
- be implementable as one property-based test;
- use a minimum of 100 generated cases.

Common patterns:

| Pattern | Example |
|---|---|
| Round trip | `decode(encode(x)) == x` |
| Invariant | `len(sort(xs)) == len(xs)` |
| Idempotence | `normalize(normalize(x)) == normalize(x)` |
| Metamorphic | `len(filter(p, xs)) <= len(xs)` |
| Model-based | optimized implementation equals a simple reference |
| Error condition | invalid input always yields a typed error, never a crash |

## Bugfix design variant

For `specType=bugfix`, `design.md` must contain the sections the design gate
checks for a bugfix (these exact `##` headings; `## Glossary` is a recommended
addition) — the same set `./bugfix.md` requires:

1. **Overview** — the defect summary and the fix approach.
2. **Bug Details** — `isBugCondition(X)` in pseudocode, plus concrete examples.
3. **Expected Behavior** — what happens when the condition holds.
4. **Hypothesized Root Cause** — ranked, falsifiable.
5. **Correctness Properties** — one fix-checking property, one preservation
   property, both citing requirements.
6. **Fix Implementation** — files/functions to change, with the smallest safe
   change.
7. **Testing Strategy** — exploratory test on unfixed code, fix check,
   preservation check, regression tests.

The preservation property is usually:

```text
FOR ALL X WHERE NOT isBugCondition(X):
  ASSERT F_original(X) == F_fixed(X)
```

## Phase gate

- [ ] every requirement maps to at least one component or behavior;
- [ ] interfaces and error contracts are explicit;
- [ ] the chosen option, the rejected alternatives, and the reason are recorded
  under `## Trade-offs` (or `## 权衡` / `## 取舍`);
- [ ] data invariants are stated;
- [ ] correctness properties are present or explicitly ruled out;
- [ ] if `research.md` exists and its Unresolved unknowns still affect
  behavior, they are addressed or cited in the design; the validator warns
  about them (and strict mode fails the gate on the warning), so a remaining
  unknown needs a recorded user waiver in the ledger;
- [ ] testing strategy names the checks that prove each requirement;
- [ ] no unresolved TODO that changes behavior;
- [ ] `kaze_spec_validate` passes.

Stop and ask the user to review. Do not start `tasks.md` in the same turn. In
a one-shot flow (`/spec-flow` or the `/spec` one-shot mode) this pause is
skipped; the single final plan review covers it. On pass, the orchestrator
calls `kaze_spec_advance` to `design`.

## Blocked decisions

A design agent that cannot ask the user must not pick a user-owned decision to
keep moving. If the ledger does not settle the language, stack, dependency,
platform, compatibility policy, or a security boundary, stop and return:

```text
BLOCKED: <one-line question>
Options: <2-4 options with one-line impact>
Blocks: design.md § <section>
```

The orchestrator asks in the root session, records the answer in `clarify.md`,
and re-dispatches this phase. In a one-shot flow the root session asks directly
and continues.
