<script>
  /**
   * @typedef {Object} Props
   * @property {any} repo
   * @property {string} [backendStatus]
   * @property {string} [jobStatus]
   * @property {number} [lastRefreshAt]
   * @property {any} [conflictState]
   * @property {any} [onCancelJob]
   */

  /** @type {Props} */
  let {
    repo,
    backendStatus = '',
    jobStatus = 'idle',
    lastRefreshAt = 0,
    conflictState = { active: false, files: [] },
    onCancelJob = () => {}
  } = $props();

  let lastRefreshLabel = $derived(lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'never');
  let jobLabel = $derived(jobStatus === 'refreshing' ? 'Refreshing' : jobStatus === 'running' ? 'Running' : jobStatus === 'cancelling' ? 'Cancelling' : 'Idle');
  let canCancel = $derived(jobStatus === 'running' || jobStatus === 'refreshing');
  let conflictCount = $derived(conflictState?.files?.length ?? 0);
  let conflictLabel = $derived(conflictState?.active ? `${conflictState.operationLabel ?? 'Conflict'} · ${conflictCount} unresolved` : 'No conflicts');
</script>

<footer class="statusbar" aria-label="Repository status">
  <span><strong>{repo.currentBranch}</strong></span>
  <span>{repo.ahead} ahead / {repo.behind} behind</span>
  <span>{repo.changed} changed files</span>
  {#if conflictState?.active}
    <span class="status-conflict" aria-label={`Conflict state: ${conflictLabel}`}>! {conflictLabel}</span>
  {/if}
  <span class="status-spacer"></span>
  <span>Last refresh: {lastRefreshLabel}</span>
  {#if canCancel}
    <button type="button" class="ui-button danger-action status-cancel-button" onclick={onCancelJob}>Cancel operation</button>
  {/if}
  <span>{jobLabel} · {backendStatus}</span>
</footer>
