<script>
  import { trapFocus } from '../../lib/focusTrap.js';
  import BranchHistoryInspector from './BranchHistoryInspector.svelte';
  import CommitInspector from './CommitInspector.svelte';
  import FileHistoryInspector from './FileHistoryInspector.svelte';
  import InspectorStatus from './InspectorStatus.svelte';
  import LargeDiffInspector from './LargeDiffInspector.svelte';
  import StashInspector from './StashInspector.svelte';

  let {
    inspector = null,
    repo = {},
    changedFiles = [],
    selectedChangedFile = null,
    selectedDiffLines = [],
    selectedDiffKey = '',
    diffLoadingKey = '',
    commits = [],
    stashes = [],
    preferences = {},
    onClose = () => {},
    onCopyText = () => {},
    onOpenInspector = () => {},
    onRunGitAction = () => {},
  } = $props();

  let closeButtonEl = $state();
  let lastInspectorKey = $state('');
  const titleId = 'secondary-inspector-title';

  function stopPropagation(event) {
    event.stopPropagation();
  }

  function handleDialogKeydown(event) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  function openInspector(type, params = {}) {
    onOpenInspector(type, params);
  }

  let inspectorKey = $derived(inspector ? `${inspector.type}:${inspector.repoPath}:${JSON.stringify(inspector.params ?? {})}` : '');

  $effect(() => {
    if (!inspectorKey || inspectorKey === lastInspectorKey) return;
    if (lastInspectorKey) queueMicrotask(() => closeButtonEl?.focus({ preventScroll: true }));
    lastInspectorKey = inspectorKey;
  });
</script>

{#if inspector}
  <div class="modal-backdrop secondary-inspector-backdrop" role="presentation" onclick={onClose}>
    <div
      class="secondary-inspector-card modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      use:trapFocus={{ initialFocus: () => closeButtonEl }}
      onclick={stopPropagation}
      onkeydown={handleDialogKeydown}
    >
      <button bind:this={closeButtonEl} class="ui-icon-button secondary-inspector-close icon-button" type="button" aria-label="Close inspector" title="Close inspector" onclick={onClose}>×</button>

      {#if inspector.type === 'large-diff'}
        <LargeDiffInspector
          {titleId}
          {inspector}
          {repo}
          {changedFiles}
          {selectedChangedFile}
          {selectedDiffLines}
          {selectedDiffKey}
          {diffLoadingKey}
          {preferences}
          {onCopyText}
          onOpenInspector={openInspector}
        />
      {:else if inspector.type === 'commit'}
        <CommitInspector {titleId} {inspector} {repo} {commits} {preferences} {onCopyText} />
      {:else if inspector.type === 'file-history'}
        <FileHistoryInspector {titleId} {inspector} {repo} {onCopyText} onOpenInspector={openInspector} />
      {:else if inspector.type === 'branch-history'}
        <BranchHistoryInspector {titleId} {inspector} {repo} {onCopyText} onOpenInspector={openInspector} />
      {:else if inspector.type === 'stashes'}
        <StashInspector {titleId} {inspector} {repo} {stashes} {preferences} {onCopyText} {onRunGitAction} />
      {:else}
        <article class="inspector-surface">
          <InspectorStatus tone="error" title="Unknown inspector" message={`Forker cannot render inspector type “${inspector.type}”.`} />
        </article>
      {/if}
    </div>
  </div>
{/if}
