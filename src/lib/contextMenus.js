export function changedFileMenuItems(file, {
  readOnly = false,
  onRunSelectedGitAction = () => {},
  onCopyText = () => {},
  onOpenInspector = null,
} = {}) {
  if (!file) return [];
  const isStaged = file.section === 'staged';
  const isWorkingTreeFile = ['staged', 'unstaged'].includes(file.section);
  return [
    !readOnly && { label: isStaged ? 'Unstage' : 'Stage', icon: isStaged ? '−' : '+', action: () => onRunSelectedGitAction(isStaged ? 'git_unstage' : 'git_stage', file.section, isStaged ? 'Unstage' : 'Stage') },
    !readOnly && !isStaged && { label: 'Discard changes', icon: '⌫', danger: true, action: () => onRunSelectedGitAction('git_discard', 'unstaged', 'Discard') },
    !readOnly && { separator: true },
    onOpenInspector && isWorkingTreeFile && { label: 'Open diff in inspector', icon: '□', action: () => onOpenInspector('large-diff', { filePath: file.path, section: file.section, status: file.status }) },
    onOpenInspector && isWorkingTreeFile && { label: 'Show file history', icon: '◷', action: () => onOpenInspector('file-history', { filePath: file.path, section: file.section, status: file.status }) },
    onOpenInspector && isWorkingTreeFile && { separator: true },
    { label: 'Copy path', icon: '⧉', action: () => onCopyText(file.path) },
  ].filter(Boolean);
}

export function changedFolderMenuItems(folder, {
  readOnly = false,
  onRunSelectedGitAction = () => {},
  onToggleFolder = () => {},
  onCopyText = () => {},
} = {}) {
  if (!folder) return [];
  const isStaged = folder.section === 'staged';
  return [
    !readOnly && { label: isStaged ? 'Unstage folder' : 'Stage folder', icon: isStaged ? '−' : '+', action: () => onRunSelectedGitAction(isStaged ? 'git_unstage' : 'git_stage', folder.section, isStaged ? 'Unstage' : 'Stage') },
    !readOnly && !isStaged && { label: 'Discard folder changes', icon: '⌫', danger: true, action: () => onRunSelectedGitAction('git_discard', 'unstaged', 'Discard') },
    !readOnly && { separator: true },
    { label: folder.collapsed ? 'Expand folder' : 'Collapse folder', icon: folder.collapsed ? '▾' : '▸', action: () => onToggleFolder(folder.section, folder.path) },
    { label: 'Copy folder path', icon: '⧉', action: () => onCopyText(folder.path) },
  ].filter(Boolean);
}

export function commitMenuItems(commit, {
  actionBusy = '',
  onRunGitAction = () => {},
  onRequestResetBranch = () => {},
  onCopyText = () => {},
  onOpenInspector = null,
} = {}) {
  return [
    onOpenInspector && { label: 'Open commit in inspector', icon: '□', disabled: !commit?.id, action: () => onOpenInspector('commit', { commitId: commit.id }) },
    onOpenInspector && { separator: true },
    { label: 'Checkout commit', icon: '⑂', disabled: !commit?.id || !!actionBusy, action: () => onRunGitAction('git_checkout', { reference: commit.id }, 'Checkout') },
    { label: 'Reset current branch to this commit…', icon: '↤', danger: true, disabled: !commit?.id || !!actionBusy, action: () => onRequestResetBranch(commit) },
    { separator: true },
    { label: 'Copy hash', icon: '⧉', disabled: !commit?.id, action: () => onCopyText(commit.id) },
    { label: 'Copy subject', icon: '⧉', disabled: !commit?.subject, action: () => onCopyText(commit.subject) },
  ].filter(Boolean);
}
