<script>
  import ConflictResolutionPage from './ConflictResolutionPage.svelte';
  import FileTree from './FileTree.svelte';
  import DiffViewer from './DiffViewer.svelte';
  import ResizeHandle from './ResizeHandle.svelte';
  import { PANE_SIZE_KEYS, RESIZE_HANDLE_SIZE, clampPaneSize, panePixels, readPaneSize, writePaneSize } from '../lib/paneSizing.js';

  /**
   * @typedef {Object} Props
   * @property {number} [unstagedCount]
   * @property {number} [stagedCount]
   * @property {any} [unstagedFiles]
   * @property {any} [stagedFiles]
   * @property {any} [unstagedRows]
   * @property {any} [stagedRows]
   * @property {any} [selectedFileKeys]
   * @property {string} [selectedSection]
   * @property {any} [selectedChangedFile]
   * @property {any[]} [selectedChangedFiles]
   * @property {any} [selectedDiffLines]
   * @property {string} [diffLoadingKey]
   * @property {string} [selectedDiffKey]
   * @property {any} [repo]
   * @property {any} [repositoryGroup]
   * @property {any} [conflictState]
   * @property {string} [commitSummary]
   * @property {string} [commitDescription]
   * @property {boolean} [amendCommit]
   * @property {any} [preferences]
   * @property {string} [actionBusy]
   * @property {boolean} [isLoadingRepo]
   * @property {() => void} [onRequestCloneRepository]
   * @property {any} onRunGitAction
   * @property {any} onRunSelectedGitAction
   * @property {any} onRunHunkGitAction
   * @property {() => void} [onCreateBranch]
   * @property {() => void} [onRequestCreateWorktree]
   * @property {any} [onLoadConflictPreview]
   * @property {any} [onOpenConflictExternal]
   * @property {any} [onMarkConflictResolved]
   * @property {any} [onContinueConflictOperation]
   * @property {any} [onAbortConflictOperation]
   * @property {any} onToggleFolder
   * @property {any} onSelectFile
   * @property {any} onSelectFolder
   * @property {any} onCommitChanges
   * @property {any} [onComposerFocusChange]
   * @property {any} onOpenContextMenu
   * @property {any} onCopyText
   * @property {any} [onOpenInspector]
   */

  /** @type {Props} */
  let {
    unstagedCount = 0,
    stagedCount = 0,
    unstagedFiles = [],
    stagedFiles = [],
    unstagedRows = [],
    stagedRows = [],
    selectedFileKeys = [],
    selectedSection = '',
    selectedChangedFile = null,
    selectedChangedFiles = [],
    selectedDiffLines = [],
    diffLoadingKey = '',
    selectedDiffKey = '',
    repo = null,
    repositoryGroup = null,
    conflictState = { active: false, files: [] },
    commitSummary = $bindable(''),
    commitDescription = $bindable(''),
    amendCommit = $bindable(false),
    preferences = {},
    actionBusy = '',
    isLoadingRepo = false,
    onRequestCloneRepository = () => {},
    onRunGitAction,
    onRunSelectedGitAction,
    onRunHunkGitAction,
    onCreateBranch = () => {},
    onRequestCreateWorktree = () => {},
    onLoadConflictPreview = async () => null,
    onOpenConflictExternal = () => {},
    onMarkConflictResolved = () => {},
    onContinueConflictOperation = () => {},
    onAbortConflictOperation = () => {},
    onToggleFolder,
    onSelectFile,
    onSelectFolder,
    onCommitChanges,
    onComposerFocusChange = () => {},
    onOpenContextMenu,
    onCopyText,
    onOpenInspector = () => {}
  } = $props();

  const CHANGES_LIST_DEFAULT_WIDTH = 330;
  const CHANGES_LIST_MIN_WIDTH = 240;
  const DIFF_PANE_MIN_WIDTH = 420;

  let fileFilter = $state('');
  let changesPageElement = $state(null);
  let changesListWidth = $state(readPaneSize(PANE_SIZE_KEYS.changesListWidth, CHANGES_LIST_DEFAULT_WIDTH));
  let changesPageStyle = $derived(`--changes-list-width: ${panePixels(changesListWidth)};`);

  let normalizedFileFilter = $derived(fileFilter.trim().toLowerCase());
  let filteredUnstagedRows = $derived(filterRows(unstagedRows, unstagedFiles, normalizedFileFilter));
  let filteredStagedRows = $derived(filterRows(stagedRows, stagedFiles, normalizedFileFilter));
  let filteredUnstagedCount = $derived(filteredUnstagedRows.filter((row) => row.type === 'file').length);
  let filteredStagedCount = $derived(filteredStagedRows.filter((row) => row.type === 'file').length);
  let hasAnyChanges = $derived(unstagedFiles.length + stagedFiles.length > 0);
  let hasFilteredMatches = $derived(filteredUnstagedCount + filteredStagedCount > 0);
  let hasStaleSelection = $derived(selectedFileKeys.length > 0 && !selectedChangedFile);
  let selectedChangeCount = $derived(selectedChangedFiles.length);
  let stageToggleLabel = $derived(selectedSection === 'staged' ? 'Unstage' : 'Stage');
  let stageToggleCommand = $derived(selectedSection === 'staged' ? 'git_unstage' : 'git_stage');
  let canToggleStage = $derived(selectedChangeCount > 0 && (selectedSection === 'staged' || selectedSection === 'unstaged') && !actionBusy);
  let showStageToggle = $derived(!!preferences?.showToolbarStageButton);
  let showStashButton = $derived(!!preferences?.showToolbarStashButton);

  const stashConfirmation = {
    confirmTitle: 'Stash working tree changes?',
    confirmMessage: 'This saves tracked and untracked changes to a Git stash, then leaves the working tree clean.',
    confirmLabel: 'Stash changes',
  };

  function filterRows(rows, files, query) {
    if (!query) return rows;
    return rows.filter((row) => {
      if (row.type === 'file') return row.file.path.toLowerCase().includes(query);
      const folderPath = `${row.path}/`.toLowerCase();
      return row.path.toLowerCase().includes(query) || files.some((file) => file.path.toLowerCase().startsWith(folderPath) && file.path.toLowerCase().includes(query));
    });
  }

  function getChangesListMaxWidth() {
    const availableWidth = changesPageElement?.getBoundingClientRect().width ?? CHANGES_LIST_DEFAULT_WIDTH + DIFF_PANE_MIN_WIDTH + RESIZE_HANDLE_SIZE;
    return Math.max(CHANGES_LIST_MIN_WIDTH, availableWidth - DIFF_PANE_MIN_WIDTH - RESIZE_HANDLE_SIZE);
  }

  function setChangesListWidth(nextWidth) {
    changesListWidth = clampPaneSize(nextWidth, CHANGES_LIST_MIN_WIDTH, getChangesListMaxWidth());
  }

  function persistChangesListWidth() {
    writePaneSize(PANE_SIZE_KEYS.changesListWidth, changesListWidth);
  }

  function resetChangesListWidth() {
    setChangesListWidth(CHANGES_LIST_DEFAULT_WIDTH);
  }
</script>

{#if conflictState?.active}
  <ConflictResolutionPage
    {repo}
    {conflictState}
    {actionBusy}
    onLoadConflictPreview={onLoadConflictPreview}
    onOpenConflictExternal={onOpenConflictExternal}
    onMarkConflictResolved={onMarkConflictResolved}
    onContinueConflictOperation={onContinueConflictOperation}
    onAbortConflictOperation={onAbortConflictOperation}
  />
{:else}
<div class="changes-page" bind:this={changesPageElement} style={changesPageStyle}>
  <section class="changes-list" aria-label="Changed files">
    <header class="pane-header">
      <div class="header-actions changes-filter-actions ui-header-actions">
        <label class="filter-field compact-filter"><span>⌕</span><input id="changed-file-filter-input" bind:value={fileFilter} placeholder="Filter files" aria-label="Filter changed files by path" /></label>
        {#if showStageToggle}
          <button class="ui-icon-button ui-compact-button git-icon-button compact-filter-action-button" class:stage-action={selectedSection !== 'staged'} class:unstage-action={selectedSection === 'staged'} type="button" disabled={!canToggleStage} aria-label={`${stageToggleLabel} selected files`} title={`${stageToggleLabel} selected ${selectedChangeCount === 1 ? 'file' : 'files'}`} onclick={() => onRunSelectedGitAction(stageToggleCommand, selectedSection, stageToggleLabel)}><span>{selectedSection === 'staged' ? '−' : '+'}</span></button>
        {/if}
        {#if showStashButton}
          <button class="ui-icon-button ui-compact-button git-icon-button compact-filter-action-button stash-action" type="button" disabled={!!actionBusy || !repo?.path} aria-label="Stash working tree changes" title="Stash working tree changes" onclick={() => onRunGitAction('git_stash', {}, 'Stash', stashConfirmation)}><span>↥</span></button>
        {/if}
      </div>
    </header>

    <div class="file-sections">
      <FileTree label="Unstaged" count={normalizedFileFilter ? filteredUnstagedCount : unstagedFiles.length} rows={filteredUnstagedRows} {selectedFileKeys} onToggleFolder={onToggleFolder} onSelectFile={onSelectFile} onSelectFolder={onSelectFolder} onOpenContextMenu={onOpenContextMenu} onRunSelectedGitAction={onRunSelectedGitAction} onCopyText={onCopyText} {onOpenInspector} />
      <FileTree label="Staged" count={normalizedFileFilter ? filteredStagedCount : stagedFiles.length} rows={filteredStagedRows} {selectedFileKeys} onToggleFolder={onToggleFolder} onSelectFile={onSelectFile} onSelectFolder={onSelectFolder} onOpenContextMenu={onOpenContextMenu} onRunSelectedGitAction={onRunSelectedGitAction} onCopyText={onCopyText} {onOpenInspector} />
      {#if !hasAnyChanges && !normalizedFileFilter}
        <div class="changes-empty-state" role="status">
          <strong>Working tree clean</strong>
          <span>No unstaged, staged, or untracked files are currently reported by Git. Make changes, switch branches, or refresh to update the workbench.</span>
        </div>
      {:else if normalizedFileFilter && !hasFilteredMatches}
        <div class="changes-empty-state" role="status">
          <strong>No files match “{fileFilter}”</strong>
          <span>Clear the filter to return to all staged and unstaged paths.</span>
        </div>
      {/if}
    </div>
  </section>

  <ResizeHandle
    orientation="vertical"
    label="Resize staged and unstaged files column"
    value={changesListWidth}
    min={CHANGES_LIST_MIN_WIDTH}
    getMax={getChangesListMaxWidth}
    onResize={setChangesListWidth}
    onResizeEnd={persistChangesListWidth}
    onReset={resetChangesListWidth}
  />

  <DiffViewer
    {selectedChangedFile}
    {selectedDiffLines}
    {diffLoadingKey}
    {selectedDiffKey}
    {hasStaleSelection}
    bind:commitSummary
    bind:commitDescription
    bind:amendCommit
    {preferences}
    {stagedCount}
    {actionBusy}
    onRunSelectedGitAction={onRunSelectedGitAction}
    onRunHunkGitAction={onRunHunkGitAction}
    onCommitChanges={onCommitChanges}
    onComposerFocusChange={onComposerFocusChange}
    onOpenContextMenu={onOpenContextMenu}
    onCopyText={onCopyText}
    {onOpenInspector}
  />
</div>
{/if}
