<script>
  import RepositoryColumnPicker from './RepositoryColumnPicker.svelte';

  /**
   * @typedef {Object} Props
   * @property {string} [repoPathInput]
   * @property {boolean} [isLoadingRepo]
   * @property {string} [backendError]
   * @property {any} [gitInstallation]
   * @property {any} [preferences]
   * @property {any} onOpenRepository
   * @property {any} onRequestCloneRepository
   */

  /** @type {Props} */
  let {
    repoPathInput = $bindable(''),
    isLoadingRepo = false,
    backendError = '',
    gitInstallation = { found: true, path: '', version: '', error: '' },
    preferences = {},
    onOpenRepository,
    onRequestCloneRepository
  } = $props();
</script>

<div class="open-repo-screen">
  <div class="open-repo-card repository-open-card">
    <div class="repository-open-heading">
      <div class="repo-glyph large">⑂</div>
      <div>
        <h1>Open a repository</h1>
        <p>Choose a standard Git repository or a Forker worktree container.</p>
        {#if gitInstallation?.found}
          <p class="git-installation-ok">{gitInstallation.version ?? 'Git found'}{gitInstallation.path ? ` · ${gitInstallation.path}` : ''}</p>
        {:else}
          <div class="git-installation-error" role="alert">
            <strong>Git is required before opening repositories.</strong>
            <span>{gitInstallation?.error ?? 'Install Git, then retry.'}</span>
            <ol>
              <li>Install Git from your OS package manager or git-scm.com.</li>
              <li>Restart Forker so the executable can be detected.</li>
              <li>If you use a custom Git path, make sure it is on PATH before launching Forker.</li>
            </ol>
          </div>
        {/if}
      </div>
      <button class="ui-button primary" type="button" disabled={isLoadingRepo || !gitInstallation?.found} title={!gitInstallation?.found ? 'Install Git before cloning repositories' : 'Clone repository'} onclick={onRequestCloneRepository}>Clone repository</button>
    </div>
    <RepositoryColumnPicker bind:selectedPath={repoPathInput} {isLoadingRepo} {backendError} defaultLocation={preferences.defaultRepoLocation} onOpenRepository={onOpenRepository} />
  </div>
</div>
