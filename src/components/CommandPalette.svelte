<script>
  import { trapFocus } from '../lib/focusTrap.js';

  /**
   * @typedef {Object} Command
   * @property {string} id
   * @property {string} label
   * @property {string} [description]
   * @property {string} [shortcut]
   * @property {string} [keywords]
   * @property {boolean} [disabled]
   * @property {boolean} [danger]
   * @property {() => void | Promise<void>} action
   */

  /** @type {{ commands?: Command[], onClose?: () => void }} */
  let { commands = [], onClose = () => {} } = $props();

  let query = $state('');
  let activeIndex = $state(0);
  let inputEl = $state();
  const paletteShortcut = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac') ? '⌘P' : 'Ctrl+P';

  function commandText(command) {
    return [command.label, command.description, command.shortcut, command.keywords].filter(Boolean).join(' ').toLowerCase();
  }

  let normalizedQuery = $derived(query.trim().toLowerCase());
  let filteredCommands = $derived(commands.filter((command) => !normalizedQuery || commandText(command).includes(normalizedQuery)));
  let enabledCommands = $derived(filteredCommands.filter((command) => !command.disabled));

  $effect(() => {
    if (activeIndex >= filteredCommands.length) activeIndex = Math.max(0, filteredCommands.length - 1);
  });

  function clampIndex(index) {
    if (!filteredCommands.length) return 0;
    return Math.max(0, Math.min(filteredCommands.length - 1, index));
  }

  function nextEnabledIndex(startIndex, direction) {
    if (!filteredCommands.length) return 0;
    let next = startIndex;
    for (let step = 0; step < filteredCommands.length; step += 1) {
      next = (next + direction + filteredCommands.length) % filteredCommands.length;
      if (!filteredCommands[next]?.disabled) return next;
    }
    return clampIndex(startIndex);
  }

  function moveActive(delta) {
    if (!filteredCommands.length) return;
    let next = activeIndex;
    for (let step = 0; step < filteredCommands.length; step += 1) {
      next = (next + delta + filteredCommands.length) % filteredCommands.length;
      if (!filteredCommands[next]?.disabled) break;
    }
    activeIndex = next;
  }

  async function runCommand(command) {
    if (!command || command.disabled) return;
    onClose();
    await command.action?.();
  }

  $effect(() => {
    const activeCommand = filteredCommands[activeIndex];
    if (!activeCommand) return;
    document.getElementById(`command-${activeCommand.id}`)?.scrollIntoView({ block: 'nearest' });
  });

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      activeIndex = nextEnabledIndex(-1, 1);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      activeIndex = nextEnabledIndex(0, -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      runCommand(filteredCommands[activeIndex] ?? enabledCommands[0]);
    }
  }
</script>

<div class="modal-backdrop command-palette-backdrop" role="presentation" onclick={onClose}>
  <div
    class="command-palette modal-card"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="command-palette-title"
    use:trapFocus={{ initialFocus: () => inputEl }}
    onclick={(event) => event.stopPropagation()}
    onkeydown={handleKeydown}
  >
    <header class="command-palette-header">
      <div>
        <h2 id="command-palette-title">Command Palette</h2>
        <p>Run repository actions and jump to workbench controls.</p>
      </div>
      <kbd>{paletteShortcut}</kbd>
    </header>

    <label class="command-search">
      <span aria-hidden="true">⌕</span>
      <input
        bind:this={inputEl}
        bind:value={query}
        placeholder="Type a command…"
        role="combobox"
        aria-label="Search commands"
        aria-controls="command-palette-list"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-activedescendant={filteredCommands[activeIndex] ? `command-${filteredCommands[activeIndex].id}` : undefined}
      />
    </label>

    <div id="command-palette-list" class="command-list" role="listbox" aria-label="Commands">
      {#each filteredCommands as command, index (command.id)}
        <button
          id={`command-${command.id}`}
          class="ui-row"
          class:active={index === activeIndex}
          class:danger={command.danger}
          disabled={command.disabled}
          role="option"
          aria-selected={index === activeIndex}
          aria-disabled={command.disabled}
          onmouseenter={() => activeIndex = clampIndex(index)}
          onclick={() => runCommand(command)}
        >
          <span class="command-main">
            <strong>{command.label}</strong>
            {#if command.description}<small>{command.description}</small>{/if}
          </span>
          {#if command.shortcut}<kbd>{command.shortcut}</kbd>{/if}
        </button>
      {:else}
        <div class="command-empty" role="status">No commands match “{query}”.</div>
      {/each}
    </div>
  </div>
</div>
