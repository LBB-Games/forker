<script>
  import { onMount, tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  /**
   * @typedef {Object} Props
   * @property {string} [selectedPath]
   * @property {boolean} [isLoadingRepo]
   * @property {string} [backendError]
   * @property {string} [defaultLocation]
   * @property {any} onOpenRepository
   * @property {any} [onClose]
   * @property {boolean} [compact]
   */

  /** @type {Props} */
  let {
    selectedPath = $bindable(''),
    isLoadingRepo = false,
    backendError = '',
    defaultLocation = '',
    onOpenRepository,
    onClose = null,
    compact = false
  } = $props();

  let columns = $state([]);
  let favorites = $state([]);
  let recentRepos = $state([]);
  let typedPath = $state(selectedPath);
  let pickerError = $state('');
  let loadingPath = $state('');
  let showHidden = $state(false);
  let activeColumnIndex = $state(2);
  let activeRowIndex = $state(0);
  let selectedIsGitRepo = $state(false);
  let browserEl = $state();
  let navigationRequest = 0;


  onMount(async () => {
    recentRepos = await readRecentRepos();
    await loadFavorites();
    const startPath = selectedPath || defaultLocation || favorites[0]?.path || await invoke('home_directory').catch(() => '');
    if (startPath) await goToPath(startPath);
    await tick();
    browserEl?.focus();
  });

  async function loadFavorites() {
    try {
      favorites = await invoke('common_directories');
    } catch (error) {
      pickerError = String(error);
      favorites = [];
    }
  }

  async function readRecentRepos() {
    try {
      const settings = await invoke('load_app_settings');
      return (settings.recentRepoPaths ?? settings.recent_repo_paths ?? []).filter(Boolean).slice(0, 8);
    } catch {
      return [];
    }
  }

  async function listDirectory(path) {
    loadingPath = path;
    pickerError = '';
    try {
      return await invoke('list_directory', { path, showHidden });
    } catch (error) {
      pickerError = String(error);
      return [];
    } finally {
      loadingPath = '';
    }
  }

  async function isGitRepository(path) {
    if (!path) return false;
    try {
      return await invoke('is_git_repository', { path });
    } catch {
      return false;
    }
  }

  function parentPath(path) {
    if (!path || path === '/') return '';
    const normalized = path.replace(/[\\/]+$/, '');
    const separatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
    if (separatorIndex <= 0) return normalized.startsWith('/') ? '/' : '';
    return normalized.slice(0, separatorIndex);
  }

  async function goToPath(path) {
    const nextPath = path?.trim();
    if (!nextPath) return;
    const requestId = ++navigationRequest;
    selectedPath = nextPath;
    typedPath = nextPath;
    selectedIsGitRepo = false;

    const parent = parentPath(nextPath);
    const grandparent = parentPath(parent);
    const [grandparentEntries, parentEntries, childEntries, isRepo] = await Promise.all([
      grandparent ? listDirectory(grandparent) : Promise.resolve([]),
      parent ? listDirectory(parent) : Promise.resolve([]),
      listDirectory(nextPath),
      isGitRepository(nextPath),
    ]);
    if (requestId !== navigationRequest) return;

    selectedIsGitRepo = isRepo;
    if (parent === '/') {
      columns = [
        { kind: 'root', path: parent, entries: parentEntries, selectedPath: nextPath },
        { kind: 'children', path: nextPath, entries: childEntries, selectedPath: '' },
        { kind: 'preview', path: '', entries: [], selectedPath: '' },
      ];
      activeColumnIndex = 0;
      activeRowIndex = Math.max(0, parentEntries.findIndex((entry) => entry.path === nextPath));
      return;
    }

    columns = [
      { kind: 'parent', path: grandparent, entries: grandparentEntries, selectedPath: parent },
      { kind: 'selected', path: parent, entries: parentEntries, selectedPath: nextPath },
      { kind: 'children', path: nextPath, entries: childEntries, selectedPath: '' },
    ];
    activeColumnIndex = 1;
    activeRowIndex = Math.max(0, parentEntries.findIndex((entry) => entry.path === nextPath));
  }

  function rowId(columnIndex, rowIndex) {
    return `repository-picker-row-${columnIndex}-${rowIndex}`;
  }

  function scrollActiveRowIntoView() {
    requestAnimationFrame(() => document.getElementById(rowId(activeColumnIndex, activeRowIndex))?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }

  function setActiveRow(columnIndex, rowIndex) {
    const entries = columns[columnIndex]?.entries ?? [];
    if (!entries.length) return;
    activeColumnIndex = Math.max(0, Math.min(columns.length - 1, columnIndex));
    activeRowIndex = Math.max(0, Math.min(entries.length - 1, rowIndex));
    scrollActiveRowIntoView();
  }

  async function selectEntry(entry) {
    if (!entry) return;
    await goToPath(entry.path);
  }

  async function refreshColumns() {
    if (!selectedPath) return;
    await goToPath(selectedPath);
  }

  function openSelectedRepository() {
    const path = selectedPath.trim();
    if (!path || !selectedIsGitRepo || isLoadingRepo) return;
    onOpenRepository(path);
  }

  function favoriteIcon(name) {
    if (name === 'Home') return '⌂';
    if (name === 'Desktop') return '▣';
    if (name === 'Downloads') return '↓';
    if (name === 'Documents') return '◫';
    if (name === 'Computer') return '⌘';
    return '◇';
  }

  async function handleKeydown(event) {
    const isTextEntry = ['INPUT', 'TEXTAREA'].includes(event.target?.tagName) || event.target?.isContentEditable;
    if (isTextEntry) return;

    if (event.key === 'Escape' && onClose && !isLoadingRepo) {
      event.preventDefault();
      onClose();
      return;
    }
    if (!columns.length) return;
    const column = columns[activeColumnIndex] ?? columns[0];
    const entries = column.entries ?? [];

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveRow(activeColumnIndex, activeRowIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveRow(activeColumnIndex, activeRowIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveRow(activeColumnIndex, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveRow(activeColumnIndex, entries.length - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const entry = entries[activeRowIndex];
      if ((activeColumnIndex === 1 || activeColumnIndex === 2) && entry) await selectEntry(entry);
      else if (columns[activeColumnIndex + 1]?.entries.length) setActiveRow(activeColumnIndex + 1, 0);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (selectedParentPath) await goToPath(selectedParentPath);
      else setActiveRow(0, activeRowIndex);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = entries[activeRowIndex];
      if (entry) await selectEntry(entry);
      else openSelectedRepository();
    }
  }
  let displayError = $derived(backendError || pickerError);
  let canOpen = $derived(selectedPath && selectedIsGitRepo && !isLoadingRepo);
  let selectedParentPath = $derived(parentPath(selectedPath));
  let activeEntry = $derived(columns[activeColumnIndex]?.entries?.[activeRowIndex] ?? null);
  let activeDescendant = $derived(activeEntry ? rowId(activeColumnIndex, activeRowIndex) : undefined);
</script>

<div class="repository-picker" class:compact onkeydown={handleKeydown} bind:this={browserEl} tabindex="0" role="tree" aria-label="Repository folder picker" aria-activedescendant={activeDescendant}>
  <aside class="repository-picker-sidebar" aria-label="Favorite locations">
    <div class="picker-section-title">Favorites</div>
    {#each favorites as favorite}
      <button class="ui-row" class:selected={selectedPath === favorite.path} type="button" onclick={() => goToPath(favorite.path)} title={favorite.path}>
        <span>{favoriteIcon(favorite.name)}</span>
        <strong>{favorite.name}</strong>
      </button>
    {/each}

    {#if recentRepos.length}
      <div class="picker-section-title recent">Recent repositories</div>
      {#each recentRepos as path}
        <button class="ui-row" class:selected={selectedPath === path} type="button" onclick={() => goToPath(path)} ondblclick={() => onOpenRepository(path)} title={path}>
          <span>⑂</span>
          <strong>{path.split('/').filter(Boolean).pop() || path}</strong>
        </button>
      {/each}
    {/if}
  </aside>

  <section class="repository-picker-main">
    <div class="repository-picker-topbar ui-action-group">
      <button type="button" class="ui-icon-button path-back-button" onclick={() => goToPath(selectedParentPath)} disabled={!selectedParentPath || isLoadingRepo} aria-label="Go back up to parent directory" title="Back up to parent">↰</button>
      <label class="path-entry">
        <span>Path</span>
        <input bind:value={typedPath} onkeydown={(event) => event.key === 'Enter' && goToPath(typedPath)} placeholder="/path/to/repo" />
      </label>
      <button type="button" onclick={() => goToPath(typedPath)} disabled={!typedPath || isLoadingRepo}>Go</button>
      <button type="button" class:active={showHidden} onclick={async () => { showHidden = !showHidden; await refreshColumns(); }}>Hidden</button>
    </div>

    <div class="repository-picker-columns" role="group" aria-label="Directory browser">
      {#each columns as column, columnIndex}
        <div class="repository-picker-column" class:active={column.kind === 'selected' || column.kind === 'root'}>
          <div class="repository-picker-column-title" title={column.path}>
            {#if column.kind === 'parent'}Parent level{/if}
            {#if column.kind === 'root'}Root level{/if}
            {#if column.kind === 'selected'}Selected folder{/if}
            {#if column.kind === 'children'}Contents{/if}
            {#if column.kind === 'preview'}Preview{/if}
            {#if column.path}<span>{column.path}</span>{/if}
          </div>

          {#if loadingPath === column.path}
            <div class="picker-empty">Loading…</div>
          {:else if !column.entries.length}
            <div class="picker-empty">{column.kind === 'preview' ? 'Select a folder to preview contents' : column.kind === 'parent' ? 'No parent folders' : 'No folders'}</div>
          {:else}
            {#each column.entries as entry, rowIndex}
              <button
                type="button"
                id={rowId(columnIndex, rowIndex)}
                class="ui-row repository-picker-row"
                class:selected={column.selectedPath === entry.path || (columnIndex === activeColumnIndex && rowIndex === activeRowIndex)}
                class:git-repo={entry.isGitRepo}
                role="treeitem"
                tabindex="-1"
                aria-selected={column.selectedPath === entry.path || (columnIndex === activeColumnIndex && rowIndex === activeRowIndex)}
                aria-level={columnIndex + 1}
                onclick={() => selectEntry(entry)}
                title={entry.path}
              >
                <span class="folder-icon">{entry.isGitRepo ? '⑂' : '▸'}</span>
                <span class="folder-name">{entry.name}</span>
                {#if entry.isGitRepo}<span class="repo-badge">Git</span>{/if}
              </button>
            {/each}
          {/if}
        </div>
      {/each}
    </div>

    <div class="repository-picker-footer">
      <div class="selected-repo-path" title={selectedPath}>{selectedPath || 'Choose a repository folder'}</div>
      <div class="modal-actions ui-action-group">
        <button class="ui-button primary" type="button" disabled={!canOpen} onclick={openSelectedRepository}>{isLoadingRepo ? 'Opening…' : 'Open Repository'}</button>
      </div>
    </div>

    {#if displayError}<div class="open-error">{displayError}</div>{/if}
  </section>
</div>
