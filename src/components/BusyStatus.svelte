<script>
  let { actionBusy = '', notice = null, showBlocking = false, showToast = false } = $props();

  let noticeIcon = $derived(notice?.tone === 'error' ? '!' : notice?.tone === 'warning' ? '!' : '✓');
  let noticeLive = $derived(notice?.tone === 'error' ? 'assertive' : 'polite');
</script>

{#if showBlocking}
  <div class="busy-overlay" role="status" aria-live="polite" aria-label={actionBusy || 'Loading repository'}>
    <div class="busy-card">
      <span class="busy-spinner" aria-hidden="true"></span>
      <strong>{actionBusy || 'Loading repository'}…</strong>
    </div>
  </div>
{:else if showToast}
  <div class="operation-toast running" role="status" aria-live="polite">
    <span class="busy-spinner small" aria-hidden="true"></span>
    <span>{actionBusy}…</span>
  </div>
{:else if notice}
  <div class="operation-toast {notice.tone}" role="status" aria-live={noticeLive}>
    <span class="operation-toast-icon" aria-hidden="true">{noticeIcon}</span>
    <span>{notice.message}</span>
  </div>
{/if}
