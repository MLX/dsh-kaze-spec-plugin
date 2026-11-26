# Living Capability Specs

A feature spec is a change; a capability spec is the project's current truth.
Kaze keeps one file per capability:

```text
.kaze/specs/<capability>/spec.md
```

It is not a spec phase and has no gate of its own. Normal writes go only
through `kaze_spec_merge`, which copies the feature's requirements into it;
hand edits are permitted solely to resolve a reported conflict.

## Recording the capability

Set `capability` once per feature spec, at creation or later:

```text
kaze_spec_init { feature: "add-oauth", capability: "auth" }
kaze_spec_capability { feature: "add-oauth", capability: "auth" }
```

Use a kebab-case capability id that names behavior (`auth`, `billing`,
`search`), not a release or a ticket.

## Merging

Run the merge when the feature spec is complete and accepted (typically from
`/spec-complete` or `/spec-run` before done, or automatically from
`/spec-archive`):

```text
kaze_spec_merge { feature: "add-oauth" }
```

The engine requires `phase=tasks` or later **and** every required task to be
complete; a draft requirements document cannot be published into a capability.
A forced archive of unfinished work skips the merge instead of publishing it.

Rules:

- requirements are matched by **title**, not by number;
- an identical body is `unchanged`;
- a different body for the same title is a **conflict**: the merge aborts and
  lists the titles; resolve by editing the capability spec or pass
  `force: true` to replace it;
- new titles are appended;
- every merge appends one row to the capability spec's `## Change Log`.

Requirements listed under `## Removed Requirements` / `## 移除的需求` are deleted
from the capability after the same conflict check, so removing behavior is an
explicit, audited merge instead of a hand edit. The merge still never silently
drops a requirement: a removal that another spec changed is a conflict.

### Removing a requirement

Record the removal in the **feature's** `requirements.md` under
`## Removed Requirements`, then merge. The engine matches a bullet's full text
(normalized) against the capability's requirement titles, so the bullet must be
the requirement title exactly as the capability records it; put the criterion
id and the reason in a plain paragraph next to the list, not inside a bullet:

```markdown
## Removed Requirements

Removed 3.1 Legacy export — reason: replaced by the streaming export
(Requirement 5).

- Legacy export
```

On merge the engine deletes the matching capability requirement and records the
removal count in the Change Log. A removal whose title matches nothing, or
whose target another spec changed after this feature's baseline, is a
conflict; resolve a deletion conflict by hand-editing the capability spec (or
with `force: true` after a user decision).

## What the capability spec is for

- **Reuse**: the next feature reads `.kaze/specs/<capability>/spec.md` instead
  of re-describing existing behavior.
- **Drift detection**: two features changing the same requirement surface a
  conflict instead of silently diverging.
- **Traceability**: the Change Log records which feature changed the capability
  and when.

## Rules

- Do not hand-edit the capability spec to add behavior; edit the feature spec
  and merge. Hand-edits are allowed only to resolve a reported conflict.
- Do not merge a spec whose requirements are not accepted.
- A capability file is a behavior contract; implementation details stay in the
  feature's `design.md`.
- The capability spec is not a substitute for `requirements.md` during a change;
  it is the accumulated result after the change.
