<script>
  let {
    backendError = '',
    backendRecovery = { hint: '', showOpenRepository: false, showPublishUpstream: false },
    lastFailedOperation = null,
    onPublishUpstream = () => {},
    onOpenRepositoryPicker = () => {},
    onForceDeleteBranch = () => {},
    onRetry = () => {},
    onCopy = () => {},
    onDismiss = () => {},
  } = $props();
</script>

{#if backendError}
  <div class="backend-banner error" role="alert" aria-live="assertive">
    <div class="backend-banner-copy">
      <strong>Error</strong>
      <span title={backendError}>{backendError}</span>
      {#if backendRecovery.hint}
        <small>{backendRecovery.hint}</small>
      {/if}
    </div>
    <div class="backend-banner-actions ui-action-group">
      {#if backendRecovery.showPublishUpstream}
        <button type="button" onclick={onPublishUpstream}>Publish branch</button>
      {/if}
      {#if backendRecovery.showOpenRepository}
        <button type="button" onclick={onOpenRepositoryPicker}>Choose repository</button>
      {/if}
      {#if backendRecovery.showForceDeleteBranch && lastFailedOperation}
        <button type="button" class="ui-button danger-action" onclick={onForceDeleteBranch}>Force delete</button>
      {/if}
      {#if lastFailedOperation}
        <button type="button" onclick={onRetry}>Retry</button>
      {/if}
      <button type="button" onclick={() => onCopy(backendError)} title="Copy error details">Copy</button>
      <button type="button" onclick={onDismiss}>Dismiss</button>
    </div>
  </div>
{/if}
