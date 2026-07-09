# ADR 0003: Use Svelte with Vite for the frontend

## Status

Accepted

## Context

The UI needs to be compact, reactive, and fast to iterate. The app shell is a desktop productivity interface with many small state transitions, not a marketing site.

## Decision

Use Svelte with Vite for the frontend. Prefer Svelte 5 style for new or substantially rewritten components while avoiding broad churn of legacy syntax.

## Consequences

Benefits:

- Lightweight runtime.
- Fast dev server.
- Simple component model.
- Good fit for dense desktop UI.

Costs:

- Mixed Svelte syntax exists during migration.
- Frontend developers need to understand Svelte 5 migration boundaries.
- Large top-level state in `App.svelte` needs continued extraction.
