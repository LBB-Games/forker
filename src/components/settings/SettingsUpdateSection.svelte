<script>
  let {
    appUpdate = {},
    isUpdateBusy = false,
    onCheckForAppUpdate = () => {},
  } = $props();

  const fallbackReleaseUrl = 'https://github.com/LBB-Games/forker/releases/latest';
  let releaseUrl = $derived(appUpdate?.releaseUrl || fallbackReleaseUrl);
  let hasUpdate = $derived(appUpdate?.status === 'available' || !!appUpdate?.available);
  let hasError = $derived(appUpdate?.status === 'error');
  let feedUnavailable = $derived(appUpdate?.status === 'unavailable');
</script>

<section class="settings-section settings-update-section" aria-labelledby="settings-updates-title">
  <div class="settings-section-heading">
    {#if feedUnavailable}
      <h2 id="settings-updates-title">Release feed unavailable</h2>
      <p>The configured GitHub release feed is not public or does not exist. You can still open the releases page manually.</p>
    {:else if hasError}
      <h2 id="settings-updates-title">Update check failed</h2>
      <p>Forker could not reach GitHub Releases. Check your connection, then try again.</p>
    {:else}
      <h2 id="settings-updates-title">Forker {appUpdate.version} is available</h2>
      <p>Download the latest installer from GitHub Releases.</p>
    {/if}
  </div>
  <div class="settings-update-panel" aria-live="polite">
    {#if feedUnavailable}
      <p class="settings-update-error" role="status">{appUpdate.message || 'No public GitHub release feed was found for Forker.'}</p>
      <div class="settings-action-row ui-action-group">
        <a class="ui-button primary" href={releaseUrl} target="_blank" rel="noreferrer">Open releases</a>
        <button class="ui-button" type="button" disabled={isUpdateBusy} onclick={() => onCheckForAppUpdate()}>{isUpdateBusy ? 'Checking…' : 'Check again'}</button>
      </div>
    {:else if hasError}
      <p class="settings-update-error" role="status">{appUpdate.error || appUpdate.message || 'Could not check GitHub Releases.'}</p>
      <div class="settings-action-row ui-action-group">
        <button class="ui-button primary" type="button" disabled={isUpdateBusy} onclick={() => onCheckForAppUpdate()}>{isUpdateBusy ? 'Checking…' : 'Retry check'}</button>
        <a class="ui-button" href={releaseUrl} target="_blank" rel="noreferrer">Open releases</a>
      </div>
    {:else if hasUpdate}
      {#if appUpdate?.body}
        <div class="settings-update-changelog">
          <h3>Release notes</h3>
          <pre>{appUpdate.body}</pre>
        </div>
      {:else}
        <p class="settings-update-message">No release notes were published with this release.</p>
      {/if}
      <div class="settings-action-row ui-action-group">
        <a class="ui-button primary" href={releaseUrl} target="_blank" rel="noreferrer">Open latest release</a>
      </div>
    {/if}
  </div>
</section>
