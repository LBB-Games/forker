<script>
  import { changedFileMenuItems, changedFolderMenuItems } from '../lib/contextMenus.js';
  import { fileKey } from '../lib/fileTree.js';

  /**
   * @typedef {import('../lib/types.js').ChangedFile} ChangedFile
   * @typedef {import('../lib/types.js').FileTreeRow} FileTreeRow
   * @typedef {import('../lib/types.js').ContextMenuItem} ContextMenuItem
   *
   * @typedef {Object} Props
   * @property {string} [label]
   * @property {FileTreeRow[]} [rows]
   * @property {number} [count]
   * @property {string[]} [selectedFileKeys]
   * @property {boolean} [readOnly]
   * @property {(section: string, path: string) => void} [onToggleFolder]
   * @property {(file: ChangedFile, event: MouseEvent | KeyboardEvent) => void} [onSelectFile]
   * @property {(folder: FileTreeRow, event: MouseEvent | KeyboardEvent) => void} [onSelectFolder]
   * @property {(event: Event, items: ContextMenuItem[]) => void} [onOpenContextMenu]
   * @property {(command: string, section: string, label: string) => void | Promise<void>} [onRunSelectedGitAction]
   * @property {(text: string) => void | Promise<void>} [onCopyText]
   * @property {(type: string, params: object) => void} [onOpenInspector]
   */

  /** @type {Props} */
  let {
    label = '',
    rows = [],
    count = 0,
    selectedFileKeys = [],
    readOnly = false,
    onToggleFolder = () => {},
    onSelectFile = () => {},
    onSelectFolder = () => {},
    onOpenContextMenu = () => {},
    onRunSelectedGitAction = () => {},
    onCopyText = () => {},
    onOpenInspector = null
  } = $props();

  let treeEl = $state();
  let activeRowIndex = $state(0);
  let lastSelectionSignature = $state('');

  function isFolderSelected(row) {
    return row.childKeys?.length && row.childKeys.every((key) => selectedFileKeys.includes(key));
  }

  $effect(() => {
    const selectionSignature = selectedFileKeys.join('\u001f');
    if (!rows.length) {
      activeRowIndex = 0;
      lastSelectionSignature = selectionSignature;
      return;
    }

    if (activeRowIndex >= rows.length) activeRowIndex = rows.length - 1;
    if (selectionSignature !== lastSelectionSignature) {
      const selectedIndex = rows.findIndex((row) => row.type === 'folder' ? isFolderSelected(row) : selectedFileKeys.includes(fileKey(row.file)));
      if (selectedIndex >= 0) activeRowIndex = selectedIndex;
      lastSelectionSignature = selectionSignature;
    }
  });

  function focusRow(index) {
    if (!rows.length) return;
    activeRowIndex = Math.max(0, Math.min(rows.length - 1, index));
    requestAnimationFrame(() => treeEl?.querySelector(`[data-tree-index="${activeRowIndex}"]`)?.focus());
  }

  function handleRowFocus(index) {
    activeRowIndex = index;
  }

  function rowTabIndex(index) {
    return index === activeRowIndex ? 0 : -1;
  }

  function focusParentFolder(index) {
    const row = rows[index];
    if (!row) return;
    for (let parentIndex = index - 1; parentIndex >= 0; parentIndex -= 1) {
      const candidate = rows[parentIndex];
      if (candidate.type === 'folder' && candidate.depth < row.depth) {
        focusRow(parentIndex);
        return;
      }
    }
  }

  function handleTreeKeydown(event) {
    const isContextMenuKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'ArrowRight', 'ArrowLeft'].includes(event.key) && !isContextMenuKey) return;
    const target = event.target?.closest?.('[data-tree-index]');
    if (!target || !treeEl?.contains(target)) return;
    const index = Number(target.dataset.treeIndex);
    const row = rows[index];
    if (!row) return;

    event.preventDefault();
    if (isContextMenuKey) {
      if (row.type === 'folder') openFolderMenu(event, row);
      else openFileMenu(event, row.file);
      return;
    }

    if (event.key === 'ArrowDown') focusRow(Math.min(rows.length - 1, index + 1));
    if (event.key === 'ArrowUp') focusRow(Math.max(0, index - 1));
    if (event.key === 'Home') focusRow(0);
    if (event.key === 'End') focusRow(rows.length - 1);

    if (event.key === 'ArrowRight' && row.type === 'folder') {
      if (row.collapsed) onToggleFolder(row.section, row.path);
      else focusRow(Math.min(rows.length - 1, index + 1));
    }
    if (event.key === 'ArrowLeft') {
      if (row.type === 'folder' && !row.collapsed) onToggleFolder(row.section, row.path);
      else focusParentFolder(index);
    }
  }

  function openFileMenu(event, file) {
    onSelectFile(file, event);
    onOpenContextMenu(event, changedFileMenuItems(file, { readOnly, onRunSelectedGitAction, onCopyText, onOpenInspector }));
  }

  function openFolderMenu(event, row) {
    onSelectFolder(row, event);
    onOpenContextMenu(event, changedFolderMenuItems(row, { readOnly, onRunSelectedGitAction, onToggleFolder, onCopyText }));
  }
</script>

<div class="file-section-label">{label} <span>{count}</span></div>
<div class="file-tree" bind:this={treeEl} role="tree" aria-label={`${label} files`} aria-multiselectable={readOnly ? undefined : 'true'}>
  {#each rows as row, rowIndex (row.type + row.section + row.path)}
    {#if row.type === 'folder'}
      <button class:selected={isFolderSelected(row)} class="ui-row tree-row tree-folder" role="treeitem" tabindex={rowTabIndex(rowIndex)} data-tree-index={rowIndex} aria-level={row.depth + 1} aria-expanded={!row.collapsed} aria-selected={isFolderSelected(row)} style={`--depth: ${row.depth}`} title={row.path} aria-label={`${row.collapsed ? 'Collapsed' : 'Expanded'} folder ${row.name}. Use arrow keys to move, collapse, or expand.`} onclick={(event) => readOnly ? onToggleFolder(row.section, row.path) : onSelectFolder(row, event)} onfocus={() => handleRowFocus(rowIndex)} onkeydown={handleTreeKeydown} ondblclick={() => onToggleFolder(row.section, row.path)} oncontextmenu={(event) => openFolderMenu(event, row)}>
        <span class="tree-twisty" aria-hidden="true" onclick={(event) => { event.stopPropagation(); onToggleFolder(row.section, row.path); }}>{row.collapsed ? '▸' : '▾'}</span><span class="tree-icon">Folder</span><strong>{row.name}</strong>
      </button>
    {:else}
      <button class:selected={selectedFileKeys.includes(fileKey(row.file))} class="ui-row tree-row tree-file {row.file.tone}" role="treeitem" tabindex={rowTabIndex(rowIndex)} data-tree-index={rowIndex} aria-level={row.depth + 1} aria-selected={selectedFileKeys.includes(fileKey(row.file))} style={`--depth: ${row.depth}`} title={row.file.path} onclick={(event) => onSelectFile(row.file, event)} onfocus={() => handleRowFocus(rowIndex)} onkeydown={handleTreeKeydown} oncontextmenu={(event) => openFileMenu(event, row.file)}>
        <span class="tree-spacer"></span><span class="status-pill">{row.file.status}</span><span class="file-name"><strong title={row.file.path}>{row.name}</strong></span><code>{row.file.lines}</code>
      </button>
    {/if}
  {/each}
</div>
