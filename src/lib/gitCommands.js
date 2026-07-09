export const GIT_COMMANDS = Object.freeze({
  stage: { command: 'git_stage', batchCommand: 'git_stage_paths', label: 'Stage' },
  unstage: { command: 'git_unstage', batchCommand: 'git_unstage_paths', label: 'Unstage' },
  discard: {
    command: 'git_discard',
    batchCommand: 'git_discard_paths',
    label: 'Discard',
    danger: true,
    confirmationPreference: 'confirmDiscardChanges',
  },
  fetch: { command: 'git_fetch', label: 'Fetch' },
  pull: { command: 'git_pull', label: 'Pull' },
  push: { command: 'git_push', label: 'Push' },
  stash: {
    command: 'git_stash',
    label: 'Stash',
    confirmation: {
      confirmTitle: 'Stash working tree changes?',
      confirmMessage: 'This saves tracked and untracked changes to a Git stash, then leaves the working tree clean.',
      confirmLabel: 'Stash changes',
    },
  },
  checkout: { command: 'git_checkout', label: 'Checkout' },
  checkoutRemote: { command: 'git_checkout_remote', label: 'Checkout remote branch' },
});

export const COMMAND_BY_NAME = Object.freeze(
  Object.fromEntries(Object.values(GIT_COMMANDS).map((definition) => [definition.command, definition])),
);

export function gitCommandDefinition(command) {
  return COMMAND_BY_NAME[command] ?? null;
}

export function gitCommandLabel(command, fallback = command) {
  return gitCommandDefinition(command)?.label ?? fallback;
}
