import { fileKey, sectionFromKey } from './fileTree.js';
import { gitCommandDefinition, GIT_COMMANDS } from './gitCommands.js';

export function selectedFileStageCommandForSection(section) {
  if (section === 'staged') return { command: GIT_COMMANDS.unstage.command, label: 'Unstage selected file' };
  if (section === 'unstaged') return { command: GIT_COMMANDS.stage.command, label: 'Stage selected file' };
  return null;
}

export function selectedFileActionPaths({ selectedFileKeys, changedFiles, section }) {
  return selectedFileKeys
    .filter((key) => sectionFromKey(key) === section)
    .map((key) => changedFiles.find((file) => fileKey(file) === key)?.path)
    .filter(Boolean);
}

export function batchCommandForFileAction(command) {
  return gitCommandDefinition(command)?.batchCommand ?? '';
}

export function shouldRunBatchFileAction(command, paths) {
  return paths.length > 1 && !!batchCommandForFileAction(command);
}
