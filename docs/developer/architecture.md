# Architecture

Status: Current

## Overview

Forker is a Tauri desktop app with a Svelte frontend and Rust backend.

```text
Tauri App
├─ Svelte frontend
│  ├─ workbench shell
│  ├─ repository navigator
│  ├─ changes and commit composer
│  ├─ commit log and details
│  ├─ diff viewer
│  └─ dialogs, context menus, command palette
│
├─ Rust backend
│  ├─ Tauri commands
│  ├─ native Git process runner
│  ├─ repository snapshot loader
│  ├─ working-tree operations
│  ├─ branch/remote operations
│  ├─ settings and recent repositories
│  └─ filesystem watcher
│
└─ Local machine
   ├─ system Git
   ├─ repository files
   ├─ Git credential helpers
   └─ app config directory
```

## Key boundaries

- The frontend owns UI state, selection state, and interaction flow.
- The backend owns filesystem access, Git execution, repository validation, and persisted app settings.
- Git remains the source of truth. Cached snapshots are convenience data, not authority.
- Browser mode is a visual fallback and uses mock data.
- Desktop mode uses Tauri commands for real repository work.

## Data flow

1. User opens a repository.
2. Frontend calls a Tauri command.
3. Backend validates path and runs Git commands.
4. Backend returns a repository snapshot DTO.
5. Frontend normalizes the snapshot and updates UI state.
6. User actions run write/sync commands.
7. Frontend refreshes repository state after successful commands.

## Important source areas

- `src/App.svelte` — top-level application orchestration.
- `src/components/` — workbench UI components.
- `src/lib/gitClient.js` — frontend Tauri/mock client boundary.
- `src/lib/repositorySession.js` — repository session helpers.
- `src/styles/` — workbench styling.
- `src-tauri/src/commands.rs` and `src-tauri/src/commands/` — Tauri command surface.
- `src-tauri/src/git_process.rs` — Git process execution.
- `src-tauri/src/snapshot.rs` — repository snapshot loading.
- `src-tauri/src/models.rs` — backend DTOs.
- `src-tauri/src/watcher.rs` — filesystem watcher.

## Architecture priorities

- Keep Git behavior predictable by delegating to native Git first.
- Keep long-running Git work off the UI thread.
- Preserve user context across background refresh.
- Make destructive operations explicit and recoverable where possible.
- Prefer small focused modules over expanding `App.svelte` indefinitely.
