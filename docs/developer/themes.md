# Theme authoring

Forker themes are authored in `src/themes/*.js` and compiled to `src/styles/themes/generated.css`.
Do not hand-edit generated CSS.

## Add a theme

1. Copy `src/themes/template.js` to `src/themes/<theme-id>.js`.
2. Set `id`, `label`, and `description`.
3. Fill both `dark` and `light` standard token maps with hex colors.
4. Fill each mode's `branchColors` array with exactly 10 colors used for branch/ref graph accents.
5. Add the theme import and entry in `src/themes/index.js`.
6. Run:

```bash
npm run themes:generate
npm run themes:check
npm run themes:stable
npm run build
```

`themes:stable` is expected to fail only when intentionally changing the existing color snapshot. For a purely additive theme, update the fixture in the same change and review the generated CSS carefully.

## Token rules

- Each mode has the same authored palette: 23 standard theme colors plus 10 branch colors.
- Token names are semantic roles, not color names.
- Use `accent` for primary actions, focus, selection, and info states.
- Use `success`, `warning`, and `danger` for Git and system states.
- Use hex values for authored colors when possible.
- Do not add component-specific colors to theme files or generated CSS.
- Use standard colors directly in component CSS; use local `color-mix(...)` for small state variations.
- Keep non-color reusable values in `src/styles/base.css`; keep theme-specific palette values in theme files.

## Files

- `src/themes/factory.js`: normalizes theme definitions, emits standard colors plus branch colors, and derives swatches when omitted.
- `src/themes/schema.js`: validates authored and generated token contracts.
- `scripts/generate-theme-css.mjs`: writes `src/styles/themes/generated.css`.
- `scripts/check-theme-output-stable.mjs`: compares rendered CSS to `test/fixtures/themes.generated.css`.
