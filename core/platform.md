# Runtime and Platform

The **target platform** is where the product runs: an OS, a runtime (Node,
browser, desktop shell, container), or a deployment environment. The **execution
platform** is where the agent runs commands while building. They are often the
same and sometimes not: a Windows workstation can target Linux CI.

Do not conflate them.

## Determine the target platform

Use the first source that is unambiguous:

1. **A user decision.** `clarify.md` records it (`D<n>`) when the user answered
   the runtime or deployment row.
2. **A workspace fact.** CI configuration, container files, a documented
   deployment target, or an OS-specific manifest.
3. **Ask once.** If both are silent and the choice is material, follow
   `clarify.md`: ask with 2-4 concrete options. Do not default to the host OS.

When the product only runs on the machine that builds it, "this machine" is a
valid answer, but state it as a decision rather than leaving it implicit.

## Defaults

- The **execution platform** defaults to the DSH host (this session's OS).
- The **target platform** has no safe default when the product ships elsewhere;
  ask.
- A local-only tool may declare the host OS as its target in the first line of
  `design.md` (`Target platform: Windows PowerShell 7`).

## Command rules

Commands in tasks, design examples, and dispatch prompts must match the target
platform. Never translate a command between shells from memory; read the
project's script or documentation first.

- **POSIX (bash/zsh)** — `&&`, `;`, `$NAME`, `${NAME}`, `test -f`, `rm`, `cp`,
  `chmod`, `uname`, `which`.
- **Windows PowerShell** — `;` chains, `$env:NAME`, `Test-Path`, `Remove-Item`,
  `Copy-Item`, `$PSVersionTable`, `Get-Command`, `$LASTEXITCODE`.
- **Cross-platform** — prefer the project's own scripts (`npm test`,
  `pnpm build`, `make`) over hand-written shell; they encode the platform for
  you.

Naming rules:

- Name the platform in a task or dispatch prompt whenever the command is
  platform-sensitive: `Windows PowerShell — use ; and $env:NAME`.
- Do not write a bash block in a Windows-only task. Do not assume `bash` exists
  on Windows; do not assume PowerShell exists on Linux or macOS.
- Do not test a cross-platform change on only one platform and call it verified;
  report the untested platform as unverified.

## Where to record it

- `clarify.md` — the user's decision, when the platform was asked.
- `design.md` — the target platform and any platform-specific component or
  packaging decision, in one line under Overview or Architecture.
- `tasks.md` — a platform-sensitive task names the platform and the exact
  verification command.
- `.kaze/<feature>/exec/context.json` — `"target_platform"` and
  `"execution_platform"` for multi-wave work.

## Execution

Before dispatching a platform-sensitive task:

1. Resolve the target platform from the sources above.
2. Read the matching command form; do not write it from memory.
3. Put the platform in the dispatch prompt.
4. After the task, verify with a command that actually ran on that platform.

If a task may run in CI or on another OS, name that platform explicitly in the
dispatch prompt. If the platform is unknown and cannot be probed safely, stop
and ask instead of guessing.
