<script>
  import ModalFrame from './ModalFrame.svelte';

  let {
    branchName = '',
    branchNameError = '',
    branchNameDescription = 'branch-name-help',
    canCreateBranch = false,
    onBranchNameChange = () => {},
    onConfirm = () => {},
    onClose = () => {},
  } = $props();

  let branchInputEl = $state();
</script>

<ModalFrame
  cardClass="modal-card confirm-card"
  titleId="create-branch-title"
  descriptionId="create-branch-description"
  initialFocus={() => branchInputEl}
  {onClose}
>
  <div class="modal-header">
    <div>
      <h2 id="create-branch-title">Create new branch</h2>
      <p id="create-branch-description" class="muted">Create and check out a new branch from the current HEAD.</p>
    </div>
    <button type="button" class="ui-icon-button icon-only-button" aria-label="Cancel" onclick={onClose}>×</button>
  </div>
  <label class="modal-field">
    <span>Branch name</span>
    <input bind:this={branchInputEl} value={branchName} oninput={(event) => onBranchNameChange(event.currentTarget.value)} onkeydown={(event) => event.key === 'Enter' && onConfirm()} placeholder="feature/my-change" autocomplete="off" aria-describedby={branchNameDescription} aria-invalid={!!branchNameError} />
    <small id="branch-name-help">Use a Git-safe ref name such as <code>feature/my-change</code>. Avoid spaces and shell punctuation.</small>
    {#if branchNameError}
      <small id="branch-name-error" class="modal-error" role="alert">{branchNameError}</small>
    {/if}
  </label>
  <div class="modal-actions ui-action-group">
    <button type="button" onclick={onClose}>Cancel</button>
    <button type="button" class="ui-button primary" disabled={!canCreateBranch} onclick={onConfirm}>Create branch</button>
  </div>
</ModalFrame>
