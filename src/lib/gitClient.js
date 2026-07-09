import { invoke } from '@tauri-apps/api/core';

export function invokeCommand(command, args = {}) {
  return invoke(command, args);
}

export function loadGitInstallation() {
  return invokeCommand('git_installation');
}

export function loadAppSettings() {
  return invokeCommand('load_app_settings');
}

export function saveAppSettings(settings) {
  return invokeCommand('save_app_settings', { settings });
}

export function watchRepository(path) {
  return invokeCommand('watch_repository', { path });
}

export function unwatchRepository() {
  return invokeCommand('unwatch_repository');
}

export function openRepositorySnapshot(path, activeWorktreePath = null) {
  return invokeCommand('open_repository_group', { rootPath: path, activeWorktreePath });
}

export function openStandardRepositorySnapshot(path) {
  return invokeCommand('open_repository', { path });
}

export function cloneStandardRepository(remoteUrl, parentPath, directoryName = null) {
  return invokeCommand('clone_standard_repository', { remoteUrl, parentPath, directoryName });
}

export function prepareBareClone(remoteUrl, parentPath, directoryName = null) {
  return invokeCommand('prepare_bare_clone', { remoteUrl, parentPath, directoryName });
}

export function prepareMetaClone(remoteUrl, parentPath, directoryName = null) {
  return invokeCommand('prepare_meta_clone', { remoteUrl, parentPath, directoryName });
}

export function completeFirstWorktree(rootPath, selectedRemoteBranch, localBranchName = null, worktreeName = null) {
  return invokeCommand('complete_first_worktree', { rootPath, selectedRemoteBranch, localBranchName, worktreeName });
}

export function selectWorktree(rootPath, worktreePath) {
  return invokeCommand('select_worktree', { rootPath, worktreePath });
}

export function createWorktree(rootPath, branchName, worktreeName, startPoint = null) {
  return invokeCommand('create_worktree', { rootPath, branchName, worktreeName, startPoint });
}

export function removeWorktree(rootPath, worktreePath, force = false) {
  return invokeCommand('remove_worktree', { rootPath, worktreePath, force });
}

export function pruneWorktrees(rootPath) {
  return invokeCommand('prune_worktrees', { rootPath });
}

export function cloneRepositorySnapshot(remoteUrl, parentPath, directoryName = null) {
  return invokeCommand('clone_repository', { remoteUrl, parentPath, directoryName });
}

export function refreshRepositorySnapshot(path, updateRemotes = false) {
  return invokeCommand('git_refresh', { path, updateRemotes });
}

export function runGitCommand(command, path, args = {}) {
  return invokeCommand(command, { path, ...args });
}

export function loadFileDiff(path, filePath, staged, status, contextLines) {
  return invokeCommand('git_file_diff', { path, filePath, staged, status, contextLines });
}

export function loadConflictPreview(path, filePath) {
  return invokeCommand('git_conflict_preview', { path, filePath });
}

export function loadCommitDetails(path, id) {
  return invokeCommand('git_commit_details', { path, id });
}

export function loadCommitDiff(path, commitId, filePath = null, contextLines = null) {
  return invokeCommand('git_commit_diff', { path, commitId, filePath, contextLines });
}

export function loadStashDiff(path, stashRef, filePath = null, contextLines = null) {
  return invokeCommand('git_stash_diff', { path, stashRef, filePath, contextLines });
}

export function loadStashList(path) {
  return invokeCommand('git_stash_list', { path });
}

export function loadFileHistory(path, filePath, limit = 80, skip = 0) {
  return invokeCommand('git_file_history', { path, filePath, limit, skip });
}

export function loadBranchHistory(path, branchName, limit = 120, skip = 0) {
  return invokeCommand('git_branch_history', { path, branchName, limit, skip });
}

export function cancelGitJob() {
  return invokeCommand('git_cancel_job');
}

export function openExternalTool(commandTemplate, repoPath, filePath = null) {
  return invokeCommand('open_external_tool', { commandTemplate, repoPath, filePath });
}
