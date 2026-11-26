# FTA — Adversarial Intent Verification

FTA is a read-only final gate. It asks whether the implementation actually
satisfies the user's intent, not whether the tasks were checked off.

Use it after `/spec-apply` and before `/spec-archive`, especially for
high-risk, cross-layer, brownfield, or long-running specs.

## Inputs

- `requirements.md` or `bugfix.md`;
- `design.md`;
- `tasks.md`;
- `acceptance.md` if present;
- the implementation diff (`git diff`, native changes review, or affected files).

## Classes of mismatch

1. **Omission** — the user wanted X, but nothing implements X.
2. **Commission** — the implementation adds user-visible behavior nobody asked for.
3. **Drift** — the implementation looks like X but its semantics differ.
4. **Regression** — an existing contract, stored data, or caller is broken.
5. **Silenced signal** — a check, test, or warning was suppressed, loosened, or
   skipped instead of fixed, so the reported evidence understates the risk.

## Severity

Use three plain labels:

- `Blocker` — must be fixed or explicitly accepted before completion.
- `Concern` — worth surfacing; may need a spec amendment.
- `Note` — observation, no action required.

Do not use color emoji. Sort findings: Blocker, then Concern, then Note.

## Evidence

Every finding must include:

- the requirement clause or user-intent quote;
- concrete `file:line` evidence;
- the observable impact;
- one minimal remediation direction.

A finding without evidence is invalid and must be dropped.

## Verdict

- `PASS` — no Blocker findings.
- `FAIL` — at least one Blocker; stop the completion step and surface it.
- `PARTIAL` — only Concern/Note findings; implementation is in scope but may
  need a spec amendment.

Output:

```text
Verdict: PASS | FAIL | PARTIAL
Blockers: N, Concerns: N, Notes: N
```

## Gate record

FTA is read-only with respect to the code, but the verdict is a gate decision:
record it with `kaze_spec_gate_record` so done can consume it.

- `PASS` or `PARTIAL` → `gate=fta status=approved`, `details` with the verdict and
  counts, `evidence` with the strongest `file:line` proofs.
- `FAIL` → `gate=fta status=failed`, `reason` with the verdict and blocker
  titles, `return_to` set to `design` (spec change), `tasks` (plan change), or
  `execute` (implementation-only fix).
- A skipped FTA is `status=skipped` with a non-empty reason, recorded by the
  caller.

## Rules

- Read-only with respect to code and documents: do not edit, build, or commit;
  the gate record is the only write.
- Do not propose new requirements; report the gap and let the user decide.
- Do not auto-fix and re-run after FAIL.
- On FAIL, close with the rework path: fix the spec (`/spec-refine`,
  `/spec-design`), the plan (`/spec-tasks`), or the implementation
  (`/spec-apply`), then run `/spec-complete` again.
- If `user_intent` is absent from the spec's `.kaze/<feature>/exec/context.json`, derive a proxy from the
  requirements Introduction and User Stories, and say so.

## Autonomous rework

`/spec-run` is the explicit exception to the one-turn FAIL stop: it records the
failed gate, fixes only implementation and tests between FTA runs, and then
re-runs the verifier. The verifier itself stays read-only; it never edits or
re-runs itself. Without `/spec-run`, a FAIL still returns to the user for a
rework decision.
