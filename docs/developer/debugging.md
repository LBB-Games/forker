# Debugging

Status: Current

## Vite does not start

The dev script uses a strict port. Free port `5173` or stop the existing Vite process.

```bash
npm run dev
```

## Tauri does not start

Confirm native prerequisites are installed. On Ubuntu/Debian:

```bash
./scripts/install-tauri-linux-deps.sh
```

Then run:

```bash
npm run tauri:dev
```

## Browser mode cannot open repositories

Expected. Browser mode uses mock data. Use Tauri desktop mode for real Git operations.

## Git command fails

Reproduce in a terminal from the same repository:

```bash
git -C /path/to/repo status
```

If terminal Git fails, fix Git configuration, credentials, locks, or repository state first.

## UI state looks stale

Check whether a background refresh completed after a selection change. The intended behavior is to preserve selected file/commit if they still exist and ignore stale refresh responses after newer write operations.

## Long errors break layout

Backend error output should be constrained in banners/status areas. If a new error surface is added, test it with long Git stderr.
