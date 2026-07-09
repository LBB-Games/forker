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
   * @property {boolean} [isRefreshing]
   * @property {any} [preferences]
   * @property {(reason?: string, updateRemotes?: boolean) => void | Promise<void>} onRefreshRepository
   * @property {(command: string, args: object, label: string, options?: object) => void | Promise<void>} [onRunGitAction]
   * @property {(command: string, section: string, label: string) => void | Promise<void>} [onRunSelectedGitAction]
   * @property {() => void} [onCreateBranch]
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
    isRefreshing = false,
    preferences = {},
    onRefreshRepository,
    onRunGitAction = () => {},
    onRunSelectedGitAction = () => {},
    onCreateBranch = () => {},
    onOpenInspector = () => {},
  } = $props();

  let outgoingCommitCount = $derived(repo?.ahead ?? 0);
  let pushTitle = $derived(outgoingCommitCount > 0
    ? `Push ${outgoingCommitCount} outgoing ${outgoingCommitCount === 1 ? 'commit' : 'commits'}`
    : 'Push current branch');
  let currentBranch = $derived(repo?.currentBranch ?? '');

  function isVisibleOnActivePage(key) {
    const suffix = activePage === 'changes' ? 'OnChanges' : 'OnCommits';
    return !!preferences?.[`${key}${suffix}`];
  }

  let showRefreshButton = $derived(isVisibleOnActivePage('showRefreshButton'));
  let showFetchButton = $derived(isVisibleOnActivePage('showToolbarFetchButton'));
  let showPullButton = $derived(isVisibleOnActivePage('showToolbarPullButton'));
  let showPushButton = $derived(isVisibleOnActivePage('showToolbarPushButton'));
  let showForcePushButton = $derived(isVisibleOnActivePage('showToolbarForcePushButton'));
  let showCreateBranchButton = $derived(isVisibleOnActivePage('showToolbarCreateBranchButton'));
  let showBranchHistoryButton = $derived(isVisibleOnActivePage('showToolbarBranchHistoryButton'));

  let showToolbar = $derived(
    showRefreshButton ||
    showFetchButton ||
    showPullButton ||
    showPushButton ||
    showForcePushButton ||
    showCreateBranchButton ||
    showBranchHistoryButton
  );

  const forcePushConfirmation = {
    confirmationPreference: 'confirmForcePush',
    confirmTitle: 'Force push current branch?',
    confirmMessage: 'This uses --force-with-lease and can overwrite remote history if your local branch has rewritten commits.',
    confirmLabel: 'Force push with lease',
    danger: true,
  };
</script>

{#if showToolbar}
  <div class="page-actions" role="presentation">
    <nav class="toolbar ui-toolbar" aria-label="Repository actions">
      {#if showRefreshButton}
        <button class="ui-icon-button git-icon-button action-refresh" disabled={!!actionBusy || isLoadingRepo || isRefreshing || !repo?.path} aria-label="Refresh repository and remotes" title={isRefreshing ? 'Refreshing repository and remotes' : 'Refresh repository and remotes'} onclick={() => onRefreshRepository('Manual refresh')}><span>↻</span></button>
      {/if}
      {#if showFetchButton}
        <button class="ui-icon-button git-icon-button action-fetch" type="button" disabled={!!actionBusy || !repo?.path} aria-label="Fetch from remote" title="Fetch from remote" onclick={() => onRunGitAction('git_fetch', {}, 'Fetch')}><span>⇣</span></button>
      {/if}
      {#if showPullButton}
        <button class="ui-icon-button git-icon-button emphasized-git-icon action-pull" type="button" disabled={!!actionBusy || !repo?.path} aria-label="Pull from upstream" title="Pull from upstream" onclick={() => onRunGitAction('git_pull', {}, 'Pull')}><span>↓</span></button>
      {/if}
      {#if showPushButton}
        <button class="ui-icon-button git-icon-button emphasized-git-icon action-push" type="button" disabled={!!actionBusy || !repo?.path} aria-label={pushTitle} title={pushTitle} onclick={() => onRunGitAction('git_push', {}, 'Push')}><span>↑</span></button>
      {/if}
      {#if showForcePushButton}
        <button class="ui-icon-button git-icon-button danger action-force-push" type="button" disabled={!!actionBusy || !repo?.hasUpstream} aria-label="Force push with lease" title="Force push with lease" onclick={() => onRunGitAction('git_force_push', {}, 'Force push', forcePushConfirmation)}><span>⇈</span></button>
      {/if}
      {#if showCreateBranchButton}
        <button class="ui-icon-button git-icon-button emphasized-git-icon action-branch" type="button" disabled={!!actionBusy || !repo?.path} aria-label="Create branch" title="Create branch" onclick={onCreateBranch}><span>⤴</span></button>
      {/if}
      {#if showBranchHistoryButton}
        <button class="ui-icon-button git-icon-button emphasized-git-icon action-history" type="button" disabled={!repo?.path || !currentBranch} aria-label="Show current branch history" title="Show current branch history" onclick={() => onOpenInspector('branch-history', { branchName: currentBranch, kind: 'local' })}><span>◷</span></button>
      {/if}
    </nav>
  </div>
{/if}
