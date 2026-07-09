<script>
  import CloneRepositoryPanel from './CloneRepositoryPanel.svelte';
  import { trapFocus } from '../lib/focusTrap.js';

  /**
   * @typedef {Object} Props
   * @property {any} [preferences]
   * @property {boolean} [isLoadingRepo]
   * @property {string} [backendError]
   * @property {any} onCloneRepository
   * @property {any} [onPrepareClone]
   * @property {any} [onCompleteClone]
   * @property {any} onClose
   */

  /** @type {Props} */
  let {
    preferences = {},
    isLoadingRepo = false,
    backendError = '',
    onCloneRepository,
    onPrepareClone = null,
    onCompleteClone = null,
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
  <div class="clone-modal" role="dialog" aria-modal="true" aria-labelledby="clone-panel-title" tabindex="-1" use:trapFocus onclick={(event) => event.stopPropagation()} onkeydown={handleDialogKeydown}>
    <CloneRepositoryPanel defaultCloneLocation={preferences.defaultRepoLocation} {isLoadingRepo} {backendError} {onCloneRepository} {onPrepareClone} {onCompleteClone} {onClose} />
  </div>
</div>
