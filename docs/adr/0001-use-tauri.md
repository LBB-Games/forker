# ADR 0001: Use Tauri for the desktop shell

## Status

Accepted

## Context

Forker needs local filesystem access, process execution for Git, native app packaging, and cross-platform desktop behavior. Electron would provide a mature desktop shell but adds a larger runtime footprint.

## Decision

Use Tauri as the desktop shell with a Rust backend and Svelte frontend.

## Consequences

Benefits:

- Smaller desktop app footprint than Electron.
- Rust backend for native operations.
- Stronger process/filesystem boundary.
- Cross-platform packaging path.

Costs:

- Developers need Rust and Tauri prerequisites.
- Some desktop behaviors require Tauri-specific implementation.
- Browser mode cannot represent all production behavior.
