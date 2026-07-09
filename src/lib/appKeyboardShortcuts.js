/**
 * Keyboard shortcuts shared by the Svelte app shell.
 *
 * The controller supplies state getters and actions so this module stays pure and
 * does not own app-wide mutable state.
 */

export function isTypingTarget(target) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  return !!element.closest('input, textarea, select, [contenteditable="true"]');
}

export function isPrimaryShortcut(event, key) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key.toLowerCase();
}

export function focusElement(selector) {
  requestAnimationFrame(() => document.querySelector(selector)?.focus?.({ preventScroll: true }));
}

/**
 * @param {object} options
 * @param {() => { modalOpen: boolean, showCommandPalette: boolean, activePage: string }} options.getState
 * @param {object} options.actions
 */
export function createGlobalKeydownHandler({ getState, actions }) {
  return async function handleGlobalKeydown(event) {
    const typing = isTypingTarget(event.target);
    const state = getState();

    if (isPrimaryShortcut(event, 'p')) {
      event.preventDefault();
      if (!state.modalOpen || state.showCommandPalette) actions.openCommandPalette();
      return;
    }

    if (state.showCommandPalette || state.modalOpen) return;

    if (isPrimaryShortcut(event, 'o') && event.shiftKey) {
      event.preventDefault();
      actions.openCloneRepository();
      return;
    }
    if (isPrimaryShortcut(event, 'o')) {
      event.preventDefault();
      actions.openRepository();
      return;
    }
    if (isPrimaryShortcut(event, 'r')) {
      event.preventDefault();
      await actions.refreshRepository();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      await actions.commitChanges();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === '1') {
      event.preventDefault();
      actions.showChangesPage();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === '2') {
      event.preventDefault();
      actions.showCommitsPage();
      return;
    }

    if (isPrimaryShortcut(event, 'a') && !typing) {
      if (state.activePage === 'changes') actions.selectAllChangedFilesInSelectedSection?.();
      event.preventDefault();
      return;
    }

    if (typing) return;

    if (event.key === ' ' && state.activePage === 'changes') {
      event.preventDefault();
      await actions.toggleSelectedFileStage();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.activePage === 'changes') {
      event.preventDefault();
      await actions.discardSelectedFileChanges();
    }
  };
}
