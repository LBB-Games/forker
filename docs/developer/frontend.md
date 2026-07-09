# Frontend

Status: Current

## Stack

- Svelte 5 with Vite.
- Tauri API client where available.
- Browser-only mock fallback for visual iteration.
- Global CSS organized by app area in `src/styles/`.

## Source map

- `src/main.js` mounts the app.
- `src/App.svelte` coordinates app state and major workflows.
- `src/components/` contains UI surfaces.
- `src/lib/` contains helpers, mock data, preferences, focus trap, repository helpers, and client boundary code.
- `src/styles.css` imports the stylesheets in `src/styles/`.

## Svelte guidance

The codebase contains legacy Svelte syntax. Do not churn everything at once. For new or substantially rewritten components, prefer:

- `$props()` over new `export let` patterns,
- `$state`, `$derived`, and `$effect` where migration is intentional,
- event attributes such as `onclick={...}`,
- callback props over event dispatchers.

## UI principles

Follow [Design system](../product/design-system.md).

High-priority requirements:

- visible focus states for every interactive control,
- keyboard-first operation,
- compact consistent row heights,
- clear hover/selected/disabled states,
- no hidden diff content,
- risk visibility for destructive Git actions,
- educational empty/loading/error states.

## Accessibility notes

Prefer native controls unless a composite ARIA pattern is fully implemented. Modal dialogs should move focus inside, trap focus, close on Escape, and restore focus. Context menus need keyboard navigation. Do not encode Git state by color alone.

## CSS guidance

- Keep tokens in `src/styles/base.css`.
- Prefer existing tokens over one-off colors.
- Avoid decorative gradients, blur, and glass effects.
- Keep workbench CSS dense and state-oriented.
- Use component-scoped styles or reusable primitives for new reusable controls when practical.

## Validation

After frontend changes:

```bash
npm run build
```

For meaningful visual changes, also run the static visual audit when available.
