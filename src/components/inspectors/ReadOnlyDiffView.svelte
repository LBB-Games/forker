<script>
  import InspectorStatus from './InspectorStatus.svelte';

  /**
   * @typedef {import('../../lib/types.js').DiffRow} DiffRow
   * @typedef {import('../../lib/types.js').UserPreferences} UserPreferences
   */

  let {
    lines = [],
    preferences = {},
    emptyTitle = 'No diff content',
    emptyMessage = 'Git did not return text diff rows for this selection.',
    ariaLabel = 'Read-only diff',
  } = $props();

  function renderText(text) {
    if (!preferences.showWhitespace) return text;
    return String(text ?? '').replace(/ /g, '·').replace(/\t/g, '→\t');
  }

  function toSplitRows(diffLines) {
    const rows = [];
    for (let index = 0; index < diffLines.length; index += 1) {
      const line = diffLines[index];
      if (line.type === 'remove' && diffLines[index + 1]?.type === 'add') {
        rows.push({ ...line, type: 'change-pair', split: { left: line, right: diffLines[index + 1] } });
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

  let renderedDiffLines = $derived((preferences.diffView === 'split') ? toSplitRows(lines) : lines.map((line) => ({ ...line, split: null })));
  let diffClasses = $derived([preferences.wrapDiffLines ? 'wrap-lines' : '', preferences.showWhitespace ? 'show-whitespace' : '', preferences.diffView === 'split' ? 'split-view' : 'unified-view'].filter(Boolean).join(' '));
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="diff-table read-only-diff {diffClasses}" role="region" tabindex="0" aria-label={ariaLabel}>
  <div class="diff-rows">
    {#each renderedDiffLines as line, index (index + ':' + (line.type ?? 'row') + ':' + (line.left ?? '') + ':' + (line.right ?? ''))}
      <div class="diff-row {line.type}">
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
      </div>
    {:else}
      <InspectorStatus tone="empty" title={emptyTitle} message={emptyMessage} />
    {/each}
  </div>
</div>
