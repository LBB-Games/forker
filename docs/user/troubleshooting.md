# Troubleshooting

Status: Current

## Git is not found

Forker uses the native Git CLI. Install Git and confirm it is available:

```bash
git --version
```

Restart the app after changing `PATH`.

## `dbus-1.pc` or Linux Tauri dependency errors

On Ubuntu/Debian, run:

```bash
./scripts/install-tauri-linux-deps.sh
```

The common `libdbus-sys` error usually means `libdbus-1-dev` and/or `pkg-config` are missing.

## Vite port 5173 is already in use

The dev script uses `--strictPort`. Stop the other Vite process or free port `5173`, then run again.

## Browser mode shows mock data

This is expected. Use the desktop app for real repositories:

```bash
npm run tauri:dev
```

## Repository path is invalid

Confirm the path exists and is inside a Git repository:

```bash
git -C /path/to/repo status
```

## Permission denied

Check filesystem permissions, mounted volume permissions, and whether the repository is accessible from the desktop app environment.

## SSH or HTTPS authentication fails

Forker delegates to system Git. Confirm the same operation works in a terminal:

```bash
git fetch
git push
```

Fix SSH keys, credential helpers, or remote URLs in Git configuration.

## Push rejected

The remote may have new commits. Fetch first, inspect ahead/behind state, then pull or rebase using your preferred workflow before pushing again.

## File watcher limits on Linux

If the dev server hits file watcher limits, use polling:

```bash
CHOKIDAR_USEPOLLING=true npm run dev
```
