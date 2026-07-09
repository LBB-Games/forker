# Git command runner

Status: Current

## Strategy

Forker uses the native Git CLI first. This keeps behavior aligned with users' terminal Git, credential helpers, SSH configuration, and platform-specific Git setup.

See ADRs:

- [0001: Use Tauri for the desktop shell](../adr/0001-use-tauri.md)
- [0002: Use native Git CLI first](../adr/0002-use-native-git-cli-first.md)

## Requirements

The Git command runner should:

- run `git` with structured argument arrays,
- set the repository working directory explicitly,
- capture stdout and stderr,
- propagate useful error messages,
- support timeouts/cancellation where practical,
- avoid shell interpolation,
- keep command behavior close to native Git.

## User-facing errors

Git stderr is often the best recovery hint. Preserve it where useful, but display it in a constrained UI so long output cannot break the workbench.

## Future considerations

Consider libgit2 or other direct Git libraries only after measuring a real need. Potential reasons could include performance limits, deep graph rendering, or advanced diff features that are hard to support through CLI calls.

Consider bundled Git only if system Git detection and support become a major product issue, especially on Windows.
