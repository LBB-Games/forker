<script>
  import { trapFocus } from '../lib/focusTrap.js';

  let {
    cardClass = 'modal-card',
    titleId,
    descriptionId = undefined,
    closeLabel = 'Close',
    initialFocus = undefined,
    closeOnBackdrop = true,
    onClose = () => {},
    children,
  } = $props();

  function handleBackdropClick() {
    if (closeOnBackdrop) onClose();
  }

  function handleKeydown(event) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  function stopPropagation(event) {
    event.stopPropagation();
  }
</script>

<div class="modal-backdrop" role="presentation" onclick={handleBackdropClick}>
  <div
    class={cardClass}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    tabindex="-1"
    use:trapFocus={initialFocus ? { initialFocus } : undefined}
    onclick={stopPropagation}
    onkeydown={handleKeydown}
  >
    {@render children?.()}
  </div>
</div>
