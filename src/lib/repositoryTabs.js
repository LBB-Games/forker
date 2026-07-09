/**
 * Helpers for the open repository tab/session model.
 *
 * App.svelte owns Svelte state assignment; this module keeps the tab array
 * updates and session shape centralized so the app shell does not duplicate the
 * same bookkeeping around every tab operation.
 */

/**
 * @typedef {Object} RepositorySession
 * @property {string} id
 * @property {string} path
 * @property {any} repo
 * @property {any[]} localBranches
 * @property {string[]} remotes
 * @property {string[]} tags
 * @property {any[]} stashes
 * @property {any[]} commits
 * @property {any[]} changedFiles
 * @property {Record<string, any[]>} diffByFile
 * @property {any} conflictState
 * @property {string} activePage
 * @property {string} selectedBranch
 * @property {string} selectedCommitId
 * @property {Set<string>} hiddenBranches
 * @property {Set<string>} hiddenRemoteBranches
 * @property {string} selectedFile
 * @property {string} selectedFileKey
 * @property {string[]} selectedFileKeys
 * @property {string} lastSelectedKey
 * @property {Set<string>} collapsedTreeFolders
 * @property {string} commitSummary
 * @property {string} commitDescription
 * @property {boolean} amendCommit
 */

/** @param {Partial<RepositorySession>} state */
export function captureRepositorySession(state) {
  const rootPath = state.rootPath ?? state.repositoryGroup?.group?.rootPath ?? state.path ?? state.repo?.path ?? '';
  return {
    id: rootPath,
    path: rootPath,
    rootPath,
    activeWorktreePath: state.activeWorktreePath ?? state.repo?.path ?? '',
    repositoryGroup: state.repositoryGroup ?? null,
    repo: state.repo,
    localBranches: state.localBranches ?? [],
    remotes: state.remotes ?? [],
    tags: state.tags ?? [],
    stashes: state.stashes ?? [],
    commits: state.commits ?? [],
    changedFiles: state.changedFiles ?? [],
    diffByFile: state.diffByFile ?? {},
    conflictState: state.conflictState ?? { active: false, operation: null, operationLabel: 'None', files: [], nextStep: 'No conflict operation is active.' },
    activePage: state.activePage ?? 'commits',
    selectedBranch: state.selectedBranch ?? '',
    selectedCommitId: state.selectedCommitId ?? '',
    hiddenBranches: new Set(state.hiddenBranches ?? []),
    hiddenRemoteBranches: new Set(state.hiddenRemoteBranches ?? []),
    selectedFile: state.selectedFile ?? '',
    selectedFileKey: state.selectedFileKey ?? '',
    selectedFileKeys: state.selectedFileKeys ?? [],
    lastSelectedKey: state.lastSelectedKey ?? '',
    collapsedTreeFolders: new Set(state.collapsedTreeFolders ?? []),
    commitSummary: state.commitSummary ?? '',
    commitDescription: state.commitDescription ?? '',
    amendCommit: state.amendCommit ?? false,
  };
}

/**
 * @param {RepositorySession[]} tabs
 * @param {string} activeTabId
 * @param {RepositorySession} session
 */
export function updateRepositorySession(tabs, activeTabId, session) {
  if (!activeTabId || !session?.path) return tabs;
  return tabs.map((tab) => tab.id === activeTabId ? session : tab);
}

/** @param {RepositorySession[]} tabs @param {RepositorySession} session */
export function upsertRepositorySession(tabs, session) {
  if (!session?.path) return tabs;
  const existingIndex = tabs.findIndex((tab) => tab.id === session.id);
  if (existingIndex < 0) return [...tabs, session];
  return tabs.map((tab, index) => index === existingIndex ? session : tab);
}

/**
 * @param {RepositorySession[]} tabs
 * @param {number} closingIndex
 */
export function chooseNextRepositorySession(tabs, closingIndex) {
  return tabs[Math.max(0, closingIndex - 1)] ?? tabs[0] ?? null;
}

/**
 * Normalize older or partial tab sessions before assigning them back into
 * App.svelte state.
 *
 * @param {Partial<RepositorySession>} session
 * @param {{ fallbackAmend?: boolean }} [options]
 */
export function normalizeRepositorySession(session, { fallbackAmend = false } = {}) {
  const repo = session.repo ?? {};
  const commits = session.commits ?? [];
  const selectedFileKey = session.selectedFileKey ?? '';

  return {
    repo,
    localBranches: session.localBranches ?? [],
    remotes: session.remotes ?? [],
    tags: session.tags ?? [],
    stashes: session.stashes ?? [],
    commits,
    changedFiles: session.changedFiles ?? [],
    diffByFile: session.diffByFile ?? {},
    conflictState: session.conflictState ?? { active: false, operation: null, operationLabel: 'None', files: [], nextStep: 'No conflict operation is active.' },
    activePage: session.activePage ?? 'commits',
    selectedBranch: session.selectedBranch ?? (repo.currentBranch),
    selectedCommitId: session.selectedCommitId ?? commits[0]?.id ?? '',
    hiddenBranches: new Set(session.hiddenBranches ?? []),
    hiddenRemoteBranches: new Set(session.hiddenRemoteBranches ?? []),
    selectedFile: session.selectedFile ?? '',
    selectedFileKey,
    selectedFileKeys: session.selectedFileKeys ?? [],
    lastSelectedKey: session.lastSelectedKey ?? selectedFileKey,
    collapsedTreeFolders: new Set(session.collapsedTreeFolders ?? []),
    commitSummary: session.commitSummary ?? '',
    commitDescription: session.commitDescription ?? '',
    amendCommit: session.amendCommit ?? fallbackAmend,
    repositoryGroup: session.repositoryGroup ?? null,
    activeWorktreePath: session.activeWorktreePath ?? repo.path ?? '',
    repoPathInput: session.rootPath ?? session.path ?? repo.path ?? '',
  };
}
