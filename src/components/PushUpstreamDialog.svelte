<script>
  import ModalFrame from './ModalFrame.svelte';

  let { repo, onConfirm = () => {}, onClose = () => {} } = $props();
  let cancelButtonEl = $state();
</script>

<ModalFrame
  cardClass="modal-card confirm-card"
  titleId="push-upstream-title"
  descriptionId="push-upstream-description"
  initialFocus={() => cancelButtonEl}
  {onClose}
>
  <div class="modal-header">
    <div>
      <h2 id="push-upstream-title">Create upstream branch?</h2>
      <p id="push-upstream-description" class="muted">The current branch <strong>{repo.currentBranch}</strong> has no upstream, so a normal push cannot run.</p>
      <p class="muted">Create the upstream branch on your remote and push this branch there?</p>
    </div>
    <button type="button" class="ui-icon-button icon-only-button" aria-label="Cancel" onclick={onClose}>×</button>
  </div>
  <div class="modal-actions ui-action-group">
    <button type="button" bind:this={cancelButtonEl} onclick={onClose}>Cancel</button>
    <button type="button" class="ui-button primary" onclick={onConfirm}>Create upstream</button>
  </div>
</ModalFrame>
