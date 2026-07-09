<script>
  import AppDropdown from './AppDropdown.svelte';
  import { branchColorMap } from '../lib/branchColors.js';

  /**
   * @typedef {Object} Props
   * @property {any} repo
   * @property {any} [repositoryGroup]
   * @property {string} [activeWorktreePath]
   * @property {any} [commits]
   * @property {any} [remotes]
   * @property {any} [tags]
   * @property {any} [stashes]
   * @property {any} [localBranches]
   * @property {Set<string>} [hiddenBranches]
   * @property {Set<string>} [hiddenRemoteBranches]
   * @property {string} [activePage]
   * @property {string} [selectedBranch]
   * @property {any} [appUpdate]
   * @property {any} [conflictState]
   * @property {any} onSelectPage
   * @property {any} onSelectBranch
   * @property {any} [onSelectStash]
   * @property {any} [onSelectWorktree]
   * @property {any} [onCreateWorktreeFromBranch]
   * @property {any} [onRequestCreateWorktree]
   * @property {any} [onRequestRemoveWorktree]
   * @property {any} onToggleBranchVisibility
   * @property {any} onToggleRemoteBranchVisibility
   * @property {any} onOpenContextMenu
   * @property {any} [onOpenInspector]
   * @property {any} onRunGitAction
   * @property {any} [onRequestSettings]
   */

  /** @type {Props} */
  let {
    repo,
    repositoryGroup = null,
    activeWorktreePath = '',
    commits = [],
    remotes = [],
    tags = [],
    stashes = [],
    localBranches = [],
    hiddenBranches = new Set(),
    hiddenRemoteBranches = new Set(),
    activePage = 'commits',
    selectedBranch = '',
    appUpdate = null,
    conflictState = { active: false, files: [] },
    onSelectPage,
    onSelectBranch,
    onSelectStash = () => {},
    onSelectWorktree = () => {},
    onCreateWorktreeFromBranch = () => {},
    onRequestCreateWorktree = () => {},
    onRequestRemoveWorktree = () => {},
    onToggleBranchVisibility,
    onToggleRemoteBranchVisibility,
    onOpenContextMenu,
    onOpenInspector = () => {},
    onRunGitAction,
    onRequestSettings = () => {}
  } = $props();

  let collapsedBranchFolders = $state(new Set());
  let collapsedRemoteFolders = $state(new Set());
  let collapsedSidebarSections = $state(new Set());

  function openNavMenu(event, item) {
    const canOpenPage = item.id === 'changes' || item.id === 'commits';
    const isStashes = item.id === 'stashes';
    onOpenContextMenu(event, [
      canOpenPage && { label: `Show ${item.label}`, icon: item.icon, action: () => onSelectPage(item.id) },
      isStashes && { label: 'Open stash manager', icon: '▤', action: () => onOpenInspector('stashes') },
      item.id !== 'no-remotes' && item.id !== 'no-tags' && !isStashes && { label: `Copy ${item.label}`, icon: '⧉', action: () => navigator.clipboard?.writeText(item.label) },
    ]);
  }

  function openStashMenu(event, stash) {
    onOpenContextMenu(event, [
      { label: 'Inspect stash diff', icon: '▤', action: () => onOpenInspector('stashes', { stashRef: stash.reference }) },
      { label: 'Apply stash', icon: '↧', action: () => onRunGitAction('git_stash_apply', { stashRef: stash.reference }, 'Apply stash') },
      {
        label: 'Pop stash…',
        icon: '↧',
        danger: true,
        action: () => onRunGitAction('git_stash_pop', { stashRef: stash.reference }, 'Pop stash', {
          confirmTitle: `Pop ${stash.reference}?`,
          confirmMessage: 'Pop applies this stash to the working tree and drops it if Git succeeds. If conflicts occur, Git normally keeps the stash, but your working tree may need conflict resolution.',
          confirmLabel: 'Pop stash',
          confirmItems: [stash.subject || stash.message || stash.reference],
          danger: true,
          alwaysConfirm: true,
        }),
      },
      {
        label: 'Drop stash…',
        icon: '⌫',
        danger: true,
        action: () => onRunGitAction('git_stash_drop', { stashRef: stash.reference }, 'Drop stash', {
          confirmTitle: `Drop ${stash.reference}?`,
          confirmMessage: 'This permanently deletes the stash entry. Forker cannot recover a dropped stash for you.',
          confirmLabel: 'Drop stash',
          confirmItems: [stash.subject || stash.message || stash.reference],
          danger: true,
          alwaysConfirm: true,
        }),
      },
      { separator: true },
      { label: 'Copy stash reference', icon: '⧉', action: () => navigator.clipboard?.writeText(stash.reference) },
    ]);
  }

  function openBranchMenu(event, branch) {
    const openWorktree = worktreeForBranch(branch.name);
    const checkedOutElsewhere = otherWorktreeForBranch(branch.name);
    onOpenContextMenu(event, [
      { label: 'View commits', icon: '●', action: () => onSelectBranch(branch.name) },
      {
        label: checkedOutElsewhere ? `Checked out in ${worktreeLabel(checkedOutElsewhere)}` : 'Checkout in current worktree',
        icon: '✓',
        disabled: branch.current || !!checkedOutElsewhere,
        action: () => onRunGitAction('git_checkout', { reference: branch.name }, 'Checkout branch'),
      },
      { label: 'Show branch history', icon: '◷', action: () => onOpenInspector('branch-history', { branchName: branch.name, kind: 'local' }) },
      hasWorktreeGroup && (openWorktree
        ? { label: 'Open worktree', icon: '⑂', action: () => onSelectWorktree(openWorktree.path) }
        : { label: 'Create worktree from branch', icon: '⑂', action: () => onCreateWorktreeFromBranch(branch.name, null) }),
      { label: 'Copy branch name', icon: '⧉', action: () => navigator.clipboard?.writeText(branch.name) },
      { separator: true },
      {
        label: 'Delete local branch…',
        icon: '⌫',
        danger: true,
        disabled: branch.current,
        action: () => onRunGitAction('git_delete_branch', { branchName: branch.name, force: false }, 'Delete branch', {
          confirmationPreference: 'confirmDeleteBranch',
          confirmTitle: `Delete local branch ${branch.name}?`,
          confirmMessage: 'Git will refuse if the branch has unmerged work. If that happens, use Force delete local branch.',
          confirmLabel: 'Delete branch',
          confirmItems: [branch.name],
          danger: true,
        }),
      },
      {
        label: 'Force delete local branch…',
        icon: '⌫',
        danger: true,
        disabled: branch.current,
        action: () => onRunGitAction('git_delete_branch', { branchName: branch.name, force: true }, 'Force delete branch', {
          confirmationPreference: 'confirmDeleteBranch',
          confirmTitle: `Force delete local branch ${branch.name}?`,
          confirmMessage: 'This deletes the branch even if it is not fully merged. Commits reachable only from this branch may become hard to recover.',
          confirmLabel: 'Force delete branch',
          confirmItems: [branch.name],
          danger: true,
          alwaysConfirm: true,
        }),
      },
    ]);
  }

  function splitRemoteBranch(value) {
    const [remote, ...branchParts] = String(value || '').split('/').filter(Boolean);
    return { remote, branchName: branchParts.join('/') };
  }

  function openRemoteBranchMenu(event, value) {
    const { remote, branchName } = splitRemoteBranch(value);
    const localBranch = localBranches.find((branch) => branch.name === branchName);
    const openWorktree = localBranch ? worktreeForBranch(localBranch.name) : null;
    const checkedOutElsewhere = openWorktree && openWorktree.path !== currentWorktreePath ? openWorktree : null;
    onOpenContextMenu(event, [
      {
        label: checkedOutElsewhere ? `Checked out in ${worktreeLabel(checkedOutElsewhere)}` : 'Checkout in current worktree',
        icon: '✓',
        disabled: !remote || !branchName || !!checkedOutElsewhere || repo.currentBranch === branchName,
        action: () => onRunGitAction('git_checkout_remote', { remoteBranch: value }, 'Checkout remote branch'),
      },
      checkedOutElsewhere && { label: 'Open worktree', icon: '⑂', action: () => onSelectWorktree(checkedOutElsewhere.path) },
      {
        label: 'Show branch history',
        icon: '◷',
        disabled: !remote || !branchName,
        action: () => onOpenInspector('branch-history', { branchName: value, kind: 'remote' }),
      },
      hasWorktreeGroup && {
        label: 'Create worktree from remote branch',
        icon: '⑂',
        disabled: !remote || !branchName,
        action: () => onCreateWorktreeFromBranch(branchName, value),
      },
      { label: 'Copy remote branch name', icon: '⧉', action: () => navigator.clipboard?.writeText(value) },
      { separator: true },
      {
        label: 'Delete remote branch…',
        icon: '⌫',
        danger: true,
        disabled: !remote || !branchName,
        action: () => onRunGitAction('git_delete_branch', { branchName, remote, force: false }, 'Delete remote branch', {
          confirmationPreference: 'confirmDeleteBranch',
          confirmTitle: `Delete remote branch ${value}?`,
          confirmMessage: 'This removes the branch from the remote for everyone who uses it.',
          confirmLabel: 'Delete remote branch',
          confirmItems: [value],
          danger: true,
        }),
      },
    ]);
  }

  function preventContextMenu(event) {
    event.preventDefault();
  }

  function toggleBranchFolder(path) {
    const next = new Set(collapsedBranchFolders);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    collapsedBranchFolders = next;
  }

  function toggleRemoteFolder(path) {
    const next = new Set(collapsedRemoteFolders);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    collapsedRemoteFolders = next;
  }

  function toggleSidebarSection(sectionId) {
    const next = new Set(collapsedSidebarSections);
    if (next.has(sectionId)) next.delete(sectionId);
    else next.add(sectionId);
    collapsedSidebarSections = next;
  }

  function branchTreeRows(branches) {
    const root = { children: new Map(), branch: null };

    for (const branch of branches) {
      const parts = branch.name.split('/').filter(Boolean);
      let node = root;

      for (const part of parts.slice(0, -1)) {
        if (!node.children.has(part)) node.children.set(part, { children: new Map(), branch: null });
        node = node.children.get(part);
      }

      const leaf = parts.at(-1) ?? branch.name;
      if (!node.children.has(leaf)) node.children.set(leaf, { children: new Map(), branch: null });
      node.children.get(leaf).branch = branch;
    }

    return flattenBranchTree(root);
  }

  function flattenBranchTree(node, depth = 0, prefix = '') {
    const rows = [];
    const entries = [...node.children.entries()].sort(([leftName, left], [rightName, right]) => {
      const leftFolder = left.children.size && !left.branch;
      const rightFolder = right.children.size && !right.branch;
      if (leftFolder !== rightFolder) return leftFolder ? -1 : 1;
      return leftName.localeCompare(rightName);
    });

    for (const [name, child] of entries) {
      const path = prefix ? `${prefix}/${name}` : name;
      const isFolder = child.children.size > 0 && !child.branch;

      if (isFolder) {
        const collapsed = collapsedBranchFolders.has(path);
        rows.push({ type: 'folder', id: path, label: name, depth, collapsed });
        if (!collapsed) rows.push(...flattenBranchTree(child, depth + 1, path));
      } else if (child.branch) {
        rows.push({ type: 'branch', id: child.branch.name, label: name, depth, branch: child.branch });
      }
    }

    return rows;
  }

  function remoteTreeRows(remoteBranches) {
    const root = { children: new Map(), value: null };
    const splitRemotes = remoteBranches.map((remote) => ({ remote, parts: remote.split('/').filter(Boolean) }));
    const remoteNames = new Set(splitRemotes.map(({ parts }) => parts[0]).filter(Boolean));
    const stripSingleRemoteRoot = remoteNames.size === 1 && splitRemotes.every(({ parts }) => parts.length > 1);
    const rootPrefix = stripSingleRemoteRoot ? splitRemotes[0]?.parts[0] : '';

    for (const { remote, parts } of splitRemotes) {
      const displayParts = stripSingleRemoteRoot ? parts.slice(1) : parts;
      let node = root;

      for (const part of displayParts.slice(0, -1)) {
        if (!node.children.has(part)) node.children.set(part, { children: new Map(), value: null });
        node = node.children.get(part);
      }

      const leaf = displayParts.at(-1) ?? remote;
      if (!node.children.has(leaf)) node.children.set(leaf, { children: new Map(), value: null });
      node.children.get(leaf).value = remote;
    }

    return flattenRemoteTree(root, 0, rootPrefix);
  }

  function flattenRemoteTree(node, depth = 0, prefix = '') {
    const rows = [];
    const entries = [...node.children.entries()].sort(([leftName, left], [rightName, right]) => {
      const leftFolder = left.children.size && !left.value;
      const rightFolder = right.children.size && !right.value;
      if (leftFolder !== rightFolder) return leftFolder ? -1 : 1;
      return leftName.localeCompare(rightName);
    });

    for (const [name, child] of entries) {
      const path = prefix ? `${prefix}/${name}` : name;
      const isFolder = child.children.size > 0;

      if (isFolder) {
        const collapsed = collapsedRemoteFolders.has(path);
        rows.push({ type: 'folder', id: path, label: name, depth, collapsed });
        if (!collapsed) rows.push(...flattenRemoteTree(child, depth + 1, path));
      } else if (child.value) {
        rows.push({ type: 'remote', id: child.value, label: name, depth, value: child.value });
      }
    }

    return rows;
  }

  function branchVisibilityLabel(branch) {
    return hiddenBranches.has(branch.name) ? `Show ${branch.name} in commit log` : `Hide ${branch.name} from commit log`;
  }

  function remoteVisibilityLabel(branchName) {
    return hiddenRemoteBranches.has(branchName) ? `Show ${branchName} in commit log` : `Hide ${branchName} from commit log`;
  }

  let branchColorByName = $derived(trackedBranchColorMap(localBranches, remotes));

  function branchStyle(branchName) {
    return `--branch-color: ${branchColorByName.get(branchName) ?? 'var(--accent)'}`;
  }

  function branchStyleWithDepth(branchName, depth = 0) {
    return `--branch-depth: ${depth}; ${branchStyle(branchName)}`;
  }

  let tagColorByName = $derived(branchColorMap(tags));

  function tagStyle(tagName) {
    return `--branch-color: ${tagColorByName.get(tagName) ?? 'var(--warning)'}`;
  }

  function sidebarItemStyle(groupTitle, item) {
    if (groupTitle === 'Tags') return tagStyle(item.id);
    if (item.id === 'changes') return '--branch-color: var(--success)';
    if (item.id === 'commits') return '--branch-color: var(--branch-color-3)';
    return '';
  }

  function worktreeBranchStyle(worktree) {
    return branchStyle(worktree?.branch);
  }

  function worktreeForBranch(branchName) {
    return worktrees.find((worktree) => worktree.branch === branchName);
  }

  function otherWorktreeForBranch(branchName) {
    const currentPath = activeWorktreePath || repo.path;
    return worktrees.find((worktree) => worktree.branch === branchName && worktree.path !== currentPath);
  }

  function worktreeLabel(worktree) {
    if (!worktree) return '';
    if (worktree.name) return worktree.name;
    return String(worktree.path || '').split(/[\\/]/).filter(Boolean).at(-1) || worktree.path;
  }

  function worktreeDirtyCount(worktree) {
    return worktree?.dirtyCount ?? 0;
  }

  function selectWorktree(path) {
    onSelectWorktree(path);
  }

  function localBranchForUpstream(remoteBranch) {
    return localBranches.find((branch) => branch.upstream === remoteBranch);
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

  let branchRows = $derived((collapsedBranchFolders, branchTreeRows(localBranches)));
  let remoteRows = $derived((collapsedRemoteFolders, remoteTreeRows(remotes)));
  let updateAvailable = $derived(appUpdate?.status === 'available' || appUpdate?.available);
  let updateButtonLabel = $derived(appUpdate?.version ? `Update available: v${appUpdate.version}` : 'Update available');
  let newestStash = $derived(stashes[0] ?? null);
  let conflictCount = $derived(conflictState?.files?.length ?? 0);
  let hasWorktreeGroup = $derived(!!repositoryGroup?.group);
  let worktrees = $derived(hasWorktreeGroup ? (repositoryGroup?.worktrees ?? []) : []);
  let currentWorktreePath = $derived(activeWorktreePath || repo.path);
  let selectedWorktree = $derived(worktrees.find((worktree) => worktree.path === currentWorktreePath) ?? worktrees[0] ?? null);

  let sidebarGroups = $derived([
    {
      title: 'Repository',
      items: [
        { id: 'changes', label: conflictState?.active ? 'Conflicts' : 'Changes', icon: conflictState?.active ? '!' : '◧', count: conflictState?.active ? String(conflictCount) : String(repo.changed), tone: conflictState?.active ? 'warning' : '' },
        { id: 'commits', label: 'Commits', icon: '●', count: String(commits.length) },
      ],
    },
    {
      title: 'Tags',
      items: tags.length
        ? tags.map((tag) => ({ id: tag, label: tag, icon: '◇' }))
        : [{ id: 'no-tags', label: 'No tags found', icon: '◇' }],
    },
  ]);
</script>

<aside class="sidebar" aria-label="Repository navigation">
  <div class="sidebar-scroll">
  {#if hasWorktreeGroup && worktrees.length}
    <section class="sidebar-group worktrees">
      <h2>Worktree</h2>
      <div class:canDeleteWorktree={worktrees.length > 1} class="worktree-picker">
        <AppDropdown
          id="worktree-select"
          value={currentWorktreePath}
          options={worktrees}
          menuLabel="Active worktree"
          getValue={(worktree) => worktree.path}
          getLabel={worktreeLabel}
          getDescription={(worktree) => `${worktree.branch ?? 'detached'}${worktreeDirtyCount(worktree) ? ` · ${worktreeDirtyCount(worktree)} changed` : ''}`}
          getIcon={(worktree) => worktree.path === currentWorktreePath ? '✓' : '⑂'}
          getBadge={(worktree) => worktreeDirtyCount(worktree) || ''}
          getStyle={worktreeBranchStyle}
          onChange={(worktree) => selectWorktree(worktree.path)}
          class="worktree-branch-dropdown"
        >
          {#snippet trigger(worktree)}
            <strong>{worktreeLabel(worktree ?? selectedWorktree)}</strong>
            <span>{worktree?.branch ?? selectedWorktree?.branch ?? 'detached'}{worktreeDirtyCount(worktree ?? selectedWorktree) ? ` · ${worktreeDirtyCount(worktree ?? selectedWorktree)} changed` : ''}</span>
          {/snippet}
        </AppDropdown>
        <button class="ui-icon-button worktree-create-button" type="button" title="Create worktree" aria-label="Create worktree" onclick={onRequestCreateWorktree} oncontextmenu={preventContextMenu}>+</button>
        {#if worktrees.length > 1}
          <button class="ui-icon-button worktree-delete-button" type="button" title="Delete selected worktree" aria-label="Delete selected worktree" onclick={() => onRequestRemoveWorktree(selectedWorktree)} oncontextmenu={preventContextMenu}>⌫</button>
        {/if}
      </div>
    </section>
  {/if}

  {#each sidebarGroups as group}
    <section class="sidebar-group" class:repository-section={group.title === 'Repository'} class:tags-section={group.title === 'Tags'}>
      {#if group.title === 'Tags'}
        <h2>
          <button class="section-toggle" type="button" aria-expanded={!collapsedSidebarSections.has('tags')} onclick={() => toggleSidebarSection('tags')}>
            <span class="section-chevron" aria-hidden="true">{collapsedSidebarSections.has('tags') ? '▸' : '▾'}</span>
            <span>Tags</span>
            <span class="section-count">{tags.length}</span>
          </button>
        </h2>
      {:else}
        <h2>{group.title}</h2>
      {/if}
      {#if group.title !== 'Tags' || !collapsedSidebarSections.has('tags')}
        {#each group.items as item (item.id)}
          <button class:active={activePage === item.id || (group.title === 'Tags' && activePage === 'commits' && selectedBranch === item.id)} class:warning={item.tone === 'warning'} class="ui-row sidebar-row" style={sidebarItemStyle(group.title, item)} onclick={() => item.id === 'changes' || item.id === 'commits' ? onSelectPage(item.id) : group.title === 'Tags' && item.id !== 'no-tags' ? onSelectBranch(item.id) : null} oncontextmenu={(event) => openNavMenu(event, item)}>
            <span class="row-icon">{item.icon}</span>
            <span class="row-label">{item.label}</span>
            {#if item.count}<span class="row-count">{item.count}</span>{/if}
          </button>
        {/each}
      {/if}
    </section>
  {/each}

  {#if stashes.length}
    <section class="sidebar-group stashes">
      <h2>
        <button class="section-toggle" type="button" aria-expanded={!collapsedSidebarSections.has('stashes')} onclick={() => toggleSidebarSection('stashes')}>
          <span class="section-chevron" aria-hidden="true">{collapsedSidebarSections.has('stashes') ? '▸' : '▾'}</span>
          <span>Stashes</span>
          <span class="section-count">{stashes.length}</span>
        </button>
      </h2>
      {#if !collapsedSidebarSections.has('stashes')}
        {#if newestStash}
          <button class:active={activePage === 'commits' && selectedBranch === newestStash.reference} class="ui-row sidebar-row stash-summary-row" title={newestStash.subject} onclick={() => onSelectStash(newestStash)} oncontextmenu={(event) => openStashMenu(event, newestStash)}>
            <span class="row-icon">▤</span>
            <span class="row-label">Newest: {newestStash.message || newestStash.subject}</span>
            <span class="row-count">{newestStash.changedFiles ?? 0}</span>
          </button>
        {/if}
        {#each stashes.slice(1, 5) as stash (stash.reference)}
          <button class:active={activePage === 'commits' && selectedBranch === stash.reference} class="ui-row sidebar-row stash-row" title={stash.subject} onclick={() => onSelectStash(stash)} oncontextmenu={(event) => openStashMenu(event, stash)}>
            <span class="row-icon">{stash.reference.replace('stash@{', '').replace('}', '')}</span>
            <span class="row-label">{stash.branch ? `${stash.branch}: ` : ''}{stash.message || stash.subject}</span>
            <span class="row-count">{stash.changedFiles ?? 0}</span>
          </button>
        {/each}
      {/if}
    </section>
  {/if}

  <section class="sidebar-group remotes">
    <h2>
      <button class="section-toggle" type="button" aria-expanded={!collapsedSidebarSections.has('remotes')} onclick={() => toggleSidebarSection('remotes')}>
        <span class="section-chevron" aria-hidden="true">{collapsedSidebarSections.has('remotes') ? '▸' : '▾'}</span>
        <span>Remotes</span>
        <span class="section-count">{remotes.length}</span>
      </button>
    </h2>
    {#if !collapsedSidebarSections.has('remotes')}
      {#if remoteRows.length}
        {#each remoteRows as row (row.id)}
          {#if row.type === 'folder'}
            <button class="ui-row sidebar-row branch-folder-row" style={`--branch-depth: ${row.depth}`} aria-expanded={!row.collapsed} onclick={() => toggleRemoteFolder(row.id)} oncontextmenu={preventContextMenu}>
              <span class="row-icon folder-chevron">{row.collapsed ? '▸' : '▾'}</span>
              <span class="row-label">{row.label}</span>
            </button>
          {:else}
            {@const trackingLocalBranch = localBranchForUpstream(row.value)}
            {@const selectedRemoteBranch = activePage === 'commits' && selectedBranch === row.value}
            <div class:selected-remote-wrap={selectedRemoteBranch} class:tracked-remote-wrap={trackingLocalBranch} class="branch-row-wrap remote-row-wrap" style={branchStyleWithDepth(row.value, row.depth)}>
              <button class:branch-hidden={hiddenRemoteBranches.has(row.value)} class="branch-visibility-toggle" aria-label={remoteVisibilityLabel(row.value)} title={remoteVisibilityLabel(row.value)} onclick={() => onToggleRemoteBranchVisibility(row.value)}>
                <span aria-hidden="true">👁</span>
              </button>
              <button class:hidden-branch={hiddenRemoteBranches.has(row.value)} class:tracked-remote={trackingLocalBranch} class:selected-remote={selectedRemoteBranch} class="ui-row sidebar-row remote-row" title={trackingLocalBranch ? `${row.value} tracked by ${trackingLocalBranch.name}` : row.value} onclick={() => onSelectBranch(row.value)} oncontextmenu={(event) => openRemoteBranchMenu(event, row.value)}>
                <span class="row-label" title={row.value}>{row.label}</span>
                {#if trackingLocalBranch}<span class="remote-tracked-pill" title={`Tracked by ${trackingLocalBranch.name}`}>↙ {trackingLocalBranch.name}</span>{/if}
              </button>
            </div>
          {/if}
        {/each}
      {:else}
        <button class="ui-row sidebar-row" oncontextmenu={(event) => openNavMenu(event, { id: 'no-remotes', label: 'No remotes found', icon: '⇄' })}>
          <span class="row-icon">⇄</span>
          <span class="row-label">No remotes found</span>
        </button>
      {/if}
    {/if}
  </section>

  <section class="sidebar-group branches">
    <h2>
      <button class="section-toggle" type="button" aria-expanded={!collapsedSidebarSections.has('branches')} onclick={() => toggleSidebarSection('branches')}>
        <span class="section-chevron" aria-hidden="true">{collapsedSidebarSections.has('branches') ? '▸' : '▾'}</span>
        <span>Local Branches</span>
        <span class="section-count">{localBranches.length}</span>
      </button>
    </h2>
    {#if !collapsedSidebarSections.has('branches')}
      {#each branchRows as row (row.id)}
        {#if row.type === 'folder'}
          <button class="ui-row sidebar-row branch-folder-row" style={`--branch-depth: ${row.depth}`} aria-expanded={!row.collapsed} onclick={() => toggleBranchFolder(row.id)} oncontextmenu={preventContextMenu}>
            <span class="row-icon folder-chevron">{row.collapsed ? '▸' : '▾'}</span>
            <span class="row-label">{row.label}</span>
          </button>
        {:else}
          {@const selectedLocalBranch = activePage === 'commits' && selectedBranch === row.branch.name}
          {@const branchWorktree = otherWorktreeForBranch(row.branch.name)}
          <div class:selected-branch-wrap={selectedLocalBranch} class:current-branch-wrap={row.branch.current} class:tracked-branch-wrap={row.branch.upstream} class:checked-out-branch-wrap={branchWorktree} class="branch-row-wrap local-branch-wrap" style={branchStyleWithDepth(row.branch.name, row.depth)}>
            <button class:branch-hidden={hiddenBranches.has(row.branch.name)} class="branch-visibility-toggle" aria-label={branchVisibilityLabel(row.branch)} title={branchVisibilityLabel(row.branch)} onclick={() => onToggleBranchVisibility(row.branch.name)}>
              <span aria-hidden="true">👁</span>
            </button>
            <button class:selected-branch={selectedLocalBranch} class:current-branch={row.branch.current} class:checked-out-elsewhere={branchWorktree} class:hidden-branch={hiddenBranches.has(row.branch.name)} class="ui-row sidebar-row branch-row" onclick={() => onSelectBranch(row.branch.name)} oncontextmenu={(event) => openBranchMenu(event, row.branch)} title={row.branch.upstream ? `${row.branch.name} tracks ${row.branch.upstream}` : row.branch.name}>
              <span class="branch-state-marker" aria-hidden="true">{row.branch.current ? '✓' : branchWorktree ? '⑂' : ''}</span>
              <span class="branch-label-line">
                <span class="row-label" title={row.branch.name}>{row.label}</span>
                {#if row.branch.current}<span class="branch-badge current-badge">Current</span>{/if}
              </span>
              <span class="branch-meta-stack">
                {#if row.branch.upstream}
                  <span class="branch-upstream-pill" title={`Tracks ${row.branch.upstream}`}>{row.branch.upstream}</span>
                {:else}
                  <span class="branch-upstream-pill local-pill">local</span>
                {/if}
                {#if branchWorktree}<span class="worktree-branch-badge" title={`Checked out in ${branchWorktree.path}`}>⑂ {worktreeLabel(branchWorktree)}</span>{/if}
              </span>
            </button>
          </div>
        {/if}
      {/each}
    {/if}
  </section>
  </div>

  {#if updateAvailable}
    <footer class="sidebar-footer">
      <button type="button" class="sidebar-update-button" onclick={() => onRequestSettings('updates')}>
        <span aria-hidden="true">↥</span>
        <span>{updateButtonLabel}</span>
      </button>
    </footer>
  {/if}
</aside>
