<script>
  import { changedFileMenuItems } from '../lib/contextMenus.js';

  /**
   * @typedef {import('../lib/types.js').ChangedFile} ChangedFile
   * @typedef {import('../lib/types.js').DiffRow} DiffRow
   * @typedef {import('../lib/types.js').UserPreferences} UserPreferences
   * @typedef {import('../lib/types.js').ContextMenuItem} ContextMenuItem
   *
   * @typedef {Object} Props
   * @property {ChangedFile | null} [selectedChangedFile]
   * @property {DiffRow[]} [selectedDiffLines]
   * @property {string} [diffLoadingKey]
   * @property {string} [selectedDiffKey]
   * @property {boolean} [hasStaleSelection]
   * @property {string} [commitSummary]
   * @property {string} [commitDescription]
   * @property {boolean} [amendCommit]
   * @property {Partial<UserPreferences>} [preferences]
   * @property {number} [stagedCount]
   * @property {string} [actionBusy]
   * @property {(command: string, section: string, label: string) => void | Promise<void>} onRunSelectedGitAction
   * @property {(command: string, file: ChangedFile, hunkIndex: number, label: string) => void | Promise<void>} onRunHunkGitAction
   * @property {() => void | Promise<void>} onCommitChanges
   * @property {(focused: boolean) => void} [onComposerFocusChange]
   * @property {(event: Event, items: ContextMenuItem[]) => void} onOpenContextMenu
   * @property {(text: string) => void | Promise<void>} onCopyText
   * @property {(type: string, params: object) => void} [onOpenInspector]
   */

  /** @type {Props} */
  let {
    selectedChangedFile = null,
    selectedDiffLines = [],
    diffLoadingKey = '',
    selectedDiffKey = '',
    hasStaleSelection = false,
    commitSummary = $bindable(''),
    commitDescription = $bindable(''),
    amendCommit = $bindable(false),
    preferences = {},
    stagedCount = 0,
    actionBusy = '',
    onRunSelectedGitAction,
    onRunHunkGitAction,
    onCommitChanges,
    onComposerFocusChange = () => {},
    onOpenContextMenu,
    onCopyText,
    onOpenInspector = () => {}
  } = $props();

  let hoveredHunkIndex = $state(null);


  function renderText(text) {
    if (!preferences.showWhitespace) return text;
    return String(text ?? '').replace(/ /g, '·').replace(/\t/g, '→\t');
  }

  function toSplitRows(lines) {
    const rows = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.type === 'remove' && lines[index + 1]?.type === 'add') {
        rows.push({ ...line, type: 'change-pair', split: { left: line, right: lines[index + 1] } });
        index += 1;
      } else if (line.type === 'remove') {
        rows.push({ ...line, split: { left: line, right: null } });
      } else if (line.type === 'add') {
        rows.push({ ...line, split: { left: null, right: line } });
      } else {
        rows.push({ ...line, split: null });
      }
    }
    return rows;
  }

  function hunkActionLabel(file = selectedChangedFile) {
    return file?.section === 'staged' ? 'Unstage hunk' : 'Stage hunk';
  }

  function hunkActionCommand(file = selectedChangedFile) {
    return file?.section === 'staged' ? 'git_unstage_hunk' : 'git_stage_hunk';
  }

  function openDiffMenu(event) {
    const file = selectedChangedFile;
    onOpenContextMenu(event, changedFileMenuItems(file, { onRunSelectedGitAction, onCopyText, onOpenInspector }));
  }

  function openLargerDiff() {
    if (!selectedChangedFile) return;
    onOpenInspector('large-diff', { filePath: selectedChangedFile.path, section: selectedChangedFile.section, status: selectedChangedFile.status });
  }
  let canStageHunks = $derived(selectedChangedFile && selectedChangedFile.status !== '?' && ['staged', 'unstaged'].includes(selectedChangedFile.section));
  let isDiffLoading = $derived(!!selectedChangedFile && diffLoadingKey === selectedDiffKey && !selectedDiffLines.length);
  let diffTitle = $derived(selectedChangedFile?.path ?? (hasStaleSelection ? 'Selection no longer changed' : 'No file selected'));
  let diffSubtitle = $derived(selectedChangedFile ? `${selectedChangedFile.label} · ${selectedChangedFile.lines}` : hasStaleSelection ? 'The selected path disappeared from Git status after refresh' : 'Choose a changed file to inspect its diff');
  let emptyDiffMessage = $derived(isDiffLoading
    ? 'Loading file diff…'
    : hasStaleSelection
      ? 'The selected path no longer has staged or unstaged changes. Choose another file, or refresh if this looks stale.'
      : selectedChangedFile
        ? 'Git did not return diff content for this file. It may be binary, renamed without text changes, or outside the selected diff mode.'
        : 'Select a changed file to display its diff. When the working tree is clean, there is no file diff to show.');
  let renderedDiffLines = $derived((preferences.diffView === 'split') ? toSplitRows(selectedDiffLines) : selectedDiffLines.map((line) => ({ ...line, split: null })));
  let diffClasses = $derived([preferences.wrapDiffLines ? 'wrap-lines' : '', preferences.showWhitespace ? 'show-whitespace' : '', preferences.diffView === 'split' ? 'split-view' : 'unified-view'].filter(Boolean).join(' '));
</script>

<section class="diff-workspace" aria-label="Diff viewer" oncontextmenu={openDiffMenu}>
  <header class="pane-header">
    <div><strong>{diffTitle}</strong><span>{diffSubtitle}</span></div>
    <div class="header-actions ui-header-actions">
      <button type="button" disabled={!selectedChangedFile} onclick={openLargerDiff}>Open larger diff</button>
      {#if selectedChangedFile?.section === 'unstaged'}
        <button class="ui-icon-button icon-only-button" aria-label="Discard changes" title="Discard changes" onclick={() => onRunSelectedGitAction('git_discard', 'unstaged', 'Discard')}>⌫</button>
      {/if}
    </div>
  </header>

  <div class="diff-table {diffClasses}">
    <div class="diff-rows">
      {#each renderedDiffLines as line, index ((selectedChangedFile?.path ?? 'empty') + index)}
        <div class="diff-row {line.type}" class:hunk-preview={hoveredHunkIndex !== null && line.hunkIndex === hoveredHunkIndex}>
          {#if line.split}
            <span class="line-no">{line.split.left?.left ?? ''}</span>
            <code class="split-left">{renderText(line.split.left?.text ?? '')}</code>
            <span class="line-no">{line.split.right?.right ?? ''}</span>
            <code class="split-right">{renderText(line.split.right?.text ?? '')}</code>
          {:else}
            <span class="line-no">{line.left}</span>
            <span class="line-no">{line.right}</span>
            <code>{renderText(line.text)}</code>
          {/if}
          <span class="diff-row-action">
            {#if line.type === 'hunk' && canStageHunks}
              <button
                class="ui-button ui-compact-button"
                class:stage-action={selectedChangedFile.section !== 'staged'}
                class:unstage-action={selectedChangedFile.section === 'staged'}
                disabled={!!actionBusy}
                title={hunkActionLabel()}
                onmouseenter={() => hoveredHunkIndex = line.hunkIndex}
                onmouseleave={() => hoveredHunkIndex = null}
                onfocus={() => hoveredHunkIndex = line.hunkIndex}
                onblur={() => hoveredHunkIndex = null}
                onclick={() => onRunHunkGitAction(hunkActionCommand(), selectedChangedFile, line.hunkIndex, hunkActionLabel())}
              >{selectedChangedFile.section === 'staged' ? 'Unstage' : 'Stage'}</button>
            {/if}
          </span>
        </div>
      {:else}
        <div class="empty-state" aria-live="polite">{emptyDiffMessage}</div>
      {/each}
    </div>
  </div>

  <footer class="commit-box">
    <input id="commit-summary-input" bind:value={commitSummary} placeholder="Commit summary" aria-label="Commit summary" onfocus={() => onComposerFocusChange(true)} onblur={() => onComposerFocusChange(false)} />
    <textarea bind:value={commitDescription} placeholder="Description" aria-label="Commit description" onfocus={() => onComposerFocusChange(true)} onblur={() => onComposerFocusChange(false)}></textarea>
    <div class="commit-actions ui-action-group">
      <label><input type="checkbox" bind:checked={amendCommit} disabled={preferences.amendBehavior === 'always'} /> Amend</label>
      <button class="ui-button success" disabled={!stagedCount || !commitSummary.trim() || !!actionBusy} onclick={onCommitChanges}>{amendCommit ? 'Amend' : 'Commit'} {stagedCount} files</button>
    </div>
  </footer>
</section>
