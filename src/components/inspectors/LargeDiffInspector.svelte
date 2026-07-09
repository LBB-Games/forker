<script>
  import { loadFileDiff } from '../../lib/gitClient.js';
  import { changedPathKey, diffContextLineCount, diffRowsToText, lineStatsFromRows, sameChangedFile, statusSummary } from '../../lib/inspectorUtils.js';
  import InspectorHeader from './InspectorHeader.svelte';
  import InspectorStatus from './InspectorStatus.svelte';
  import ReadOnlyDiffView from './ReadOnlyDiffView.svelte';

  let {
    titleId = undefined,
    inspector,
    repo = {},
    changedFiles = [],
    selectedChangedFile = null,
    selectedDiffLines = [],
    selectedDiffKey = '',
    diffLoadingKey = '',
    preferences = {},
    onCopyText = () => {},
    onOpenInspector = () => {},
  } = $props();

  let localRows = $state([]);
  let localRowsKey = $state('');
  let loadingKey = $state('');
  let error = $state('');

  function targetChangedFile() {
    const params = inspector?.params ?? {};
    const exact = changedFiles.find((file) => file.path === params.filePath && file.section === params.section && file.status === params.status);
    if (exact) return exact;
    return changedFiles.find((file) => file.path === params.filePath && file.section === params.section) ?? null;
  }

  function descriptorKey(file) {
    return file ? `${inspector.repoPath}\u001f${changedPathKey(file)}\u001f${diffContextLineCount(preferences)}` : '';
  }

  async function loadInspectorDiff(key, file) {
    if (!file?.path || !inspector?.repoPath) return;
    loadingKey = key;
    error = '';
    try {
      const rows = await loadFileDiff(inspector.repoPath, file.path, file.section === 'staged', file.status, diffContextLineCount(preferences));
      if (loadingKey !== key) return;
      localRows = Array.isArray(rows) ? rows : [];
      localRowsKey = key;
    } catch (loadError) {
      if (loadingKey !== key) return;
      error = String(loadError);
      localRows = [];
      localRowsKey = '';
    } finally {
      if (loadingKey === key) loadingKey = '';
    }
  }

  let targetFile = $derived(targetChangedFile());
  let key = $derived(descriptorKey(targetFile));
  let targetFileKey = $derived(targetFile ? `${targetFile.section}:${targetFile.path}` : '');
  let primaryRowsAvailable = $derived(sameChangedFile(targetFile, selectedChangedFile) && selectedDiffLines.length > 0);
  let rows = $derived(primaryRowsAvailable ? selectedDiffLines : (localRowsKey === key ? localRows : []));
  let loading = $derived(!!targetFile && ((!!diffLoadingKey && diffLoadingKey === targetFileKey) || loadingKey === key) && !rows.length);
  let stats = $derived(lineStatsFromRows(rows));
  let staleRepo = $derived(!!inspector?.repoPath && !!repo?.path && inspector.repoPath !== repo.path);
  let subtitle = $derived(targetFile ? statusSummary(targetFile) : `${inspector?.params?.section ?? 'file'} · ${inspector?.params?.status ?? ''}`.trim());

  $effect(() => {
    if (!targetFile || staleRepo || primaryRowsAvailable || !key || localRowsKey === key || loadingKey === key) return;
    loadInspectorDiff(key, targetFile);
  });
</script>

<article class="inspector-surface large-diff-inspector">
  <InspectorHeader
    {titleId}
    eyebrow="Working tree diff"
    title={inspector?.params?.filePath ?? 'Selected file diff'}
    {subtitle}
    meta={[
      { label: 'Repository', value: repo?.name ?? 'Repository' },
      { label: 'Hunks', value: String(stats.hunks) },
      { label: 'Additions', value: `+${stats.additions}`, tone: 'success' },
      { label: 'Deletions', value: `−${stats.deletions}`, tone: 'danger' },
    ]}
  >
    {#snippet actions()}
      <button type="button" disabled={!targetFile} onclick={() => onCopyText(targetFile.path)}>Copy path</button>
      <button type="button" disabled={!rows.length} onclick={() => onCopyText(diffRowsToText(rows))}>Copy diff</button>
      <button type="button" disabled={!targetFile} onclick={() => onOpenInspector('file-history', { filePath: targetFile.path, section: targetFile.section, status: targetFile.status })}>Show file history</button>
    {/snippet}
  </InspectorHeader>

  <div class="inspector-body diff-inspector-body">
    {#if staleRepo}
      <InspectorStatus tone="stale" title="Inspector belongs to another repository" message="This diff was opened for a repository that is no longer active. Close the inspector or switch back to that repository." />
    {:else if !targetFile}
      <InspectorStatus tone="stale" title="Selection is no longer changed" message="Git no longer reports this file in the staged or unstaged changes list. Refresh or choose another changed file." />
    {:else if error}
      <InspectorStatus tone="error" title="Diff unavailable" message={error} actionLabel="Retry" onAction={() => loadInspectorDiff(key, targetFile)} />
    {:else if loading}
      <InspectorStatus tone="loading" title="Loading file diff…" message="Forker is asking Git for the current read-only diff rows." />
    {:else}
      <ReadOnlyDiffView
        lines={rows}
        {preferences}
        ariaLabel={`Read-only larger diff for ${targetFile.path}`}
        emptyTitle="No diff rows for this file"
        emptyMessage="Git did not return text diff rows. The file may be binary, renamed without text changes, or no longer match this inspector descriptor."
      />
    {/if}
  </div>
</article>
