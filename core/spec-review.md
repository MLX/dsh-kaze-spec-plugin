# Spec Review (host-agnostic)

Goal: let a human leave inline comments on a spec document and have the agent
apply them **only** to that document, without breaking the document format.

## Inputs

- `path`: the document under review.
- `documentType`: `requirements` | `design` | `tasks` | `bugfix` | `markdown`.
- `comments`: each with
  - `quotedPassage` — the anchor text;
  - `section` — the nearest heading, if known;
  - `lines` — `start`/`end` in the current file;
  - `note` — the reviewer's instruction or question.

## Prompt

The engine emits a readable Markdown brief. It keeps the reviewer's passages
and notes as blockquotes so they cannot create headings of their own, and it
never wraps the comments in JSON or XML.

```text
A reviewer left 2 comment(s) on the spec document at ".kaze/demo/design.md".

Revise only that document. Do not edit any other file.
Each quoted passage marks where the concern is; treat it as an anchor, not
necessarily the only text to change. ...

Format: Keep section headings and a valid Correctness Properties section ...

### Comment 1 — line 7
Section: ## Overview

> subtract them with integer arithmetic on aligned coefficients...

> **Reviewer note:** Make the rounding rule explicit.
```

Generate it with the native tool:

```text
kaze_spec_review { feature: "demo", file: ".kaze/demo/design.md" }
```

The tool reads `.kaze/demo/reviews/design.json` by default. Pass `comments` to
use another file. The output is always readable Markdown.

`formatGuidance` by document type:

| Type | Guidance |
|---|---|
| requirements | keep the document's `### Requirement N:` / `### 需求 N:` headings, `#### Acceptance Criteria` / `#### 验收标准`, EARS wording, and property annotations |
| design | keep section headings and a valid `## Correctness Properties` / `## 正确性属性` with `**Validates: Requirements X.Y**` / `**验证：需求 X.Y**` |
| tasks | keep `- [ ] N.` / `- [ ] N.M`, statuses `[ ]` / `[-]` / `[~]` / `[x]`, and requirement refs |
| bugfix | keep `## Introduction`, `## Bug Analysis`, and the three behavior sections |
| markdown | keep the existing structure; answer in chat unless asked to edit |

## Stored comments

The UI and commands share one file per document:

```text
.kaze/<feature>/reviews/<document>.json
```

```json
{
  "schema": 1,
  "feature": "demo",
  "document": "design",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "comments": [
    {
      "id": "…",
      "quotedSource": "WHEN the user submits...",
      "section": "## Requirements",
      "sourceLines": { "start": 12, "end": 18 },
      "reviewerNote": "Make the timeout explicit.",
      "createdAt": 0,
      "resolved": false,
      "stale": false
    }
  ]
}
```

JSON here is storage data, not the prompt. The engine normalizes it into the
Markdown brief above.

## After applying

1. Re-run `kaze_spec_validate` on the file.
2. If the document is `requirements.md`, re-check that every criterion still
   maps to a design element and a task.
3. Report:
   - comments applied;
   - comments that were questions and how the text changed;
   - any comment you could not apply, with the reason.

## Ordinary Markdown

For non-spec Markdown, do not edit by default. Answer each comment in chat:
explain the passage, answer the question, or propose replacement wording. Only
edit when the reviewer explicitly asks for an edit.
