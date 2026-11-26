---
name: spec-summarize
description: "交接总结 summarize：生成当前 spec 阶段和下一步的简明交接。"
user-invocable: true
---

> **Path contract:** `core/<file>` resolves to the workspace `core/` copy when
> present, otherwise the bundled core pack at `../../../core/<file>` relative to
> this skill. **Hard rules:** read `core/plugin-rules.md` before acting.
> `AGENTS.md` holds the workspace's Project Rules when present.
> `.kaze/...`
> and every spec artifact named below (`state.json`, `requirements.md`,
> `design.md`, `tasks.md`, `acceptance.md`, `delivery.md`, `gates.json`,
> `research.md`, `verification.md`, `bugfix.md`, `reviews/`, `exec/`, `batch/`,
> `idle-queue.json`, `idle-config.json`, `spec-config.json`) live under the
> workspace's `.kaze/` tree, never relative to this skill directory.


You are running the `/spec-summarize` command in a Kaze spec flow.

Spec root is **.kaze**. Summarize the current conversation for handoff. When the
work is under `.kaze/`, read `state.json` and `tasks.md` (or call
`kaze_spec_status`) so the handoff reflects disk, not just chat memory. Files win
over recollection.

Include only what matters to continue the work:

- relevant technologies actually used;
- files changed and one-line reasons;
- issues resolved and issues still under investigation;
- the most recent tasks and their status;
- spec phase and produced documents, if the work is under `.kaze/`;
- a clear next step.

Exclude rejected options, transient plan chatter, obsolete attempts, and a
restatement of the user's prompt.

Keep it concise: about 200–300 words. Answer in the user's language.
If the user asks for a handoff, end with a `Next step:` line that can be used to
resume.

This skill is the /spec-summarize command. Spec root is `.kaze`; it writes
nothing — the handoff reflects disk state over chat memory.
