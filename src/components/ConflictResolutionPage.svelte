<script>
  /**
   * @typedef {import('../lib/types.js').ConflictFile} ConflictFile
   * @typedef {import('../lib/types.js').ConflictFilePreview} ConflictFilePreview
   */

  let {
    repo = null,
    conflictState = { active: false, files: [] },
    actionBusy = '',
    onLoadConflictPreview = async () => null,
    onOpenConflictExternal = () => {},
    onMarkConflictResolved = () => {},
    onContinueConflictOperation = () => {},
    onAbortConflictOperation = () => {},
  } = $props();

  const groupOrder = ['both_modified', 'deleted_by_us', 'deleted_by_them', 'add_add', 'rename', 'binary', 'added_by_us', 'added_by_them', 'both_deleted', 'unmerged'];
  const groupLabels = {
    both_modified: 'Both modified',
    deleted_by_us: 'Deleted / modified',
    deleted_by_them: 'Modified / deleted',
    add_add: 'Add/add',
    rename: 'Rename conflicts',
    binary: 'Binary conflicts',
    added_by_us: 'Added by us',
    added_by_them: 'Added by them',
    both_deleted: 'Both deleted',
    unmerged: 'Other unmerged files',
  };

  let selectedPath = $state('');
  /** @type {ConflictFilePreview | null} */
  let preview = $state(null);
  let previewLoading = $state(false);
  let previewError = $state('');
  let previewRequestId = 0;

  let files = $derived(conflictState?.files ?? []);
  let operationLabel = $derived(conflictState?.operationLabel ?? 'operation');
  let unresolvedCount = $derived(files.length);
  let canContinue = $derived(unresolvedCount === 0 && !actionBusy && (conflictState?.operation?.canContinue ?? true));
  let canAbort = $derived(!actionBusy && (conflictState?.operation?.canAbort ?? true));
  let selectedFile = $derived(files.find((file) => file.path === selectedPath) ?? files[0] ?? null);
  let groups = $derived(groupConflictFiles(files));

  $effect(() => {
    if (!files.length) {
      selectedPath = '';
      preview = null;
      previewError = '';
      return;
    }
    if (!files.some((file) => file.path === selectedPath)) selectedPath = files[0].path;
  });

  $effect(() => {
    const path = selectedPath;
    if (!path) return;
    loadPreview(path);
  });

  function groupConflictFiles(items) {
    const grouped = new Map();
    for (const file of items) {
      const key = file.binary ? 'binary' : file.kind || 'unmerged';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(file);
    }
    return [...grouped.entries()]
      .sort(([left], [right]) => (groupOrder.indexOf(left) === -1 ? 99 : groupOrder.indexOf(left)) - (groupOrder.indexOf(right) === -1 ? 99 : groupOrder.indexOf(right)))
      .map(([kind, groupFiles]) => ({ kind, label: groupLabels[kind] ?? groupFiles[0]?.kindLabel ?? kind, files: groupFiles.sort((a, b) => a.path.localeCompare(b.path)) }));
  }

  async function loadPreview(path) {
    const requestId = ++previewRequestId;
    previewLoading = true;
    previewError = '';
    try {
      const result = await onLoadConflictPreview(path);
      if (requestId !== previewRequestId) return;
      preview = result;
    } catch (error) {
      if (requestId !== previewRequestId) return;
      preview = null;
      previewError = String(error);
    } finally {
      if (requestId === previewRequestId) previewLoading = false;
    }
  }

  function lineClass(line) {
    const text = String(line ?? '');
    if (text.startsWith('<<<<<<<') || text.startsWith('=======') || text.startsWith('>>>>>>>')) return 'marker';
    return '';
  }

  function fileKindLabel(file) {
    return file?.kindLabel ?? groupLabels[file?.kind] ?? 'Unmerged';
  }
</script>

<section class="conflict-workspace" aria-label="Conflict resolution">
  <header class="conflict-header">
    <div>
      <p class="eyebrow">Repository conflict state</p>
      <h2>{operationLabel} paused by conflicts</h2>
      <p>{conflictState?.nextStep}</p>
    </div>
    <div class="conflict-next-actions ui-action-group" aria-label="Conflict operation actions">
      <button type="button" disabled={!canContinue} onclick={onContinueConflictOperation}>Continue {operationLabel}</button>
      <button type="button" class="ui-button danger" disabled={!canAbort} onclick={onAbortConflictOperation}>Abort {operationLabel}</button>
    </div>
  </header>

  <div class="conflict-guidance" role="status" aria-live="polite">
    <strong>{unresolvedCount} conflicted {unresolvedCount === 1 ? 'file' : 'files'}</strong>
    <span>Forker is read-only here: resolve in your editor, then mark files resolved. Abort can overwrite or remove conflict-resolution edits.</span>
  </div>

  <div class="conflict-layout">
    <aside class="conflict-file-list" aria-label="Conflicted files grouped by type">
      {#each groups as group (group.kind)}
        <section class="conflict-group">
          <h3>{group.label}<span>{group.files.length}</span></h3>
          {#each group.files as file (file.path)}
            <button type="button" class:active={selectedPath === file.path} class="ui-row conflict-file-row" onclick={() => selectedPath = file.path}>
              <span class="conflict-file-status">{file.status}</span>
              <span class="conflict-file-path" title={file.path}>{file.path}</span>
              {#if file.binary}<span class="conflict-file-badge">binary</span>{/if}
            </button>
          {/each}
        </section>
      {:else}
        <div class="conflict-empty">
          <strong>No unresolved files remain.</strong>
          <span>Continue the {operationLabel.toLowerCase()} or refresh if the operation has already completed.</span>
        </div>
      {/each}
    </aside>

    <section class="conflict-preview" aria-label="Conflict preview">
      <header class="pane-header conflict-preview-header">
        <div>
          <strong>{selectedFile?.path ?? repo?.name ?? 'Conflict preview'}</strong>
          <span>{selectedFile ? fileKindLabel(selectedFile) : 'Ready to continue'}</span>
        </div>
        <div class="header-actions ui-header-actions">
          <button type="button" disabled={!selectedFile || !!actionBusy} onclick={() => onOpenConflictExternal(selectedFile.path)}>Open in editor</button>
          <button type="button" disabled={!selectedFile || !!actionBusy} onclick={() => onMarkConflictResolved(selectedFile.path)}>Mark resolved</button>
        </div>
      </header>

      {#if previewLoading}
        <div class="empty-state" role="status">Loading conflict preview…</div>
      {:else if previewError}
        <div class="empty-state error" role="alert">Preview unavailable: {previewError}</div>
      {:else if preview}
        <div class="conflict-panes" aria-label="Read-only ours base theirs and result panes">
          {@render previewPane(preview.ours, 'Ours')}
          {@render previewPane(preview.base, 'Base')}
          {@render previewPane(preview.theirs, 'Theirs')}
          {@render previewPane(preview.result, 'Working result', true)}
        </div>
      {:else}
        <div class="empty-state">Select a conflicted file to preview ours, base, theirs, and the current working result.</div>
      {/if}
    </section>
  </div>
</section>

{#snippet previewPane(side, title, emphasizeMarkers = false)}
  <section class="conflict-pane" aria-label={title}>
    <header>
      <strong>{title}</strong>
      {#if side?.truncated}<span>truncated</span>{/if}
    </header>
    {#if !side?.available || side?.binary}
      <div class="conflict-pane-message">{side?.message || 'This side is unavailable.'}</div>
    {:else}
      <div class="conflict-code" class:emphasize-markers={emphasizeMarkers}>
        {#each side.lines as line, index (`${title}-${index}`)}
          <div class="conflict-code-line {lineClass(line)}">
            <span class="line-no">{index + 1}</span>
            <code>{line || ' '}</code>
          </div>
        {/each}
      </div>
      {#if side.message}<p class="conflict-pane-note">{side.message}</p>{/if}
    {/if}
  </section>
{/snippet}
