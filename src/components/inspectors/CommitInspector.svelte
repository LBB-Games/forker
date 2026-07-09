<script>
  import { loadCommitDiff } from '../../lib/gitClient.js';
  import { commitMetadataText, diffContextLineCount, diffRowsToText, shortHash, statMeta } from '../../lib/inspectorUtils.js';
  import InspectorHeader from './InspectorHeader.svelte';
  import InspectorStatus from './InspectorStatus.svelte';
  import ReadOnlyDiffView from './ReadOnlyDiffView.svelte';

  let {
    titleId = undefined,
    inspector,
    repo = {},
    commits = [],
    preferences = {},
    onCopyText = () => {},
  } = $props();

  let selectedFilePath = $state('');
  let lastCommitId = $state('');
  let info = $state(null);
  let diffRows = $state([]);
  let loadingKey = $state('');
  let error = $state('');
  let cache = $state({});

  function commitMatches(commit, id) {
    if (!commit?.id || !id) return false;
    return commit.id === id || id.startsWith(commit.id) || commit.id.startsWith(id);
  }

  function cacheKey(filePath = selectedFilePath) {
    return [inspector?.repoPath ?? '', commitId, filePath ?? '', diffContextLineCount(preferences)].join('\u001f');
  }

  async function loadDiff(filePath = selectedFilePath, force = false) {
    if (!inspector?.repoPath || !commitId) return;
    const key = cacheKey(filePath);
    if (!force && cache[key]) {
      info = cache[key].info;
      diffRows = cache[key].diffRows;
      error = '';
      return;
    }

    loadingKey = key;
    error = '';
    try {
      const result = await loadCommitDiff(inspector.repoPath, commitId, filePath || null, diffContextLineCount(preferences));
      if (loadingKey !== key) return;
      const normalized = {
        ...result,
        changedPaths: result?.changedPaths ?? [],
        diffRows: result?.diffRows ?? [],
        selectedFilePath: result?.selectedFilePath ?? filePath,
        shortId: result?.shortId ?? shortHash(result?.id ?? commitId),
        authorEmail: result?.authorEmail ?? '',
      };
      info = normalized;
      diffRows = normalized.diffRows;
      cache = { ...cache, [key]: { info: normalized, diffRows: normalized.diffRows } };
    } catch (loadError) {
      if (loadingKey !== key) return;
      error = String(loadError);
      diffRows = [];
    } finally {
      if (loadingKey === key) loadingKey = '';
    }
  }

  let commitId = $derived(inspector?.params?.commitId ?? '');
  let knownCommit = $derived(commits.find((commit) => commitMatches(commit, commitId)) ?? null);
  let currentKey = $derived(cacheKey(selectedFilePath));
  let loading = $derived(loadingKey === currentKey && !diffRows.length);
  let staleRepo = $derived(!!inspector?.repoPath && !!repo?.path && inspector.repoPath !== repo.path);
  let changedPaths = $derived(info?.changedPaths ?? knownCommit?.changedPaths ?? []);
  let changedFiles = $derived((changedPaths ?? []).filter((file) => typeof file === 'object'));
  let title = $derived(info?.subject || knownCommit?.subject || commitId || 'Commit');
  let short = $derived(info?.shortId || shortHash(commitId));
  let parentLabel = $derived((info?.parents?.length ?? knownCommit?.parents?.length ?? 0) ? `${info?.parents?.length ?? knownCommit?.parents?.length} parent${(info?.parents?.length ?? knownCommit?.parents?.length) === 1 ? '' : 's'}` : 'root commit');
  let selectedFile = $derived(changedFiles.find((file) => file.path === selectedFilePath) ?? null);

  $effect(() => {
    if (commitId === lastCommitId) return;
    selectedFilePath = inspector?.params?.filePath ?? '';
    lastCommitId = commitId;
    info = null;
    diffRows = [];
    error = '';
  });

  $effect(() => {
    if (!commitId || staleRepo) return;
    if (cache[currentKey]) {
      info = cache[currentKey].info;
      diffRows = cache[currentKey].diffRows;
      error = '';
      return;
    }
    if (loadingKey === currentKey) return;
    loadDiff(selectedFilePath);
  });

  $effect(() => {
    if (!selectedFilePath && info?.changedPaths?.length) {
      const firstPath = info.changedPaths.find((file) => file?.path)?.path;
      if (firstPath) selectedFilePath = firstPath;
    }
  });

  function metadataForCopy() {
    if (info) return commitMetadataText(info);
    if (!knownCommit) return commitId;
    return [
      `Commit: ${knownCommit.id}`,
      `Subject: ${knownCommit.subject}`,
      `Author: ${knownCommit.author}`,
      `Date: ${knownCommit.date}`,
      `Parents: ${(knownCommit.parents ?? []).join(', ') || 'root commit'}`,
      `Files: ${knownCommit.files}`,
      `Stats: +${knownCommit.insertions} −${knownCommit.deletions}`,
    ].join('\n');
  }
</script>

<article class="inspector-surface commit-inspector">
  <InspectorHeader
    {titleId}
    eyebrow="Commit inspector"
    {title}
    subtitle={`${short} · ${parentLabel}`}
    meta={[
      { label: 'Repository', value: repo?.name ?? 'Repository' },
      { label: 'Hash', value: info?.id ?? commitId },
      { label: 'Refs', value: (info?.refs ?? knownCommit?.refs ?? []).join(', ') || 'none' },
      { label: 'Author', value: info?.author ?? knownCommit?.author ?? 'Unknown' },
      { label: 'Date', value: info?.date ?? knownCommit?.date ?? 'Unknown' },
      { label: 'Files', value: String(info?.files ?? knownCommit?.files ?? changedFiles.length ?? 0) },
      ...statMeta(info?.insertions ?? knownCommit?.insertions ?? 0, info?.deletions ?? knownCommit?.deletions ?? 0),
    ]}
  >
    {#snippet actions()}
      <button type="button" disabled={!commitId} onclick={() => onCopyText(info?.id ?? commitId)}>Copy hash</button>
      <button type="button" disabled={!title} onclick={() => onCopyText(title)}>Copy subject</button>
      <button type="button" disabled={!commitId} onclick={() => onCopyText(metadataForCopy())}>Copy metadata</button>
    {/snippet}
  </InspectorHeader>

  <div class="inspector-body commit-inspector-body">
    {#if staleRepo}
      <InspectorStatus tone="stale" title="Inspector belongs to another repository" message="This commit inspector was opened for a repository that is no longer active." />
    {:else if error}
      <InspectorStatus tone="error" title="Commit diff unavailable" message={error} actionLabel="Retry" onAction={() => loadDiff(selectedFilePath, true)} />
    {:else}
      <aside class="inspector-list-panel" aria-label="Files changed in commit">
        <div class="inspector-panel-heading">
          <strong>Changed files</strong>
          <span>{changedFiles.length ? `${changedFiles.length} files` : 'Waiting for Git metadata'}</span>
        </div>
        <div class="inspector-file-list">
          {#each changedFiles as file (file.path + file.status)}
            <button type="button" class:selected={file.path === selectedFilePath} onclick={() => selectedFilePath = file.path}>
              <span class="status-pill {file.tone}">{file.status}</span>
              <strong title={file.path}>{file.path}</strong>
              <code>{file.lines}</code>
            </button>
          {:else}
            <InspectorStatus tone={loading ? 'loading' : 'empty'} title={loading ? 'Loading changed files…' : 'No changed files'} message={loading ? 'Forker is reading commit metadata from Git.' : 'Git did not report changed files for this commit.'} />
          {/each}
        </div>
      </aside>

      <section class="inspector-preview-panel" aria-label="Commit diff preview">
        <div class="inspector-panel-heading">
          <strong>{selectedFile ? selectedFile.path : 'Commit diff'}</strong>
          <span>{selectedFile ? selectedFile.lines : 'Read-only patch'}</span>
        </div>
        {#if loading}
          <InspectorStatus tone="loading" title="Loading commit diff…" message="Forker is asking Git for a read-only patch." />
        {:else}
          <ReadOnlyDiffView
            lines={diffRows}
            {preferences}
            ariaLabel={selectedFile ? `Read-only diff for ${selectedFile.path} in ${short}` : `Read-only commit diff for ${short}`}
            emptyTitle="No text diff for this selection"
            emptyMessage="This file may be binary, renamed without text edits, or unsupported by the current Git diff output."
          />
        {/if}
      </section>
    {/if}
  </div>
</article>
