const STORAGE_PREFIX = 'forker.layout.';

export const RESIZE_HANDLE_SIZE = 6;

export const PANE_SIZE_KEYS = Object.freeze({
  sidebarWidth: `${STORAGE_PREFIX}sidebarWidth`,
  changesListWidth: `${STORAGE_PREFIX}changesListWidth`,
  commitDetailsHeight: `${STORAGE_PREFIX}commitDetailsHeight`,
});

export function clampPaneSize(value, min, max = Number.POSITIVE_INFINITY) {
  const numericValue = Number(value);
  const numericMin = Number(min);
  const numericMax = Number(max);
  const lower = Number.isFinite(numericMin) ? numericMin : 0;
  const upper = Number.isFinite(numericMax) ? Math.max(lower, numericMax) : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(numericValue)) return lower;
  return Math.min(Math.max(numericValue, lower), upper);
}

export function readPaneSize(key, fallback) {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;

  try {
    const storedValue = Number(window.localStorage.getItem(key));
    return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : fallback;
  } catch {
    return fallback;
  }
}

export function writePaneSize(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // Ignore storage failures; resizing should still work for the current session.
  }
}

export function panePixels(value) {
  return `${Math.round(value)}px`;
}
