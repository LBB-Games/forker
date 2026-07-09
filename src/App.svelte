<script>
  import { onMount } from 'svelte';
  import AppModals from './components/AppModals.svelte';
  import OpenRepositoryScreen from './components/OpenRepositoryScreen.svelte';
  import WorkbenchShell from './components/WorkbenchShell.svelte';
  import { createAppController } from './lib/appController.svelte.js';

  const app = createAppController();

  onMount(() => app.mount());
</script>

{#if !app.hasLoadedRepo}
  <OpenRepositoryScreen
    bind:repoPathInput={app.repoPathInput}
    isLoadingRepo={app.isLoadingRepo}
    backendError={app.backendError}
    gitInstallation={app.gitInstallation}
    preferences={app.preferences}
    onOpenRepository={app.openRepository}
    onRequestCloneRepository={app.requestCloneRepositoryFromOpenScreen}
  />
{/if}

<WorkbenchShell
  shellState={app.shellState}
  changesState={app.changesState}
  commitsState={app.commitsState}
  backendState={app.backendState}
  actions={app.workbenchActions}
  bind:commitSummary={app.commitSummary}
  bind:commitDescription={app.commitDescription}
  bind:amendCommit={app.amendCommit}
  preferences={app.preferences}
/>

<AppModals
  repo={app.repo}
  bind:repoPathInput={app.repoPathInput}
  bind:autoRefresh={app.autoRefresh}
  themeFamily={app.themeFamily}
  themeAppearance={app.themeAppearance}
  resolvedThemeMode={app.resolvedThemeMode}
  preferences={app.preferences}
  appUpdate={app.appUpdate}
  showUpdatePrompt={app.showUpdatePrompt}
  isLoadingRepo={app.isLoadingRepo}
  actionBusy={app.actionBusy}
  backendError={app.backendError}
  contextMenu={app.contextMenu}
  confirmationDialog={app.confirmationDialog}
  activeInspector={app.activeInspector}
  inspectorContext={app.inspectorContext}
  commandPaletteCommands={app.commandPaletteCommands}
  bind:showCommandPalette={app.showCommandPalette}
  bind:showOpenRepositoryModal={app.showOpenRepositoryModal}
  bind:showCloneRepositoryModal={app.showCloneRepositoryModal}
  bind:showSettingsModal={app.showSettingsModal}
  bind:showCreateBranchModal={app.showCreateBranchModal}
  bind:showCreateWorktreeModal={app.showCreateWorktreeModal}
  bind:showResetBranchModal={app.showResetBranchModal}
  bind:showPushUpstreamModal={app.showPushUpstreamModal}
  bind:branchName={app.branchName}
  branchNameError={app.branchNameError}
  branchNameDescription={app.branchNameDescription}
  canCreateBranch={app.canCreateBranch}
  resetTargetCommit={app.resetTargetCommit}
  bind:resetMode={app.resetMode}
  onCloseContextMenu={app.closeContextMenu}
  onOpenRepository={app.openRepository}
  onCloneRepository={app.cloneRepository}
  onPrepareClone={app.prepareClone}
  onCompleteClone={app.completeClone}
  onThemeFamilyChange={app.handleThemeFamilyChange}
  onThemeAppearanceChange={app.handleThemeAppearanceChange}
  onPreferencesChange={app.handlePreferencesChange}
  onCheckForAppUpdate={app.checkAppUpdate}
  onDismissUpdatePrompt={app.dismissUpdatePrompt}
  onCloseConfirmation={app.closeConfirmationDialog}
  onConfirmCreateBranch={app.confirmCreateBranch}
  onCloseCreateBranch={app.closeCreateBranchModal}
  onConfirmCreateWorktree={app.confirmCreateWorktree}
  onConfirmResetBranch={app.confirmResetBranch}
  onCloseResetBranch={app.closeResetBranchModal}
  onConfirmPushUpstream={app.confirmPushUpstream}
  onCloseInspector={app.closeInspector}
  onOpenInspector={app.openInspector}
  onRunGitAction={app.workbenchActions.onRunGitAction}
  onCopyText={app.copyText}
/>
