<script>
  let {
    appUpdate = {},
    onClose = () => {},
  } = $props();

  const fallbackReleaseUrl = 'https://github.com/mcread29/forker/releases/latest';
  let releaseUrl = $derived(appUpdate?.releaseUrl || fallbackReleaseUrl);

  function handleKeydown(event) {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" role="presentation" onclick={onClose}>
  <div class="modal-card compact-dialog update-release-dialog" role="dialog" aria-modal="true" aria-labelledby="update-release-title" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()}>
    <header class="modal-header">
      <h2 id="update-release-title">Forker {appUpdate.version} is available</h2>
      <button class="ui-icon-button icon-button" type="button" aria-label="Close update notice" title="Close" onclick={onClose}>×</button>
    </header>
    <div class="modal-body">
      <p>{appUpdate.message || 'A new Forker release is available.'}</p>
      <p class="field-help">Download the latest installer from GitHub Releases. Forker no longer installs updates inside the app.</p>
      {#if appUpdate?.body}
        <details class="settings-update-changelog">
          <summary>Release notes</summary>
          <pre>{appUpdate.body}</pre>
        </details>
      {/if}
    </div>
    <footer class="modal-actions ui-action-group">
      <button class="ui-button" type="button" onclick={onClose}>Not now</button>
      <a class="ui-button primary" href={releaseUrl} target="_blank" rel="noreferrer">Open latest release</a>
    </footer>
  </div>
</div>
