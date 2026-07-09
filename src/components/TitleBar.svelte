<script>
  import GitActionsDropdown from './GitActionsDropdown.svelte';

  /**
   * @typedef {Object} Props
   * @property {any} repo
   * @property {any} [repositoryGroup]
   * @property {string} [activeWorktreePath]
   * @property {any[]} [repoTabs]
   * @property {string} [activeRepositoryTabId]
   * @property {string} [activePage]
   * @property {string} [selectedSection]
   * @property {any[]} [selectedChangedFiles]
   * @property {string} [actionBusy]
   * @property {boolean} [isLoadingRepo]
   * @property {any} [preferences]
   * @property {any} onRequestOpenRepository
   * @property {any} onRequestSettings
   * @property {any} [onRequestCommandPalette]
   * @property {(kind: 'editor' | 'terminal') => void | Promise<void>} [onOpenExternalTool]
   * @property {() => void} [onRequestCloneRepository]
   * @property {(command: string, args: object, label: string, options?: object) => void | Promise<void>} [onRunGitAction]
   * @property {(command: string, section: string, label: string) => void | Promise<void>} [onRunSelectedGitAction]
   * @property {() => void} [onCreateBranch]
   * @property {() => void} [onRequestCreateWorktree]
   * @property {(event: Event, items: import('../lib/types.js').ContextMenuItem[]) => void} [onOpenContextMenu]
   * @property {(type: string, params: object) => void} [onOpenInspector]
   * @property {any} [onSelectRepositoryTab]
   * @property {any} [onCloseRepositoryTab]
   * @property {any} [onReorderRepositoryTab]
   */

  /** @type {Props} */
  let {
    repo,
    repositoryGroup = null,
    activeWorktreePath = '',
    repoTabs = [],
    activeRepositoryTabId = '',
    activePage = 'commits',
    selectedSection = '',
    selectedChangedFiles = [],
    actionBusy = '',
    isLoadingRepo = false,
    preferences = {},
    onRequestOpenRepository,
    onRequestSettings,
    onRequestCommandPalette = () => {},
    onOpenExternalTool = () => {},
    onRequestCloneRepository = () => {},
    onRunGitAction = () => {},
    onRunSelectedGitAction = () => {},
    onCreateBranch = () => {},
    onRequestCreateWorktree = () => {},
    onOpenContextMenu = () => {},
    onOpenInspector = () => {},
    onSelectRepositoryTab = () => {},
    onCloseRepositoryTab = () => {},
    onReorderRepositoryTab = () => {},
  } = $props();

  let draggedTabId = $state('');
  let dragOverTabId = $state('');
  let hasPreferredEditor = $derived(!!preferences?.preferredEditor?.trim?.());
  let hasPreferredTerminal = $derived(!!preferences?.preferredTerminal?.trim?.());

  let fallbackTab = $derived(repositoryGroup?.group ? {
    id: repositoryGroup.group.rootPath,
    path: repositoryGroup.group.rootPath,
    repositoryGroup,
    repo,
  } : (repo?.path ? { id: repo.path, path: repo.path, repo } : null));
  let tabs = $derived(repoTabs.length ? repoTabs : (fallbackTab ? [fallbackTab] : []));
  function tabRepo(tab) {
    const group = tab.repositoryGroup?.group;
    if (group) {
      return {
        name: group.name,
        path: group.rootPath,
        worktreeCount: tab.repositoryGroup?.worktrees?.length ?? 0,
        conflicts: (tab.repositoryGroup?.worktrees ?? []).reduce((total, worktree) => total + (worktree.conflicts ?? 0), 0),
      };
    }
    return tab.repo ?? tab;
  }

  function tabIdFor(tab) {
    return tab.id ?? tabRepo(tab).path;
  }

  function tabIndexFor(tabId) {
    return tabs.findIndex((tab) => tabIdFor(tab) === tabId);
  }

  function closeTab(event, tabId) {
    event.stopPropagation();
    onCloseRepositoryTab(tabId);
  }

  function beginTabDrag(event, tabId) {
    if (isLoadingRepo || tabs.length < 2) return;
    draggedTabId = tabId;
    dragOverTabId = tabId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tabId);
  }

  function dragOverTab(event, tabId) {
    if (!draggedTabId || draggedTabId === tabId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dragOverTabId = tabId;
  }

  function dropTab(event, targetTabId) {
    event.preventDefault();
    const sourceTabId = draggedTabId || event.dataTransfer.getData('text/plain');
    const fromIndex = tabIndexFor(sourceTabId);
    const targetIndex = tabIndexFor(targetTabId);
    if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const placeAfterTarget = event.clientX > rect.left + rect.width / 2;
    let nextIndex = targetIndex + (placeAfterTarget ? 1 : 0);
    if (fromIndex < nextIndex) nextIndex -= 1;
    onReorderRepositoryTab(sourceTabId, nextIndex);
    endTabDrag();
  }

  function endTabDrag() {
    draggedTabId = '';
    dragOverTabId = '';
  }

  function handleTabKeydown(event, tabId) {
    if (!event.altKey || !event.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const currentIndex = tabIndexFor(tabId);
    if (currentIndex < 0) return;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const nextIndex = Math.max(0, Math.min(currentIndex + direction, tabs.length - 1));
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    onReorderRepositoryTab(tabId, nextIndex);
  }
</script>

<header class="titlebar">
  <div class="repo-tabs" role="tablist" aria-label="Open repositories">
    {#each tabs as tab (tab.id ?? tab.path)}
      {@const currentRepo = tabRepo(tab)}
      {@const tabId = tabIdFor(tab)}
      <div
        class="repo-tab"
        class:active={tabId === activeRepositoryTabId || (!activeRepositoryTabId && currentRepo.path === (repositoryGroup?.group?.rootPath ?? repo?.path))}
        class:dragging={draggedTabId === tabId}
        class:drag-over={dragOverTabId === tabId && draggedTabId !== tabId}
        role="presentation"
        draggable={!isLoadingRepo && tabs.length > 1}
        ondragstart={(event) => beginTabDrag(event, tabId)}
        ondragover={(event) => dragOverTab(event, tabId)}
        ondragleave={() => dragOverTabId === tabId && (dragOverTabId = '')}
        ondrop={(event) => dropTab(event, tabId)}
        ondragend={endTabDrag}
      >
        <button
          class="repo-tab-body"
          type="button"
          role="tab"
          aria-selected={tabId === activeRepositoryTabId}
          aria-label={`${currentRepo.name}. Drag to reorder, or press Alt Shift Left or Right to move.`}
          disabled={isLoadingRepo}
          title={`${currentRepo.path}\nDrag to reorder. Alt+Shift+←/→ moves this tab.`}
          onclick={() => onSelectRepositoryTab(tabId)}
          onkeydown={(event) => handleTabKeydown(event, tabId)}
        >
          <span class="repo-tab-main">
            <strong>{currentRepo.name}</strong>
            {#if currentRepo.worktreeCount !== undefined}
              <span class="repo-tab-dirty">{currentRepo.worktreeCount} {currentRepo.worktreeCount === 1 ? 'worktree' : 'worktrees'}</span>
            {:else if currentRepo.changed}
              <span class="repo-tab-dirty">{currentRepo.changed} changed</span>
            {/if}
            {#if currentRepo.conflicts}
              <span class="repo-tab-dirty">{currentRepo.conflicts} conflicts</span>
            {/if}
          </span>
          <span class="repo-tab-path">{currentRepo.path}</span>
        </button>
        {#if tabs.length > 1}
          <button class="repo-tab-close" type="button" disabled={isLoadingRepo} aria-label={`Close ${currentRepo.name}`} onclick={(event) => closeTab(event, tabId)}>×</button>
        {/if}
      </div>
    {/each}
    <button class="repo-tab-add" type="button" disabled={isLoadingRepo} aria-label="Open repository" title="Open repository" onclick={onRequestOpenRepository}>+</button>
    {#if preferences?.showToolbarCloneButton}
      <button class="repo-tab-add clone-tab-button" type="button" disabled={isLoadingRepo} aria-label="Clone repository" title="Clone repository" onclick={onRequestCloneRepository}>⎇</button>
    {/if}
  </div>

  <div class="titlebar-actions ui-header-actions">
    {#if preferences?.showGitActionsButton !== false}
      <GitActionsDropdown
        {repo}
        {repositoryGroup}
        {activePage}
        {selectedSection}
        {selectedChangedFiles}
        {actionBusy}
        {isLoadingRepo}
        {onRequestCloneRepository}
        {onRunGitAction}
        {onRunSelectedGitAction}
        {onCreateBranch}
        {onRequestCreateWorktree}
        {onOpenContextMenu}
        {onOpenInspector}
      />
    {/if}
    {#if preferences?.showOpenEditorButton && hasPreferredEditor}
      <button class="ui-icon-button icon-button" type="button" disabled={!!actionBusy || isLoadingRepo || !repo?.path} aria-label="Open repository in editor" title="Open in editor" onclick={() => onOpenExternalTool('editor')}>✎</button>
    {/if}
    {#if preferences?.showOpenTerminalButton && hasPreferredTerminal}
      <button class="ui-icon-button icon-button terminal-icon" type="button" disabled={!!actionBusy || isLoadingRepo || !repo?.path} aria-label="Open repository in terminal" title="Open in terminal" onclick={() => onOpenExternalTool('terminal')}>›_</button>
    {/if}
    {#if preferences?.showCommandPaletteButton}
      <button class="ui-icon-button icon-button command-trigger" type="button" aria-label="Open command palette" title="Command palette (Ctrl/Cmd+P)" onclick={onRequestCommandPalette}><span aria-hidden="true">⌘</span></button>
    {/if}
    <button class="ui-icon-button icon-button" type="button" aria-label="Open settings" title="Settings" onclick={onRequestSettings}>⚙</button>
  </div>
</header>
