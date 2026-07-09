<script>
  import ModalFrame from './ModalFrame.svelte';

  let { dialog, onClose = () => {} } = $props();
  let cancelButtonEl = $state();
</script>

<ModalFrame
  cardClass="modal-card confirm-card"
  titleId="confirmation-title"
  descriptionId="confirmation-message"
  initialFocus={() => cancelButtonEl}
  onClose={() => onClose(false)}
>
  <div class="modal-header">
    <div>
      <h2 id="confirmation-title">{dialog.title}</h2>
      <p id="confirmation-message" class="muted">{dialog.message}</p>
      {#if dialog.items?.length}
        <ul class="confirm-file-list" aria-label="Affected paths">
          {#each dialog.items as item}
            <li><code>{item}</code></li>
          {/each}
        </ul>
      {/if}
    </div>
    <button type="button" class="ui-icon-button icon-only-button" aria-label="Cancel" onclick={() => onClose(false)}>×</button>
  </div>
  <div class="modal-actions ui-action-group">
    <button type="button" bind:this={cancelButtonEl} onclick={() => onClose(false)}>Cancel</button>
    <button type="button" class="ui-button" class:danger-action={dialog.danger} class:primary={!dialog.danger} onclick={() => onClose(true)}>{dialog.confirmLabel}</button>
  </div>
</ModalFrame>
