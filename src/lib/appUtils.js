import { fileKey } from './fileTree.js';

export function diffLinesForFile(file, diffMap) {
  if (!file) return [];

  const exactKey = `${file.section}:${file.path}`;
  if (diffMap[exactKey]) return diffMap[exactKey];
  if (diffMap[file.path]) return diffMap[file.path];

  return [];
}

export function resolveSelectedChangedFile(files, key, keys, path, options = {}) {
  return resolveChangedFileSelection(files, { key, keys, path }, options).file;
}

export function resolveChangedFileSelection(files, selection = {}, options = {}) {
  const { fallbackToFirst = true } = options;
  const key = selection.key ?? '';
  const keys = Array.isArray(selection.keys) ? selection.keys.filter(Boolean) : [];
  const path = selection.path ?? '';

  if (!files.length) return { file: null, key: '', keys: [] };

  const requestedKeys = Array.from(new Set([key, ...keys].filter(Boolean)));
  const exactMatches = files
    .map((file) => ({ file, key: fileKey(file) }))
    .filter((entry) => requestedKeys.includes(entry.key));

  if (exactMatches.length) {
    const primary = exactMatches.find((entry) => entry.key === key) ?? exactMatches[0];
    return { file: primary.file, key: primary.key, keys: exactMatches.map((entry) => entry.key) };
  }

  const requestedPaths = new Set([
    path,
    ...requestedKeys.map(pathFromSelectionKey),
  ].filter(Boolean));
  const pathMatches = files
    .map((file) => ({ file, key: fileKey(file) }))
    .filter((entry) => requestedPaths.has(entry.file.path));

  if (pathMatches.length) {
    const primary = pathMatches.find((entry) => entry.file.path === path) ?? pathMatches[0];
    return { file: primary.file, key: primary.key, keys: pathMatches.map((entry) => entry.key) };
  }

  const fallbackFile = fallbackToFirst ? files[0] : null;
  const fallbackKey = fallbackFile ? fileKey(fallbackFile) : '';
  return { file: fallbackFile, key: fallbackKey, keys: fallbackKey ? [fallbackKey] : [] };
}

function pathFromSelectionKey(key) {
  const separatorIndex = String(key).indexOf(':');
  return separatorIndex >= 0 ? String(key).slice(separatorIndex + 1) : String(key);
}

export function selectChangedFileKeys({ file, event, selectedFileKeys, lastSelectedKey, sectionKeys }) {
  const key = fileKey(file);
  const selectionIsSameSection = selectedFileKeys.every((selectedKey) => selectedKey.startsWith(`${file.section}:`));
  const useRange = event.shiftKey && lastSelectedKey && sectionKeys.includes(lastSelectedKey) && selectionIsSameSection;
  const useToggle = (event.ctrlKey || event.metaKey) && selectionIsSameSection;

  if (useRange) {
    return selectChangedFileRangeKeys(key, sectionKeys, lastSelectedKey, selectedFileKeys, event.ctrlKey || event.metaKey);
  }

  if (useToggle) {
    const nextKeys = selectedFileKeys.includes(key)
      ? selectedFileKeys.filter((selectedKey) => selectedKey !== key)
      : [...selectedFileKeys, key];
    return nextKeys.length ? nextKeys : [key];
  }

  return [key];
}

export function selectChangedFolderKeys({ folder, event, selectedFileKeys }) {
  const folderKeys = folder.childKeys ?? [];
  if (!folderKeys.length) return selectedFileKeys;

  const selectionIsSameSection = selectedFileKeys.every((selectedKey) => selectedKey.startsWith(`${folder.section}:`));
  const useToggle = (event.ctrlKey || event.metaKey) && selectionIsSameSection;
  const allChildrenSelected = folderKeys.every((key) => selectedFileKeys.includes(key));

  if (useToggle && allChildrenSelected) {
    const nextKeys = selectedFileKeys.filter((key) => !folderKeys.includes(key));
    return nextKeys.length ? nextKeys : [folderKeys[0]];
  }

  if (useToggle) {
    return Array.from(new Set([...selectedFileKeys, ...folderKeys]));
  }

  return folderKeys;
}

export function selectChangedFileRangeKeys(key, sectionKeys, lastSelectedKey, selectedFileKeys, appendSelection) {
  const start = sectionKeys.indexOf(lastSelectedKey);
  const end = sectionKeys.indexOf(key);
  const range = sectionKeys.slice(Math.min(start, end), Math.max(start, end) + 1);
  return appendSelection ? Array.from(new Set([...selectedFileKeys, ...range])) : range;
}

export function commitFilesForTree(commit) {
  return (commit.changedPaths ?? []).map((file) => {
    if (typeof file === 'string') {
      return { path: file, status: '·', label: 'Changed', section: 'commit', tone: 'modified', lines: '' };
    }
    return { section: 'commit', tone: 'modified', lines: '', ...file };
  });
}

export function emptyCommit(branch) {
  return {
    id: '',
    subject: 'No commits found',
    author: '',
    date: '',
    branch,
    refs: [],
    parents: [],
    detailsLoaded: true,
    files: 0,
    insertions: 0,
    deletions: 0,
    message: 'This repository has no commit history yet.',
  };
}

export function getBranchNameProblem(value) {
  const name = value.trim();
  if (!name) return 'Enter a branch name.';
  if (name.length > 255) return 'Branch names must be 255 characters or fewer.';
  if (name.startsWith('-')) return 'Branch names cannot start with a dash.';
  if (name.startsWith('.') || name.includes('/.') || name.endsWith('.') || name.endsWith('/')) return 'Branch names cannot start or end a path segment with a dot or slash.';
  if (name.includes('..')) return 'Branch names cannot contain two consecutive dots.';
  if (name.includes('//')) return 'Branch names cannot contain empty path segments.';
  if (name.includes('@{')) return 'Branch names cannot contain the sequence @{.';
  if (/\.lock(?:$|\/)/.test(name)) return 'Branch name segments cannot end with .lock.';
  if (/[\s~^:?*\[\]\\]/.test(name)) return 'Branch names cannot contain spaces or these characters: ~ ^ : ? * [ ] \\.';
  return '';
}

export function confirmationPreferenceForAction(command, options = {}) {
  if (options.confirmationPreference) return options.confirmationPreference;
  const action = String(command || '').toLowerCase();
  if (action.includes('discard')) return 'confirmDiscardChanges';
  if (action.includes('reset')) return 'confirmResetBranch';
  if (action.includes('force')) return 'confirmForcePush';
  if (action.includes('delete') && action.includes('branch')) return 'confirmDeleteBranch';
  if (action.includes('cancel')) return 'confirmCancelOperations';
  return '';
}

export function describeBackendError(error) {
  const message = String(error || '').toLowerCase();
  if (!message) return { hint: '', showOpenRepository: false, showPublishUpstream: false };
  if (message.includes('no upstream branch') || message.includes('set the remote as upstream')) {
    return { hint: 'Publish this branch to a remote before pushing normally.', showOpenRepository: false, showPublishUpstream: true };
  }
  if (message.includes('not a git repository') || message.includes('repository not found') || message.includes('no such file') || message.includes('cannot find path')) {
    return { hint: 'Choose a valid repository folder, then try opening it again.', showOpenRepository: true, showPublishUpstream: false };
  }
  if (message.includes('git is required') || message.includes('git executable') || message.includes('command not found')) {
    return { hint: 'Install Git, ensure it is on PATH, then restart Forker so repository commands can run.', showOpenRepository: false, showPublishUpstream: false };
  }
  if (message.includes('not fully merged') && message.includes('branch')) {
    return { hint: 'Git protected this branch because it has commits not merged into the current branch. Force delete only if those commits are no longer needed.', showOpenRepository: false, showPublishUpstream: false, showForceDeleteBranch: true };
  }
  if (message.includes('conflict') || message.includes('merge failed')) {
    return { hint: 'Resolve the working tree conflicts, then refresh the repository state.', showOpenRepository: false, showPublishUpstream: false, showForceDeleteBranch: false };
  }
  if (message.includes('rejected') || message.includes('non-fast-forward') || message.includes('fetch first')) {
    return { hint: 'Fetch or pull the remote changes before pushing again.', showOpenRepository: false, showPublishUpstream: false };
  }
  if (message.includes('no remote') || message.includes('does not appear to be a git repository')) {
    return { hint: 'Add or verify the repository remote, then fetch again.', showOpenRepository: false, showPublishUpstream: false };
  }
  if (message.includes('could not resolve host') || message.includes('failed to connect') || message.includes('network') || message.includes('unable to access')) {
    return { hint: 'The remote is unreachable. Check your network, VPN, proxy, or remote URL before retrying.', showOpenRepository: false, showPublishUpstream: false };
  }
  if (message.includes('permission') || message.includes('authentication') || message.includes('could not read from remote repository')) {
    return { hint: 'Check your remote credentials or SSH access, then retry the operation.', showOpenRepository: false, showPublishUpstream: false };
  }
  return { hint: 'Review the Git message, fix the repository state if needed, then retry.', showOpenRepository: false, showPublishUpstream: false };
}

export function isNoUpstreamError(error) {
  const message = String(error).toLowerCase();
  return message.includes('no upstream branch') || message.includes('set the remote as upstream');
}

export function isBlockingAction(label) {
  return ['Checkout', 'Discard', 'Discard changes', 'Reset'].some((item) => String(label || '').startsWith(item));
}
