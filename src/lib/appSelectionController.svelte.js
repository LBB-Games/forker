import { fileKey, sortFilesByPath, treeFolderKey } from './fileTree.js';
import {
  selectChangedFileKeys,
  selectChangedFolderKeys,
} from './appUtils.js';
import { selectedFileStageCommandForSection } from './gitActionRouting.js';

/**
 * Changed-file tree selection and selected-file action helpers.
 */
export function createSelectionController(state, deps = {}) {
  const { runSelectedGitAction = async () => {} } = deps;

  function selectedFileStageCommand() {
    return selectedFileStageCommandForSection(state.selectedSection);
  }

  async function toggleSelectedFileStage() {
    const stageCommand = selectedFileStageCommand();
    if (!stageCommand || !state.selectedChangedFiles.length || state.actionBusy) return;
    await runSelectedGitAction(stageCommand.command, state.selectedSection, stageCommand.command === 'git_stage' ? 'Stage' : 'Unstage');
  }

  async function discardSelectedFileChanges() {
    if (state.selectedSection !== 'unstaged' || !state.selectedChangedFiles.length || state.actionBusy) return;
    await runSelectedGitAction('git_discard', 'unstaged', 'Discard');
  }

  function selectFirstChangedFile() {
    const firstFile = state.changedFiles[0];
    state.selectedFile = firstFile.path;
    state.selectedFileKey = fileKey(firstFile);
    state.selectedFileKeys = [state.selectedFileKey];
    state.lastSelectedKey = state.selectedFileKey;
  }

  function filesInSection(section) {
    return sortFilesByPath(state.changedFiles.filter((file) => file.section === section));
  }

  function selectAllChangedFilesInSelectedSection() {
    const section = state.selectedSection;
    if (!section) return false;

    const sectionFiles = filesInSection(section);
    if (!sectionFiles.length) return false;

    const sectionKeys = sectionFiles.map(fileKey);
    const selectedKey = sectionKeys.includes(state.selectedFileKey) ? state.selectedFileKey : sectionKeys[0];
    const selectedFile = sectionFiles.find((file) => fileKey(file) === selectedKey) ?? sectionFiles[0];

    state.selectedFile = selectedFile.path;
    state.selectedFileKey = fileKey(selectedFile);
    state.selectedFileKeys = sectionKeys;
    state.lastSelectedKey = state.selectedFileKey;
    return true;
  }

  function toggleTreeFolder(section, path) {
    const key = treeFolderKey(section, path);
    const next = new Set(state.collapsedTreeFolders);
    next.has(key) ? next.delete(key) : next.add(key);
    state.collapsedTreeFolders = next;
  }

  function selectChangedFile(file, event) {
    const key = fileKey(file);
    const sectionKeys = filesInSection(file.section).map((item) => fileKey(item));
    state.selectedFileKeys = selectChangedFileKeys({ file, event, selectedFileKeys: state.selectedFileKeys, lastSelectedKey: state.lastSelectedKey, sectionKeys });
    state.lastSelectedKey = key;
    state.selectedFile = file.path;
    state.selectedFileKey = key;
  }

  function selectChangedFolder(folder, event) {
    const folderKeys = folder.childKeys ?? [];
    if (!folderKeys.length) return;

    state.selectedFileKeys = selectChangedFolderKeys({ folder, event, selectedFileKeys: state.selectedFileKeys });
    const nextKey = state.selectedFileKeys.find((key) => folderKeys.includes(key)) ?? folderKeys[0];
    const nextFile = state.changedFiles.find((file) => fileKey(file) === nextKey);
    state.selectedFile = nextFile?.path ?? state.selectedFile;
    state.selectedFileKey = nextKey;
    state.lastSelectedKey = nextKey;
  }

  return {
    discardSelectedFileChanges,
    selectAllChangedFilesInSelectedSection,
    selectChangedFile,
    selectChangedFolder,
    selectFirstChangedFile,
    selectedFileStageCommand,
    toggleSelectedFileStage,
    toggleTreeFolder,
  };
}
