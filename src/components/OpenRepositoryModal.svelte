<script>
  import RepositoryColumnPicker from './RepositoryColumnPicker.svelte';
  import { trapFocus } from '../lib/focusTrap.js';

  /**
   * @typedef {Object} Props
   * @property {string} [repoPathInput]
   * @property {boolean} [isLoadingRepo]
   * @property {string} [backendError]
   * @property {any} [preferences]
   * @property {any} onOpenRepository
   * @property {any} onClose
   */

  /** @type {Props} */
  let {
    repoPathInput = $bindable(''),
    isLoadingRepo = false,
    backendError = '',
    preferences = {},
    onOpenRepository,
    onClose
  } = $props();

  function handleKeydown(event) {
    if (event.key === 'Escape' && !isLoadingRepo) onClose();
  }

  function handleDialogKeydown(event) {
    event.stopPropagation();
    handleKeydown(event);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" role="presentation" onclick={() => !isLoadingRepo && onClose()}>
  <div class="open-repo-card modal-card repository-open-card" role="dialog" aria-modal="true" aria-labelledby="open-repo-title" tabindex="-1" use:trapFocus onclick={(event) => event.stopPropagation()} onkeydown={handleDialogKeydown}>
    <div class="modal-header compact">
      <div>
        <h1 id="open-repo-title">Open repository</h1>
        <p>Choose a standard Git repository or a Forker worktree container.</p>
      </div>
      <button class="ui-icon-button icon-button" type="button" aria-label="Close" title="Close" disabled={isLoadingRepo} onclick={onClose}>×</button>
    </div>

    <RepositoryColumnPicker bind:selectedPath={repoPathInput} {isLoadingRepo} {backendError} defaultLocation={preferences.defaultRepoLocation} {onOpenRepository} {onClose} compact />
  </div>
</div>
