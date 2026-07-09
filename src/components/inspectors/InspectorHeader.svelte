<script>
  let {
    titleId = undefined,
    eyebrow = '',
    title = '',
    subtitle = '',
    meta = [],
    actions,
  } = $props();
</script>

<header class="inspector-header">
  <div class="inspector-title-block">
    {#if eyebrow}<span class="inspector-eyebrow">{eyebrow}</span>{/if}
    <h1 id={titleId}>{title}</h1>
    {#if subtitle}<p>{subtitle}</p>{/if}
    {#if meta.length}
      <div class="inspector-meta-row" aria-label="Inspector metadata">
        {#each meta as item (item.label + ':' + item.value)}
          <span class:tone-green={item.tone === 'success'} class:tone-red={item.tone === 'danger'} class:tone-amber={item.tone === 'warning'}>
            <strong>{item.label}</strong> {item.value}
          </span>
        {/each}
      </div>
    {/if}
  </div>
  {#if actions}
    <div class="inspector-header-actions ui-action-group">
      {@render actions()}
    </div>
  {/if}
</header>
