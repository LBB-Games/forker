/** @typedef {import('./types.js').RepoInfo} RepoInfo */
/** @typedef {import('./types.js').BranchInfo} BranchInfo */
/** @typedef {import('./types.js').ChangedFile} ChangedFile */
/** @typedef {import('./types.js').CommitInfo} CommitInfo */
/** @typedef {import('./types.js').DiffRow} DiffRow */
/** @typedef {import('./types.js').RepoSnapshot} RepoSnapshot */
/** @typedef {import('./types.js').JobStatus} JobStatus */
/** @typedef {import('./types.js').WorkspacePage} WorkspacePage */

import { tick } from 'svelte';
import { listen } from '@tauri-apps/api/event';
import { createRepositoryLifecycleController } from './appRepositoryController.svelte.js';
import { createSelectionController } from './appSelectionController.svelte.js';
import { loadPreferences, normalizePreferences, savePreferences as persistPreferences } from './preferences.js';
import { createThemeController } from './themeController.svelte.js';
import { createGlobalKeydownHandler, focusElement } from './appKeyboardShortcuts.js';
import { commitIdForBranch, commitIdForStash, pruneHiddenBranches, pruneHiddenRemoteBranches } from './branchVisibility.js';
import {
  fileKey,
  fileTreeRows,
  sectionFromKey,
  sortFilesByPath,
} from './fileTree.js';
import {
  commitFilesForTree,
  confirmationPreferenceForAction,
  describeBackendError,
  diffLinesForFile,
  emptyCommit,
  getBranchNameProblem,
  isBlockingAction,
  isNoUpstreamError,
  resolveSelectedChangedFile,
} from './appUtils.js';
import {
  cancelGitJob,
  loadAppSettings,
  loadCommitDetails as loadCommitDetailsFromGit,
  loadFileDiff,
  loadGitInstallation,
  loadConflictPreview as loadConflictPreviewFromGit,
  openExternalTool as openExternalToolFromGit,
  createWorktree as createWorktreeGroup,
  refreshRepositorySnapshot,
  removeWorktree as removeWorktreeGroup,
  selectWorktree as refreshWorktreeGroup,
  runGitCommand,
  unwatchRepository,
} from './gitClient.js';
import { createAppUpdateController } from './appUpdateController.svelte.js';
import { createOperationNoticeController } from './operationNoticeController.svelte.js';
import {
  captureScrollPositions,
  applyScrollPositions,
  createRepositoryRefreshScheduler,
  defaultAppSettings,
  shouldFetchFor,
  uniqueRepositoryPaths,
} from './repositorySession.js';
import { commitsReachableFromVisibleBranches } from './commitFilters.js';
import { buildCommandPaletteCommands } from './commandPalette.js';
import {
  batchCommandForFileAction,
  selectedFileActionPaths,
  shouldRunBatchFileAction,
} from './gitActionRouting.js';
import {
  initialChangedFiles,
  initialCommits,
  initialConflictState,
  initialDiffByFile,
  initialLocalBranches,
  initialRemotes,
  initialRepo,
  initialStashes,
  initialTags,
} from './mockData.js';

/**
 * Creates the app-wide controller for a single mounted workbench instance.
 *
 * This is intentionally a factory instead of a module singleton so tests or
 * future embedded shells can construct isolated repository sessions.
 */
export function createAppController() {
  const initialPreferences = loadPreferences();

  let repoPathInput = $state('');
  let recentRepoPaths = $state([]);
  let settingsLoaded = $state(false);
  let backendStatus = $state('Choose a repository');
  let backendError = $state('');
  let isLoadingRepo = $state(false);
  let hasLoadedRepo = $state(false);
  let repositoryGroup = $state(null);
  let activeWorktreePath = $state('');
  let openRepositoryTabs = $state([]);
  let activeRepositoryTabId = $state('');
  let watchedRepositoryPath = $state('');
  let showOpenRepositoryModal = $state(false);
  let showCloneRepositoryModal = $state(false);
  let showSettingsModal = $state(false);
  let showCommandPalette = $state(false);
  let showPushUpstreamModal = $state(false);
  let showCreateBranchModal = $state(false);
  let showCreateWorktreeModal = $state(false);
  let showResetBranchModal = $state(false);
  let autoRefresh = $state(defaultAppSettings().autoRefresh);
  let preferences = $state(initialPreferences);
  let gitInstallation = $state({ found: true, path: '', version: '', error: '' });

  /** @type {RepoInfo} */
  let repo = $state(initialRepo);
  /** @type {BranchInfo[]} */
  let localBranches = $state(initialLocalBranches);
  /** @type {string[]} */
  let remotes = $state(initialRemotes);
  /** @type {string[]} */
  let tags = $state(initialTags);
  /** @type {import('./types.js').StashInfo[]} */
  let stashes = $state(initialStashes);
  /** @type {CommitInfo[]} */
  let commits = $state(initialCommits);
  /** @type {ChangedFile[]} */
  let changedFiles = $state(initialChangedFiles);
  /** @type {Record<string, DiffRow[]>} */
  let diffByFile = $state(initialDiffByFile);
  /** @type {import('./types.js').ConflictState} */
  let conflictState = $state(initialConflictState);

  /** @type {WorkspacePage} */
  let activePage = $state('commits');
  let selectedBranch = $state('main');
  let selectedCommitId = $state('c8a12f4');
  let hiddenBranches = $state(new Set());
  let hiddenRemoteBranches = $state(new Set());
  let selectedFile = $state('src/App.svelte');
  let commitSummary = $state('');
  let commitDescription = $state('');
  let amendCommit = $state(initialPreferences.amendBehavior === 'always');
  let commitComposerFocused = $state(false);
  let branchName = $state('');
  let createBranchAttempted = $state(false);
  let resetTargetCommit = $state(null);
  let resetMode = $state('mixed');
  let actionBusy = $state('');
  let isRefreshing = $state(false);
  let refreshFeedbackVisible = $state(false);
  /** @type {JobStatus} */
  let jobStatus = $state('idle');
  let stateVersion = $state(0);
  let unlistenRepositoryChanged = $state(null);
  let lastRefreshAt = $state(0);
  let selectedFileKey = $state('');
  let selectedFileKeys = $state([]);
  let lastSelectedKey = $state('');
  let diffLoadingKey = $state('');
  let detailLoadingCommitId = $state('');
  let collapsedTreeFolders = $state(new Set());
  let contextMenu = $state(null);
  let confirmationDialog = $state(null);
  let activeInspector = $state(null);
  let pendingScrollRestore = $state(null);
  let lastFailedOperation = $state(null);
  let hasCleanedUp = $state(false);

  const themeController = createThemeController({
    getPreferences: () => preferences,
    setPreferences: (nextPreferences) => preferences = nextPreferences,
    persistPreferences,
  });

  const operationNoticeController = createOperationNoticeController();
  const { clearOperationNotice, showOperationNotice } = operationNoticeController;
  const appUpdateController = createAppUpdateController({
    showOperationNotice,
  });
  const {
    checkAppUpdate,
    dismissUpdatePrompt,
    runPassiveAppUpdateCheck,
  } = appUpdateController;

  const state = {};
  for (const [key, accessors] of Object.entries({
    repoPathInput: { get: () => repoPathInput, set: (value) => repoPathInput = value },
    recentRepoPaths: { get: () => recentRepoPaths, set: (value) => recentRepoPaths = value },
    settingsLoaded: { get: () => settingsLoaded, set: (value) => settingsLoaded = value },
    backendStatus: { get: () => backendStatus, set: (value) => backendStatus = value },
    backendError: { get: () => backendError, set: (value) => backendError = value },
    isLoadingRepo: { get: () => isLoadingRepo, set: (value) => isLoadingRepo = value },
    hasLoadedRepo: { get: () => hasLoadedRepo, set: (value) => hasLoadedRepo = value },
    repositoryGroup: { get: () => repositoryGroup, set: (value) => repositoryGroup = value },
    activeWorktreePath: { get: () => activeWorktreePath, set: (value) => activeWorktreePath = value },
    openRepositoryTabs: { get: () => openRepositoryTabs, set: (value) => openRepositoryTabs = value },
    activeRepositoryTabId: { get: () => activeRepositoryTabId, set: (value) => activeRepositoryTabId = value },
    watchedRepositoryPath: { get: () => watchedRepositoryPath, set: (value) => watchedRepositoryPath = value },
    showOpenRepositoryModal: { get: () => showOpenRepositoryModal, set: (value) => showOpenRepositoryModal = value },
    showCloneRepositoryModal: { get: () => showCloneRepositoryModal, set: (value) => showCloneRepositoryModal = value },
    showCreateWorktreeModal: { get: () => showCreateWorktreeModal, set: (value) => showCreateWorktreeModal = value },
    autoRefresh: { get: () => autoRefresh, set: (value) => autoRefresh = value },
    preferences: { get: () => preferences, set: (value) => preferences = value },
    repo: { get: () => repo, set: (value) => repo = value },
    localBranches: { get: () => localBranches, set: (value) => localBranches = value },
    remotes: { get: () => remotes, set: (value) => remotes = value },
    tags: { get: () => tags, set: (value) => tags = value },
    stashes: { get: () => stashes, set: (value) => stashes = value },
    commits: { get: () => commits, set: (value) => commits = value },
    changedFiles: { get: () => changedFiles, set: (value) => changedFiles = value },
    diffByFile: { get: () => diffByFile, set: (value) => diffByFile = value },
    conflictState: { get: () => conflictState, set: (value) => conflictState = value },
    activePage: { get: () => activePage, set: (value) => activePage = value },
    selectedBranch: { get: () => selectedBranch, set: (value) => selectedBranch = value },
    selectedCommitId: { get: () => selectedCommitId, set: (value) => selectedCommitId = value },
    hiddenBranches: { get: () => hiddenBranches, set: (value) => hiddenBranches = value },
    hiddenRemoteBranches: { get: () => hiddenRemoteBranches, set: (value) => hiddenRemoteBranches = value },
    selectedFile: { get: () => selectedFile, set: (value) => selectedFile = value },
    selectedFileKey: { get: () => selectedFileKey, set: (value) => selectedFileKey = value },
    selectedFileKeys: { get: () => selectedFileKeys, set: (value) => selectedFileKeys = value },
    lastSelectedKey: { get: () => lastSelectedKey, set: (value) => lastSelectedKey = value },
    collapsedTreeFolders: { get: () => collapsedTreeFolders, set: (value) => collapsedTreeFolders = value },
    commitSummary: { get: () => commitSummary, set: (value) => commitSummary = value },
    commitDescription: { get: () => commitDescription, set: (value) => commitDescription = value },
    amendCommit: { get: () => amendCommit, set: (value) => amendCommit = value },
    actionBusy: { get: () => actionBusy, set: (value) => actionBusy = value },
    isRefreshing: { get: () => isRefreshing, set: (value) => isRefreshing = value },
    jobStatus: { get: () => jobStatus, set: (value) => jobStatus = value },
    stateVersion: { get: () => stateVersion, set: (value) => stateVersion = value },
    lastRefreshAt: { get: () => lastRefreshAt, set: (value) => lastRefreshAt = value },
    lastFailedOperation: { get: () => lastFailedOperation, set: (value) => lastFailedOperation = value },
    selectedSection: { get: () => selectedSection },
    selectedChangedFiles: { get: () => selectedChangedFiles },
  })) {
    Object.defineProperty(state, key, { enumerable: true, get: accessors.get, set: accessors.set });
  }

  const repositoryController = createRepositoryLifecycleController(state, {
    runAutoFetch: (reason) => runAutoFetch(reason),
  });
  const {
    activateRepositorySnapshot,
    captureRepositorySession,
    closeRepositoryTab,
    cloneRepository,
    completeClone,
    currentOpenRepositoryPaths,
    openRepository,
    persistAppSettings,
    prepareClone,
    reorderRepositoryTab,
    restoreOpenRepositories,
    saveActiveRepositorySession,
    selectRepositoryTab,
    watchActiveRepository,
  } = repositoryController;

  const refreshScheduler = createRepositoryRefreshScheduler({
    getState: () => ({
      autoRefresh,
      preferences,
      lastRefreshAt,
      hasLoadedRepo,
      repoPath: repo.path,
      actionBusy,
      isLoadingRepo,
      isRefreshing,
      documentHidden: typeof document !== 'undefined' && document.hidden,
      pauseRefreshWhileEditing: preferences.pauseRefreshWhileEditing,
      commitComposerFocused,
    }),
    refreshRepository: (reason, updateRemotes) => refreshRepository(reason, updateRemotes),
  });

  let stagedCount = $derived(changedFiles.filter((file) => file.section === 'staged').length);
  let unstagedCount = $derived(changedFiles.filter((file) => file.section === 'unstaged').length);
  let visibleCommits = $derived(commitsReachableFromVisibleBranches(commits, localBranches, hiddenBranches, remotes, hiddenRemoteBranches));
  let selectedCommit = $derived(visibleCommits.find((commit) => commit.id === selectedCommitId) ?? visibleCommits[0] ?? emptyCommit(repo.currentBranch));
  let unstagedFiles = $derived(sortFilesByPath(changedFiles.filter((file) => file.section === 'unstaged')));
  let stagedFiles = $derived(sortFilesByPath(changedFiles.filter((file) => file.section === 'staged')));
  let unstagedRows = $derived(fileTreeRows(unstagedFiles, collapsedTreeFolders));
  let stagedRows = $derived(fileTreeRows(stagedFiles, collapsedTreeFolders));
  let selectedChangedFile = $derived(resolveSelectedChangedFile(changedFiles, selectedFileKey, selectedFileKeys, selectedFile, { fallbackToFirst: false }));
  let selectedSection = $derived(selectedFileKeys.length ? sectionFromKey(selectedFileKeys[0]) : selectedChangedFile?.section ?? '');
  let selectedChangedFiles = $derived.by(() => selectedFileKeys
    .map((key) => changedFiles.find((file) => fileKey(file) === key))
    .filter(Boolean)
    .filter((file) => file.section === selectedSection));
  const selectionController = createSelectionController(state, {
    runSelectedGitAction: (command, section, label) => runSelectedGitAction(command, section, label),
  });
  const {
    discardSelectedFileChanges,
    selectAllChangedFilesInSelectedSection,
    selectChangedFile,
    selectChangedFolder,
    selectFirstChangedFile,
    selectedFileStageCommand,
    toggleSelectedFileStage,
    toggleTreeFolder,
  } = selectionController;
  let selectedDiffLines = $derived(diffLinesForFile(selectedChangedFile, diffByFile));
  let selectedCommitFiles = $derived(commitFilesForTree(selectedCommit));
  let selectedCommitRows = $derived(fileTreeRows(sortFilesByPath(selectedCommitFiles), collapsedTreeFolders));
  let selectedDiffKey = $derived(selectedChangedFile ? fileKey(selectedChangedFile) : '');
  let modalOpen = $derived(showOpenRepositoryModal || showCloneRepositoryModal || showSettingsModal || showCommandPalette || showPushUpstreamModal || showCreateBranchModal || showCreateWorktreeModal || showResetBranchModal || !!confirmationDialog || !!activeInspector);
  let branchNameError = $derived(branchName.trim() || createBranchAttempted ? getBranchNameProblem(branchName) : '');
  let branchNameDescription = $derived(branchNameError ? 'branch-name-help branch-name-error' : 'branch-name-help');
  let canCreateBranch = $derived(!!branchName.trim() && !branchNameError && !actionBusy && !isLoadingRepo);
  let backendRecovery = $derived.by(() => {
    const recovery = describeBackendError(backendError);
    return {
      ...recovery,
      showForceDeleteBranch: !!recovery.showForceDeleteBranch && canForceDeleteBranchOperation(lastFailedOperation),
    };
  });
  let visibleRefreshBusy = $derived(isRefreshing && refreshFeedbackVisible);
  let showBlockingBusyOverlay = $derived(hasLoadedRepo && (isLoadingRepo || isBlockingAction(actionBusy)));
  let showNonBlockingBusyToast = $derived(hasLoadedRepo && actionBusy && !showBlockingBusyOverlay);
  let repoTabs = $derived.by(() => openRepositoryTabs.map((tab) => activeRepositoryTabId && tab.id === activeRepositoryTabId ? captureRepositorySession() : tab));
  let shellState = $derived.by(() => ({ repo, repositoryGroup, activeWorktreePath, repoTabs, activeRepositoryTabId, commits, remotes, tags, stashes, localBranches, activePage, selectedBranch, selectedCommitId, hiddenBranches, hiddenRemoteBranches, conflictState, hasLoadedRepo, modalOpen }));
  let changesState = $derived.by(() => ({ unstagedCount, stagedCount, unstagedFiles, stagedFiles, unstagedRows, stagedRows, selectedFileKeys, selectedSection, selectedChangedFile, selectedChangedFiles, selectedDiffLines, diffLoadingKey, selectedDiffKey, conflictState }));
  let commitsState = $derived.by(() => ({ selectedCommit, selectedCommitFiles, selectedCommitRows }));
  let backendState = $derived.by(() => ({ actionBusy, isLoadingRepo, isRefreshing: visibleRefreshBusy, isBackgroundRefreshing: isRefreshing && !refreshFeedbackVisible, backendError, backendRecovery, lastFailedOperation, operationNotice: operationNoticeController.operationNotice, backendStatus, jobStatus, lastRefreshAt, appUpdate: appUpdateController.appUpdate, showBlockingBusyOverlay, showNonBlockingBusyToast }));
  let inspectorContext = $derived.by(() => ({ changedFiles, selectedChangedFile, selectedDiffLines, selectedDiffKey, diffLoadingKey, commits, stashes, localBranches, remotes }));
  let commandPaletteCommands = $derived.by(() => buildCommandPaletteCommands({
    state: {
      repo,
      hasLoadedRepo,
      selectedBranch,
      activePage,
      selectedChangedFiles,
      selectedChangedFile,
      selectedSection,
      selectedCommit,
      stashes,
      remotes,
      stagedCount,
      commitSummary,
      actionBusy,
      isRefreshing,
      isLoadingRepo,
      stageCommand: selectedFileStageCommand(),
    },
    actions: {
      requestOpenRepository,
      requestCloneRepository,
      refreshRepository,
      runGitAction,
      runSelectedGitAction,
      discardSelectedFileChanges,
      commitChanges,
      createBranch,
      openSettings: requestSettings,
      selectPage,
      focusControl: focusWorkspaceControl,
      openInspector,
    },
  }));
  let workbenchActions = $derived.by(() => ({
    onRequestOpenRepository: requestOpenRepository,
    onRequestCloneRepository: requestCloneRepository,
    onRequestSettings: requestSettings,
    onRequestCommandPalette: requestCommandPalette,
    onSelectRepositoryTab: selectRepositoryTab,
    onCloseRepositoryTab: closeRepositoryTab,
    onReorderRepositoryTab: reorderRepositoryTab,
    onOpenExternalTool: openExternalTool,
    onPublishUpstream: confirmPushUpstream,
    onOpenRepositoryPicker: openRepositoryPickerFromError,
    onForceDeleteBranch: forceDeleteLastFailedBranch,
    onRetry: retryLastFailure,
    onCopy: copyText,
    onDismissError: clearBackendError,
    onSelectPage: selectPage,
    onSelectBranch: selectBranch,
    onSelectStash: selectStash,
    onOpenContextMenu: openContextMenu,
    onOpenInspector: openInspector,
    onRunGitAction: runGitAction,
    onRefreshRepository: refreshRepository,
    onCreateBranch: createBranch,
    onCreateWorktreeFromBranch: createWorktreeFromBranch,
    onRequestCreateWorktree: requestCreateWorktree,
    onRequestRemoveWorktree: requestRemoveWorktree,
    onRunSelectedGitAction: runSelectedGitAction,
    onRunHunkGitAction: runHunkGitAction,
    onLoadConflictPreview: loadConflictPreview,
    onOpenConflictExternal: openConflictExternal,
    onMarkConflictResolved: markConflictResolved,
    onContinueConflictOperation: continueConflictOperation,
    onAbortConflictOperation: abortConflictOperation,
    onToggleFolder: toggleTreeFolder,
    onSelectFile: selectChangedFile,
    onSelectFolder: selectChangedFolder,
    onCommitChanges: commitChanges,
    onComposerFocusChange: (focused) => commitComposerFocused = focused,
    onSelectCommit: selectCommit,
    onToggleBranchVisibility: toggleBranchVisibility,
    onToggleRemoteBranchVisibility: toggleRemoteBranchVisibility,
    onShowAllBranches: showAllBranches,
    onRequestResetBranch: requestResetBranch,
    onCancelJob: cancelCurrentJob,
  }));

  const handleGlobalKeydown = createGlobalKeydownHandler({
    getState: () => ({ modalOpen, showCommandPalette, activePage }),
    actions: {
      openCommandPalette: requestCommandPalette,
      openCloneRepository: requestCloneRepository,
      openRepository: requestOpenRepository,
      refreshRepository: () => refreshRepository('Manual refresh'),
      commitChanges,
      showChangesPage: () => selectPage('changes'),
      showCommitsPage: () => selectPage('commits'),
      toggleSelectedFileStage,
      discardSelectedFileChanges,
      selectAllChangedFilesInSelectedSection,
    },
  });

  $effect(() => {
    if (settingsLoaded) persistAppSettings(autoRefresh, recentRepoPaths, repoPathInput, currentOpenRepositoryPaths(), activeRepositoryTabId || (hasLoadedRepo ? repo.path : ''));
  });
  $effect(() => {
    if (!changedFiles.length) {
      if (selectedFile || selectedFileKey || selectedFileKeys.length || lastSelectedKey) {
        selectedFile = '';
        selectedFileKey = '';
        selectedFileKeys = [];
        lastSelectedKey = '';
      }
      return;
    }

    if (!selectedChangedFile && !selectedFile && !selectedFileKey && !selectedFileKeys.length) selectFirstChangedFile();
  });
  $effect(() => {
    if (hasLoadedRepo && selectedChangedFile && !conflictState?.active) loadDiffForFile(selectedChangedFile);
  });
  $effect(() => {
    if (hasLoadedRepo && selectedCommit?.id && !selectedCommit.detailsLoaded) loadCommitDetails(selectedCommit.id);
  });
  $effect(() => {
    if (!hasLoadedRepo || activePage !== 'commits') return;
    if (!visibleCommits.length) {
      selectedCommitId = '';
      return;
    }
    if (!visibleCommits.some((commit) => commit.id === selectedCommitId)) selectedCommitId = visibleCommits[0]?.id ?? '';
  });
  $effect(() => {
    if (!commitSummary && !commitDescription && preferences.commitMessageTemplate) applyCommitTemplate(preferences.commitMessageTemplate);
  });

  function mount() {
    initializeAppSettings().then(() => initializeGitInstallation());
    runPassiveAppUpdateCheck();

    listen('repository-changed', (event) => {
      if (!event.detail?.path || event.detail.path === repo.path) {
        scheduleBackgroundRefresh(event.detail?.reason ?? 'Repository changed');
      }
    }).then((unlisten) => {
      if (hasCleanedUp) {
        unlisten();
      } else {
        unlistenRepositoryChanged = unlisten;
      }
    }).catch(() => {});

    const handleFocusRefresh = () => handleAppFocus('Window focus');
    const handleVisibilityRefresh = () => {
      if (!document.hidden) handleAppFocus('Window visible');
    };

    window.addEventListener('focus', handleFocusRefresh);
    window.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    resetRefreshTimer();

    return () => cleanupAppSubscriptions(handleFocusRefresh, handleVisibilityRefresh);
  }

  function cleanupAppSubscriptions(handleFocusRefresh, handleVisibilityRefresh) {
    if (hasCleanedUp) return;
    hasCleanedUp = true;
    if (handleFocusRefresh) window.removeEventListener('focus', handleFocusRefresh);
    window.removeEventListener('keydown', handleGlobalKeydown);
    if (handleVisibilityRefresh) document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    refreshScheduler.clear();
    clearOperationNotice();
    if (unlistenRepositoryChanged) {
      unlistenRepositoryChanged();
      unlistenRepositoryChanged = null;
    }
    unwatchRepository().catch(() => {});
  }

  function clearBackendError() {
    backendError = '';
  }

  function diffContextLineCount() {
    const value = Number.parseInt(String(preferences.diffContextLines ?? '3'), 10);
    return Number.isFinite(value) ? Math.max(0, Math.min(20, value)) : 3;
  }

  function keepOnlySelectedDiffCache(file) {
    const key = file ? fileKey(file) : '';
    const cachedLines = key ? (diffByFile[key] ?? diffByFile[file.path]) : null;
    diffByFile = cachedLines ? { [key]: cachedLines } : {};
  }

  async function loadDiffForFile(file, options = {}) {
    if (!repo.path || !file?.path) return;

    const { force = false, quiet = false } = options;
    const key = fileKey(file);
    if (diffLoadingKey === key) return;
    if (!force && (diffByFile[key] || diffByFile[file.path])) return;

    const repoPath = repo.path;
    const requestVersion = stateVersion;
    diffLoadingKey = key;

    try {
      const lines = await loadFileDiff(repoPath, file.path, file.section === 'staged', file.status, diffContextLineCount());
      if (repo.path !== repoPath || requestVersion !== stateVersion) return;
      diffByFile = { ...diffByFile, [key]: Array.isArray(lines) ? lines : [] };
      if (!quiet && !backendError) backendStatus = `Loaded diff for ${file.path}`;
    } catch (error) {
      if (repo.path !== repoPath || requestVersion !== stateVersion) return;
      const message = String(error);
      const hasExistingDiff = !!(diffByFile[key] || diffByFile[file.path]);
      if (!quiet || !hasExistingDiff) {
        diffByFile = { ...diffByFile, [key]: [{ type: 'meta', left: '', right: '', text: `Diff unavailable: ${message}`, hunkIndex: null }] };
      }
      if (!quiet) {
        backendError = message;
        backendStatus = `Load diff failed for ${file.path}`;
      }
    } finally {
      if (diffLoadingKey === key) diffLoadingKey = '';
    }
  }

  function requestOpenRepository() {
    clearBackendError();
    showOpenRepositoryModal = true;
  }

  function requestCloneRepository() {
    clearBackendError();
    showCloneRepositoryModal = true;
  }

  function requestSettings() {
    showSettingsModal = true;
    if (appUpdate.status === 'idle') checkAppUpdate();
  }

  function requestCommandPalette() {
    showCommandPalette = true;
  }

  function openInspector(type, params = {}) {
    if (!repo.path || !type) return;
    closeContextMenu();
    showCommandPalette = false;
    activeInspector = {
      type,
      repoPath: repo.path,
      params: { ...params },
    };
  }

  function closeInspector() {
    activeInspector = null;
  }

  function selectPage(page) {
    activePage = page;
  }

  function handleThemeFamilyChange(nextThemeFamily) {
    themeController.setThemeFamily(nextThemeFamily);
  }

  function handleThemeAppearanceChange(nextThemeAppearance) {
    themeController.setThemeAppearance(nextThemeAppearance);
  }

  function handlePreferencesChange(nextPreferences) {
    const previousContext = preferences.diffContextLines;
    preferences = normalizePreferences(nextPreferences);
    autoRefresh = preferences.autoRefresh;
    if (preferences.amendBehavior === 'always') amendCommit = true;
    if (previousContext !== preferences.diffContextLines) diffByFile = {};
    persistPreferences(preferences);
    persistAppSettings(autoRefresh, recentRepoPaths, repoPathInput);
    resetRefreshTimer();
  }

  function shouldConfirmRisk(key) {
    return preferences?.[key] !== false;
  }

  async function initializeGitInstallation() {
    try {
      gitInstallation = await loadGitInstallation();
      if (gitInstallation?.found && gitInstallation.version) {
        backendStatus = gitInstallation.path ? `${gitInstallation.version} · ${gitInstallation.path}` : gitInstallation.version;
      } else if (gitInstallation?.error) {
        backendStatus = 'Git is required';
        backendError = gitInstallation.error;
      }
    } catch {
      // Browser-only mode cannot inspect system Git.
    }
  }

  async function initializeAppSettings() {
    try {
      const settings = await loadAppSettings();
      autoRefresh = settings.autoRefresh ?? settings.auto_refresh ?? true;
      recentRepoPaths = settings.recentRepoPaths ?? settings.recent_repo_paths ?? [];
      repoPathInput = settings.lastRepoPath ?? settings.last_repo_path ?? '';
      preferences = normalizePreferences({ ...preferences, ...settings, autoRefresh });
      preferences = normalizePreferences(preferences);

      const openRepoPaths = uniqueRepositoryPaths(settings.openRepoPaths ?? settings.open_repo_paths ?? []);
      const activeRepoPath = settings.activeRepoPath ?? settings.active_repo_path ?? repoPathInput;
      if (openRepoPaths.length) {
        await restoreOpenRepositories(openRepoPaths, activeRepoPath);
      } else if (repoPathInput) {
        await openRepository(repoPathInput);
      }
    } catch {
      // Browser-only mode keeps the initial defaults.
    }
    settingsLoaded = true;
  }

  function focusWorkspaceControl(page, selector) {
    selectPage(page);
    focusElement(selector);
  }

  function safeWorktreeName(branchName) {
    return String(branchName || '').replace(/^origin\//, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'worktree';
  }

  function requestCreateWorktree() {
    if (!repositoryGroup?.group?.rootPath) return;
    showCreateWorktreeModal = true;
  }

  async function createWorktreeFromBranch(branchName, startPoint = null) {
    const groupRoot = repositoryGroup?.group?.rootPath;
    if (!groupRoot || !branchName || actionBusy || isLoadingRepo) return;
    const localBranch = String(branchName).replace(/^origin\//, '');
    const worktreeName = safeWorktreeName(localBranch);
    stateVersion += 1;
    actionBusy = 'Create worktree';
    jobStatus = 'running';
    backendError = '';
    clearOperationNotice();
    backendStatus = 'Creating worktree…';
    await yieldToPaint();
    try {
      activateRepositorySnapshot(await createWorktreeGroup(groupRoot, localBranch, worktreeName, startPoint), false);
      stateVersion += 1;
      lastRefreshAt = Date.now();
      backendStatus = 'Worktree created';
      showCreateWorktreeModal = false;
      showOperationNotice('Worktree created', 'success');
    } catch (error) {
      backendError = String(error);
      backendStatus = 'Create worktree failed';
      lastFailedOperation = { type: 'create-worktree', branchName, startPoint };
    } finally {
      actionBusy = '';
      jobStatus = 'idle';
    }
  }

  function worktreeDisplayName(worktree) {
    return worktree?.name || String(worktree?.path || '').split(/[\\/]/).filter(Boolean).at(-1) || worktree?.path || 'worktree';
  }

  async function requestRemoveWorktree(worktree = null) {
    const groupRoot = repositoryGroup?.group?.rootPath;
    const worktrees = repositoryGroup?.worktrees ?? [];
    const target = worktree ?? worktrees.find((item) => item.path === (activeWorktreePath || repo.path));
    if (!groupRoot || !target?.path || worktrees.length <= 1 || actionBusy || isLoadingRepo) return;

    const dirtyCount = target.dirtyCount ?? 0;
    const force = dirtyCount > 0;
    const confirmed = await requestConfirmation({
      title: `Delete worktree ${worktreeDisplayName(target)}?`,
      message: force
        ? `This worktree has ${dirtyCount} changed file(s). Deleting it will discard those local changes.`
        : 'This removes the local worktree folder. The branch and commits remain in the repository.',
      confirmLabel: force ? 'Delete and discard changes' : 'Delete worktree',
      confirmItems: [target.path],
      danger: true,
    });
    if (!confirmed) return;

    stateVersion += 1;
    actionBusy = 'Delete worktree';
    jobStatus = 'running';
    backendError = '';
    clearOperationNotice();
    backendStatus = 'Deleting worktree…';
    await yieldToPaint();
    try {
      activateRepositorySnapshot(await removeWorktreeGroup(groupRoot, target.path, force), false);
      stateVersion += 1;
      lastRefreshAt = Date.now();
      backendStatus = 'Worktree deleted';
      showOperationNotice('Worktree deleted', 'success');
    } catch (error) {
      backendError = String(error);
      backendStatus = 'Delete worktree failed';
      lastFailedOperation = { type: 'delete-worktree', worktreePath: target.path };
      await refreshSnapshotAfterFailedGit();
    } finally {
      actionBusy = '';
      jobStatus = 'idle';
    }
  }

  async function runGitCommandSnapshot(command, args = {}) {
    const snapshot = await runGitCommand(command, repo.path, args);
    if (repositoryGroup?.group?.rootPath && activeWorktreePath) {
      return refreshWorktreeGroup(repositoryGroup.group.rootPath, activeWorktreePath);
    }
    return snapshot;
  }

  async function runGitAction(command, args = {}, label = command, options = {}) {
    closeContextMenu();
    if (!repo.path || actionBusy || isLoadingRepo) return;
    if (command === 'git_push' && !repo.hasUpstream) {
      showPushUpstreamModal = true;
      return;
    }
    if (options.confirmMessage) {
      const confirmationPreference = confirmationPreferenceForAction(command, options);
      if (options.alwaysConfirm || !confirmationPreference || shouldConfirmRisk(confirmationPreference)) {
        const confirmed = await requestConfirmation({
          title: options.confirmTitle ?? 'Confirm destructive action',
          message: options.confirmMessage,
          confirmLabel: options.confirmLabel ?? label,
          items: options.confirmItems ?? [],
          danger: options.danger ?? command.includes('discard'),
        });
        if (!confirmed) return;
      }
    }
    stateVersion += 1;
    actionBusy = label;
    jobStatus = 'running';
    backendError = '';
    clearOperationNotice();
    lastFailedOperation = null;
    backendStatus = `${label}…`;
    await yieldToPaint();
    try {
      activateRepositorySnapshot(await runGitCommandSnapshot(command, args));
      stateVersion += 1;
      lastRefreshAt = Date.now();
      lastFailedOperation = null;
      backendStatus = `${label} complete`;
      showOperationNotice(`${label} complete`, 'success');
    } catch (error) {
      lastFailedOperation = { type: 'action', command, args, label, options };
      if (command === 'git_push' && isNoUpstreamError(error)) {
        showPushUpstreamModal = true;
        backendStatus = 'Push needs an upstream';
        showOperationNotice('Push needs an upstream', 'warning');
      } else {
        backendError = String(error);
        backendStatus = `${label} failed`;
        showOperationNotice(`${label} failed`, 'error');
      }
      await refreshSnapshotAfterFailedGit();
    } finally {
      actionBusy = '';
      jobStatus = 'idle';
    }
  }

  function requestConfirmation(details) {
    return new Promise((resolve) => {
      confirmationDialog = { ...details, resolve };
    });
  }

  function closeConfirmationDialog(result = false) {
    confirmationDialog?.resolve(result);
    confirmationDialog = null;
  }

  async function confirmPushUpstream() {
    showPushUpstreamModal = false;
    await runGitAction('git_push_upstream', {}, 'Publish branch');
  }

  async function cancelCurrentJob() {
    if (jobStatus !== 'running' && jobStatus !== 'refreshing') return;
    if (shouldConfirmRisk('confirmCancelOperations')) {
      const confirmed = await requestConfirmation({
        title: 'Cancel running Git operation?',
        message: 'Forker will ask the backend job to stop. Git may still finish the current process step before the cancellation takes effect.',
        confirmLabel: 'Cancel operation',
        danger: true,
      });
      if (!confirmed) return;
    }

    jobStatus = 'cancelling';
    backendStatus = 'Cancelling operation…';
    try {
      const status = await cancelGitJob();
      backendStatus = status?.cancelRequested ? 'Cancellation requested' : 'No running operation to cancel';
      showOperationNotice(backendStatus, status?.cancelRequested ? 'warning' : 'success');
    } catch (error) {
      backendError = String(error);
      backendStatus = 'Cancel failed';
      showOperationNotice('Cancel failed', 'error');
    }
  }

  function resetRefreshTimer() {
    refreshScheduler.reset();
  }

  function handleAppFocus(reason) {
    if (shouldFetchFor(preferences, 'focus')) {
      scheduleBackgroundRefresh('Auto-fetch on focus', true);
    } else if (preferences.refreshOnFocus) {
      scheduleBackgroundRefresh(reason);
    }
  }

  async function runAutoFetch(reason) {
    if (!repo.path || actionBusy || isLoadingRepo || isRefreshing) return;
    await refreshRepository(reason, true);
  }

  function scheduleBackgroundRefresh(reason = 'Refresh', updateRemotes = false) {
    refreshScheduler.schedule(reason, updateRemotes);
  }

  async function loadCommitDetails(commitId) {
    if (!repo.path || !commitId || detailLoadingCommitId === commitId) return;

    detailLoadingCommitId = commitId;
    try {
      const details = await loadCommitDetailsFromGit(repo.path, commitId);
      commits = commits.map((commit) => {
        if (commit.id !== commitId) return commit;
        return {
          ...commit,
          ...details,
          detailsLoaded: true,
          changedPaths: details.changedPaths ?? commit.changedPaths ?? [],
        };
      });
    } catch (error) {
      backendError = String(error);
      backendStatus = 'Commit details failed';
      commits = commits.map((commit) => commit.id === commitId ? { ...commit, detailsLoaded: true } : commit);
    } finally {
      if (detailLoadingCommitId === commitId) detailLoadingCommitId = '';
    }
  }

  async function yieldToPaint() {
    await tick();
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function restoreScrollPositions(positions) {
    await tick();
    applyScrollPositions(positions);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    applyScrollPositions(positions);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    applyScrollPositions(positions);
  }

  async function refreshRepository(reason = 'Refresh', updateRemotes = reason === 'Manual refresh') {
    if (!repo.path || actionBusy || isRefreshing || isLoadingRepo) return;
    const showRefreshFeedback = reason === 'Manual refresh';
    const scrollPositions = captureScrollPositions();
    pendingScrollRestore = scrollPositions;
    const refreshVersion = stateVersion;
    isRefreshing = true;
    refreshFeedbackVisible = showRefreshFeedback;
    if (showRefreshFeedback) {
      jobStatus = 'refreshing';
      backendStatus = `${reason}…`;
      clearOperationNotice();
      await yieldToPaint();
    }
    backendError = '';
    lastFailedOperation = null;
    try {
      const snapshot = repositoryGroup?.group?.rootPath && activeWorktreePath
        ? await refreshWorktreeGroup(repositoryGroup.group.rootPath, activeWorktreePath)
        : await refreshRepositorySnapshot(repo.path, updateRemotes);
      if (refreshVersion === stateVersion && !actionBusy) {
        const snapshotApplied = activateRepositorySnapshot(snapshot);
        if (snapshotApplied) await restoreScrollPositions(scrollPositions);
        lastRefreshAt = Date.now();
        lastFailedOperation = null;
        if (showRefreshFeedback) {
          backendStatus = `${reason} complete`;
          showOperationNotice('Refresh complete', 'success');
        }
        if (!showRefreshFeedback) {
          keepOnlySelectedDiffCache(selectedChangedFile);
          if (selectedChangedFile) loadDiffForFile(selectedChangedFile, { force: true, quiet: true });
        }
      } else if (showRefreshFeedback) {
        backendStatus = `${reason} skipped; repository changed`;
      }
    } catch (error) {
      backendError = String(error);
      lastFailedOperation = { type: 'refresh', reason };
      backendStatus = `${reason} failed`;
      if (showRefreshFeedback) showOperationNotice('Refresh failed', 'error');
    } finally {
      isRefreshing = false;
      refreshFeedbackVisible = false;
      if (showRefreshFeedback) jobStatus = actionBusy ? 'running' : 'idle';
    }
  }

  async function commitChanges() {
    if (!commitSummary.trim()) return;
    if (preferences.autoStagePreference === 'all') {
      await runGitAction('git_stage', { filePath: null }, 'Auto-stage');
      if (backendError) return;
    } else if (preferences.autoStagePreference === 'tracked') {
      await runGitAction('git_stage_tracked', {}, 'Auto-stage tracked');
      if (backendError) return;
    }
    await runGitAction('git_commit', { summary: commitSummary, description: commitDescription, amend: amendCommit, sign: preferences.signCommits }, amendCommit ? 'Amend commit' : 'Commit');
    if (!backendError) {
      commitSummary = '';
      commitDescription = '';
      if (preferences.amendBehavior !== 'always') amendCommit = false;
    }
  }

  async function runSelectedGitAction(command, section, label) {
    const paths = selectedFileActionPaths({ selectedFileKeys, changedFiles, section });

    if (!paths.length) return;

    if (command === 'git_discard' && shouldConfirmRisk('confirmDiscardChanges')) {
      const confirmed = await requestConfirmation({
        title: paths.length === 1 ? 'Discard file changes?' : `Discard changes in ${paths.length} files?`,
        message: 'This permanently removes unstaged changes from the working tree and cannot be undone by this app.',
        confirmLabel: 'Discard changes',
        items: paths,
        danger: true,
      });
      if (!confirmed) return;
    }

    if (shouldRunBatchFileAction(command, paths)) {
      await runGitBatchAction(command, paths, label);
      return;
    }

    await runGitAction(command, { filePath: paths[0] }, label);
  }

  async function runGitBatchAction(command, paths, label) {
    closeContextMenu();
    const batchCommand = batchCommandForFileAction(command);

    if (!batchCommand || !paths.length || !repo.path || actionBusy || isLoadingRepo) return;

    stateVersion += 1;
    actionBusy = paths.length > 1 ? `${label} ${paths.length} files` : label;
    jobStatus = 'running';
    backendError = '';
    clearOperationNotice();
    lastFailedOperation = null;
    backendStatus = `${actionBusy}…`;
    await yieldToPaint();
    try {
      activateRepositorySnapshot(await runGitCommandSnapshot(batchCommand, { filePaths: paths }));
      stateVersion += 1;
      lastRefreshAt = Date.now();
      lastFailedOperation = null;
      backendStatus = `${actionBusy} complete`;
      showOperationNotice(`${actionBusy} complete`, 'success');
    } catch (error) {
      backendError = String(error);
      lastFailedOperation = { type: 'batch-action', command, paths, label };
      backendStatus = `${actionBusy} failed`;
      showOperationNotice(`${actionBusy} failed`, 'error');
      await refreshSnapshotAfterFailedGit();
    } finally {
      actionBusy = '';
      jobStatus = 'idle';
    }
  }

  async function runHunkGitAction(command, file, hunkIndex, label) {
    if (!file || hunkIndex === null || hunkIndex === undefined) return;
    await runGitAction(command, { filePath: file.path, hunkIndex }, label);
  }

  function openContextMenu(event, items = []) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget?.getBoundingClientRect?.();
    const fallbackX = rect ? rect.left + Math.min(32, rect.width) : 0;
    const fallbackY = rect ? rect.top + Math.min(28, rect.height) : 0;
    const clientX = event.clientX || fallbackX;
    const clientY = event.clientY || fallbackY;
    contextMenu = {
      x: Math.min(clientX, window.innerWidth - 250),
      y: Math.min(clientY, window.innerHeight - 220),
      items: items.filter(Boolean),
    };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function applyCommitTemplate(template) {
    const [summary = '', ...body] = String(template || '').split('\n');
    commitSummary = summary;
    commitDescription = body.join('\n').trimStart();
  }

  async function refreshSnapshotAfterFailedGit() {
    if (!repo.path) return;
    try {
      const snapshot = await refreshRepositorySnapshot(repo.path, false);
      activateRepositorySnapshot(snapshot);
      lastRefreshAt = Date.now();
      const nextConflictState = snapshot.conflictState;
      if (nextConflictState?.active) activePage = 'changes';
    } catch {
      // Keep the original Git error visible; a best-effort refresh should not replace it.
    }
  }

  async function openExternalTool(kind, filePath = null) {
    const commandTemplate = kind === 'terminal' ? preferences.preferredTerminal : preferences.preferredEditor;
    if (!commandTemplate.trim()) {
      backendError = `Set a preferred ${kind} command in Settings first.`;
      backendStatus = `No ${kind} command configured`;
      return;
    }
    try {
      await openExternalToolFromGit(commandTemplate, repo.path, filePath);
      backendStatus = filePath ? `Opened ${filePath} in ${kind}` : `Opened ${kind}`;
    } catch (error) {
      backendError = String(error);
      backendStatus = `Open ${kind} failed`;
    }
  }

  async function loadConflictPreview(filePath) {
    if (!repo.path || !filePath) return null;
    return loadConflictPreviewFromGit(repo.path, filePath);
  }

  async function openConflictExternal(filePath) {
    await openExternalTool('editor', filePath);
  }

  async function markConflictResolved(filePath) {
    if (!filePath) return;
    await runGitAction('git_mark_conflict_resolved', { filePath }, 'Mark resolved');
  }

  async function continueConflictOperation() {
    const label = conflictState?.operationLabel ?? 'operation';
    await runGitAction('git_conflict_continue', {}, `Continue ${label.toLowerCase()}`);
  }

  async function abortConflictOperation() {
    const label = conflictState?.operationLabel ?? 'operation';
    await runGitAction('git_conflict_abort', {}, `Abort ${label.toLowerCase()}`, {
      confirmTitle: `Abort ${label.toLowerCase()}?`,
      confirmMessage: 'Aborting asks Git to roll back the in-progress operation. Any conflict resolutions or manual edits made during this operation may be overwritten or removed.',
      confirmLabel: `Abort ${label.toLowerCase()}`,
      confirmItems: (conflictState?.files ?? []).map((file) => file.path),
      danger: true,
      alwaysConfirm: true,
    });
  }

  async function copyText(text) {
    if (!text) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      backendStatus = 'Copied to clipboard';
    } catch {
      backendStatus = 'Copy failed; select the text manually';
    }
  }

  function canForceDeleteBranchOperation(operation) {
    return operation?.type === 'action' && operation.command === 'git_delete_branch' && !operation.args?.remote && !!operation.args?.branchName;
  }

  async function forceDeleteLastFailedBranch() {
    const operation = lastFailedOperation;
    if (!canForceDeleteBranchOperation(operation)) return;
    const branchName = operation.args.branchName;
    await runGitAction('git_delete_branch', { ...operation.args, force: true }, 'Force delete branch', {
      confirmTitle: `Force delete local branch ${branchName}?`,
      confirmMessage: 'This deletes the branch even though Git says it is not fully merged. Commits reachable only from this branch may become hard to recover.',
      confirmLabel: 'Force delete branch',
      confirmItems: [branchName],
      danger: true,
      alwaysConfirm: true,
    });
  }

  async function retryLastFailure() {
    const operation = lastFailedOperation;
    if (!operation) return;
    if (operation.type === 'open') {
      await openRepository(operation.path);
    } else if (operation.type === 'clone') {
      await cloneRepository(operation.remoteUrl, operation.parentPath, operation.directoryName ?? '');
    } else if (operation.type === 'refresh') {
      await refreshRepository(operation.reason);
    } else if (operation.type === 'action') {
      await runGitAction(operation.command, operation.args, operation.label, operation.options);
    } else if (operation.type === 'batch-action') {
      await runGitBatchAction(operation.command, operation.paths, operation.label);
    }
  }

  function openRepositoryPickerFromError() {
    backendError = '';
    showOpenRepositoryModal = true;
  }

  function createBranch() {
    closeContextMenu();
    branchName = preferences.defaultBranchName || '';
    createBranchAttempted = false;
    showCreateBranchModal = true;
  }

  function closeCreateBranchModal() {
    showCreateBranchModal = false;
    branchName = '';
    createBranchAttempted = false;
  }

  function requestResetBranch(commit) {
    resetTargetCommit = commit;
    resetMode = 'mixed';
    showResetBranchModal = true;
  }

  function closeResetBranchModal() {
    showResetBranchModal = false;
    resetTargetCommit = null;
    resetMode = 'mixed';
  }

  async function confirmResetBranch() {
    if (!resetTargetCommit?.id) return;
    const target = resetTargetCommit.id;
    const mode = resetMode;
    const branch = repo.currentBranch;
    closeResetBranchModal();
    await runGitAction('git_reset_branch', { target, mode }, 'Reset branch', {
      confirmationPreference: 'confirmResetBranch',
      confirmTitle: `Reset ${branch} to ${target.slice(0, 8)}?`,
      confirmMessage: mode === 'hard'
        ? 'Hard reset moves the branch and permanently discards working tree and staged changes that conflict with the target.'
        : 'This moves the current branch pointer. Review the selected reset mode before continuing.',
      confirmLabel: 'Reset branch',
      confirmItems: [`${branch} → ${target.slice(0, 12)}`, `mode: ${mode}`],
      danger: true,
    });
  }

  async function confirmCreateBranch() {
    createBranchAttempted = true;
    const name = branchName.trim();
    const problem = getBranchNameProblem(name);
    if (problem || actionBusy || isLoadingRepo) return;
    showCreateBranchModal = false;
    branchName = '';
    createBranchAttempted = false;
    await runGitAction('git_create_branch', { name, checkout: preferences.checkoutAfterCreate }, 'Create branch');
  }

  function selectBranch(branchName) {
    selectedBranch = branchName;
    activePage = 'commits';
    if (hiddenBranches.has(branchName)) {
      const next = new Set(hiddenBranches);
      next.delete(branchName);
      hiddenBranches = next;
    }
    if (hiddenRemoteBranches.has(branchName)) {
      const next = new Set(hiddenRemoteBranches);
      next.delete(branchName);
      hiddenRemoteBranches = next;
    }
    selectedCommitId = commitIdForBranch(commits, branchName);
  }

  function selectStash(stash) {
    if (!stash) return;
    selectedBranch = stash.reference;
    activePage = 'commits';
    selectedCommitId = commitIdForStash(commits, stash);
  }

  function selectCommit(commitId) {
    selectedCommitId = commitId;
    selectedBranch = commits.find((commit) => commit.id === commitId)?.branch ?? selectedBranch;
  }

  function toggleBranchVisibility(branchName) {
    if (!branchName) return;
    const next = new Set(hiddenBranches);
    if (next.has(branchName)) next.delete(branchName);
    else next.add(branchName);
    hiddenBranches = pruneHiddenBranches(next, localBranches);
  }

  function toggleRemoteBranchVisibility(branchName) {
    if (!branchName) return;
    const next = new Set(hiddenRemoteBranches);
    if (next.has(branchName)) next.delete(branchName);
    else next.add(branchName);
    hiddenRemoteBranches = pruneHiddenRemoteBranches(next, remotes);
  }

  function showAllBranches() {
    hiddenBranches = new Set();
    hiddenRemoteBranches = new Set();
  }

  function confirmCreateWorktree(branchName, startPoint = null) {
    createWorktreeFromBranch(branchName, startPoint);
  }

  function requestCloneRepositoryFromOpenScreen() {
    showCloneRepositoryModal = true;
  }

  return {
    mount,
    get hasLoadedRepo() { return hasLoadedRepo; },
    get repoPathInput() { return repoPathInput; },
    set repoPathInput(value) { repoPathInput = value; },
    get isLoadingRepo() { return isLoadingRepo; },
    get backendError() { return backendError; },
    get gitInstallation() { return gitInstallation; },
    get appUpdate() { return appUpdateController.appUpdate; },
    get showUpdatePrompt() { return appUpdateController.showUpdatePrompt; },
    get preferences() { return preferences; },
    get shellState() { return shellState; },
    get changesState() { return changesState; },
    get commitsState() { return commitsState; },
    get backendState() { return backendState; },
    get workbenchActions() { return workbenchActions; },
    get commitSummary() { return commitSummary; },
    set commitSummary(value) { commitSummary = value; },
    get commitDescription() { return commitDescription; },
    set commitDescription(value) { commitDescription = value; },
    get amendCommit() { return amendCommit; },
    set amendCommit(value) { amendCommit = value; },
    get repo() { return repo; },
    get repositoryGroup() { return repositoryGroup; },
    get activeWorktreePath() { return activeWorktreePath; },
    get autoRefresh() { return autoRefresh; },
    set autoRefresh(value) { autoRefresh = value; },
    get themeFamily() { return themeController.family; },
    get themeAppearance() { return themeController.appearance; },
    get resolvedThemeMode() { return themeController.mode; },
    get contextMenu() { return contextMenu; },
    get confirmationDialog() { return confirmationDialog; },
    get activeInspector() { return activeInspector; },
    get inspectorContext() { return inspectorContext; },
    get commandPaletteCommands() { return commandPaletteCommands; },
    get showCommandPalette() { return showCommandPalette; },
    set showCommandPalette(value) { showCommandPalette = value; },
    get showOpenRepositoryModal() { return showOpenRepositoryModal; },
    set showOpenRepositoryModal(value) { showOpenRepositoryModal = value; },
    get showCloneRepositoryModal() { return showCloneRepositoryModal; },
    set showCloneRepositoryModal(value) { showCloneRepositoryModal = value; },
    get showSettingsModal() { return showSettingsModal; },
    set showSettingsModal(value) { showSettingsModal = value; },
    get showCreateBranchModal() { return showCreateBranchModal; },
    set showCreateBranchModal(value) { showCreateBranchModal = value; },
    get showCreateWorktreeModal() { return showCreateWorktreeModal; },
    set showCreateWorktreeModal(value) { showCreateWorktreeModal = value; },
    get showResetBranchModal() { return showResetBranchModal; },
    set showResetBranchModal(value) { showResetBranchModal = value; },
    get showPushUpstreamModal() { return showPushUpstreamModal; },
    set showPushUpstreamModal(value) { showPushUpstreamModal = value; },
    get branchName() { return branchName; },
    set branchName(value) { branchName = value; },
    get branchNameError() { return branchNameError; },
    get branchNameDescription() { return branchNameDescription; },
    get canCreateBranch() { return canCreateBranch; },
    get resetTargetCommit() { return resetTargetCommit; },
    get resetMode() { return resetMode; },
    set resetMode(value) { resetMode = value; },
    requestCloneRepositoryFromOpenScreen,
    closeContextMenu,
    openInspector,
    closeInspector,
    copyText,
    openRepository,
    cloneRepository,
    prepareClone,
    completeClone,
    handleThemeFamilyChange,
    handleThemeAppearanceChange,
    handlePreferencesChange,
    checkAppUpdate,
    dismissUpdatePrompt,
    closeConfirmationDialog,
    confirmCreateBranch,
    closeCreateBranchModal,
    confirmCreateWorktree,
    confirmResetBranch,
    closeResetBranchModal,
    confirmPushUpstream,
  };
}
