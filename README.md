# forker

Forker is a cross-platform desktop Git client built with **Tauri**, **Svelte**, and **Rust**. It is designed as a compact native-feeling Git workbench for inspecting repository state, reviewing diffs, staging changes, committing, and running branch/remote workflows with clear feedback.

## Current status

The app has a Svelte/Vite frontend and an initial Tauri 2 backend. Browser-only Vite mode uses mock data for visual iteration. The Tauri desktop app can open local Git repositories and run native `git` commands to load branches, remotes, tags, commits, changed files, and diffs.

## Install for users

Download the package for your platform from the project release page, then install it with the native installer for your OS.

### macOS

Use the `.dmg` or `.app.tar.gz` bundle matching your Mac CPU:

- Apple silicon: `aarch64` / `arm64`
- Intel: `x64` / `x86_64`

Open the `.dmg`, drag **forker** to **Applications**, then launch it from Applications. If macOS Gatekeeper blocks an unsigned/local build, right-click the app, choose **Open**, and confirm.

### Windows

Use the `.msi` installer. Download it, run it, and follow the installer prompts. Prefer the `x64` build for most Windows PCs.

### Linux

Tauri Linux builds are distributed as native packages plus an AppImage. The proper choice depends on your distro:

| Distro family | Recommended package | Install command / notes |
| --- | --- | --- |
| Debian, Ubuntu, Linux Mint, Pop!_OS, elementary OS, Zorin OS | `.deb` | `sudo apt install ./forker_*_amd64.deb` |
| Fedora, RHEL, CentOS Stream, Rocky Linux, AlmaLinux | `.rpm` | `sudo dnf install ./forker-*.x86_64.rpm` |
| openSUSE Leap/Tumbleweed, SUSE Linux Enterprise | `.rpm` | `sudo zypper install ./forker-*.x86_64.rpm` |
| Arch Linux, Manjaro, EndeavourOS, other distros without `.deb`/`.rpm` support | `.AppImage` | `chmod +x Forker_*.AppImage && ./Forker_*.AppImage` |
| NixOS | `.AppImage` via `appimage-run` | `nix shell nixpkgs#appimage-run -c appimage-run ./Forker_*.AppImage` |

Linux notes:

- Prefer `.deb` or `.rpm` when your distro supports it; the package manager can install required runtime libraries and create desktop/menu entries.
- Use the AppImage for portable installs or unsupported distros. Some systems require FUSE 2 support to run AppImages (`libfuse2`/`fuse2`).
- Forker uses the system `git` binary for repository operations. Install Git if it is not already present (`sudo apt install git`, `sudo dnf install git`, `sudo pacman -S git`, etc.).
- Tauri apps on Linux use WebKitGTK/GTK runtime libraries. Native `.deb`/`.rpm` packages should declare these dependencies; with AppImage, install your distro's WebKitGTK/GTK packages if the app does not start.

## Quick start for contributors

```bash
cd forker
npm install
npm run dev
```

Run the desktop app:

```bash
npm run tauri:dev
```

Build the frontend:

```bash
npm run build
```

Build installable desktop packages:

```bash
npm run tauri:build
```

Tauri writes release artifacts under `src-tauri/target/release/bundle/` (`deb/`, `rpm/`, `appimage/`, `dmg/`, `msi/`, etc., depending on host platform and configured targets).

On Ubuntu/Debian, install native Tauri development dependencies with:

```bash
./scripts/install-tauri-linux-deps.sh
```

## Documentation

Start at the documentation hub:

- [docs/README.md](docs/README.md)

Common entry points:

- [User quickstart](docs/user/quickstart.md)
- [Developer setup](docs/developer/setup.md)
- [Architecture](docs/developer/architecture.md)
- [Product brief](docs/product/product-brief.md)
- [Design system](docs/product/design-system.md)
- [Troubleshooting](docs/user/troubleshooting.md)

## Directory layout

```text
forker/
├─ docs/              Documentation hub, user docs, developer docs, ADRs, work logs
├─ src/               Svelte frontend
├─ src-tauri/         Tauri/Rust backend
├─ assets/            App assets
├─ design/            Design source assets, if present
├─ package.json       Frontend and Tauri scripts
├─ PRODUCT.md         Short pointer to canonical product docs
└─ DESIGN.md          Short pointer to canonical design docs
```
