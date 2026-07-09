export {
  defaultThemeFamily,
  defaultThemeMode,
  themeFamilies,
  themeModes,
} from '../themes/index.js';

import {
  defaultThemeFamily,
  defaultThemeMode,
  themeFamilies,
  themeModes,
} from '../themes/index.js';

export const defaultThemeAppearance = 'system';

export const themeAppearances = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export function themeSwatches(themeFamily, themeMode = defaultThemeMode) {
  const mode = normalizeThemeMode(themeMode);
  const swatches = themeFamily?.swatches;

  if (Array.isArray(swatches)) return swatches;
  return swatches?.[mode] ?? swatches?.[defaultThemeMode] ?? [];
}

export function isThemeFamily(value) {
  return themeFamilies.some((theme) => theme.id === value);
}

export function isThemeMode(value) {
  return themeModes.some((mode) => mode.id === value);
}

export function isThemeAppearance(value) {
  return themeAppearances.some((appearance) => appearance.id === value);
}

export function normalizeThemeFamily(value) {
  return isThemeFamily(value) ? value : defaultThemeFamily;
}

export function normalizeThemeMode(value) {
  return isThemeMode(value) ? value : defaultThemeMode;
}

export function normalizeThemeAppearance(value) {
  return isThemeAppearance(value) ? value : defaultThemeAppearance;
}

export function themeIdFor(themeFamily = defaultThemeFamily, themeMode = defaultThemeMode) {
  return `${normalizeThemeFamily(themeFamily)}-${normalizeThemeMode(themeMode)}`;
}

export function resolveTheme(value = {}, systemThemeMode = defaultThemeMode) {
  const family = normalizeThemeFamily(value.themeFamily);
  const appearance = normalizeThemeAppearance(value.themeAppearance);
  const mode = appearance === 'system' ? normalizeThemeMode(systemThemeMode) : normalizeThemeMode(appearance);

  return {
    family,
    appearance,
    mode,
    cssTheme: themeIdFor(family, mode),
    colorScheme: appearance === 'system' ? 'light dark' : mode,
  };
}
