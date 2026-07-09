import { defaultThemeAppearance, defaultThemeFamily, resolveTheme } from './themes.js';

export const preferencesStorageKey = 'forker.preferences.v1';

export const defaultPreferences = {
  themeFamily: defaultThemeFamily,
  themeAppearance: defaultThemeAppearance,
  confirmDiscardChanges: true,
  confirmResetBranch: true,
  confirmForcePush: true,
  confirmDeleteBranch: true,
  confirmCancelOperations: true,
  defaultRepoLocation: '',
  gitPathMode: 'auto',
  gitExecutablePath: '',
  refreshInterval: '30',
  refreshOnFocus: true,
  pauseRefreshWhileEditing: true,
  fetchBehavior: 'manual',
  fetchInterval: '10',
  diffView: 'unified',
  showWhitespace: false,
  wrapDiffLines: false,
  diffContextLines: '3',
  signCommits: false,
  amendBehavior: 'manual',
  autoStagePreference: 'never',
  commitMessageTemplate: '',
  defaultBranchName: 'main',
  checkoutAfterCreate: true,
  pruneDeletedRemoteBranches: false,
  preferredEditor: '',
  preferredTerminal: '',
  showGitActionsButton: true,
  showOpenEditorButton: false,
  showOpenTerminalButton: false,
  showCommandPaletteButton: false,
  showRefreshButton: false,
  showToolbarCloneButton: false,
  showToolbarStageButton: true,
  showToolbarFetchButton: false,
  showToolbarPullButton: false,
  showToolbarPushButton: false,
  showToolbarForcePushButton: false,
  showToolbarCreateBranchButton: false,
  showToolbarBranchHistoryButton: false,
  showToolbarStashButton: false,
  showRefreshButtonOnChanges: false,
  showRefreshButtonOnCommits: false,
  showToolbarFetchButtonOnChanges: false,
  showToolbarFetchButtonOnCommits: false,
  showToolbarPullButtonOnChanges: false,
  showToolbarPullButtonOnCommits: false,
  showToolbarPushButtonOnChanges: false,
  showToolbarPushButtonOnCommits: false,
  showToolbarForcePushButtonOnChanges: false,
  showToolbarForcePushButtonOnCommits: false,
  showToolbarCreateBranchButtonOnChanges: false,
  showToolbarCreateBranchButtonOnCommits: false,
  showToolbarBranchHistoryButtonOnChanges: false,
  showToolbarBranchHistoryButtonOnCommits: false,
};

export function normalizePreferences(value = {}) {
  const resolvedTheme = resolveTheme(value);
  return {
    ...defaultPreferences,
    ...value,
    themeFamily: resolvedTheme.family,
    themeAppearance: resolvedTheme.appearance,
  };
}

export function loadPreferences() {
  if (typeof localStorage === 'undefined') return { ...defaultPreferences };
  try {
    return normalizePreferences(JSON.parse(localStorage.getItem(preferencesStorageKey) || '{}'));
  } catch {
    return { ...defaultPreferences };
  }
}

export function savePreferences(preferences) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(preferencesStorageKey, JSON.stringify(normalizePreferences(preferences)));
}
