import { GIT_COMMANDS } from './gitCommands.js';

/**
 * Builds the command palette command model from app state and callback props.
 * Keeping this pure makes shortcut labels and action routing easier to review.
 */

export function buildCommandPaletteCommands({ state, actions }) {
  const {
    repo,
    hasLoadedRepo,
    selectedBranch,
    activePage,
    selectedChangedFiles,
    selectedChangedFile,
    selectedSection,
    selectedCommit,
    stashes = [],
    remotes = [],
    stagedCount,
    commitSummary,
    actionBusy,
    isRefreshing,
    isLoadingRepo,
    stageCommand,
  } = state;

  const hasRepo = !!repo.path && hasLoadedRepo;
  const selectedBranchName = selectedBranch || repo.currentBranch;
  const selectedBranchIsRemote = remotes.includes(selectedBranchName);
  const checkoutSelectedBranchCommand = selectedBranchIsRemote ? GIT_COMMANDS.checkoutRemote : GIT_COMMANDS.checkout;
  const checkoutSelectedBranchArgs = selectedBranchIsRemote ? { remoteBranch: selectedBranchName } : { reference: selectedBranchName };
  const canStageSelection = activePage === 'changes' && !!stageCommand && !!selectedChangedFiles.length && !actionBusy;
  const canDiscardSelection = activePage === 'changes' && selectedSection === 'unstaged' && !!selectedChangedFiles.length && !actionBusy;
  const canCommit = hasRepo && !!stagedCount && !!commitSummary.trim() && !actionBusy;
  const canInspectSelectedFile = hasRepo && activePage === 'changes' && !!selectedChangedFile?.path;
  const canInspectSelectedCommit = hasRepo && activePage === 'commits' && !!selectedCommit?.id;
  const stashCount = stashes.length;

  return [
    { id: 'open-repository', label: 'Open repository', description: 'Choose a local Git repository.', shortcut: shortcutLabel('O'), keywords: 'repo local folder', action: actions.requestOpenRepository },
    { id: 'clone-repository', label: 'Clone repository', description: 'Clone a remote repository to disk.', shortcut: shortcutLabel('Shift+O'), keywords: 'remote url new repo', action: actions.requestCloneRepository },
    { id: 'refresh-repository', label: 'Refresh repository', description: 'Reload working tree, branches, and history.', shortcut: shortcutLabel('R'), disabled: !hasRepo || !!actionBusy || isRefreshing || isLoadingRepo, keywords: 'reload status', action: () => actions.refreshRepository('Manual refresh') },
    { id: 'fetch-repository', label: 'Fetch', description: 'Fetch from configured remotes.', disabled: !hasRepo || !!actionBusy, keywords: 'remote update', action: () => actions.runGitAction(GIT_COMMANDS.fetch.command, {}, GIT_COMMANDS.fetch.label) },
    { id: 'pull-repository', label: 'Pull', description: 'Pull from upstream into the current branch.', disabled: !hasRepo || !!actionBusy, keywords: 'remote down upstream', action: () => actions.runGitAction(GIT_COMMANDS.pull.command, {}, GIT_COMMANDS.pull.label) },
    { id: 'push-repository', label: 'Push', description: 'Push the current branch.', disabled: !hasRepo || !!actionBusy, keywords: 'remote up upstream publish', action: () => actions.runGitAction(GIT_COMMANDS.push.command, {}, GIT_COMMANDS.push.label) },
    { id: 'stash-working-tree', label: 'Stash working tree changes', description: 'Save tracked and untracked changes, then clean the working tree.', disabled: !hasRepo || !!actionBusy, keywords: 'shelve save worktree dirty changes', action: () => actions.runGitAction(GIT_COMMANDS.stash.command, {}, GIT_COMMANDS.stash.label, GIT_COMMANDS.stash.confirmation) },
    { id: 'open-stash-manager', label: 'Open stashes', description: stashCount ? `Inspect and apply ${stashCount} ${stashCount === 1 ? 'stash' : 'stashes'}.` : 'No stashes are currently saved.', disabled: !hasRepo, keywords: 'stash list apply pop drop inspect diff', action: () => actions.openInspector('stashes') },
    { id: 'stage-selected-file', label: 'Stage selected file', description: selectedChangedFiles.length > 1 ? `Stage ${selectedChangedFiles.length} selected files.` : 'Move selected file changes into the index.', shortcut: 'Space', disabled: !canStageSelection || stageCommand?.command !== GIT_COMMANDS.stage.command, keywords: 'index add selection', action: () => actions.runSelectedGitAction(GIT_COMMANDS.stage.command, 'unstaged', GIT_COMMANDS.stage.label) },
    { id: 'unstage-selected-file', label: 'Unstage selected file', description: selectedChangedFiles.length > 1 ? `Unstage ${selectedChangedFiles.length} selected files.` : 'Move selected file changes out of the index.', shortcut: 'Space', disabled: !canStageSelection || stageCommand?.command !== GIT_COMMANDS.unstage.command, keywords: 'index reset selection', action: () => actions.runSelectedGitAction(GIT_COMMANDS.unstage.command, 'staged', GIT_COMMANDS.unstage.label) },
    { id: 'discard-selected-changes', label: 'Discard selected changes', description: 'Permanently remove unstaged changes after confirmation.', shortcut: 'Delete', disabled: !canDiscardSelection, danger: true, keywords: 'remove revert destructive selected file', action: actions.discardSelectedFileChanges },
    { id: 'commit-staged-changes', label: 'Commit staged changes', description: stagedCount ? `Commit ${stagedCount} staged ${stagedCount === 1 ? 'file' : 'files'}.` : 'Stage files and enter a summary first.', shortcut: shortcutLabel('Enter'), disabled: !canCommit, keywords: 'save snapshot', action: actions.commitChanges },
    { id: 'create-branch', label: 'Create branch', description: 'Create a new local branch.', disabled: !hasRepo || !!actionBusy, keywords: 'new branch', action: actions.createBranch },
    { id: 'checkout-selected-branch', label: selectedBranchIsRemote ? 'Checkout selected remote branch' : 'Checkout selected branch', description: selectedBranchName ? `Switch the current worktree to ${selectedBranchName}.` : 'Select a branch first.', disabled: !hasRepo || !selectedBranchName || selectedBranchName === (repo.currentBranch) || !!actionBusy, keywords: 'switch branch worktree', action: () => actions.runGitAction(checkoutSelectedBranchCommand.command, checkoutSelectedBranchArgs, checkoutSelectedBranchCommand.label) },
    { id: 'open-selected-file-diff-inspector', label: 'Open selected file diff', description: selectedChangedFile?.path ? `Inspect ${selectedChangedFile.path} in a larger read-only diff.` : 'Select a changed file first.', disabled: !canInspectSelectedFile, keywords: 'inspect larger diff working tree file', action: () => actions.openInspector('large-diff', { filePath: selectedChangedFile.path, section: selectedChangedFile.section, status: selectedChangedFile.status }) },
    { id: 'show-selected-file-history', label: 'Show selected file history', description: selectedChangedFile?.path ? `Show commits that touched ${selectedChangedFile.path}.` : 'Select a changed file first.', disabled: !canInspectSelectedFile, keywords: 'inspect file log follow renames', action: () => actions.openInspector('file-history', { filePath: selectedChangedFile.path, section: selectedChangedFile.section, status: selectedChangedFile.status }) },
    { id: 'open-selected-commit-inspector', label: 'Open selected commit', description: selectedCommit?.id ? `Inspect ${selectedCommit.subject}.` : 'Select a commit first.', disabled: !canInspectSelectedCommit, keywords: 'inspect commit diff details metadata', action: () => actions.openInspector('commit', { commitId: selectedCommit.id }) },
    { id: 'show-current-branch-history', label: 'Show current branch history', description: selectedBranchName ? `Inspect commit history for ${selectedBranchName}.` : 'Select a branch first.', disabled: !hasRepo || !selectedBranchName, keywords: 'inspect branch log commits filter', action: () => actions.openInspector('branch-history', { branchName: selectedBranchName }) },
    { id: 'open-settings', label: 'Open settings', description: 'Configure Git workflow preferences.', shortcut: ',', keywords: 'preferences options', action: actions.openSettings },
    { id: 'show-changes', label: 'Switch to Changes', description: 'Show working copy, diff, and commit composer.', shortcut: shortcutLabel('1'), keywords: 'working tree files', action: () => actions.selectPage('changes') },
    { id: 'show-commits', label: 'Switch to Commits', description: 'Show commit graph and commit details.', shortcut: shortcutLabel('2'), keywords: 'history graph log', action: () => actions.selectPage('commits') },
    { id: 'focus-commit-summary', label: 'Focus commit summary', description: 'Move the cursor to the commit summary field.', disabled: !hasRepo, keywords: 'message subject composer', action: () => actions.focusControl('changes', '#commit-summary-input') },
    { id: 'focus-file-filter', label: 'Focus file filter', description: 'Filter changed files in the Changes page.', disabled: !hasRepo, keywords: 'changes search file path', action: () => actions.focusControl('changes', '#changed-file-filter-input') },
    { id: 'focus-commit-filter', label: 'Focus commit filter', description: 'Filter commits in the history list.', disabled: !hasRepo, keywords: 'history search log', action: () => actions.focusControl('commits', '#commit-filter-input') },
  ];
}

export function shortcutLabel(key) {
  const primary = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac') ? '⌘' : 'Ctrl+';
  return `${primary}${key}`;
}
