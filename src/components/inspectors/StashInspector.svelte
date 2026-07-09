<script>
  import { loadStashDiff } from '../../lib/gitClient.js';
  import { diffContextLineCount, diffRowsToText, statMeta } from '../../lib/inspectorUtils.js';
  import InspectorHeader from './InspectorHeader.svelte';
  import InspectorStatus from './InspectorStatus.svelte';
  import ReadOnlyDiffView from './ReadOnlyDiffView.svelte';

  let {
    titleId = undefined,
    inspector,
    repo = {},
    stashes = [],
    preferences = {},
    onCopyText = () => {},
    onRunGitAction = () => {},
  } = $props();

  let selectedStashRef = $state('');
  let selectedFilePath = $state('');
  let info = $state(null);
  let diffRows = $state([]);
  let loadingKey = $state('');
  let error = $state('');
  let cache = $state({});
  let lastRequestedStashRef = $state('');

  function stashCount(stash) {
    return stash?.changedFiles ?? 0;
  }

  function stashShortId(stash) {
    return stash?.shortId ?? '';
  }

  function stashTitle(stash) {
    return stash?.message || stash?.subject || stash?.reference || 'Stash';
  }

  function cacheKey(stashRef = selectedStashRef, filePath = selectedFilePath) {
    return [inspector?.repoPath ?? '', stashRef ?? '', filePath ?? '', diffContextLineCount(preferences)].join('\u001f');
  }

  async function loadDiff(stashRef = selectedStashRef, filePath = selectedFilePath, force = false) {
    if (!inspector?.repoPath || !stashRef) return;
    const key = cacheKey(stashRef, filePath);
    if (!force && cache[key]) {
      info = cache[key].info;
      diffRows = cache[key].diffRows;
      error = '';
      return;
    }

    loadingKey = key;
    error = '';
    try {
      const result = await loadStashDiff(inspector.repoPath, stashRef, filePath || null, diffContextLineCount(preferences));
      if (loadingKey !== key) return;
      const normalized = {
        ...result,
        selectedFilePath: result?.selectedFilePath ?? filePath,
        changedPaths: result?.changedPaths ?? [],
        diffRows: result?.diffRows ?? [],
      };
      info = normalized;
      diffRows = normalized.diffRows;
      if (normalized.selectedFilePath && normalized.selectedFilePath !== selectedFilePath) selectedFilePath = normalized.selectedFilePath;
      cache = { ...cache, [key]: { info: normalized, diffRows: normalized.diffRows } };
    } catch (loadError) {
      if (loadingKey !== key) return;
      error = String(loadError);
      diffRows = [];
    } finally {
      if (loadingKey === key) loadingKey = '';
    }
  }

  function selectStash(reference) {
    if (!reference || reference === selectedStashRef) return;
    selectedStashRef = reference;
    selectedFilePath = '';
    info = null;
    diffRows = [];
    error = '';
  }

  function applySelected() {
    if (!selectedStashRef) return;
    onRunGitAction('git_stash_apply', { stashRef: selectedStashRef }, 'Apply stash');
  }

  function popSelected() {
    const stash = selectedStash;
    if (!stash?.reference) return;
    onRunGitAction('git_stash_pop', { stashRef: stash.reference }, 'Pop stash', {
      confirmTitle: `Pop ${stash.reference}?`,
      confirmMessage: 'Pop applies this stash to the working tree and drops it if Git succeeds. If conflicts occur, Git normally keeps the stash, but your working tree may need conflict resolution.',
      confirmLabel: 'Pop stash',
      confirmItems: [stash.subject || stash.message || stash.reference],
      danger: true,
      alwaysConfirm: true,
    });
  }

  function dropSelected() {
    const stash = selectedStash;
    if (!stash?.reference) return;
    onRunGitAction('git_stash_drop', { stashRef: stash.reference }, 'Drop stash', {
      confirmTitle: `Drop ${stash.reference}?`,
      confirmMessage: 'This permanently deletes the stash entry. Forker cannot recover a dropped stash for you.',
      confirmLabel: 'Drop stash',
      confirmItems: [stash.subject || stash.message || stash.reference],
      danger: true,
      alwaysConfirm: true,
    });
  }

  function copyMetadata() {
    const stash = info?.stash ?? selectedStash;
    if (!stash) return;
    onCopyText([
      `Stash: ${stash.reference}`,
      `Hash: ${stashShortId(stash)}`,
      `Branch: ${stash.branch || 'unknown'}`,
      `Date: ${stash.date || 'unknown'}`,
      `Message: ${stash.message || stash.subject}`,
      `Files: ${info?.files ?? stashCount(stash)}`,
      `Stats: +${info?.insertions ?? 0} −${info?.deletions ?? 0}`,
    ].join('\n'));
  }

  let requestedStashRef = $derived(inspector?.params?.stashRef ?? '');
  let selectedStash = $derived(stashes.find((stash) => stash.reference === selectedStashRef) ?? stashes[0] ?? null);
  let currentKey = $derived(cacheKey(selectedStashRef, selectedFilePath));
  let loading = $derived(loadingKey === currentKey && !diffRows.length);
  let staleRepo = $derived(!!inspector?.repoPath && !!repo?.path && inspector.repoPath !== repo.path);
  let changedFiles = $derived(info?.changedPaths ?? []);
  let selectedFile = $derived(changedFiles.find((file) => file.path === selectedFilePath) ?? null);
  let selectedTitle = $derived(stashTitle(info?.stash ?? selectedStash));
  let subtitle = $derived(selectedStash ? `${selectedStash.reference}${selectedStash.branch ? ` · ${selectedStash.branch}` : ''}` : 'No stashes saved');

  $effect(() => {
    const requestedExists = requestedStashRef && stashes.some((stash) => stash.reference === requestedStashRef);
    const preferred = requestedExists ? requestedStashRef : stashes[0]?.reference ?? '';
    if (requestedExists && requestedStashRef !== lastRequestedStashRef) {
      lastRequestedStashRef = requestedStashRef;
      selectedStashRef = requestedStashRef;
      selectedFilePath = '';
      info = null;
      diffRows = [];
      error = '';
      return;
    }
    if (!requestedStashRef) lastRequestedStashRef = '';
    if (!selectedStashRef || !stashes.some((stash) => stash.reference === selectedStashRef)) {
      selectedStashRef = preferred;
      selectedFilePath = '';
      info = null;
      diffRows = [];
      error = '';
    }
  });

  $effect(() => {
    if (!selectedStashRef || staleRepo) return;
    if (cache[currentKey]) {
      info = cache[currentKey].info;
      diffRows = cache[currentKey].diffRows;
      error = '';
      return;
    }
    if (loadingKey === currentKey) return;
    loadDiff(selectedStashRef, selectedFilePath);
  });
</script>

<article class="inspector-surface stash-inspector">
  <InspectorHeader
    {titleId}
    eyebrow="Stash manager"
    title={selectedTitle}
    {subtitle}
    meta={selectedStash ? [
      { label: 'Repository', value: repo?.name ?? 'Repository' },
      { label: 'Ref', value: selectedStash.reference },
      { label: 'Hash', value: stashShortId(selectedStash) || 'unknown' },
      { label: 'Date', value: selectedStash.date || 'unknown' },
      { label: 'Files', value: String(info?.files ?? stashCount(selectedStash)) },
      ...statMeta(info?.insertions ?? 0, info?.deletions ?? 0),
    ] : [{ label: 'Repository', value: repo?.name ?? 'Repository' }]}
  >
    {#snippet actions()}
      <button type="button" disabled={!selectedStashRef} onclick={applySelected}>Apply</button>
      <button type="button" disabled={!selectedStashRef} onclick={popSelected}>Pop…</button>
      <button type="button" disabled={!selectedStashRef} onclick={dropSelected}>Drop…</button>
      <button type="button" disabled={!selectedStashRef} onclick={() => onCopyText(selectedStashRef)}>Copy ref</button>
      <button type="button" disabled={!selectedStashRef} onclick={copyMetadata}>Copy metadata</button>
      <button type="button" disabled={!diffRows.length} onclick={() => onCopyText(diffRowsToText(diffRows))}>Copy patch</button>
    {/snippet}
  </InspectorHeader>

  <div class="inspector-body stash-inspector-body">
    {#if staleRepo}
      <InspectorStatus tone="stale" title="Inspector belongs to another repository" message="This stash inspector was opened for a repository that is no longer active." />
    {:else if !stashes.length}
      <InspectorStatus tone="empty" title="No stashes saved" message="Use Stash working tree changes to save tracked and untracked edits for later." />
    {:else if error}
      <InspectorStatus tone="error" title="Stash diff unavailable" message={error} actionLabel="Retry" onAction={() => loadDiff(selectedStashRef, selectedFilePath, true)} />
    {:else}
      <aside class="inspector-list-panel" aria-label="Saved stashes">
        <div class="inspector-panel-heading">
          <strong>Saved stashes</strong>
          <span>{stashes.length} {stashes.length === 1 ? 'stash' : 'stashes'}</span>
        </div>
        <div class="inspector-history-list stash-history-list">
          {#each stashes as stash (stash.reference)}
            <button type="button" class:selected={stash.reference === selectedStashRef} onclick={() => selectStash(stash.reference)}>
              <strong title={stash.subject}>{stashTitle(stash)}</strong>
              <span>{stash.branch || 'unknown branch'} · {stash.date || 'unknown date'} · {stashCount(stash)} files</span>
              <code>{stash.reference}</code>
              <em>{stashShortId(stash)}</em>
            </button>
          {/each}
        </div>
      </aside>

      <section class="inspector-preview-panel" aria-label="Stash diff preview">
        <div class="inspector-panel-heading">
          <strong>{selectedFile ? selectedFile.path : 'Stash diff'}</strong>
          <span>{selectedFile ? selectedFile.lines : 'Read-only patch'}</span>
        </div>
        {#if loading}
          <InspectorStatus tone="loading" title="Loading stash diff…" message="Forker is asking Git for a read-only stash patch." />
        {:else}
          <div class="stash-preview-layout">
            <aside class="inspector-file-list stash-file-list" aria-label="Files in selected stash">
              {#each changedFiles as file (file.path + file.status)}
                <button type="button" class:selected={file.path === selectedFilePath} onclick={() => selectedFilePath = file.path}>
                  <span class="status-pill {file.tone}">{file.status}</span>
                  <strong title={file.path}>{file.path}</strong>
                  <code>{file.lines}</code>
                </button>
              {:else}
                <InspectorStatus tone={loading ? 'loading' : 'empty'} title={loading ? 'Loading changed files…' : 'No changed files'} message={loading ? 'Forker is reading stash metadata from Git.' : 'Git did not report changed files for this stash.'} />
              {/each}
            </aside>
            <ReadOnlyDiffView
              lines={diffRows}
              {preferences}
              ariaLabel={selectedFile ? `Read-only diff for ${selectedFile.path} in ${selectedStashRef}` : `Read-only stash diff for ${selectedStashRef}`}
              emptyTitle="No text diff for this selection"
              emptyMessage="This file may be binary, renamed without text edits, or unsupported by the current Git stash diff output."
            />
          </div>
        {/if}
      </section>
    {/if}
  </div>
</article>
