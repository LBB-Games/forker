import { applyResolvedTheme, getSystemThemeMode, watchSystemThemeMode } from './appTheme.js';
import { normalizePreferences } from './preferences.js';
import { resolveTheme } from './themes.js';

export function createThemeController({ getPreferences, setPreferences, persistPreferences = () => {} }) {
  let systemThemeMode = $state(getSystemThemeMode());
  let preferences = $derived(getPreferences());
  let resolved = $derived(resolveTheme(preferences, systemThemeMode));

  $effect(() => applyResolvedTheme(resolved));
  $effect(() => watchSystemThemeMode((nextMode) => systemThemeMode = nextMode));

  function commitThemePreference(nextThemePreference) {
    const nextPreferences = normalizePreferences({ ...getPreferences(), ...nextThemePreference });
    setPreferences(nextPreferences);
    persistPreferences(nextPreferences);
  }

  function setThemeFamily(themeFamily) {
    commitThemePreference({ themeFamily });
  }

  function setThemeAppearance(themeAppearance) {
    commitThemePreference({ themeAppearance });
  }

  return {
    get family() { return resolved.family; },
    get appearance() { return resolved.appearance; },
    get mode() { return resolved.mode; },
    get cssTheme() { return resolved.cssTheme; },
    setThemeFamily,
    setThemeAppearance,
  };
}
