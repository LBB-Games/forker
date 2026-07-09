<script>
  import { tick } from 'svelte';
  import AppDropdown from './AppDropdown.svelte';

  /**
   * @typedef {Object} Props
   * @property {string} [defaultCloneLocation]
   * @property {boolean} [isLoadingRepo]
   * @property {string} [backendError]
   * @property {any} [onCloneRepository]
   * @property {any} [onPrepareClone]
   * @property {any} [onCompleteClone]
   * @property {any} [onClose]
   */

  /** @type {Props} */
  let {
    defaultCloneLocation = '',
    isLoadingRepo = false,
    backendError = '',
    onCloneRepository = () => {},
    onPrepareClone = null,
    onCompleteClone = null,
    onClose = null
  } = $props();

  let remoteUrl = $state('');
  let destinationName = $state('');
  let parentPath = $state('');
  let attempted = $state(false);
  let cloneMode = $state('standard');
  let worktreeLayout = $state('bare');
  let preparation = $state(null);
  let selectedBranch = $state('');
  let localBranchName = $state('');
  let worktreeName = $state('');
  let customLocalBranch = $state(false);
  let localBranchInput = $state();

  function repositoryNameFromUrl(value) {
    const trimmed = value.trim().replace(/[\/]+$/, '');
    if (!trimmed) return '';
    const last = trimmed.split(/[/:]/).filter(Boolean).pop() || '';
    return last.replace(/\.git$/i, '') || 'repository';
  }

  function joinPath(parent, child) {
    if (!child) return parent;
    const separator = parent.includes('\\') ? '\\' : '/';
    return `${parent.replace(/[\\/]+$/, '')}${separator}${child}`;
  }

  function branchShortName(branch) {
    return String(branch || '').replace(/^refs\/remotes\/origin\//, '').replace(/^origin\//, '');
  }

  function safeWorktreeName(branch) {
    return branchShortName(branch).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'worktree';
  }

  function syncBranchFields(branch, forceLocalName = !customLocalBranch) {
    const shortName = branchShortName(branch);
    if (forceLocalName || !localBranchName.trim()) localBranchName = shortName;
    if (forceLocalName || !worktreeName.trim()) worktreeName = safeWorktreeName(forceLocalName ? shortName : localBranchName || shortName);
  }

  function selectRemoteBranch(branch, previous = selectedBranch) {
    selectedBranch = branch;
    syncBranchFields(branch, !customLocalBranch || localBranchName === branchShortName(previous));
  }

  async function enableCustomLocalBranch() {
    customLocalBranch = true;
    if (!localBranchName.trim()) localBranchName = branchShortName(selectedBranch);
    await tick();
    localBranchInput?.focus();
    localBranchInput?.select();
  }

  function useRemoteBranchName() {
    customLocalBranch = false;
    localBranchName = branchShortName(selectedBranch);
    worktreeName = safeWorktreeName(localBranchName);
  }

  function handleLocalBranchInput(event) {
    const previousWorktreeName = safeWorktreeName(localBranchName || selectedBranch);
    localBranchName = event.currentTarget.value;
    if (!worktreeName.trim() || worktreeName === previousWorktreeName) worktreeName = safeWorktreeName(localBranchName || selectedBranch);
  }

  async function prepareClone() {
    attempted = true;
    if (!canPrepare) return;
    if (cloneMode === 'standard' || !onPrepareClone) {
      onCloneRepository(remoteUrl.trim(), parentPath.trim(), destinationName.trim(), cloneMode === 'worktrees', worktreeLayout);
      return;
    }
    const result = await onPrepareClone(remoteUrl.trim(), parentPath.trim(), destinationName.trim(), worktreeLayout);
    if (!result) return;
    preparation = result;
    selectedBranch = result.defaultBranch || result.remoteBranches?.[0] || '';
    customLocalBranch = false;
    syncBranchFields(selectedBranch, true);
  }

  function createFirstWorktree() {
    attempted = true;
    if (!canComplete) return;
    onCompleteClone(preparation.rootPath, selectedBranch, localBranchName, worktreeName);
  }

  function useDefaultLocation() {
    parentPath = defaultCloneLocation;
  }

  $effect(() => {
    if (!parentPath && defaultCloneLocation) parentPath = defaultCloneLocation;
  });

  $effect(() => {
    if (!preparation || !selectedBranch) return;
    if (!localBranchName) localBranchName = branchShortName(selectedBranch);
    if (!worktreeName) worktreeName = safeWorktreeName(selectedBranch);
  });

  let remoteBranchOptions = $derived(preparation?.remoteBranches ?? []);
  let selectedBranchLabel = $derived(selectedBranch || remoteBranchOptions[0] || 'No remote branches found');
  let localBranchHelp = $derived(customLocalBranch
    ? 'Forker will create this local branch from the selected remote branch.'
    : 'Forker will create a local branch with the same short name as the remote branch.');
  let derivedName = $derived(repositoryNameFromUrl(remoteUrl));
  let effectiveName = $derived(destinationName.trim() || derivedName);
  let canPrepare = $derived(remoteUrl.trim() && parentPath.trim() && effectiveName && !isLoadingRepo && !preparation);
  let canComplete = $derived(preparation?.rootPath && selectedBranch && localBranchName.trim() && worktreeName.trim() && !isLoadingRepo);
  let helperText = $derived(parentPath.trim()
    ? cloneMode === 'worktrees'
      ? worktreeLayout === 'meta'
        ? `Workspace: ${joinPath(parentPath.trim(), effectiveName || 'repository')} (repo.meta checkout with worktrees/)`
        : `Container: ${joinPath(parentPath.trim(), effectiveName || 'repository')} (bare .git plus sibling worktrees)`
      : `Repository: ${joinPath(parentPath.trim(), effectiveName || 'repository')}`
    : 'Set a default clone location in Settings, or enter one here.');
</script>

<section class="clone-panel" aria-labelledby="clone-panel-title">
  <div class="clone-panel-heading">
    <div>
      <h2 id="clone-panel-title">Clone repository</h2>
      <p>Clone a standard checkout, or set up a worktree workspace and choose the first worktree branch.</p>
    </div>
    {#if onClose}
      <button class="ui-icon-button icon-button" type="button" aria-label="Close" title="Close" disabled={isLoadingRepo} onclick={onClose}>×</button>
    {/if}
  </div>

  {#if !preparation}
    <div class="clone-grid">
      <label class="settings-field clone-url-field">
        <span>Remote URL</span>
        <input type="url" bind:value={remoteUrl} placeholder="https://github.com/org/repo.git" aria-invalid={attempted && !remoteUrl.trim() ? 'true' : undefined} />
      </label>
      <label class="settings-field">
        <span>Repository folder name</span>
        <input type="text" bind:value={destinationName} placeholder={derivedName || 'repo'} />
      </label>
      <label class="settings-field clone-location-field">
        <span>Parent folder</span>
        <div class="settings-input-action ui-input-action">
          <input type="text" bind:value={parentPath} placeholder="/Users/you/Code" aria-invalid={attempted && !parentPath.trim() ? 'true' : undefined} />
          <button type="button" disabled={!defaultCloneLocation || isLoadingRepo} onclick={useDefaultLocation}>Use default</button>
        </div>
      </label>
      <div class="settings-field clone-location-field">
        <span>Clone type</span>
        <div class="settings-segmented" role="radiogroup" aria-label="Clone type">
          <label class:selected={cloneMode === 'standard'}><input type="radio" name="clone-mode" value="standard" bind:group={cloneMode} disabled={isLoadingRepo} /><span>Standard checkout</span></label>
          <label class:selected={cloneMode === 'worktrees'}><input type="radio" name="clone-mode" value="worktrees" bind:group={cloneMode} disabled={isLoadingRepo} /><span>Worktrees</span></label>
        </div>
      </div>
      {#if cloneMode === 'worktrees'}
        <div class="settings-field clone-location-field">
          <span>Worktree layout</span>
          <div class="settings-segmented" role="radiogroup" aria-label="Worktree layout">
            <label class:selected={worktreeLayout === 'bare'}><input type="radio" name="worktree-layout" value="bare" bind:group={worktreeLayout} disabled={isLoadingRepo} /><span>Bare + sibling worktrees</span></label>
            <label class:selected={worktreeLayout === 'meta'}><input type="radio" name="worktree-layout" value="meta" bind:group={worktreeLayout} disabled={isLoadingRepo} /><span>repo.meta checkout</span></label>
          </div>
          <small class="field-help clone-field-help">If the remote already has repo.meta or repo-meta, Forker checks it out. Otherwise it creates a new orphan repo.meta branch.</small>
        </div>
      {/if}
    </div>

    <div class="clone-panel-footer">
      <div class="clone-destination" title={helperText}>{helperText}</div>
      <div class="modal-actions ui-action-group">
        <button class="ui-button primary" type="button" disabled={!canPrepare} onclick={prepareClone}>{isLoadingRepo ? 'Cloning…' : cloneMode === 'worktrees' ? 'Prepare worktrees' : 'Clone repository'}</button>
      </div>
    </div>
  {:else}
    <div class="clone-grid">
      <div class="settings-field clone-url-field">
        <span>Remote start point</span>
        <AppDropdown
          class="branch-ref"
          bind:value={selectedBranch}
          options={remoteBranchOptions}
          disabled={isLoadingRepo || !remoteBranchOptions.length}
          menuLabel="Remote branches"
          placeholder={selectedBranchLabel}
          getDescription={(branch) => `Creates from origin/${branchShortName(branch)}`}
          onChange={(branch, _value, previous) => selectRemoteBranch(branch, previous)}
        >
          {#snippet trigger(branch)}
            <strong>{branch || selectedBranchLabel}</strong>
            <small>Start point for the first worktree</small>
          {/snippet}
          {#snippet option(branch)}
            <span class="branch-ref-dot" aria-hidden="true"></span>
            <span class="app-dropdown-option-copy">
              <strong>{branch}</strong>
              <small>Creates from origin/{branchShortName(branch)}</small>
            </span>
          {/snippet}
        </AppDropdown>
      </div>
      <label class="settings-field">
        <span>Local branch name</span>
        <div class="clone-local-branch-control ui-input-action">
          <input bind:this={localBranchInput} type="text" value={localBranchName} placeholder={branchShortName(selectedBranch) || 'main'} readonly={!customLocalBranch} oninput={handleLocalBranchInput} />
          {#if customLocalBranch}
            <button type="button" disabled={isLoadingRepo} onclick={useRemoteBranchName}>Use remote name</button>
          {:else}
            <button type="button" disabled={isLoadingRepo || !selectedBranch} onclick={enableCustomLocalBranch}>Create new…</button>
          {/if}
        </div>
        <small class="field-help clone-field-help">{localBranchHelp}</small>
      </label>
      <label class="settings-field">
        <span>Worktree folder name</span>
        <input type="text" bind:value={worktreeName} placeholder={safeWorktreeName(selectedBranch)} />
      </label>
    </div>

    <div class="clone-panel-footer">
      <div class="clone-destination" title={preparation.rootPath}>{preparation.cloneLayout === 'meta' ? `Workspace ready${preparation.metaBranch ? ` on ${preparation.metaBranch}` : ''}:` : 'Container ready:'} {preparation.rootPath}</div>
      <div class="modal-actions ui-action-group">
        <button type="button" disabled={isLoadingRepo} onclick={() => preparation = null}>Back</button>
        <button class="ui-button primary" type="button" disabled={!canComplete} onclick={createFirstWorktree}>{isLoadingRepo ? 'Creating…' : 'Create first worktree'}</button>
      </div>
    </div>
  {/if}

  {#if backendError}<div class="open-error">{backendError}</div>{/if}
</section>
