# State model

Status: Current

## Repository snapshot

The backend returns snapshots containing repository identity and Git state such as:

- root path,
- current branch,
- remotes,
- branches,
- tags,
- recent commits,
- changed files,
- ahead/behind values,
- selected diff/detail data when requested.

The frontend normalizes and renders this data.

## Selection state

The frontend owns selected page, selected file, selected commit, open dialogs, context menus, command palette state, and commit composer input.

Background refresh should preserve selected file and commit when those items still exist.

## Job state

Write and sync actions should run as explicit jobs. Repository refresh can run separately so it does not unnecessarily block normal UI interaction.

Typical job states:

```text
idle → running → success/error
```

Planned durable backend job states:

```text
queued → running → success/error/cancelled
```

## Settings state

Recent repositories and user preferences are persisted in the app config directory through backend settings commands. Browser mode may use local fallback behavior for visual development.

## Design goals

- Keep Git as source of truth.
- Avoid stale async responses overwriting newer repository state.
- Preserve review context during auto-refresh.
- Keep state modules focused instead of growing `App.svelte` indefinitely.
