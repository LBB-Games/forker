# ADR 0002: Use native Git CLI first

## Status

Accepted

## Context

Forker needs Git behavior users can trust. Reimplementing Git semantics or switching immediately to libgit2 would increase product risk. Users already have credential helpers, SSH config, hooks, and platform Git behavior configured around the native CLI.

## Decision

Use the system/native Git CLI as the first Git engine. Run Git from Rust with structured argument arrays and explicit working directories.

## Consequences

Benefits:

- Behavior matches terminal Git.
- Existing credential helpers and hooks continue to work.
- Advanced Git behavior can be introduced incrementally.
- Lower initial implementation risk.

Costs:

- Requires Git to be installed or detected.
- CLI parsing must be robust.
- Process cancellation and progress streaming need careful handling.
- Bundled Git may still be needed later, especially on Windows.
