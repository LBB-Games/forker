<script>
  let {
    tone = 'empty',
    title = '',
    message = '',
    actionLabel = '',
    onAction = null,
  } = $props();
</script>

<div class="inspector-status {tone}" role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
  {#if title}<strong>{title}</strong>{/if}
  {#if message}<span>{message}</span>{/if}
  {#if actionLabel && onAction}
    <button class="ui-button" type="button" onclick={onAction}>{actionLabel}</button>
  {/if}
</div>
