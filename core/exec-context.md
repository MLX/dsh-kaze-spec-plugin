# Execution Context

Read by the execute and run loops before each wave.

For multi-wave, cross-layer, or brownfield specs, build a reusable execution
brief once:

```text
.kaze/<feature>/exec/context.json
```

Do not create it for a small single-wave spec; it is an optimization, not a
contract.

## Shape

```json
{
  "project_type": "e.g. TypeScript monorepo",
  "language": "primary language",
  "build_system": "manifest/build system",
  "test_framework": "test runner",
  "target_platform": "where the product runs (OS/runtime), or null",
  "execution_platform": "where commands run now (this host), or null",
  "build_command": "single-run build command",
  "test_command": "single-run test command",
  "verification_instructions": "documented checks, or null",
  "setup_instructions": "documented setup, or null",
  "environment_constraints": "known limits, or null",
  "key_patterns": "naming/error/structure conventions",
  "relevant_files": ["modify: path", "study: path"],
  "compatibility_picture": "brownfield contracts and call sites, or null",
  "baseline_test_result": "brownfield baseline, or null",
  "regression_command": "exact no-regression command, or null",
  "user_intent": "optional verbatim 1-3 sentence goal"
}
```

Rules:

- every field traces to a real file or command;
- `target_platform` is the product's runtime, not this machine's OS; when they
  differ, record both and read `./platform.md` before writing a command;
- `relevant_files` distinguishes `modify:` from `study:`;
- `user_intent` is verbatim, not rewritten into spec language;
- do not duplicate requirements/design text;
- a subagent may trust this brief and read only the code it needs.

## Dispatch

Include in each task dispatch:

- task id and intent;
- verbatim requirement clause(s), not just numbers;
- design section pointer with a one-line excerpt;
- relevant files and patterns from the spec's `.kaze/<feature>/exec/context.json`;
- the target platform and the exact platform-specific command form when
  commands are platform-sensitive;
- the verification command and stop rule.

If a referenced clause cannot be resolved, stop and report instead of letting
the subagent guess.
