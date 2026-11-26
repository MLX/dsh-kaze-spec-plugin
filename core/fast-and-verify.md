# Fast Task and Verify-First Workflows

## A. Fast Task (Quick Spec)

Five phases. Only `clarify` and `review` talk to the user; the middle phases run
silently and write files.

1. **Clarify** — scan the workspace, detect the dominant language, ask 2–4
   questions that materially change the design. Do not create files.
2. **Requirements** — write `requirements.md` from the request + answers.
3. **Design** — write `design.md`, including correctness properties when PBT
   applies.
4. **Tasks** — write `tasks.md` with the dependency graph.
5. **Review** — read `tasks.md` and summarize the plan for the user; ask for
   one round of feedback.

Rules:

- no phase-by-phase checkpoints; one review at the end;
- if the user asks for a change, re-run only the affected phases and keep the
  three documents consistent;
- if the workspace is empty and no language is detectable, use Structured
  Pseudocode and say so.

## B. Verify-First

The authoritative procedure is `./verify-first.md`; this section is only a
pointer. The route differs from requirements-first in exactly these ways:

- the model (`model.smt2`) and its check happen between the requirements draft
  and the EARS criteria, and the requirements gate needs
  `model.smt2` + `verification.md`;
- design and tasks then follow the normal requirements-first rules;
- a design change that invalidates an assertion adds a model-recheck task:
  update `model.smt2`, re-run the check, update `verification.md`, then call
  `kaze_spec_verify` again.

Post-execution feedback is not a separate refine phase: apply it through
`/spec-comments` on the affected document, and let the acceptance gate's
`return_to` rework loop (`./completion.md`) handle rework after criteria fail.
