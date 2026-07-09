<script>
  import { loadFileHistory } from '../../lib/gitClient.js';
  import { shortHash } from '../../lib/inspectorUtils.js';
  import InspectorHeader from './InspectorHeader.svelte';
  import InspectorStatus from './InspectorStatus.svelte';

  let {
    titleId = undefined,
    inspector,
    repo = {},
    onCopyText = () => {},
    onOpenInspector = () => {},
  } = $props();

  const HISTORY_LIMIT = 80;

  let info = $state(null);
  let loadingKey = $state('');
  let error = $state('');
  let cache = $state({});
  let filterText = $state('');
  let selectedEntryId = $state('');
  let listEl = $state();

  function cacheKey() {
    return [inspector?.repoPath ?? '', filePath, HISTORY_LIMIT].join('\u001f');
  }

  async function loadHistory(force = false) {
    if (!inspector?.repoPath || !filePath) return;
    const key = cacheKey();
    if (!force && cache[key]) {
      info = cache[key];
      error = '';
      return;
    }
    loadingKey = key;
    error = '';
    try {
      const result = await loadFileHistory(inspector.repoPath, filePath, HISTORY_LIMIT, 0);
      if (loadingKey !== key) return;
      const normalized = {
        ...result,
        bestEffortRenameFollowing: result?.bestEffortRenameFollowing ?? true,
        entries: result?.entries ?? [],
      };
      info = normalized;
      cache = { ...cache, [key]: normalized };
    } catch (loadError) {
      if (loadingKey !== key) return;
      error = String(loadError);
      info = null;
    } finally {
      if (loadingKey === key) loadingKey = '';
    }
  }

  function matchesFilter(entry, query) {
    if (!query) return true;
    return [entry.subject, entry.author, entry.date, entry.id, entry.shortId, ...(entry.refs ?? [])]
      .join(' ')
      .toLowerCase()
      .includes(query);
  }

  function focusEntry(index) {
    const entry = filteredEntries[index];
    if (!entry) return;
    selectedEntryId = entry.id;
    requestAnimationFrame(() => listEl?.querySelector(`[data-entry-id="${entry.id}"]`)?.focus());
  }

  function handleListKeydown(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key)) return;
    if (!filteredEntries.length) return;
    const currentIndex = Math.max(0, filteredEntries.findIndex((entry) => entry.id === selectedEntryId));
    if (event.key === 'Enter') {
      event.preventDefault();
      openSelectedCommit();
      return;
    }
    event.preventDefault();
    if (event.key === 'ArrowDown') focusEntry(Math.min(filteredEntries.length - 1, currentIndex + 1));
    if (event.key === 'ArrowUp') focusEntry(Math.max(0, currentIndex - 1));
    if (event.key === 'Home') focusEntry(0);
    if (event.key === 'End') focusEntry(filteredEntries.length - 1);
  }

  function openSelectedCommit() {
    const entry = selectedEntry;
    if (!entry?.id) return;
    onOpenInspector('commit', { commitId: entry.id, filePath });
  }

  let filePath = $derived(inspector?.params?.filePath ?? '');
  let key = $derived(cacheKey());
  let loading = $derived(loadingKey === key && !info);
  let staleRepo = $derived(!!inspector?.repoPath && !!repo?.path && inspector.repoPath !== repo.path);
  let entries = $derived(info?.entries ?? []);
  let normalizedFilter = $derived(filterText.trim().toLowerCase());
  let filteredEntries = $derived(entries.filter((entry) => matchesFilter(entry, normalizedFilter)));
  let selectedEntry = $derived(filteredEntries.find((entry) => entry.id === selectedEntryId) ?? filteredEntries[0] ?? null);

  $effect(() => {
    if (!filePath || staleRepo) return;
    if (cache[key]) {
      info = cache[key];
      error = '';
      return;
    }
    if (loadingKey === key) return;
    loadHistory();
  });

  $effect(() => {
    if (!filteredEntries.length) {
      selectedEntryId = '';
      return;
    }
    if (!filteredEntries.some((entry) => entry.id === selectedEntryId)) selectedEntryId = filteredEntries[0].id;
  });
</script>

<article class="inspector-surface file-history-inspector">
  <InspectorHeader
    {titleId}
    eyebrow="File history"
    title={filePath || 'Selected file'}
    subtitle="History follows renames when Git can resolve them. Rename tracking is best-effort."
    meta={[
      { label: 'Repository', value: repo?.name ?? 'Repository' },
      { label: 'Loaded', value: String(entries.length) },
      { label: 'Limit', value: String(HISTORY_LIMIT) },
    ]}
  >
    {#snippet actions()}
      <button type="button" disabled={!filePath} onclick={() => onCopyText(filePath)}>Copy path</button>
      <button type="button" disabled={!selectedEntry} onclick={openSelectedCommit}>Open selected commit</button>
    {/snippet}
  </InspectorHeader>

  <div class="inspector-body history-inspector-body">
    {#if staleRepo}
      <InspectorStatus tone="stale" title="Inspector belongs to another repository" message="This file history was opened for a repository that is no longer active." />
    {:else if error}
      <InspectorStatus tone="error" title="File history unavailable" message={error} actionLabel="Retry" onAction={() => loadHistory(true)} />
    {:else if loading}
      <InspectorStatus tone="loading" title="Loading file history…" message="Forker is reading a bounded, read-only Git log for this path." />
    {:else}
      <aside class="inspector-list-panel" aria-label="File history commits">
        <div class="inspector-panel-heading stackable">
          <div>
            <strong>Commits touching this path</strong>
            <span>{normalizedFilter ? `${filteredEntries.length} of ${entries.length} match` : `${entries.length} loaded`}</span>
          </div>
          <label class="filter-field inspector-filter"><span>⌕</span><input bind:value={filterText} placeholder="Filter history" aria-label="Filter file history by subject, hash, author, date, or ref" /></label>
        </div>
        <div class="inspector-history-list" bind:this={listEl} role="listbox" tabindex="0" aria-label={`History for ${filePath}`} onkeydown={handleListKeydown}>
          {#each filteredEntries as entry (entry.id)}
            <button
              type="button"
              role="option"
              class:selected={entry.id === selectedEntryId}
              aria-selected={entry.id === selectedEntryId}
              tabindex={entry.id === selectedEntryId ? 0 : -1}
              data-entry-id={entry.id}
              onclick={() => selectedEntryId = entry.id}
              ondblclick={openSelectedCommit}
            >
              <strong title={entry.subject}>{entry.subject}</strong>
              <span>{entry.author} · {entry.date}</span>
              <code>{entry.shortId || shortHash(entry.id)}</code>
              <em>{entry.lines}</em>
            </button>
          {:else}
            <InspectorStatus tone="empty" title={normalizedFilter ? 'No matching commits' : 'No file history'} message={normalizedFilter ? 'Clear the filter to return to the loaded file history.' : 'Git did not return commits for this path. The file may be new, removed, or outside this branch history.'} />
          {/each}
        </div>
      </aside>

      <section class="inspector-preview-card" aria-label="Selected file history commit preview">
        {#if selectedEntry}
          <span class="inspector-eyebrow">Selected history row</span>
          <h2>{selectedEntry.subject}</h2>
          <dl>
            <div><dt>Commit</dt><dd><code>{selectedEntry.id}</code></dd></div>
            <div><dt>Author</dt><dd>{selectedEntry.author}</dd></div>
            <div><dt>Date</dt><dd>{selectedEntry.date}</dd></div>
            <div><dt>Parents</dt><dd>{selectedEntry.parents?.length ? selectedEntry.parents.join(', ') : 'root commit'}</dd></div>
            <div><dt>Stats</dt><dd>{selectedEntry.files} files · {selectedEntry.lines}</dd></div>
          </dl>
          <div class="inspector-preview-actions ui-action-group">
            <button type="button" onclick={openSelectedCommit}>Open commit inspector</button>
            <button type="button" onclick={() => onCopyText(selectedEntry.id)}>Copy hash</button>
          </div>
        {:else}
          <InspectorStatus tone="empty" title="No history row selected" message="Select a commit row to preview metadata or open the commit inspector." />
        {/if}
      </section>
    {/if}
  </div>
</article>
