/** @typedef {import('./types.js').RepoSnapshot} RepoSnapshot */

import { tick } from 'svelte';
import { fileKey } from './fileTree.js';
import { pruneHiddenBranches, pruneHiddenRemoteBranches } from './branchVisibility.js';
import { resolveChangedFileSelection } from './appUtils.js';
import { cloneStandardRepository, completeFirstWorktree, openRepositorySnapshot, openStandardRepositorySnapshot, prepareBareClone, prepareMetaClone, selectWorktree as selectWorktreeSnapshot, unwatchRepository, watchRepository, saveAppSettings } from './gitClient.js';
import {
  defaultAppSettings,
  normalizeRepositoryGroup,
  normalizeSnapshot,
  rememberRecentRepository as rememberRecentRepositoryPath,
  uniqueRepositoryPaths,
  shouldFetchFor,
} from './repositorySession.js';
import {
  captureRepositorySession as captureRepositoryTabSession,
  chooseNextRepositorySession,
  normalizeRepositorySession,
  updateRepositorySession,
  upsertRepositorySession,
} from './repositoryTabs.js';

async function yieldToPaint() {
  await tick();
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function stableStringify(value) {
  return JSON.stringify(value ?? null);
}

function repoSignature(repo = {}) {
  return {
    name: repo.name ?? '',
    path: repo.path ?? '',
    currentBranch: repo.currentBranch ?? '',
    upstream: repo.upstream ?? null,
    hasUpstream: repo.hasUpstream ?? false,
    ahead: repo.ahead ?? 0,
    behind: repo.behind ?? 0,
    changed: repo.changed ?? 0,
    conflicts: repo.conflicts ?? 0,
  };
}

function conflictSignature(conflictState = {}) {
  return {
    active: conflictState.active ?? false,
    operationLabel: conflictState.operationLabel ?? '',
    nextStep: conflictState.nextStep ?? '',
    files: (conflictState.files ?? []).map((file) => ({
      path: file.path ?? '',
      status: file.status ?? '',
      kind: file.kind ?? '',
      binary: file.binary ?? false,
    })),
  };
}

function branchSignature(branch = {}) {
  return {
    name: branch.name ?? '',
    meta: branch.meta ?? '',
    current: branch.current ?? false,
    color: branch.color ?? '',
    upstream: branch.upstream ?? '',
  };
}

function fileSignature(file = {}) {
  return {
    status: file.status ?? '',
    label: file.label ?? '',
    path: file.path ?? '',
    folder: file.folder ?? '',
    section: file.section ?? '',
    tone: file.tone ?? '',
    lines: file.lines ?? '',
  };
}

function commitSignature(commit = {}) {
  return {
    id: commit.id ?? '',
    subject: commit.subject ?? '',
    author: commit.author ?? '',
    date: commit.date ?? '',
    branch: commit.branch ?? '',
    refs: commit.refs ?? [],
    parents: commit.parents ?? [],
    lane: commit.lane ?? '',
    laneIndex: commit.laneIndex ?? null,
    activeLanes: commit.activeLanes ?? [],
    graph: commit.graph ?? null,
  };
}

function stashSignature(stash = {}) {
  return {
    reference: stash.reference ?? '',
    shortId: stash.shortId ?? '',
    message: stash.message ?? '',
    subject: stash.subject ?? '',
    branch: stash.branch ?? '',
    date: stash.date ?? '',
    changedFiles: stash.changedFiles ?? 0,
  };
}

function arraySignaturesMatch(nextItems = [], currentItems = [], signatureFor = (item) => item) {
  if (nextItems.length !== currentItems.length) return false;
  return nextItems.every((item, index) => stableStringify(signatureFor(item)) === stableStringify(signatureFor(currentItems[index])));
}

function snapshotMatchesCurrentState(normalized, state) {
  if (!state.hasLoadedRepo) return false;
  return stableStringify(repoSignature(normalized.repo)) === stableStringify(repoSignature(state.repo))
    && arraySignaturesMatch(normalized.localBranches, state.localBranches, branchSignature)
    && arraySignaturesMatch(normalized.remotes, state.remotes)
    && arraySignaturesMatch(normalized.tags, state.tags)
    && arraySignaturesMatch(normalized.stashes, state.stashes, stashSignature)
    && arraySignaturesMatch(normalized.commits, state.commits, commitSignature)
    && arraySignaturesMatch(normalized.changedFiles, state.changedFiles, fileSignature)
    && stableStringify(conflictSignature(normalized.conflictState)) === stableStringify(conflictSignature(state.conflictState));
}

function mergeStableItems(nextItems = [], currentItems = [], signatureFor = (item) => item) {
  return nextItems.map((item, index) => {
    const current = currentItems[index];
    return current && stableStringify(signatureFor(item)) === stableStringify(signatureFor(current)) ? current : item;
  });
}

function mergeCommitDetails(nextCommits = [], currentCommits = []) {
  const currentById = new Map(currentCommits.map((commit) => [commit.id, commit]));
  return nextCommits.map((commit) => {
    const current = currentById.get(commit.id);
    if (!current) return commit;
    if (stableStringify(commitSignature(commit)) === stableStringify(commitSignature(current))) return current;
    if (!current.detailsLoaded) return commit;
    return {
      ...commit,
      files: current.files,
      insertions: current.insertions,
      deletions: current.deletions,
      message: current.message,
      changedPaths: current.changedPaths ?? [],
      detailsLoaded: true,
    };
  });
}

function mergeCachedDiffs(nextDiffByFile = {}, currentDiffByFile = {}, changedFiles = []) {
  const validDiffKeys = new Set();
  for (const file of changedFiles) {
    validDiffKeys.add(fileKey(file));
    validDiffKeys.add(file.path);
  }

  const merged = { ...nextDiffByFile };
  for (const [key, lines] of Object.entries(currentDiffByFile ?? {})) {
    if (validDiffKeys.has(key) && !merged[key]) merged[key] = lines;
  }
  return merged;
}

/**
 * Repository lifecycle and tab/session persistence controller.
 * Receives the app rune state through accessors so mutable state remains scoped
 * to the top-level app controller instance rather than module singletons.
 */
export function createRepositoryLifecycleController(state, deps = {}) {
  const { runAutoFetch = async () => {} } = deps;

  function shouldFallbackToStandardRepository(error) {
    const message = String(error || '');
    return message.includes('not a Forker worktree repository container')
      || message.includes('missing .git directory')
      || message.includes('missing bare .git directory')
      || message.includes('inside a Git repository')
      || message.includes('not a bare clone-worktree repository container');
  }

  async function openAnyRepositorySnapshot(path) {
    try {
      return await openRepositorySnapshot(path);
    } catch (error) {
      if (!shouldFallbackToStandardRepository(error)) throw error;
      return openStandardRepositorySnapshot(path);
    }
  }

  async function openRepository(path = state.repoPathInput) {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      state.backendError = 'Enter a repository path first.';
      return;
    }

    if (state.actionBusy || state.isLoadingRepo) return;
    state.stateVersion += 1;
    state.isLoadingRepo = true;
    state.jobStatus = 'running';
    state.backendError = '';
    state.lastFailedOperation = null;
    state.backendStatus = 'Loading repository…';
    await yieldToPaint();
    try {
      saveActiveRepositorySession();
      activateRepositorySnapshot(await openAnyRepositorySnapshot(trimmedPath), false);
      state.stateVersion += 1;
      state.lastRefreshAt = Date.now();
      state.backendStatus = 'Loaded from Git';
      state.lastFailedOperation = null;
      state.showOpenRepositoryModal = false;
      state.isLoadingRepo = false;
      state.jobStatus = 'idle';
      if (shouldFetchFor(state.preferences, 'open')) await runAutoFetch('Auto-fetch on open');
    } catch (error) {
      state.backendError = String(error);
      state.lastFailedOperation = { type: 'open', path: trimmedPath };
      state.backendStatus = 'Open failed';
    } finally {
      state.isLoadingRepo = false;
      state.jobStatus = 'idle';
    }
  }

  async function prepareClone(remoteUrl, parentPath, directoryName = '', layout = 'bare') {
    const trimmedUrl = remoteUrl.trim();
    const cloneLocation = String(parentPath || '').trim() || String(state.preferences.defaultRepoLocation || '').trim();
    if (!trimmedUrl) {
      state.backendError = 'Enter a remote repository URL first.';
      return null;
    }
    if (!cloneLocation) {
      state.backendError = 'Set a default clone location in Settings or enter a clone location.';
      return null;
    }
    if (state.actionBusy || state.isLoadingRepo) return null;

    state.stateVersion += 1;
    state.isLoadingRepo = true;
    state.jobStatus = 'running';
    state.backendError = '';
    state.lastFailedOperation = null;
    state.backendStatus = layout === 'meta' ? 'Cloning repo.meta workspace…' : 'Cloning bare repository…';
    await yieldToPaint();
    try {
      const prepare = layout === 'meta' ? prepareMetaClone : prepareBareClone;
      const preparation = await prepare(trimmedUrl, cloneLocation, directoryName.trim() || null);
      state.backendStatus = 'Choose the first worktree branch';
      state.lastFailedOperation = null;
      return preparation;
    } catch (error) {
      state.backendError = String(error);
      state.lastFailedOperation = { type: 'clone', remoteUrl: trimmedUrl, parentPath: cloneLocation, directoryName };
      state.backendStatus = 'Clone failed';
      return null;
    } finally {
      state.isLoadingRepo = false;
      state.jobStatus = 'idle';
    }
  }

  async function completeClone(rootPath, selectedRemoteBranch, localBranchName = '', worktreeName = '') {
    if (!rootPath || !selectedRemoteBranch || state.actionBusy || state.isLoadingRepo) return;
    state.stateVersion += 1;
    state.isLoadingRepo = true;
    state.jobStatus = 'running';
    state.backendError = '';
    state.lastFailedOperation = null;
    state.backendStatus = 'Creating first worktree…';
    await yieldToPaint();
    try {
      saveActiveRepositorySession();
      activateRepositorySnapshot(await completeFirstWorktree(rootPath, selectedRemoteBranch, localBranchName.trim() || null, worktreeName.trim() || null), false);
      state.stateVersion += 1;
      state.lastRefreshAt = Date.now();
      state.backendStatus = 'Clone complete';
      state.lastFailedOperation = null;
      state.showOpenRepositoryModal = false;
      state.showCloneRepositoryModal = false;
    } catch (error) {
      state.backendError = String(error);
      state.lastFailedOperation = { type: 'clone', rootPath, selectedRemoteBranch };
      state.backendStatus = 'Create worktree failed';
    } finally {
      state.isLoadingRepo = false;
      state.jobStatus = 'idle';
    }
  }

  async function cloneRepository(remoteUrl, parentPath, directoryName = '', useWorktrees = false, layout = 'bare') {
    if (!useWorktrees) {
      const trimmedUrl = remoteUrl.trim();
      const cloneLocation = String(parentPath || '').trim() || String(state.preferences.defaultRepoLocation || '').trim();
      if (!trimmedUrl) {
        state.backendError = 'Enter a remote repository URL first.';
        return;
      }
      if (!cloneLocation) {
        state.backendError = 'Set a default clone location in Settings or enter a clone location.';
        return;
      }
      if (state.actionBusy || state.isLoadingRepo) return;
      state.stateVersion += 1;
      state.isLoadingRepo = true;
      state.jobStatus = 'running';
      state.backendError = '';
      state.lastFailedOperation = null;
      state.backendStatus = 'Cloning repository…';
      await yieldToPaint();
      try {
        saveActiveRepositorySession();
        activateRepositorySnapshot(await cloneStandardRepository(trimmedUrl, cloneLocation, directoryName.trim() || null), false);
        state.stateVersion += 1;
        state.lastRefreshAt = Date.now();
        state.backendStatus = 'Clone complete';
        state.lastFailedOperation = null;
        state.showOpenRepositoryModal = false;
        state.showCloneRepositoryModal = false;
      } catch (error) {
        state.backendError = String(error);
        state.lastFailedOperation = { type: 'clone', remoteUrl: trimmedUrl, parentPath: cloneLocation, directoryName };
        state.backendStatus = 'Clone failed';
      } finally {
        state.isLoadingRepo = false;
        state.jobStatus = 'idle';
      }
      return;
    }
    const preparation = await prepareClone(remoteUrl, parentPath, directoryName, layout);
    const branch = preparation?.defaultBranch || preparation?.remoteBranches?.[0];
    if (preparation && branch) await completeClone(preparation.rootPath, branch, branch.replace(/^origin\//, ''), branch.replace(/^origin\//, '').replace(/[^a-zA-Z0-9._-]+/g, '-'));
  }

  /** @param {RepoSnapshot} snapshot */
  function activateRepositorySnapshot(snapshot, preserveSelection = true) {
    const groupSnapshot = snapshot?.group ? normalizeRepositoryGroup(snapshot) : null;
    state.repositoryGroup = groupSnapshot;
    state.activeWorktreePath = groupSnapshot?.activeWorktree?.repo?.path ?? '';
    if (groupSnapshot && !groupSnapshot.activeWorktree) {
      state.backendError = 'This repository has no worktrees yet. Create the first worktree from a remote branch.';
      return false;
    }
    const applied = applySnapshot(snapshot, preserveSelection);
    if (applied) {
      state.activeRepositoryTabId = state.repositoryGroup?.group?.rootPath ?? state.repo.path;
      upsertActiveRepositorySession();
      watchActiveRepository(state.repositoryGroup?.group?.rootPath ?? state.repo.path);
    }
    return applied;
  }

  /** @param {RepoSnapshot} snapshot */
  function applySnapshot(snapshot, preserveSelection = true) {
    const previousCommitId = preserveSelection ? state.selectedCommitId : '';
    const previousBranch = preserveSelection ? state.selectedBranch : '';
    const previousFileSelection = preserveSelection
      ? { key: state.selectedFileKey, keys: state.selectedFileKeys, path: state.selectedFile, lastKey: state.lastSelectedKey }
      : { key: '', keys: [], path: '', lastKey: '' };
    const normalized = normalizeSnapshot(snapshot);
    if (preserveSelection && snapshotMatchesCurrentState(normalized, state)) return false;

    state.hasLoadedRepo = true;
    state.repo = normalized.repo;
    state.localBranches = preserveSelection ? mergeStableItems(normalized.localBranches, state.localBranches, branchSignature) : normalized.localBranches;
    state.remotes = preserveSelection ? mergeStableItems(normalized.remotes, state.remotes) : normalized.remotes;
    state.tags = preserveSelection ? mergeStableItems(normalized.tags, state.tags) : normalized.tags;
    state.stashes = preserveSelection ? mergeStableItems(normalized.stashes, state.stashes, stashSignature) : normalized.stashes;
    state.commits = preserveSelection ? mergeCommitDetails(normalized.commits, state.commits) : normalized.commits;
    state.changedFiles = preserveSelection ? mergeStableItems(normalized.changedFiles, state.changedFiles, fileSignature) : normalized.changedFiles;
    state.diffByFile = preserveSelection ? mergeCachedDiffs(normalized.diffByFile, state.diffByFile, state.changedFiles) : normalized.diffByFile;
    state.conflictState = normalized.conflictState;
    state.hiddenBranches = preserveSelection ? pruneHiddenBranches(state.hiddenBranches, normalized.localBranches) : new Set();
    state.hiddenRemoteBranches = preserveSelection ? pruneHiddenRemoteBranches(state.hiddenRemoteBranches, normalized.remotes) : new Set();
    state.selectedBranch = previousBranch || (state.repo.currentBranch);
    state.selectedCommitId = state.commits.some((commit) => commit.id === previousCommitId) ? previousCommitId : state.commits[0]?.id ?? '';

    if (!state.changedFiles.length) {
      state.selectedFile = '';
      state.selectedFileKey = '';
      state.selectedFileKeys = [];
      state.lastSelectedKey = '';
    } else {
      const nextFileSelection = resolveChangedFileSelection(state.changedFiles, previousFileSelection, { fallbackToFirst: !preserveSelection });
      if (nextFileSelection.file || !preserveSelection) {
        state.selectedFile = nextFileSelection.file?.path ?? '';
        state.selectedFileKey = nextFileSelection.key;
        state.selectedFileKeys = nextFileSelection.keys;
        state.lastSelectedKey = nextFileSelection.key;
      } else {
        state.selectedFile = previousFileSelection.path;
        state.selectedFileKey = previousFileSelection.key;
        state.selectedFileKeys = previousFileSelection.keys;
        state.lastSelectedKey = previousFileSelection.lastKey || previousFileSelection.key;
      }
    }
    state.repoPathInput = state.repositoryGroup?.group?.rootPath ?? state.repo.path;
    rememberRecentRepository(state.repositoryGroup?.group?.rootPath ?? state.repo.path);
    return true;
  }

  function captureRepositorySession() {
    return captureRepositoryTabSession({
      repositoryGroup: state.repositoryGroup,
      activeWorktreePath: state.activeWorktreePath,
      rootPath: state.repositoryGroup?.group?.rootPath ?? state.repo.path,
      repo: state.repo,
      localBranches: state.localBranches,
      remotes: state.remotes,
      tags: state.tags,
      stashes: state.stashes,
      commits: state.commits,
      changedFiles: state.changedFiles,
      diffByFile: state.diffByFile,
      conflictState: state.conflictState,
      activePage: state.activePage,
      selectedBranch: state.selectedBranch,
      selectedCommitId: state.selectedCommitId,
      hiddenBranches: state.hiddenBranches,
      hiddenRemoteBranches: state.hiddenRemoteBranches,
      selectedFile: state.selectedFile,
      selectedFileKey: state.selectedFileKey,
      selectedFileKeys: state.selectedFileKeys,
      lastSelectedKey: state.lastSelectedKey,
      collapsedTreeFolders: state.collapsedTreeFolders,
      commitSummary: state.commitSummary,
      commitDescription: state.commitDescription,
      amendCommit: state.amendCommit,
    });
  }

  function saveActiveRepositorySession() {
    state.openRepositoryTabs = updateRepositorySession(state.openRepositoryTabs, state.activeRepositoryTabId, captureRepositorySession());
  }

  function upsertActiveRepositorySession() {
    state.openRepositoryTabs = upsertRepositorySession(state.openRepositoryTabs, captureRepositorySession());
  }

  function loadRepositorySession(session) {
    if (!session) return;
    const next = normalizeRepositorySession(session, { fallbackAmend: state.preferences.amendBehavior === 'always' });
    state.repositoryGroup = next.repositoryGroup;
    state.activeWorktreePath = next.activeWorktreePath;
    state.repo = next.repo;
    state.localBranches = next.localBranches;
    state.remotes = next.remotes;
    state.tags = next.tags;
    state.stashes = next.stashes;
    state.commits = next.commits;
    state.changedFiles = next.changedFiles;
    state.diffByFile = next.diffByFile;
    state.conflictState = next.conflictState;
    state.activePage = next.activePage;
    state.selectedBranch = next.selectedBranch;
    state.selectedCommitId = next.selectedCommitId;
    state.hiddenBranches = next.hiddenBranches;
    state.hiddenRemoteBranches = next.hiddenRemoteBranches;
    state.selectedFile = next.selectedFile;
    state.selectedFileKey = next.selectedFileKey;
    state.selectedFileKeys = next.selectedFileKeys;
    state.lastSelectedKey = next.lastSelectedKey;
    state.collapsedTreeFolders = next.collapsedTreeFolders;
    state.commitSummary = next.commitSummary;
    state.commitDescription = next.commitDescription;
    state.amendCommit = next.amendCommit;
    state.repoPathInput = next.repoPathInput;
    state.hasLoadedRepo = true;
  }

  function watchActiveRepository(path) {
    if (!path || state.watchedRepositoryPath === path) return;
    unwatchRepository().catch(() => {});
    state.watchedRepositoryPath = path;
    watchRepository(path).catch(() => {});
  }

  function loadSettings() {
    return defaultAppSettings();
  }

  async function restoreOpenRepositories(paths, activePath) {
    if (state.actionBusy || state.isLoadingRepo) return;
    const restorePaths = uniqueRepositoryPaths(paths);
    if (!restorePaths.length) return;

    state.stateVersion += 1;
    state.isLoadingRepo = true;
    state.jobStatus = 'running';
    state.backendError = '';
    state.lastFailedOperation = null;
    state.backendStatus = restorePaths.length === 1 ? 'Restoring repository…' : `Restoring ${restorePaths.length} repositories…`;
    await yieldToPaint();

    const orderedPaths = [
      ...restorePaths.filter((path) => path === activePath),
      ...restorePaths.filter((path) => path !== activePath),
    ];
    const restoredSessions = [];
    const failedPaths = [];

    for (const path of orderedPaths) {
      try {
        const snapshot = await openAnyRepositorySnapshot(path);
        restoredSessions.push(createRepositorySessionFromSnapshot(snapshot));
        rememberRecentRepository(snapshot.repo?.path ?? path);
      } catch (error) {
        failedPaths.push({ path, error: String(error) });
      }
    }

    if (restoredSessions.length) {
      state.openRepositoryTabs = restoredSessions;
      const activeSession = restoredSessions.find((session) => session.path === activePath) ?? restoredSessions[0];
      state.activeRepositoryTabId = activeSession.id;
      loadRepositorySession(activeSession);
      watchActiveRepository(activeSession.rootPath ?? activeSession.path);
      state.lastRefreshAt = Date.now();
      state.backendStatus = failedPaths.length
        ? `Restored ${restoredSessions.length} repositories; ${failedPaths.length} failed`
        : `Restored ${restoredSessions.length} repositories`;
      state.backendError = failedPaths[0] ? `Unable to restore ${failedPaths[0].path}: ${failedPaths[0].error}` : '';
    } else {
      state.backendStatus = 'Choose a repository';
      state.backendError = failedPaths[0] ? `Unable to restore repositories: ${failedPaths[0].error}` : '';
      state.hasLoadedRepo = false;
    }

    state.isLoadingRepo = false;
    state.jobStatus = 'idle';
  }

  function createRepositorySessionFromSnapshot(snapshot) {
    const groupSnapshot = snapshot?.group ? normalizeRepositoryGroup(snapshot) : null;
    const normalized = normalizeSnapshot(snapshot);
    const currentRepo = normalized.repo;
    const firstChangedFile = normalized.changedFiles[0] ?? null;
    const firstChangedFileKey = firstChangedFile ? fileKey(firstChangedFile) : '';

    return captureRepositoryTabSession({
      repositoryGroup: groupSnapshot,
      activeWorktreePath: groupSnapshot ? currentRepo.path : '',
      rootPath: groupSnapshot?.group?.rootPath ?? currentRepo.path,
      repo: currentRepo,
      localBranches: normalized.localBranches,
      remotes: normalized.remotes,
      tags: normalized.tags,
      stashes: normalized.stashes,
      commits: normalized.commits,
      changedFiles: normalized.changedFiles,
      diffByFile: normalized.diffByFile,
      activePage: 'commits',
      selectedBranch: currentRepo.currentBranch,
      selectedCommitId: normalized.commits[0]?.id ?? '',
      selectedFile: firstChangedFile?.path ?? '',
      selectedFileKey: firstChangedFileKey,
      selectedFileKeys: firstChangedFileKey ? [firstChangedFileKey] : [],
      lastSelectedKey: firstChangedFileKey,
      collapsedTreeFolders: new Set(),
      commitSummary: '',
      commitDescription: '',
      amendCommit: state.preferences.amendBehavior === 'always',
    });
  }

  function currentOpenRepositoryPaths() {
    return uniqueRepositoryPaths([
      ...state.openRepositoryTabs.map((tab) => tab.rootPath ?? tab.path),
      state.hasLoadedRepo ? (state.repositoryGroup?.group?.rootPath ?? state.repo.path) : '',
    ]);
  }

  function persistAppSettings(
    nextAutoRefresh = state.autoRefresh,
    nextRecentRepoPaths = state.recentRepoPaths,
    nextRepoPathInput = state.repoPathInput,
    nextOpenRepoPaths = currentOpenRepositoryPaths(),
    nextActiveRepoPath = state.activeRepositoryTabId || (state.hasLoadedRepo ? state.repo.path : ''),
  ) {
    saveAppSettings({
      ...state.preferences,
      autoRefresh: nextAutoRefresh,
      recentRepoPaths: nextRecentRepoPaths,
      lastRepoPath: nextRepoPathInput,
      openRepoPaths: nextOpenRepoPaths,
      activeRepoPath: nextActiveRepoPath,
    }).catch(() => {});
  }

  function rememberRecentRepository(path) {
    state.recentRepoPaths = rememberRecentRepositoryPath(state.recentRepoPaths, path);
  }

  async function selectRepositoryTab(tabId) {
    if (!tabId || tabId === state.activeRepositoryTabId || state.actionBusy || state.isLoadingRepo) return;
    const groupRoot = state.repositoryGroup?.group?.rootPath;
    if (groupRoot && state.repositoryGroup?.worktrees?.some((worktree) => worktree.path === tabId)) {
      state.isLoadingRepo = true;
      state.jobStatus = 'running';
      state.backendError = '';
      state.backendStatus = 'Selecting worktree…';
      try {
        activateRepositorySnapshot(await selectWorktreeSnapshot(groupRoot, tabId), false);
        state.lastRefreshAt = Date.now();
        state.backendStatus = 'Worktree selected';
      } catch (error) {
        state.backendError = String(error);
        state.backendStatus = 'Worktree selection failed';
      } finally {
        state.isLoadingRepo = false;
        state.jobStatus = 'idle';
      }
      return;
    }
    saveActiveRepositorySession();
    const nextSession = state.openRepositoryTabs.find((tab) => tab.id === tabId);
    if (!nextSession) return;
    state.activeRepositoryTabId = tabId;
    loadRepositorySession(nextSession);
    watchActiveRepository(nextSession.path);
    state.backendError = '';
    state.backendStatus = 'Repository tab selected';
  }

  function reorderRepositoryTab(tabId, targetIndex) {
    if (!tabId || state.actionBusy || state.isLoadingRepo) return;
    const tabs = state.openRepositoryTabs.map((tab) => state.activeRepositoryTabId && tab.id === state.activeRepositoryTabId ? captureRepositorySession() : tab);
    const fromIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (fromIndex < 0) return;
    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, tabs.length - 1));
    if (fromIndex === boundedTargetIndex) return;

    const nextTabs = [...tabs];
    const [movedTab] = nextTabs.splice(fromIndex, 1);
    nextTabs.splice(boundedTargetIndex, 0, movedTab);
    state.openRepositoryTabs = nextTabs;
    state.backendStatus = 'Repository tabs reordered';
  }

  function closeRepositoryTab(tabId) {
    if (!tabId || state.actionBusy || state.isLoadingRepo) return;
    saveActiveRepositorySession();
    const closingIndex = state.openRepositoryTabs.findIndex((tab) => tab.id === tabId);
    if (closingIndex < 0) return;
    const nextTabs = state.openRepositoryTabs.filter((tab) => tab.id !== tabId);
    state.openRepositoryTabs = nextTabs;

    if (tabId !== state.activeRepositoryTabId) return;
    const nextSession = chooseNextRepositorySession(nextTabs, closingIndex);
    if (nextSession) {
      state.activeRepositoryTabId = nextSession.id;
      loadRepositorySession(nextSession);
      watchActiveRepository(nextSession.path);
    } else {
      state.activeRepositoryTabId = '';
      state.hasLoadedRepo = false;
      state.watchedRepositoryPath = '';
      state.backendStatus = 'Choose a repository';
      unwatchRepository().catch(() => {});
    }
  }

  return {
    activateRepositorySnapshot,
    applySnapshot,
    captureRepositorySession,
    closeRepositoryTab,
    cloneRepository,
    completeClone,
    currentOpenRepositoryPaths,
    loadRepositorySession,
    loadSettings,
    openRepository,
    prepareClone,
    persistAppSettings,
    rememberRecentRepository,
    reorderRepositoryTab,
    restoreOpenRepositories,
    saveActiveRepositorySession,
    selectRepositoryTab,
    upsertActiveRepositorySession,
    watchActiveRepository,
  };
}
