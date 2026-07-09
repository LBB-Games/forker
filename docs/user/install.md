# Install and run

Status: Current for preview builds

Forker can be run from source during development. Preview release packages may also be attached to tagged releases when platform validation is complete.

## Prerequisites

- Node.js and npm.
- Rust toolchain.
- Native Tauri prerequisites for your operating system.
- A working `git` executable on your `PATH`.

On Ubuntu/Debian, install Tauri system dependencies from the project directory:

```bash
./scripts/install-tauri-linux-deps.sh
```

## Run browser preview mode

```bash
cd forker
npm install
npm run dev
```

Browser preview mode cannot run local Git commands. It uses mock repository data and is mainly for visual development.

## Run the desktop app

```bash
cd forker
npm install
npm run tauri:dev
```

The Tauri desktop app can run local Git commands and open real repositories.

## Install a preview package

When a tagged release includes packages, download the package for your operating system and install it using normal platform tools. Forker requires a working `git` executable on your `PATH`; Git is not bundled yet.

On Linux preview releases, available packages may include AppImage, deb, and rpm artifacts. Package availability depends on what was validated for that release.

## Build from source

```bash
npm run build
```

Use `npm run tauri:build` for a Tauri package build when native prerequisites are installed.
