import { defaultThemeMode, resolveTheme } from './themes.js';

const systemThemeQuery = '(prefers-color-scheme: light)';

export function getSystemThemeMode() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return defaultThemeMode;
  return window.matchMedia(systemThemeQuery).matches ? 'light' : 'dark';
}

export function watchSystemThemeMode(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(systemThemeQuery);
  const handleChange = () => onChange(getSystemThemeMode());
  media.addEventListener?.('change', handleChange);
  return () => media.removeEventListener?.('change', handleChange);
}

export function applyResolvedTheme(resolved) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolved.cssTheme;
  document.documentElement.dataset.themeFamily = resolved.family;
  document.documentElement.dataset.themeAppearance = resolved.appearance;
  document.documentElement.dataset.themeMode = resolved.mode;
  document.documentElement.style.colorScheme = resolved.colorScheme;
}

export function applyTheme(value) {
  applyResolvedTheme(resolveTheme(value, getSystemThemeMode()));
}
