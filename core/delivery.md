# Delivery Report and Gate History

Kaze keeps two small audit artifacts beside the spec:

```text
.kaze/<feature>/gates.json
.kaze/<feature>/delivery.md
```

They are not gates and they do not change phase state. They make approval and
delivery evidence inspectable after the conversation is gone.

## gates.json

One append-only array of human decisions:

```json
[
  {
    "gate": "acceptance",
    "status": "approved",
    "at": "2026-11-23T...",
    "phase": "execute",
    "reason": "All criteria observed",
    "returnTo": null,
    "details": "ACCEPTED.txt contains ok",
    "docsHash": "sha256:..."
  },
  {
    "gate": "fta",
    "status": "approved",
    "at": "2026-11-23T...",
    "phase": "execute",
    "reason": "",
    "returnTo": null,
    "details": "Verdict: PASS",
    "docsHash": "sha256:..."
  }
]
```

Status: `approved`, `failed`, `skipped`, or `pending`.
Gate names include `acceptance`, `fta`, `archive` (the archive decision
recorded before an archive is performed or refused), and `custom` (a free-form
human gate the flow records).
`phase` is the phase the spec had when the decision was recorded; acceptance and
FTA require the task plan to exist, so a draft cannot be approved.
`docsHash` hashes the approved documents (requirements/bugfix, design, tasks,
acceptance). Done compares it: if the a document changed after the approval, the
gate must be recorded again.
`returnTo` is an audit and rework target (`design`, `tasks`, or `execute`). The
engine never moves a phase backward; the completion surface turns a failed gate's
`returnTo` into the next rework action.

Write it with `kaze_spec_gate_record`; do not hand-edit it.

## delivery.md

`kaze_spec_delivery` renders:

- summary: scope, type, workflow, phase, task counts;
- task list;
- acceptance criteria;
- verification record presence;
- latest FTA decision;
- gate history table;
- residual risks (include the unresolved Concerns/Notes of the latest FTA
  decision and any open Blocker findings of the latest `/spec-code-review`);
- archive note.

`delivery.md` is generated from the spec and `gates.json`. Archive moves the
whole spec directory, so the report travels with it. When the profile setting
**archive on done** is on, the advance to done moves the spec before a separate
delivery call would run; the report in the archived directory is the final one.

## Rules

- Record acceptance before FTA.
- Record FTA as `approved`, `failed`, or `skipped`.
- `approved` needs non-empty `details` or `evidence`.
- `failed` and `skipped` need a non-empty `reason`; a failure should also pass
  `return_to` so the rework action is explicit.
- Acceptance approval requires every criterion checked `[x]`.
- Do not mark a failed gate as approved.
- A skipped gate must say why it was skipped.
- Changing requirements, design, tasks, or acceptance after an approval
  invalidates it; record the gate again before done.
- `delivery.md` is a report, not a source of truth; `state.json`, `tasks.md`,
  and the gate records remain authoritative.
