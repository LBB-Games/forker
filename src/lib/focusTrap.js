const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function trapFocus(node, options = {}) {
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  function focusableElements() {
    return Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      return !element.hasAttribute('disabled') && element.offsetParent !== null;
    });
  }

  function focusInitial() {
    const elements = focusableElements();
    const initial = options.initialFocus?.() ?? elements[0] ?? node;
    if (initial instanceof HTMLElement) initial.focus({ preventScroll: true });
  }

  function handleKeydown(event) {
    if (event.key !== 'Tab') return;

    const elements = focusableElements();
    if (!elements.length) {
      event.preventDefault();
      node.focus({ preventScroll: true });
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  node.addEventListener('keydown', handleKeydown);
  queueMicrotask(focusInitial);

  return {
    destroy() {
      node.removeEventListener('keydown', handleKeydown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    },
  };
}
