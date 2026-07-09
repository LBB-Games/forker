<script>
  import { tick } from 'svelte';
  import CommitGraphCell from './CommitGraphCell.svelte';
  import { commitsWithGraph } from '../lib/commitGraph.js';
  import { commitsReachableFromVisibleBranches } from '../lib/commitFilters.js';
  import { commitMenuItems } from '../lib/contextMenus.js';
  import { branchColorMap } from '../lib/branchColors.js';

  /**
   * @typedef {import('../lib/types.js').CommitInfo} CommitInfo
   * @typedef {import('../lib/types.js').ContextMenuItem} ContextMenuItem
   *
   * @typedef {Object} Props
   * @property {string} [selectedBranch]
   * @property {string} [selectedCommitId]
   * @property {CommitInfo[]} [commits]
   * @property {import('../lib/types.js').BranchInfo[]} [localBranches]
   * @property {Set<string>} [hiddenBranches]
   * @property {string[]} [remotes]
   * @property {Set<string>} [hiddenRemoteBranches]
   * @property {string} [actionBusy]
   * @property {(commitId: string) => void} [onSelectCommit]
   * @property {() => void} [onShowAllBranches]
   * @property {(command: string, args: object, label: string, options?: object) => void | Promise<void>} [onRunGitAction]
   * @property {(commit: CommitInfo) => void} [onRequestResetBranch]
   * @property {(event: Event, items: ContextMenuItem[]) => void} [onOpenContextMenu]
   * @property {(text: string) => void | Promise<void>} [onCopyText]
   * @property {(type: string, params: object) => void} [onOpenInspector]
   */

  /** @type {Props} */
  let {
    selectedBranch = '',
    selectedCommitId = '',
    commits = [],
    localBranches = [],
    hiddenBranches = new Set(),
    remotes = [],
    hiddenRemoteBranches = new Set(),
    actionBusy = '',
    onSelectCommit = () => {},
    onShowAllBranches = () => {},
    onRunGitAction = () => {},
    onRequestResetBranch = () => {},
    onOpenContextMenu = () => {},
    onCopyText = () => {},
    onOpenInspector = () => {}
  } = $props();

  let branchRefColorByName = $derived(trackedBranchColorMap(localBranches, remotes));
  let knownRemoteNames = $derived(remoteNameSet(remotes));

  function openCommitMenu(event, commit) {
    onSelectCommit(commit.id);
    onOpenContextMenu(event, commitMenuItems(commit, { actionBusy, onRunGitAction, onRequestResetBranch, onCopyText, onOpenInspector }));
  }

  function commitRefPills(refs = []) {
    const localBranchRefs = new Set(refs.filter((ref) => isLocalBranchRef(ref)));
    const pillsByType = { tag: [], remote: [], branch: [] };
    const seen = new Set();

    for (const ref of refs) {
      if (!ref) continue;

      if (ref.startsWith('tag: ')) {
        addPill(pillsByType.tag, seen, { label: ref.replace('tag: ', ''), type: 'tag', icon: '◇' });
        continue;
      }

      if (isRemoteRef(ref)) {
        const [remote, ...branchParts] = ref.split('/');
        const branch = branchParts.join('/');
        addPill(pillsByType.remote, seen, { label: remote, type: 'remote', icon: '⇄' });
        if (branch && !localBranchRefs.has(branch)) addPill(pillsByType.branch, seen, { label: branch, type: 'branch', colorKey: ref });
        continue;
      }

      addPill(pillsByType.branch, seen, { label: ref, type: 'branch' });
    }

    return [...pillsByType.tag, ...pillsByType.remote, ...pillsByType.branch];
  }

  function addPill(pills, seen, pill) {
    const key = `${pill.type}:${pill.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    pills.push(pill);
  }

  function isLocalBranchRef(ref) {
    return !ref.includes('/') && !ref.startsWith('tag: ');
  }

  function isRemoteRef(ref) {
    if (!ref.includes('/') || ref.startsWith('tag: ')) return false;
    const remoteName = ref.split('/')[0];
    return knownRemoteNames.has(remoteName);
  }

  function refStyle(ref) {
    if (ref.type !== 'branch') return '';

    return `--branch-color: ${branchRefColorByName.get(ref.colorKey ?? ref.label) ?? 'var(--accent)'};`;
  }

  function commitBranchColor(commit) {
    const branchRefs = (commit.refs ?? []).filter((ref) => ref && !ref.startsWith('tag: '));
    const localRef = branchRefs.find((ref) => isLocalBranchRef(ref));
    if (localRef) return branchRefColorByName.get(localRef) ?? null;
    const remoteRef = branchRefs.find((ref) => isRemoteRef(ref));
    if (remoteRef) return branchRefColorByName.get(remoteRef) ?? null;
    return null;
  }

  function remoteNameSet(remoteBranches = []) {
    return new Set(['origin', 'upstream', ...remoteBranches.map((remote) => String(remote || '').split('/')[0]).filter(Boolean)]);
  }

  function trackedBranchColorMap(branches = [], remoteBranches = []) {
    const trackedRemotes = new Set(branches.map((branch) => branch.upstream).filter(Boolean));
    const colors = branchColorMap([
      ...branches.map((branch) => branch.name),
      ...remoteBranches.filter((remote) => !trackedRemotes.has(remote)),
    ]);

    for (const branch of branches) {
      if (!branch.upstream || !colors.has(branch.name)) continue;
      colors.set(branch.upstream, colors.get(branch.name));
    }

    return colors;
  }

  function hasBranchTipRef(commit) {
    return (commit.refs ?? []).some((ref) => ref && !ref.startsWith('tag: '));
  }

  function stopTipLaneAboveNode(commit, connectedCommitIds) {
    if (!hasBranchTipRef(commit) || connectedCommitIds.has(commit.id)) return commit;
    const nodeLane = commit.graph?.nodeLane ?? 0;
    return {
      ...commit,
      graph: {
        ...commit.graph,
        topLanes: (commit.graph?.topLanes ?? []).filter((lane) => lane !== nodeLane),
      },
    };
  }

  function parentIds(commits) {
    return commits.reduce((ids, commit) => {
      for (const parent of commit.parents ?? []) ids.add(parent);
      return ids;
    }, new Set());
  }

  const graphLaneWidth = 14;
  const graphGutter = 8;
  let filterText = $state('');
  let commitTableEl = $state();

  function visibleBranchCount() {
    return localBranches.filter((branch) => !hiddenBranches.has(branch.name)).length + remotes.filter((branch) => !hiddenRemoteBranches.has(branch)).length;
  }


  function filterSummary() {
    if ((hiddenBranches.size || hiddenRemoteBranches.size) && normalizedFilter) return `${filteredCommits.length} of ${branchFilteredCommits.length} visible commits match`;
    if (hiddenBranches.size || hiddenRemoteBranches.size) return `${filteredCommits.length} commits across ${visibleBranchCount()} visible branches`;
    if (normalizedFilter) return `${filteredCommits.length} of ${commits.length} commits match`;
    return 'Most recent commit is selected when a local branch is chosen';
  }

  function matchesFilter(commit, query) {
    if (!query) return true;
    const haystack = [commit.subject, commit.author, commit.date, commit.id, ...(commit.refs ?? [])].join(' ').toLowerCase();
    return haystack.includes(query);
  }

  let normalizedFilter = $derived(filterText.trim().toLowerCase());
  let branchFilteredCommits = $derived(commitsReachableFromVisibleBranches(commits, localBranches, hiddenBranches, remotes, hiddenRemoteBranches));
  let filteredCommits = $derived(branchFilteredCommits.filter((commit) => matchesFilter(commit, normalizedFilter)));
  let connectedCommitIds = $derived(parentIds(filteredCommits));
  let graphedCommits = $derived(commitsWithGraph(filteredCommits, { getLaneColorForCommit: commitBranchColor }).map((commit) => {
    const commitWithTipLane = stopTipLaneAboveNode(commit, connectedCommitIds);
    return { ...commitWithTipLane, refPills: commitRefPills(commitWithTipLane.refs) };
  }));
  let graphColumnWidth = $derived(`${Math.max(...graphedCommits.map((commit) => graphGutter * 2 + Math.max(1, commit.graph?.laneCount ?? 1) * graphLaneWidth), graphGutter * 2 + graphLaneWidth)}px`);

  function scrollCommitIntoView(commitId) {
    document.getElementById(`commit-row-${commitId}`)?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  $effect(() => {
    const commitId = selectedCommitId;
    const isVisible = graphedCommits.some((commit) => commit.id === commitId);
    if (!commitId || !isVisible) return;
    tick().then(() => scrollCommitIntoView(commitId));
  });

  function selectCommitAt(index) {
    const commit = graphedCommits[index];
    if (!commit) return;
    onSelectCommit(commit.id);
    requestAnimationFrame(() => scrollCommitIntoView(commit.id));
  }

  function handleCommitKeydown(event) {
    const isContextMenuKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && !isContextMenuKey) return;
    if (!graphedCommits.length) return;
    event.preventDefault();
    const currentIndex = graphedCommits.findIndex((commit) => commit.id === selectedCommitId);
    const fallbackIndex = currentIndex === -1 ? 0 : currentIndex;
    if (isContextMenuKey) {
      openCommitMenu(event, graphedCommits[fallbackIndex]);
      return;
    }
    if (event.key === 'ArrowDown') selectCommitAt(Math.min(graphedCommits.length - 1, fallbackIndex + 1));
    if (event.key === 'ArrowUp') selectCommitAt(Math.max(0, fallbackIndex - 1));
    if (event.key === 'Home') selectCommitAt(0);
    if (event.key === 'End') selectCommitAt(graphedCommits.length - 1);
  }
</script>

<section class="commit-log" aria-label="Commit log">
  <header class="pane-header commit-log-header">
    <div><strong>{selectedBranch}</strong><span>{filterSummary()}</span></div>
    <label class="filter-field"><span>⌕</span><input id="commit-filter-input" bind:value={filterText} placeholder="Filter commits" aria-label="Filter commits by subject, hash, author, date, or ref" /></label>
  </header>

  <div class="commit-table" bind:this={commitTableEl} role="listbox" tabindex="0" aria-label="Commit history" aria-activedescendant={selectedCommitId ? `commit-row-${selectedCommitId}` : undefined} onkeydown={handleCommitKeydown} style={`--commit-graph-column-width: ${graphColumnWidth}`}>
    <div class="commit-head" role="presentation" aria-hidden="true"><span></span><span>Description</span><span>Author</span><span>Date</span><span>Hash</span></div>
    {#if (hiddenBranches.size || hiddenRemoteBranches.size) && !branchFilteredCommits.length}
      <div class="commit-empty" role="status">No commits are visible because every branch is hidden. <button class="ui-button" type="button" onclick={onShowAllBranches}>Show all branches</button></div>
    {:else if (normalizedFilter || hiddenBranches.size || hiddenRemoteBranches.size) && !graphedCommits.length}
      <div class="commit-empty" role="status">No commits match the current filters.</div>
    {:else if !graphedCommits.length}
      <div class="commit-empty" role="status"><strong>No commits yet.</strong><span>Stage changes and create the first commit to start this repository history.</span></div>
    {/if}
    {#each graphedCommits as commit, commitIndex (commit.id)}
      <button id={`commit-row-${commit.id}`} class:selected={selectedCommitId === commit.id} class="ui-row commit-row" role="option" tabindex="-1" aria-selected={selectedCommitId === commit.id} aria-posinset={commitIndex + 1} aria-setsize={graphedCommits.length} aria-label={`Commit ${commit.subject} by ${commit.author} on ${commit.date}, hash ${commit.id}`} onclick={() => onSelectCommit(commit.id)} ondblclick={() => onOpenInspector('commit', { commitId: commit.id })} oncontextmenu={(event) => openCommitMenu(event, commit)}>
        <CommitGraphCell graph={commit.graph} />
        <span class:no-refs={commit.refPills.length === 0} class="commit-subject">
          <strong title={commit.subject}>{commit.subject}</strong>
          <span class="commit-refs">
            {#each commit.refPills as ref (`${ref.type}:${ref.label}`)}
              <em class:remote-ref={ref.type === 'remote'} class:tag-ref={ref.type === 'tag'} style={refStyle(ref)}>
                {#if ref.icon}<span class="ref-icon" aria-hidden="true">{ref.icon}</span>{/if}{ref.label}
              </em>
            {/each}
          </span>
        </span>
        <span class="commit-author" title={commit.author}>{commit.author}</span>
        <span class="commit-date">{commit.date}</span>
        <code class="commit-hash" title={commit.id}>{commit.id}</code>
      </button>
    {/each}
  </div>
</section>
