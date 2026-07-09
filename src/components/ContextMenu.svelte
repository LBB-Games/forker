<script>
  import { tick } from 'svelte';

  /**
   * @typedef {Object} Props
   * @property {any} [menu]
   * @property {any} [onClose]
   */

  /** @type {Props} */
  let { menu = null, onClose = () => {} } = $props();

  let menuEl = $state();
  let activeIndex = $state(0);


  async function focusMenu() {
    activeIndex = nextEnabledIndex(-1, 1);
    await tick();
    menuEl?.focus();
  }

  function actionableIndex(index) {
    const item = items[index];
    return item && !item.separator ? index : -1;
  }

  function nextEnabledIndex(startIndex, direction) {
    if (!items.length) return -1;
    let index = startIndex;
    for (let step = 0; step < items.length; step += 1) {
      index = (index + direction + items.length) % items.length;
      const item = items[index];
      if (item && !item.separator && !item.disabled) return index;
    }
    return -1;
  }

  function moveActive(direction) {
    const nextIndex = nextEnabledIndex(activeIndex, direction);
    if (nextIndex >= 0) activeIndex = nextIndex;
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      activeIndex = nextEnabledIndex(-1, 1);
    } else if (event.key === 'End') {
      event.preventDefault();
      activeIndex = nextEnabledIndex(0, -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) runAction(item);
    } else if (event.key === 'Tab') {
      onClose();
    }
  }

  function runAction(item) {
    if (item.disabled) return;
    onClose();
    item.action?.();
  }
  let items = $derived(menu?.items?.filter(Boolean) ?? []);
  let activeItemId = $derived(actionableIndex(activeIndex) >= 0 ? `context-menu-item-${actionableIndex(activeIndex)}` : undefined);
  $effect(() => {
    if (menu && items.length) focusMenu();
  });

  function closeContextMenu(event) {
    event.preventDefault();
    onClose();
  }
</script>

{#if menu && items.length}
  <button class="context-menu-backdrop" type="button" tabindex="-1" aria-label="Close context menu" onclick={onClose} oncontextmenu={closeContextMenu}></button>
  <div class="context-menu" role="menu" tabindex="-1" aria-activedescendant={activeItemId} bind:this={menuEl} style={`left: ${menu.x}px; top: ${menu.y}px;`} onkeydown={handleKeydown} onmousedown={(event) => event.stopPropagation()}>
    {#each items as item, index}
      {#if item.separator}
        <div class="context-menu-separator" role="separator"></div>
      {:else}
        <button id={`context-menu-item-${index}`} role="menuitem" class:danger={item.danger} class:active={index === activeIndex} disabled={item.disabled} aria-disabled={item.disabled} tabindex="-1" onmouseenter={() => !item.disabled && (activeIndex = index)} onclick={() => runAction(item)}>
          {#if item.icon}<span>{item.icon}</span>{/if}
          <strong>{item.label}</strong>
        </button>
      {/if}
    {/each}
  </div>
{/if}
