<script>
  import AppDropdown from './AppDropdown.svelte';
  import { trapFocus } from '../lib/focusTrap.js';
  import { getBranchNameProblem } from '../lib/appUtils.js';

  let {
    localBranches = [],
    remotes = [],
    isLoadingRepo = false,
    actionBusy = '',
    onConfirm = () => {},
    onClose = () => {},
  } = $props();

  let mode = $state('existing');
  let selected = $state('');
  let startPoint = $state('');
  let newBranchName = $state('');
  let attempted = $state(false);

  let options = $derived([
    ...localBranches.map((branch) => ({ value: `local:${branch.name}`, label: branch.name, branchName: branch.name, startPoint: null, kind: 'Local' })),
    ...remotes.map((remote) => ({ value: `remote:${remote}`, label: remote, branchName: String(remote).replace(/^origin\//, ''), startPoint: remote, kind: 'Remote' })),
  ]);
  let startPointOptions = $derived([
    ...localBranches.map((branch) => ({ value: `local:${branch.name}`, label: branch.name, startPoint: branch.name, kind: 'Local' })),
    ...remotes.map((remote) => ({ value: `remote:${remote}`, label: remote, startPoint: remote, kind: 'Remote' })),
  ]);
  let selectedOption = $derived(options.find((option) => option.value === selected) ?? options[0] ?? null);
  let selectedStartPointOption = $derived(startPointOptions.find((option) => option.value === startPoint) ?? startPointOptions[0] ?? null);
  let newBranchNameError = $derived(newBranchName.trim() || attempted ? getBranchNameProblem(newBranchName) : '');
  let branchAlreadyExists = $derived(localBranches.some((branch) => branch.name === newBranchName.trim()));
  let newBranchError = $derived(newBranchNameError || (branchAlreadyExists ? 'A local branch with this name already exists.' : ''));
  let isBusy = $derived(isLoadingRepo || !!actionBusy);
  let busyLabel = $derived(isLoadingRepo ? 'Loading repository' : actionBusy);
  let canCreateExisting = $derived(!!selectedOption && !isBusy);
  let canCreateNew = $derived(!!newBranchName.trim() && !newBranchError && !!selectedStartPointOption && !isBusy);
  let canCreate = $derived(mode === 'new' ? canCreateNew : canCreateExisting);

  $effect(() => {
    if (!selected && options.length) selected = options[0].value;
  });

  $effect(() => {
    if (!startPoint && startPointOptions.length) startPoint = startPointOptions[0].value;
  });

  function confirm() {
    attempted = true;
    if (!canCreate) return;
    if (mode === 'new') {
      onConfirm(newBranchName.trim(), selectedStartPointOption.startPoint);
      return;
    }
    onConfirm(selectedOption.branchName, selectedOption.startPoint);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && !isBusy) onClose();
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) confirm();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" role="presentation" onclick={() => !isBusy && onClose()}>
  <div class="modal-card compact-dialog" role="dialog" aria-modal="true" aria-labelledby="create-worktree-title" aria-busy={isBusy ? 'true' : undefined} tabindex="-1" use:trapFocus onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()}>
    <div class="modal-header compact">
      <div>
        <h1 id="create-worktree-title">Create worktree</h1>
        <p>Create a sibling worktree from an existing branch or a new local branch.</p>
      </div>
      <button class="ui-icon-button icon-button" type="button" aria-label="Close" disabled={isBusy} onclick={onClose}>×</button>
    </div>

    <div class="settings-segmented" role="radiogroup" aria-label="Worktree branch source">
      <label class:selected={mode === 'existing'}><input type="radio" name="worktree-branch-mode" value="existing" bind:group={mode} disabled={isBusy} /><span>Existing branch</span></label>
      <label class:selected={mode === 'new'}><input type="radio" name="worktree-branch-mode" value="new" bind:group={mode} disabled={isBusy} /><span>New local branch</span></label>
    </div>

    {#if mode === 'new'}
      <label class="settings-field">
        <span>New branch name</span>
        <input value={newBranchName} oninput={(event) => newBranchName = event.currentTarget.value} onkeydown={(event) => event.key === 'Enter' && confirm()} placeholder="feature/my-change" autocomplete="off" aria-describedby="new-worktree-branch-help" aria-invalid={!!newBranchError} disabled={isBusy} />
      </label>
      <div class="settings-field">
        <span>Start point</span>
        <AppDropdown
          id="create-worktree-start-point"
          class="branch-ref"
          bind:value={startPoint}
          options={startPointOptions}
          disabled={isBusy || !startPointOptions.length}
          invalid={attempted && !selectedStartPointOption}
          menuLabel="New branch start point"
          getValue={(option) => option.value}
          getLabel={(option) => option.label}
          getDescription={(option) => `${option.kind} start point`}
          getIcon={(option) => option.kind === 'Local' ? '⑂' : '↙'}
        />
      </div>
      <p id="new-worktree-branch-help" class="field-help">Create a local branch at the selected start point, then open it in a new worktree.</p>
      {#if newBranchError}
        <p class="field-help modal-error" role="alert">{newBranchError}</p>
      {/if}
    {:else}
      <div class="settings-field">
        <span>Branch</span>
        <AppDropdown
          id="create-worktree-branch"
          class="branch-ref"
          bind:value={selected}
          {options}
          disabled={isBusy || !options.length}
          invalid={attempted && !selectedOption}
          menuLabel="Worktree branch"
          getValue={(option) => option.value}
          getLabel={(option) => option.label}
          getDescription={(option) => `${option.kind} start point`}
          getIcon={(option) => option.kind === 'Local' ? '⑂' : '↙'}
        />
      </div>

      {#if selectedOption}
        <p class="field-help">Worktree folder name will be derived from <strong>{selectedOption.branchName}</strong>.</p>
      {:else}
        <p class="field-help">No branches are available.</p>
      {/if}
    {/if}

    <div class="modal-actions ui-action-group">
      <button class="ui-button primary" type="button" disabled={!canCreate} onclick={confirm}>{isBusy ? `${busyLabel}…` : 'Create worktree'}</button>
    </div>
  </div>
</div>
