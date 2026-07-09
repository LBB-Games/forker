# Tauri integration

Status: Current

## Runtime modes

Forker has two frontend runtime modes:

- **Browser/Vite mode**: started with `npm run dev`; uses mock data because browsers cannot run local Git commands.
- **Tauri desktop mode**: started with `npm run tauri:dev`; uses Tauri commands to access files and run Git.

## Client boundary

The frontend should call Git/backend functionality through `src/lib/gitClient.js` rather than importing Tauri APIs throughout components. This keeps browser fallback and desktop behavior in one place.

## Command responsibilities

Tauri commands handle:

- repository open/refresh,
- Git detection,
- branch operations,
- working-tree operations,
- remote sync operations,
- diff and commit detail loading,
- recent repository/settings persistence,
- filesystem picker helpers where available.

## Dev server constraints

`src-tauri/tauri.conf.json` expects the Vite dev server at the configured `devUrl`. The npm script uses:

```bash
vite --host 127.0.0.1 --strictPort
```

If port `5173` is occupied, stop the other process before running `npm run tauri:dev`.

## Security posture

Keep filesystem and process access in Rust commands. The frontend should not shell out or assume direct filesystem access. Pass structured data across the Tauri boundary.
