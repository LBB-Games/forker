<script>
  /**
   * Shared product dropdown/listbox used anywhere the app needs a styled picker.
   * Supports simple label/description options plus optional Svelte snippets for richer rows.
   */
  let {
    id = '',
    value = $bindable(''),
    options = [],
    disabled = false,
    invalid = false,
    placeholder = 'Select…',
    menuLabel = 'Options',
    getValue = (option) => option?.value ?? option,
    getLabel = (option) => option?.label ?? String(option ?? ''),
    getDescription = (option) => option?.description ?? '',
    getIcon = (option) => option?.icon ?? '',
    getBadge = (option) => option?.badge ?? '',
    getStyle = () => '',
    onChange = () => {},
    trigger,
    option,
    class: className = '',
  } = $props();

  let open = $state(false);

  let selectedOption = $derived(options.find((item) => getValue(item) === value) ?? options[0] ?? null);
  let selectedValue = $derived(selectedOption ? getValue(selectedOption) : '');
  let menuId = $derived(id ? `${id}-menu` : undefined);

  $effect(() => {
    if ((value === '' || value === undefined || value === null) && selectedOption) value = getValue(selectedOption);
  });

  $effect(() => {
    if (disabled || !options.length) open = false;
  });

  function choose(item) {
    if (disabled) return;
    const previousValue = value;
    const nextValue = getValue(item);
    value = nextValue;
    open = false;
    onChange(item, nextValue, previousValue);
  }

  function selectedIndex() {
    return Math.max(0, options.findIndex((item) => getValue(item) === selectedValue));
  }

  function moveSelection(delta) {
    if (!options.length) return;
    const nextIndex = (selectedIndex() + delta + options.length) % options.length;
    choose(options[nextIndex]);
    open = true;
  }

  function handleFocusout(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) open = false;
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      open = false;
      event.stopPropagation();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) open = true;
      else moveSelection(1);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) open = true;
      else moveSelection(-1);
    }
  }
</script>

<div class={`app-dropdown ${className}`} class:open onfocusout={handleFocusout}>
  <button
    {id}
    class="app-dropdown-trigger"
    type="button"
    disabled={disabled || !options.length}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={menuId}
    data-invalid={invalid ? 'true' : undefined}
    onclick={() => open = !open}
    onkeydown={handleKeydown}
    style={selectedOption ? getStyle(selectedOption) : ''}
  >
    <span class="app-dropdown-trigger-copy">
      {#if trigger}
        {@render trigger(selectedOption)}
      {:else if selectedOption}
        <strong>{getLabel(selectedOption)}</strong>
        {#if getDescription(selectedOption)}<small>{getDescription(selectedOption)}</small>{/if}
      {:else}
        <strong>{placeholder}</strong>
      {/if}
    </span>
    <span class="app-dropdown-chevron" aria-hidden="true">⌄</span>
  </button>

  {#if open}
    <div id={menuId} class="app-dropdown-menu" role="listbox" aria-label={menuLabel} tabindex="-1" onkeydown={handleKeydown}>
      {#each options as item (getValue(item))}
        {@const active = getValue(item) === selectedValue}
        <button type="button" role="option" aria-selected={active} class:selected={active} style={getStyle(item)} onclick={() => choose(item)}>
          {#if option}
            {@render option(item, active)}
          {:else}
            {#if getIcon(item)}<span class="app-dropdown-option-marker" aria-hidden="true">{getIcon(item)}</span>{/if}
            <span class="app-dropdown-option-copy">
              <strong>{getLabel(item)}</strong>
              {#if getDescription(item)}<small>{getDescription(item)}</small>{/if}
            </span>
            {#if getBadge(item)}<span class="app-dropdown-badge">{getBadge(item)}</span>{/if}
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
