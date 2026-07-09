<script>
  /**
   * @typedef {import('../lib/types.js').RepoInfo} RepoInfo
   *
   * @typedef {Object} Props
   * @property {RepoInfo} repo
   * @property {any} [repositoryGroup]
   * @property {string} [activePage]
   * @property {string} [selectedSection]
   * @property {any[]} [selectedChangedFiles]
   * @property {string} [actionBusy]
   * @property {boolean} [isLoadingRepo]
   * @property {() => void} [onRequestCloneRepository]
   * @property {(command: string, args: object, label: string, options?: object) => void | Promise<void>} [onRunGitAction]
   * @property {(command: string, section: string, label: string) => void | Promise<void>} [onRunSelectedGitAction]
   * @property {() => void} [onCreateBranch]
   * @property {() => void} [onRequestCreateWorktree]
   * @property {(event: Event, items: import('../lib/types.js').ContextMenuItem[]) => void} [onOpenContextMenu]
   * @property {(type: string, params: object) => void} [onOpenInspector]
   */

  /** @type {Props} */
  let {
    repo,
    repositoryGroup = null,
    activePage = 'commits',
    selectedSection = '',
    selectedChangedFiles = [],
    actionBusy = '',
    isLoadingRepo = false,
    onRequestCloneRepository = () => {},
    onRunGitAction = () => {},
    onRunSelectedGitAction = () => {},
    onCreateBranch = () => {},
    onRequestCreateWorktree = () => {},
    onOpenContextMenu = () => {},
    onOpenInspector = () => {},
  } = $props();

  let hasWorktreeGroup = $derived(!!repositoryGroup?.group);
  let outgoingCommitCount = $derived(repo?.ahead ?? 0);
  let pushLabel = $derived(outgoingCommitCount > 0
    ? `Push ${outgoingCommitCount} outgoing ${outgoingCommitCount === 1 ? 'commit' : 'commits'}`
    : 'Push current branch');
  let selectedChangeCount = $derived(selectedChangedFiles.length);
  let stageToggleLabel = $derived(selectedSection === 'staged' ? 'Unstage' : 'Stage');
  let stageToggleCommand = $derived(selectedSection === 'staged' ? 'git_unstage' : 'git_stage');
  let stageSelectionLabel = $derived(`${stageToggleLabel} selected ${selectedChangeCount === 1 ? 'file' : 'files'}`);
  let canToggleStage = $derived(activePage === 'changes' && selectedChangeCount > 0 && (selectedSection === 'staged' || selectedSection === 'unstaged') && !actionBusy);

  const stashConfirmation = {
    confirmTitle: 'Stash working tree changes?',
    confirmMessage: 'This saves tracked and untracked changes to a Git stash, then leaves the working tree clean.',
    confirmLabel: 'Stash changes',
  };

  const forcePushConfirmation = {
    confirmationPreference: 'confirmForcePush',
    confirmTitle: 'Force push current branch?',
    confirmMessage: 'This uses --force-with-lease and can overwrite remote history if your local branch has rewritten commits.',
    confirmLabel: 'Force push with lease',
    danger: true,
  };

  function openGitActions(event) {
    onOpenContextMenu(event, [
      { label: 'Clone repository…', icon: '⎇', disabled: isLoadingRepo, action: onRequestCloneRepository },
      activePage === 'changes' && { label: stageSelectionLabel, icon: selectedSection === 'staged' ? '−' : '+', disabled: !canToggleStage, action: () => onRunSelectedGitAction(stageToggleCommand, selectedSection, stageToggleLabel) },
      { separator: true },
      { label: 'Fetch from remote', icon: '⇣', disabled: !!actionBusy || !repo?.path, action: () => onRunGitAction('git_fetch', {}, 'Fetch') },
      { label: 'Pull from upstream', icon: '↓', disabled: !!actionBusy || !repo?.path, action: () => onRunGitAction('git_pull', {}, 'Pull') },
      { label: pushLabel, icon: '↑', disabled: !!actionBusy || !repo?.path, action: () => onRunGitAction('git_push', {}, 'Push') },
      { label: 'Force push with lease', icon: '⇈', disabled: !!actionBusy || !repo?.hasUpstream, danger: true, action: () => onRunGitAction('git_force_push', {}, 'Force push', forcePushConfirmation) },
      { separator: true },
      { label: 'Create branch…', icon: '⑂', disabled: !!actionBusy || !repo?.path, action: onCreateBranch },
      hasWorktreeGroup && { label: 'New worktree…', icon: '+', disabled: !!actionBusy || !repo?.path, action: onRequestCreateWorktree },
      { label: 'Show current branch history', icon: '◷', disabled: !repo?.path || !(repo?.currentBranch), action: () => onOpenInspector('branch-history', { branchName: repo.currentBranch, kind: 'local' }) },
      { label: 'Stash working tree changes', icon: '↥', disabled: !!actionBusy || !repo?.path, action: () => onRunGitAction('git_stash', {}, 'Stash', stashConfirmation) },
    ]);
  }
</script>

<button class="ui-button text-button git-actions-button" type="button" disabled={isLoadingRepo} aria-haspopup="menu" title="Git Actions" onclick={openGitActions}>Git Actions ▾</button>
