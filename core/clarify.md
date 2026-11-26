# Clarification Protocol

Turn a fuzzy request into decisions before writing spec documents. `/spec-flow`,
both modes of `/spec`, and `/spec-requirements` when no ledger exists use this
protocol.

## Creation setup (new spec)

Before the requirement questions, settle the process route. Ask these as
**separate sequential calls**, one question per call — not as one multi-question
call, and not against the clarification budget:

| Order | Question | Options |
|---|---|---|
| 1 (only `/spec`) | Checkpoint mode | 逐阶段审阅 (Recommended) / 一站式生成 |
| 2 | Workflow route | 先写需求 (Recommended) / 先写设计 / 先验证需求 |
| 3 (only `先写设计`) | Design detail | 完整 (Recommended) / 高层 / 低层 |

`/spec-flow` is already one-shot, so it skips step 1. A route other than
`先写设计` records `designDetail=comprehensive` without asking. Skip a step the
user already named.

Record the route and detail with `kaze_spec_init workflow=... designDetail=...`,
or with `kaze_spec_workflow` after init. These are process decisions, not
requirement decisions.

## Mandatory first round

In an interactive creation flow, ask at least one clarification round before
writing `requirements.md`, `design.md`, or `tasks.md`. Do not silently fill
defaults just because the request looks detailed: defaults such as maximum hop
count, retry count, timeout, cache policy, or error behavior are user decisions
unless the workspace or the request already states them.

The same rule covers decisions the workspace cannot make: language, framework,
library, architecture shape, runtime, target platform, deployment target,
compatibility policy, migration and rollback, security boundary, package
installation and network access, and the test bar. "The workspace uses X"
answers a fact question; it does not answer "use X for this new subsystem".

The only exceptions are a non-interactive run, a run whose root session cannot
reach the user, or the user explicitly saying "no questions / 用推荐默认值". A
phase agent that can reach the root session returns `BLOCKED` (see below) instead
of taking this exception. Record the exception and every assumption in the
ledger.

## Facts vs decisions

Do not ask for a **fact** the workspace already answers: paths, current
behavior, conventions, build/test commands, installed versions, or whether a
library is already present. Reading beats asking.

A **decision** is not a fact. When the workspace only narrows the options, the
choice is still the user's and passes the materiality test:

- two supported frameworks, or services in one monorepo that use different
  stacks;
- keeping or breaking an existing contract;
- adding a dependency or a third-party service;
- targeting this machine or a different runtime or OS;
- rewriting stored data versus reading it as-is.

Greenfield rule: an empty workspace answers nothing. Do not infer a stack from
the absence of files; ask when the choice is material, and say why.

## Verify before asking

Answer from the workspace first: read the manifest, config, and code, and run a
safe command when it settles the point. This narrows a question; it never
replaces a user decision.

The user still owns every material decision. A technology, framework, library,
runtime, compatibility, data/rollback, security, or test-bar choice is asked even
when the workspace already answers it: the current stack is context, not a
confirmed decision, so a new dependency, a new service, or a new component still
needs the choice. Reserve local reads for details the user does not own — a path,
a field name, the exact form of a command, a value already recorded in the
repository.

## Materiality test

Ask only when the answer changes at least one of:

- observable behavior or an acceptance criterion;
- scope, a non-goal, or a priority that changes what gets built;
- a data, persistence, or public-interface contract;
- compatibility, migration, or rollback;
- a security, permission, or trust boundary;
- a design fork that changes components or the task DAG;
- a technology, dependency, runtime, or deployment-target choice;
- an external fact the workspace cannot settle (legal limit, standard, vendor
  quota, compatibility claim), which needs research or an explicit assumption;
- an operational limit: network egress, credentials, install permission,
  destructive command, or data retention;
- the test bar: tests required, existing tests may change, no-regression scope.

Do not ask for stylistic preferences that do not change behavior. Do not re-ask
a question the user skipped.

## Decision classes

The user owns these decisions; the model owns the implementation detail inside
the chosen option. Ask every row the request does not settle and that applies to
this work. A workspace fact narrows the options and can make one the
recommendation; it does not settle a user-owned row by itself, and it is never a
reason to skip a technology, runtime, or compatibility question.

| Class | The user decides | Example options |
|---|---|---|
| Technology | language, framework, library, dependency, build tool | "extend the existing TS package" / "new Python service" / "no new dependency" |
| Architecture shape | one module vs new package/service; extend vs replace a component | "extend the current module" / "split a new service" |
| Runtime target | OS, runtime version, browser/Node/desktop, container or host | "this machine (Windows PowerShell)" / "Linux CI" / "both" |
| Deployment | local script, service, CI, market, or none yet | "local only" / "reuse the existing pipeline" |
| Compatibility | breaking vs additive; old callers and data keep working | "preserve the current format" / "breaking change with migration" |
| Data and rollback | schema change, backfill, deletion, backup, undo | "read-only migration" / "rewrite with a backup" |
| Security and trust | authn/authz, secrets, network exposure, PII retention | "reuse the existing session" / "new token scope" |
| External dependency | new service or API, credentials, network egress | "no network at runtime" / "call vendor X" |
| External fact | a legal limit, standard clause, vendor quota, or compatibility claim the workspace cannot settle | "research it before the criterion" / "record it as an assumption" |
| Test bar | tests required, existing tests may change, regression scope | "add unit + one integration test" / "keep the current suite intact" |
| User-visible surface | empty/error/permission states, copy language, accessibility | "same states as the current page" / "add a loading state" |

A survey can recommend a row; it cannot choose it. Mark a recommended option
`(Recommended)` but keep every option selectable.

## Budgets

- **Standard** (default): at most 5 rounds, at most 10 questions per round;
  prefer 3-6 questions.
- **Quick** (`/spec-quick`): at most 2 rounds, at most 5 questions per round;
  the same materiality test applies.
- **Thorough**: no round cap; stop only when no material question remains. The
  user starts it by saying "彻底澄清" / "thorough" or by choosing it when asked.
- The user can stop at any time ("用推荐默认值" / "stop asking"); record every
  remaining item as an assumption.
- Non-interactive runs ask nothing: record assumptions and continue.

## Asking

Use the native user-question tool (DSH: `ask_user_question`).

- One call per round. Give every question a unique `id` and a short `header`.
- Ask in the user's language; write spec prose in the injected
  `kaze:spec-context` block's `language`.
- Put the recommended option first and append `(Recommended)` to its label.
- Give 2-4 concrete options with one-sentence impact descriptions; use
  `multi_select` only when choices genuinely combine.
- Accept a typed answer as a custom answer; never force an option.
- A skipped item means "continue without it": record it as an assumption; do
  not ask it again.
- Ask in outcome terms ("runs on Linux CI", "same Windows PowerShell as today"),
  not with methodology names.

Round 1 question set (choose only the rows that pass the materiality test):

| Category | Example |
|---|---|
| Goal and actor | Who uses this, and what changes for them? |
| Scope and non-goals | Which adjacent behavior is explicitly out of scope? |
| Data and contracts | New field, new file, or a change to an existing shape? |
| Technology | Extend the current stack, add a new one, or take no new dependency? |
| Runtime and platform | Runs on this machine, in CI, or on a different OS/runtime? |
| Compatibility | Must existing data and callers keep working, or is a breaking change allowed? |
| Behavior and edge cases | Empty, duplicate, concurrent, failed, or partial input? |
| Security and permissions | Who may use it, and what may it touch? |
| Test bar | Which tests are required, and may existing tests change? |
| User-visible states | Empty/loading/error/permission states, copy language, accessibility target? |
| Execution constraints | May the work install packages, reach the network, or run migrations? |
| Non-functional | A measurable latency, volume, or error/retry bound? |
| Priority | Must-have for this spec versus a follow-up? |

Round 2+ asks only derived ambiguity: contradictions between answers, missing
bounds, vague terms ("fast", "robust"), escape clauses ("where possible"),
unclear pronouns, absolutes ("never"), or a case the draft requirements missed.

State the scope classification (brownfield/greenfield), the feature id, and any
selected workflow in the first-round summary so the user can correct them
without a separate question.

## Assumption review

A skipped or unanswered material item becomes an assumption, but a high-risk
assumption is not final until confirmed once. Before writing the first document,
if an assumption affects technology, runtime or platform, compatibility, data or
rollback, security, or the test bar, ask one confirmation round that lists the
assumptions with their impact and offers "keep the assumption" / "change it".

"用推荐默认值" / "no questions" waives this round; record that the user waived
it. Every high-risk assumption that remains is marked `accepted-by: assumption
round` or `waived` in the ledger.

## Ledger

After every round, write or update `.kaze/<feature>/clarify.md`. It is an audit
and resume record, not a spec document:

```md
# Clarification Ledger — <feature>

## Decisions

- D1 <decision> — source: round 1 Q2 — affects: Requirement 1.2
- D2 <decision> — source: user typed answer — affects: design § Data Models

## Assumptions

- A1 <assumption> — why: skipped at round 2 — risk: medium
- A2 <assumption> — accepted-by: assumption round — affects: task 3.1

## Open

- (none when the loop exits)

## Rounds

- Round 1: 4 asked, 3 answered, 1 skipped
- Round 2: 2 asked, 2 answered
```

Decisions and assumptions that fix a technology, runtime, platform, or
compatibility policy are carried into the design (and cited by its `research.md`
Decision when one is written) and into the tasks that depend on them.

Each decision that changes behavior must appear in at least one acceptance
criterion. Each assumption that is behavior-visible must be stated in
`requirements.md`; the rest stay in the ledger.

## Exit criteria

Stop asking when all of these hold:

1. Every answer is incorporated into the ledger.
2. No remaining question passes the materiality test.
3. No answer contradicts the survey or another answer.
4. No high-risk assumption is unconfirmed, or the user waived the review.
5. The round budget is exhausted, or the user stopped.

Then summarize the decisions, assumptions, and any open risk in one short
message before writing documents.

## Conflicts

If an answer contradicts a surveyed fact, an earlier answer, or an acceptance
criterion, stop and ask once with the concrete evidence. Do not silently choose
a breaking interpretation.

## Post-draft analysis

After `requirements.md` exists, scan it for ambiguity and ask at most one more
round (no cap in thorough mode):

- vague adjectives without a measurable bound;
- escape clauses and undefined pronouns;
- absolutes without conditions;
- missing empty, error, boundary, concurrent, or repeated-input cases;
- one criterion that contains two behaviors;
- an acceptance criterion that is not observable;
- a criterion that silently fixes a technology, platform, or compatibility
  policy without a ledger decision.

Auto-resolve trivial wording. Ask only the material items. Edit the existing
criteria instead of rewriting a criterion whose answer is already present; do
not renumber requirements after design starts.

## Downstream consistency

When a clarification changes or adds a requirement after `design.md` or
`tasks.md` exists, update the affected design sections and task references
immediately, then re-validate and re-gate before claiming the phase. Never leave
a downstream document quoting a superseded requirement.

## Blocked phase agents

A phase agent cannot ask the user directly (DSH rejects a live child's
`ask_user_question`). If a phase finds a material decision the ledger does not
answer, it must not choose: stop and return:

```text
BLOCKED: <one-line question>
Options: <2-4 options with one-line impact>
Blocks: <phase or task id>
```

The root session asks through the question tool, records the answer in
`clarify.md`, and re-dispatches the phase. A `BLOCKED` return is **not** a
failed task: it does not consume the task's two-retry budget
(`./delegation.md`, `./execute.md`). Never resolve a `BLOCKED` item by
default; never let the phase agent silently pick one.

## Anti-patterns

- A wall of 20 questions in one call.
- Asking about code facts the workspace can answer.
- Silently selecting a language, stack, dependency, or platform.
- Treating an empty workspace as permission to choose.
- Defaulting to Structured Pseudocode to avoid a tech question.
- Writing a `research.md` Decision for a choice the user owns.
- Writing an unverified external fact as `SHALL` instead of research or a
  flagged assumption.
- Assuming this machine's OS is the target platform.
- A phase-by-phase "continue?" checkpoint.
- Re-asking a skipped question.
- Inventing an answer for a high-risk skipped item without flagging it.
