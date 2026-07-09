# Backend

Status: Current

## Stack

- Rust inside `src-tauri/`.
- Tauri 2 command handlers.
- Native Git CLI first.
- Filesystem watcher for repository refresh events.
- App config storage for settings and recent repositories.

## Source map

- `src-tauri/src/lib.rs` wires the Tauri app.
- `src-tauri/src/commands.rs` and `src-tauri/src/commands/` expose command handlers.
- `src-tauri/src/git_process.rs` runs native Git commands.
- `src-tauri/src/snapshot.rs` builds repository snapshots.
- `src-tauri/src/changes.rs` and `src-tauri/src/diff.rs` parse status/diff data.
- `src-tauri/src/models.rs` defines DTOs returned to the frontend.
- `src-tauri/src/settings.rs` persists settings/recent repositories.
- `src-tauri/src/watcher.rs` watches repository files and debounces refresh events.
- `src-tauri/src/jobs.rs` contains job-related backend support.

## Responsibilities

The backend should:

- validate repository paths,
- run Git through argument arrays, not shell-interpolated strings,
- capture stdout/stderr,
- return structured errors,
- avoid blocking the UI,
- keep Git as the source of truth,
- preserve platform-specific behavior where system Git already handles it.

## Safety rules

- Do not invent repository state.
- Treat destructive operations as explicit commands.
- Keep command arguments structured.
- Return raw Git stderr where it helps the user recover.
- Use tests with temporary repositories for command behavior.

## Planned backend improvements

- Richer repository state cache.
- Deeper job cancellation that terminates in-flight Git child processes.
- More command tests for remote, reset, stash, and conflict scenarios.
- Optional bundled Git strategy if system Git creates too much support burden.
