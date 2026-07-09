<script>
  import BackendBanner from './BackendBanner.svelte';
  import BusyStatus from './BusyStatus.svelte';
  import ChangesPage from './ChangesPage.svelte';
  import CommitsPage from './CommitsPage.svelte';
  import GitToolbar from './GitToolbar.svelte';
  import ResizeHandle from './ResizeHandle.svelte';
  import Sidebar from './Sidebar.svelte';
  import StatusBar from './StatusBar.svelte';
  import TitleBar from './TitleBar.svelte';
  import { PANE_SIZE_KEYS, RESIZE_HANDLE_SIZE, clampPaneSize, panePixels, readPaneSize, writePaneSize } from '../lib/paneSizing.js';

  let {
    shellState = {},
    changesState = {},
    commitsState = {},
    backendState = {},
    actions = {},
    commitSummary = $bindable(''),
    commitDescription = $bindable(''),
    amendCommit = $bindable(false),
    preferences,
  } = $props();

  let repo = $derived(shellState.repo);
  let repositoryGroup = $derived(shellState.repositoryGroup ?? null);
  let activeWorktreePath = $derived(shellState.activeWorktreePath ?? '');
  let repoTabs = $derived(shellState.repoTabs ?? []);
  let activeRepositoryTabId = $derived(shellState.activeRepositoryTabId ?? '');
  let commits = $derived(shellState.commits ?? []);
  let remotes = $derived(shellState.remotes ?? []);
  let tags = $derived(shellState.tags ?? []);
  let stashes = $derived(shellState.stashes ?? []);
  let localBranches = $derived(shellState.localBranches ?? []);
  let activePage = $derived(shellState.activePage ?? 'commits');
  let selectedBranch = $derived(shellState.selectedBranch ?? '');
  let selectedCommitId = $derived(shellState.selectedCommitId ?? '');
  let hiddenBranches = $derived(shellState.hiddenBranches ?? new Set());
  let hiddenRemoteBranches = $derived(shellState.hiddenRemoteBranches ?? new Set());
  let hasLoadedRepo = $derived(shellState.hasLoadedRepo ?? false);
  let modalOpen = $derived(shellState.modalOpen ?? false);
  let conflictState = $derived(shellState.conflictState ?? changesState.conflictState ?? { active: false, files: [] });

  let selectedCommit = $derived(commitsState.selectedCommit);
  let selectedCommitFiles = $derived(commitsState.selectedCommitFiles ?? []);
  let selectedCommitRows = $derived(commitsState.selectedCommitRows ?? []);

  let unstagedCount = $derived(changesState.unstagedCount ?? 0);
  let stagedCount = $derived(changesState.stagedCount ?? 0);
  let unstagedFiles = $derived(changesState.unstagedFiles ?? []);
  let stagedFiles = $derived(changesState.stagedFiles ?? []);
  let unstagedRows = $derived(changesState.unstagedRows ?? []);
  let stagedRows = $derived(changesState.stagedRows ?? []);
  let selectedFileKeys = $derived(changesState.selectedFileKeys ?? []);
  let selectedSection = $derived(changesState.selectedSection ?? '');
  let selectedChangedFile = $derived(changesState.selectedChangedFile);
  let selectedChangedFiles = $derived(changesState.selectedChangedFiles ?? []);
  let selectedDiffLines = $derived(changesState.selectedDiffLines ?? []);
  let diffLoadingKey = $derived(changesState.diffLoadingKey ?? '');
  let selectedDiffKey = $derived(changesState.selectedDiffKey ?? '');

  let actionBusy = $derived(backendState.actionBusy ?? '');
  let isLoadingRepo = $derived(backendState.isLoadingRepo ?? false);
  let isRefreshing = $derived(backendState.isRefreshing ?? false);
  let backendError = $derived(backendState.backendError ?? '');
  let backendRecovery = $derived(backendState.backendRecovery);
  let lastFailedOperation = $derived(backendState.lastFailedOperation ?? null);
  let operationNotice = $derived(backendState.operationNotice ?? null);
  let backendStatus = $derived(backendState.backendStatus ?? '');
  let jobStatus = $derived(backendState.jobStatus ?? 'idle');
  let lastRefreshAt = $derived(backendState.lastRefreshAt ?? 0);
  let appUpdate = $derived(backendState.appUpdate ?? null);
  let showBlockingBusyOverlay = $derived(backendState.showBlockingBusyOverlay ?? false);
  let showNonBlockingBusyToast = $derived(backendState.showNonBlockingBusyToast ?? false);

  let onRequestOpenRepository = $derived(actions.onRequestOpenRepository ?? (() => {}));
  let onRequestCloneRepository = $derived(actions.onRequestCloneRepository ?? (() => {}));
  let onRequestSettings = $derived(actions.onRequestSettings ?? (() => {}));
  let onRequestCommandPalette = $derived(actions.onRequestCommandPalette ?? (() => {}));
  let onSelectRepositoryTab = $derived(actions.onSelectRepositoryTab ?? (() => {}));
  let onCloseRepositoryTab = $derived(actions.onCloseRepositoryTab ?? (() => {}));
  let onReorderRepositoryTab = $derived(actions.onReorderRepositoryTab ?? (() => {}));
  let onOpenExternalTool = $derived(actions.onOpenExternalTool ?? (() => {}));
  let onPublishUpstream = $derived(actions.onPublishUpstream ?? (() => {}));
  let onOpenRepositoryPicker = $derived(actions.onOpenRepositoryPicker ?? (() => {}));
  let onForceDeleteBranch = $derived(actions.onForceDeleteBranch ?? (() => {}));
  let onRetry = $derived(actions.onRetry ?? (() => {}));
  let onCopy = $derived(actions.onCopy ?? (() => {}));
  let onDismissError = $derived(actions.onDismissError ?? (() => {}));
  let onSelectPage = $derived(actions.onSelectPage ?? (() => {}));
  let onSelectBranch = $derived(actions.onSelectBranch ?? (() => {}));
  let onSelectStash = $derived(actions.onSelectStash ?? (() => {}));
  let onOpenContextMenu = $derived(actions.onOpenContextMenu ?? (() => {}));
  let onOpenInspector = $derived(actions.onOpenInspector ?? (() => {}));
  let onRunGitAction = $derived(actions.onRunGitAction ?? (() => {}));
  let onRefreshRepository = $derived(actions.onRefreshRepository ?? (() => {}));
  let onCreateBranch = $derived(actions.onCreateBranch ?? (() => {}));
  let onCreateWorktreeFromBranch = $derived(actions.onCreateWorktreeFromBranch ?? (() => {}));
  let onRequestCreateWorktree = $derived(actions.onRequestCreateWorktree ?? (() => {}));
  let onRequestRemoveWorktree = $derived(actions.onRequestRemoveWorktree ?? (() => {}));
  let onRunSelectedGitAction = $derived(actions.onRunSelectedGitAction ?? (() => {}));
  let onRunHunkGitAction = $derived(actions.onRunHunkGitAction ?? (() => {}));
  let onLoadConflictPreview = $derived(actions.onLoadConflictPreview ?? (async () => null));
  let onOpenConflictExternal = $derived(actions.onOpenConflictExternal ?? (() => {}));
  let onMarkConflictResolved = $derived(actions.onMarkConflictResolved ?? (() => {}));
  let onContinueConflictOperation = $derived(actions.onContinueConflictOperation ?? (() => {}));
  let onAbortConflictOperation = $derived(actions.onAbortConflictOperation ?? (() => {}));
  let onToggleFolder = $derived(actions.onToggleFolder ?? (() => {}));
  let onSelectFile = $derived(actions.onSelectFile ?? (() => {}));
  let onSelectFolder = $derived(actions.onSelectFolder ?? (() => {}));
  let onCommitChanges = $derived(actions.onCommitChanges ?? (() => {}));
  let onComposerFocusChange = $derived(actions.onComposerFocusChange ?? (() => {}));
  let onSelectCommit = $derived(actions.onSelectCommit ?? (() => {}));
  let onToggleBranchVisibility = $derived(actions.onToggleBranchVisibility ?? (() => {}));
  let onToggleRemoteBranchVisibility = $derived(actions.onToggleRemoteBranchVisibility ?? (() => {}));
  let onShowAllBranches = $derived(actions.onShowAllBranches ?? (() => {}));
  let onRequestResetBranch = $derived(actions.onRequestResetBranch ?? (() => {}));
  let onCancelJob = $derived(actions.onCancelJob ?? (() => {}));

  const SIDEBAR_DEFAULT_WIDTH = 268;
  const SIDEBAR_MIN_WIDTH = 200;
  const MAIN_PANE_MIN_WIDTH = 640;

  let workbenchElement;
  let sidebarWidth = $state(readPaneSize(PANE_SIZE_KEYS.sidebarWidth, SIDEBAR_DEFAULT_WIDTH));
  let sidebarStyle = $derived(`--sidebar-width: ${panePixels(sidebarWidth)};`);

  function getSidebarMaxWidth() {
    const availableWidth = workbenchElement?.getBoundingClientRect().width ?? SIDEBAR_DEFAULT_WIDTH + MAIN_PANE_MIN_WIDTH + RESIZE_HANDLE_SIZE;
    return Math.max(SIDEBAR_MIN_WIDTH, availableWidth - MAIN_PANE_MIN_WIDTH - RESIZE_HANDLE_SIZE);
  }

  function setSidebarWidth(nextWidth) {
    sidebarWidth = clampPaneSize(nextWidth, SIDEBAR_MIN_WIDTH, getSidebarMaxWidth());
  }

  function persistSidebarWidth() {
    writePaneSize(PANE_SIZE_KEYS.sidebarWidth, sidebarWidth);
  }

  function resetSidebarWidth() {
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
  }
</script>

<div class="app-shell" class:dimmed={!hasLoadedRepo} class:modalOpen={modalOpen} inert={!hasLoadedRepo || modalOpen} aria-hidden={!hasLoadedRepo || modalOpen ? 'true' : undefined}>
  <TitleBar
    {repo}
    {repositoryGroup}
    {activeWorktreePath}
    {repoTabs}
    {activeRepositoryTabId}
    {activePage}
    {selectedSection}
    {selectedChangedFiles}
    {actionBusy}
    {isLoadingRepo}
    {preferences}
    {onRequestOpenRepository}
    {onRequestSettings}
    {onRequestCommandPalette}
    {onOpenExternalTool}
    {onRequestCloneRepository}
    {onRunGitAction}
    {onRunSelectedGitAction}
    {onCreateBranch}
    {onRequestCreateWorktree}
    {onOpenContextMenu}
    {onOpenInspector}
    {onSelectRepositoryTab}
    {onCloseRepositoryTab}
    {onReorderRepositoryTab}
  />

  <BackendBanner {backendError} {backendRecovery} {lastFailedOperation} onPublishUpstream={onPublishUpstream} onOpenRepositoryPicker={onOpenRepositoryPicker} onForceDeleteBranch={onForceDeleteBranch} onRetry={onRetry} onCopy={onCopy} onDismiss={onDismissError} />

  <main class="workbench" bind:this={workbenchElement} style={sidebarStyle}>
    <Sidebar {repo} {repositoryGroup} {activeWorktreePath} {commits} {remotes} {tags} {stashes} {localBranches} {hiddenBranches} {hiddenRemoteBranches} {activePage} {selectedBranch} {appUpdate} {conflictState} onSelectPage={onSelectPage} onSelectBranch={onSelectBranch} onSelectStash={onSelectStash} onSelectWorktree={onSelectRepositoryTab} onCreateWorktreeFromBranch={onCreateWorktreeFromBranch} onRequestCreateWorktree={onRequestCreateWorktree} onRequestRemoveWorktree={onRequestRemoveWorktree} onToggleBranchVisibility={onToggleBranchVisibility} onToggleRemoteBranchVisibility={onToggleRemoteBranchVisibility} onOpenContextMenu={onOpenContextMenu} onOpenInspector={onOpenInspector} onRunGitAction={onRunGitAction} onRequestSettings={onRequestSettings} />
    <ResizeHandle
      orientation="vertical"
      label="Resize repository sidebar"
      value={sidebarWidth}
      min={SIDEBAR_MIN_WIDTH}
      getMax={getSidebarMaxWidth}
      onResize={setSidebarWidth}
      onResizeEnd={persistSidebarWidth}
      onReset={resetSidebarWidth}
    />

    <section class="main-pane" aria-label={activePage === 'changes' ? 'Changes page' : 'Commits page'}>
      <GitToolbar
        {repo}
        {repositoryGroup}
        {activePage}
        {selectedSection}
        {selectedChangedFiles}
        {actionBusy}
        {isLoadingRepo}
        {isRefreshing}
        {preferences}
        {onRefreshRepository}
        {onRunGitAction}
        {onRunSelectedGitAction}
        {onCreateBranch}
        {onOpenInspector}
      />
      {#if activePage === 'changes'}
        <ChangesPage
          {unstagedCount}
          {stagedCount}
          {unstagedFiles}
          {stagedFiles}
          {unstagedRows}
          {stagedRows}
          {selectedFileKeys}
          {selectedSection}
          {selectedChangedFile}
          {selectedChangedFiles}
          {selectedDiffLines}
          {diffLoadingKey}
          {selectedDiffKey}
          {repo}
          {repositoryGroup}
          {conflictState}
          bind:commitSummary
          bind:commitDescription
          bind:amendCommit
          {preferences}
          {actionBusy}
          {isLoadingRepo}
          onRequestCloneRepository={onRequestCloneRepository}
          onRunGitAction={onRunGitAction}
          onRunSelectedGitAction={onRunSelectedGitAction}
          onRunHunkGitAction={onRunHunkGitAction}
          onCreateBranch={onCreateBranch}
          onRequestCreateWorktree={onRequestCreateWorktree}
          onLoadConflictPreview={onLoadConflictPreview}
          onOpenConflictExternal={onOpenConflictExternal}
          onMarkConflictResolved={onMarkConflictResolved}
          onContinueConflictOperation={onContinueConflictOperation}
          onAbortConflictOperation={onAbortConflictOperation}
          onToggleFolder={onToggleFolder}
          onSelectFile={onSelectFile}
          onSelectFolder={onSelectFolder}
          onCommitChanges={onCommitChanges}
          onComposerFocusChange={onComposerFocusChange}
          onOpenContextMenu={onOpenContextMenu}
          onCopyText={onCopy}
          onOpenInspector={onOpenInspector}
        />
      {:else}
        <CommitsPage
          {commits}
          {selectedBranch}
          {selectedCommitId}
          {localBranches}
          {hiddenBranches}
          {remotes}
          {hiddenRemoteBranches}
          {selectedCommit}
          {selectedCommitFiles}
          {selectedCommitRows}
          {actionBusy}
          onSelectCommit={onSelectCommit}
          onShowAllBranches={onShowAllBranches}
          onRunGitAction={onRunGitAction}
          onRequestResetBranch={onRequestResetBranch}
          onToggleFolder={onToggleFolder}
          onOpenContextMenu={onOpenContextMenu}
          onCopyText={onCopy}
          onOpenInspector={onOpenInspector}
        />
      {/if}
    </section>
  </main>

  <StatusBar {repo} {backendStatus} {jobStatus} {lastRefreshAt} {conflictState} onCancelJob={onCancelJob} />
</div>

<BusyStatus {actionBusy} notice={operationNotice} showBlocking={showBlockingBusyOverlay} showToast={showNonBlockingBusyToast} />
