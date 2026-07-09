# ADR 0004: Keep browser mode as mock-data preview

## Status

Accepted

## Context

Vite browser mode is useful for rapid visual iteration, screenshots, and frontend development. Browsers cannot run local Git commands or access arbitrary repository paths. The production app runs inside Tauri.

## Decision

Keep browser mode and show mock repository data when Tauri APIs are unavailable.

## Consequences

Benefits:

- Faster frontend iteration.
- Visual development does not require native Tauri startup.
- Easier to inspect UI states in a browser.

Costs:

- Browser behavior can diverge from desktop behavior.
- Docs and UI need to make clear that real repositories require Tauri.
- Mock data must stay representative enough to catch layout issues.
