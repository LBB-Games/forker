# Open a repository

Status: Current

## Open by path

Start the Tauri app and enter or choose a local repository path. The backend validates the path and resolves the repository root before loading state.

## Recent repositories

Forker stores recent repositories in the app config directory so you can reopen them quickly.

## Browser mode note

`npm run dev` opens the Svelte/Vite app in a browser. Browser mode cannot access local Git repositories and falls back to mock data.

Use `npm run tauri:dev` for real repositories.

## If opening fails

Common causes:

- the path does not exist,
- the path is not inside a Git repository,
- Git is not installed or not on `PATH`,
- the app does not have filesystem permission,
- the repository is locked by another Git process.

See [Troubleshooting](troubleshooting.md).
