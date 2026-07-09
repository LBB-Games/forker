# Developer setup

Status: Current

## Prerequisites

- Node.js and npm.
- Rust toolchain.
- Tauri 2 prerequisites for your OS.
- System Git available on `PATH`.

Ubuntu/Debian:

```bash
./scripts/install-tauri-linux-deps.sh
```

## Install dependencies

```bash
cd forker
npm install
```

## Frontend development

```bash
npm run dev
```

This starts Vite at `127.0.0.1:5173` with `--strictPort`. Browser mode uses mock data.

## Desktop development

```bash
npm run tauri:dev
```

This starts the Tauri app and enables local Git commands.

## Build validation

```bash
npm run build
```

Run this before claiming frontend changes are complete.

## Production/package build

```bash
npm run tauri:build
```

Native packaging depends on OS-specific Tauri setup.
