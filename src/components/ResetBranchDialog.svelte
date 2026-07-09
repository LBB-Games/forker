<script>
  import ModalFrame from './ModalFrame.svelte';

  let {
    repo,
    resetTargetCommit,
    resetMode = 'mixed',
    onResetModeChange = () => {},
    onConfirm = () => {},
    onClose = () => {},
  } = $props();

  let cancelButtonEl = $state();
</script>

<ModalFrame
  cardClass="modal-card confirm-card"
  titleId="reset-branch-title"
  descriptionId="reset-branch-description"
  initialFocus={() => cancelButtonEl}
  {onClose}
>
  <div class="modal-header">
    <div>
      <h2 id="reset-branch-title">Reset current branch?</h2>
      <p id="reset-branch-description" class="muted">Move <strong>{repo.currentBranch}</strong> to <code>{resetTargetCommit?.id?.slice(0, 12)}</code>.</p>
      {#if resetTargetCommit?.subject}
        <p class="muted">{resetTargetCommit.subject}</p>
      {/if}
    </div>
    <button type="button" class="ui-icon-button icon-only-button" aria-label="Cancel" onclick={onClose}>×</button>
  </div>
  <fieldset class="modal-radio-list">
    <legend>Reset mode</legend>
    {#each [
      ['soft', 'Soft', 'Keep index and working tree changes staged.'],
      ['mixed', 'Mixed', 'Keep working tree changes, but unstage them.'],
      ['hard', 'Hard', 'Discard conflicting staged and working tree changes.'],
    ] as [value, label, hint]}
      <label>
        <input type="radio" name="reset-mode" value={value} checked={resetMode === value} onchange={() => onResetModeChange(value)} />
        <span><strong>{label}</strong><small>{hint}</small></span>
      </label>
    {/each}
  </fieldset>
  <div class="modal-actions ui-action-group">
    <button type="button" bind:this={cancelButtonEl} onclick={onClose}>Cancel</button>
    <button type="button" class="ui-button danger-action" disabled={!resetTargetCommit?.id} onclick={onConfirm}>Reset branch</button>
  </div>
</ModalFrame>
