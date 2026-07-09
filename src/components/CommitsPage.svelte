<script>
  import CommitLog from './CommitLog.svelte';
  import CommitDetails from './CommitDetails.svelte';
  import ResizeHandle from './ResizeHandle.svelte';
  import { PANE_SIZE_KEYS, RESIZE_HANDLE_SIZE, clampPaneSize, panePixels, readPaneSize, writePaneSize } from '../lib/paneSizing.js';

  /**
   * @typedef {Object} Props
   * @property {any} [commits]
   * @property {string} [selectedBranch]
   * @property {string} [selectedCommitId]
   * @property {any[]} [localBranches]
   * @property {Set<string>} [hiddenBranches]
   * @property {string[]} [remotes]
   * @property {Set<string>} [hiddenRemoteBranches]
   * @property {any} selectedCommit
   * @property {any} [selectedCommitFiles]
   * @property {any} [selectedCommitRows]
   * @property {string} [actionBusy]
   * @property {any} onSelectCommit
   * @property {any} onShowAllBranches
   * @property {any} onRunGitAction
   * @property {any} onRequestResetBranch
   * @property {any} onToggleFolder
   * @property {any} onOpenContextMenu
   * @property {any} onCopyText
   * @property {any} [onOpenInspector]
   */

  /** @type {Props} */
  let {
    commits = [],
    selectedBranch = '',
    selectedCommitId = '',
    localBranches = [],
    hiddenBranches = new Set(),
    remotes = [],
    hiddenRemoteBranches = new Set(),
    selectedCommit,
    selectedCommitFiles = [],
    selectedCommitRows = [],
    actionBusy = '',
    onSelectCommit,
    onShowAllBranches,
    onRunGitAction,
    onRequestResetBranch,
    onToggleFolder,
    onOpenContextMenu,
    onCopyText,
    onOpenInspector = () => {}
  } = $props();

  const COMMIT_DETAILS_DEFAULT_HEIGHT = 300;
  const COMMIT_DETAILS_MIN_HEIGHT = 180;
  const COMMIT_LOG_MIN_HEIGHT = 220;

  let commitsPageElement;
  let commitDetailsHeight = $state(readPaneSize(PANE_SIZE_KEYS.commitDetailsHeight, COMMIT_DETAILS_DEFAULT_HEIGHT));
  let commitsPageStyle = $derived(`--commit-details-height: ${panePixels(commitDetailsHeight)};`);

  function getCommitDetailsMaxHeight() {
    const availableHeight = commitsPageElement?.getBoundingClientRect().height ?? COMMIT_DETAILS_DEFAULT_HEIGHT + COMMIT_LOG_MIN_HEIGHT + RESIZE_HANDLE_SIZE;
    return Math.max(COMMIT_DETAILS_MIN_HEIGHT, availableHeight - COMMIT_LOG_MIN_HEIGHT - RESIZE_HANDLE_SIZE);
  }

  function setCommitDetailsHeight(nextHeight) {
    commitDetailsHeight = clampPaneSize(nextHeight, COMMIT_DETAILS_MIN_HEIGHT, getCommitDetailsMaxHeight());
  }

  function persistCommitDetailsHeight() {
    writePaneSize(PANE_SIZE_KEYS.commitDetailsHeight, commitDetailsHeight);
  }

  function resetCommitDetailsHeight() {
    setCommitDetailsHeight(COMMIT_DETAILS_DEFAULT_HEIGHT);
  }
</script>

<div class="commits-page" bind:this={commitsPageElement} style={commitsPageStyle}>
  <CommitLog {commits} {selectedBranch} {selectedCommitId} {localBranches} {hiddenBranches} {remotes} {hiddenRemoteBranches} {actionBusy} onSelectCommit={onSelectCommit} onShowAllBranches={onShowAllBranches} onRunGitAction={onRunGitAction} onRequestResetBranch={onRequestResetBranch} onOpenContextMenu={onOpenContextMenu} onCopyText={onCopyText} {onOpenInspector} />
  <ResizeHandle
    orientation="horizontal"
    label="Resize commit details pane"
    value={commitDetailsHeight}
    min={COMMIT_DETAILS_MIN_HEIGHT}
    direction={-1}
    getMax={getCommitDetailsMaxHeight}
    onResize={setCommitDetailsHeight}
    onResizeEnd={persistCommitDetailsHeight}
    onReset={resetCommitDetailsHeight}
  />
  <CommitDetails {selectedCommit} {selectedCommitFiles} {selectedCommitRows} {actionBusy} onRunGitAction={onRunGitAction} onRequestResetBranch={onRequestResetBranch} onToggleFolder={onToggleFolder} onOpenContextMenu={onOpenContextMenu} onCopyText={onCopyText} {onOpenInspector} />
</div>
