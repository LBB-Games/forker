export function defaultAppSettings() {
  return { autoRefresh: true, recentRepoPaths: [], lastRepoPath: '', openRepoPaths: [], activeRepoPath: '' };
}

export function normalizeRepositoryGroup(snapshot) {
  const group = snapshot?.group ?? null;
  const activeWorktree = snapshot?.activeWorktree ?? null;
  return {
    group,
    worktrees: snapshot?.worktrees ?? [],
    localBranches: snapshot?.localBranches ?? [],
    remoteBranches: snapshot?.remoteBranches ?? [],
    remotes: snapshot?.remotes ?? [],
    tags: snapshot?.tags ?? [],
    activeWorktree,
  };
}

export function normalizeSnapshot(snapshot) {
  const activeWorktree = snapshot?.activeWorktree;
  const source = activeWorktree ?? snapshot ?? {};
  return {
    repo: source.repo,
    localBranches: source.localBranches ?? [],
    remotes: source.remotes ?? [],
    tags: source.tags ?? [],
    stashes: source.stashes ?? [],
    commits: source.commits ?? [],
    changedFiles: source.changedFiles ?? [],
    diffByFile: source.diffByFile ?? {},
    conflictState: normalizeConflictState(source.conflictState),
  };
}

export function normalizeConflictState(conflictState) {
  const state = conflictState ?? {};
  return {
    active: !!state.active,
    operation: state.operation ?? null,
    operationLabel: state.operationLabel ?? 'None',
    files: state.files ?? [],
    nextStep: state.nextStep ?? 'No conflict operation is active.',
  };
}

export function uniqueRepositoryPaths(paths) {
  return [...new Set((paths ?? []).map((path) => String(path || '').trim()).filter(Boolean))];
}

export function rememberRecentRepository(paths, path) {
  return [path, ...paths.filter((item) => item !== path)].slice(0, 10);
}

export function refreshIntervalMs(preferences) {
  return Math.max(5, Number(preferences.refreshInterval) || 30) * 1000;
}

export function fetchIntervalMs(preferences) {
  return Math.max(1, Number(preferences.fetchInterval) || 10) * 60 * 1000;
}

export function shouldFetchFor(preferences, eventName) {
  return preferences.fetchBehavior === eventName || (eventName === 'focus' && preferences.fetchBehavior === 'interval');
}

export function shouldScheduleRefresh({ autoRefresh, updateRemotes, hasLoadedRepo, repoPath, actionBusy, isLoadingRepo, isRefreshing, documentHidden, pauseRefreshWhileEditing, commitComposerFocused, lastRefreshAt }) {
  if ((!autoRefresh && !updateRemotes) || !hasLoadedRepo || !repoPath || actionBusy || isLoadingRepo || isRefreshing || documentHidden) return false;
  if (pauseRefreshWhileEditing && commitComposerFocused) return false;
  if (Date.now() - lastRefreshAt < 2500) return false;
  return true;
}

export function captureScrollPositions(selectors = ['.file-sections', '.diff-table', '.commit-table', '.details-pane']) {
  return selectors.map((selector) => {
    const element = document.querySelector(selector);
    return element ? { selector, top: element.scrollTop, left: element.scrollLeft } : null;
  }).filter(Boolean);
}

export function applyScrollPositions(positions) {
  for (const { selector, top, left } of positions) {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  }
}

export function createRepositoryRefreshScheduler({
  getState,
  refreshRepository,
}) {
  let refreshTimer = null;
  let refreshDebounceTimer = null;

  function reset() {
    clearInterval(refreshTimer);
    refreshTimer = null;

    const { autoRefresh, preferences } = getState();
    if (!autoRefresh && preferences.fetchBehavior !== 'interval') return;
    const interval = preferences.fetchBehavior === 'interval'
      ? Math.min(refreshIntervalMs(preferences), fetchIntervalMs(preferences))
      : refreshIntervalMs(preferences);
    refreshTimer = window.setInterval(() => {
      const state = getState();
      if (state.preferences.fetchBehavior === 'interval' && Date.now() - state.lastRefreshAt >= fetchIntervalMs(state.preferences)) {
        schedule('Auto fetch', true);
      } else {
        schedule('Auto refresh');
      }
    }, interval);
  }

  function schedule(reason = 'Refresh', updateRemotes = false) {
    const state = getState();
    if (!shouldScheduleRefresh({ ...state, updateRemotes })) return;
    clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = window.setTimeout(() => refreshRepository(reason, updateRemotes), 500);
  }

  function clear() {
    clearInterval(refreshTimer);
    clearTimeout(refreshDebounceTimer);
    refreshTimer = null;
    refreshDebounceTimer = null;
  }

  return { reset, schedule, clear };
}
