<script>
  import FileTree from './FileTree.svelte';
  import { commitMenuItems } from '../lib/contextMenus.js';

  /**
   * @typedef {import('../lib/types.js').CommitInfo} CommitInfo
   * @typedef {import('../lib/types.js').ChangedFile} ChangedFile
   * @typedef {import('../lib/types.js').FileTreeRow} FileTreeRow
   * @typedef {import('../lib/types.js').ContextMenuItem} ContextMenuItem
   *
   * @typedef {Object} Props
   * @property {CommitInfo} selectedCommit
   * @property {ChangedFile[]} [selectedCommitFiles]
   * @property {FileTreeRow[]} [selectedCommitRows]
   * @property {string} [actionBusy]
   * @property {(command: string, args: object, label: string, options?: object) => void | Promise<void>} [onRunGitAction]
   * @property {(commit: CommitInfo) => void} [onRequestResetBranch]
   * @property {(section: string, path: string) => void} [onToggleFolder]
   * @property {(event: Event, items: ContextMenuItem[]) => void} [onOpenContextMenu]
   * @property {(text: string) => void | Promise<void>} [onCopyText]
   * @property {(type: string, params: object) => void} [onOpenInspector]
   */

  /** @type {Props} */
  let {
    selectedCommit,
    selectedCommitFiles = [],
    selectedCommitRows = [],
    actionBusy = '',
    onRunGitAction = () => {},
    onRequestResetBranch = () => {},
    onToggleFolder = () => {},
    onOpenContextMenu = () => {},
    onCopyText = () => {},
    onOpenInspector = () => {}
  } = $props();

  function openCommitDetailsMenu(event) {
    onOpenContextMenu(event, commitMenuItems(selectedCommit, { actionBusy, onRunGitAction, onRequestResetBranch, onCopyText, onOpenInspector }));
  }

  function openCommitInspector() {
    if (!selectedCommit?.id) return;
    onOpenInspector('commit', { commitId: selectedCommit.id });
  }

</script>

<aside class="details-pane" aria-label="Selected commit details" oncontextmenu={openCommitDetailsMenu}>
  <header class="pane-header compact">
    <div><strong>Commit</strong><span>{selectedCommit.id}</span></div>
    <div class="header-actions ui-header-actions">
      <button type="button" disabled={!selectedCommit.id} onclick={openCommitInspector}>Open commit</button>
      <button class="ui-icon-button icon-only-button" disabled={!selectedCommit.id || !!actionBusy} aria-label="Reset current branch to this commit" title="Reset current branch to this commit" onclick={() => onRequestResetBranch(selectedCommit)}>↤</button>
      <button class="ui-icon-button icon-only-button" disabled={!selectedCommit.id || !!actionBusy} aria-label="Checkout commit" title="Checkout commit" onclick={() => onRunGitAction('git_checkout', { reference: selectedCommit.id }, 'Checkout')}>⑂</button>
    </div>
  </header>

  <section class="commit-detail-card">
    <h1>{selectedCommit.subject}</h1>
    <p>{selectedCommit.message}</p>
    <dl>
      <div><dt>Author</dt><dd>{selectedCommit.author}</dd></div>
      <div><dt>Date</dt><dd>{selectedCommit.date}</dd></div>
      <div><dt>Branch</dt><dd>{selectedCommit.branch}</dd></div>
      <div><dt>Files</dt><dd>{selectedCommit.files} changed</dd></div>
    </dl>
    <div class="stat-strip"><span class="added">+{selectedCommit.insertions}</span><span class="deleted">−{selectedCommit.deletions}</span></div>
  </section>

  <section class="changed-in-commit">
    <h2>Files in commit</h2>
    {#if selectedCommitFiles.length}
      <FileTree
        label="Changed"
        count={selectedCommitFiles.length}
        rows={selectedCommitRows}
        readOnly
        selectedFileKeys={[]}
        onToggleFolder={onToggleFolder}
        onOpenContextMenu={onOpenContextMenu}
        onCopyText={onCopyText}
      />
    {:else}
      <div class="empty-state">No changed files for this commit.</div>
    {/if}
  </section>
</aside>
