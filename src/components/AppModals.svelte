<script>
  import CloneRepositoryModal from './CloneRepositoryModal.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import ConfirmationDialog from './ConfirmationDialog.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import CreateBranchDialog from './CreateBranchDialog.svelte';
  import CreateWorktreeDialog from './CreateWorktreeDialog.svelte';
  import OpenRepositoryModal from './OpenRepositoryModal.svelte';
  import PushUpstreamDialog from './PushUpstreamDialog.svelte';
  import ResetBranchDialog from './ResetBranchDialog.svelte';
  import ReleaseUpdateDialog from './ReleaseUpdateDialog.svelte';
  import SettingsModal from './SettingsModal.svelte';
  import SecondaryInspectorHost from './inspectors/SecondaryInspectorHost.svelte';

  let {
    repo,
    repoPathInput = $bindable(''),
    autoRefresh = $bindable(true),
    themeFamily = 'graphite',
    themeAppearance = 'system',
    resolvedThemeMode = 'dark',
    preferences,
    appUpdate,
    showUpdatePrompt = false,
    isLoadingRepo = false,
    actionBusy = '',
    backendError = '',
    contextMenu = null,
    confirmationDialog = null,
    activeInspector = null,
    inspectorContext = {},
    showCommandPalette = $bindable(false),
    commandPaletteCommands = [],
    showOpenRepositoryModal = $bindable(false),
    showCloneRepositoryModal = $bindable(false),
    showSettingsModal = $bindable(false),
    showCreateBranchModal = $bindable(false),
    showCreateWorktreeModal = $bindable(false),
    showResetBranchModal = $bindable(false),
    showPushUpstreamModal = $bindable(false),
    branchName = $bindable(''),
    branchNameError = '',
    branchNameDescription = 'branch-name-help',
    canCreateBranch = false,
    resetTargetCommit = null,
    resetMode = $bindable('mixed'),
    onCloseContextMenu = () => {},
    onOpenRepository = () => {},
    onCloneRepository = () => {},
    onPrepareClone = () => {},
    onCompleteClone = () => {},
    onThemeFamilyChange = () => {},
    onThemeAppearanceChange = () => {},
    onPreferencesChange = () => {},
    onCheckForAppUpdate = () => {},
    onDismissUpdatePrompt = () => {},
    onCloseConfirmation = () => {},
    onConfirmCreateBranch = () => {},
    onCloseCreateBranch = () => {},
    onConfirmCreateWorktree = () => {},
    onConfirmResetBranch = () => {},
    onCloseResetBranch = () => {},
    onConfirmPushUpstream = () => {},
    onCloseInspector = () => {},
    onOpenInspector = () => {},
    onRunGitAction = () => {},
    onCopyText = () => {},
  } = $props();
</script>

<ContextMenu menu={contextMenu} onClose={onCloseContextMenu} />

<SecondaryInspectorHost
  inspector={activeInspector}
  repo={repo}
  changedFiles={inspectorContext.changedFiles ?? []}
  selectedChangedFile={inspectorContext.selectedChangedFile ?? null}
  selectedDiffLines={inspectorContext.selectedDiffLines ?? []}
  selectedDiffKey={inspectorContext.selectedDiffKey ?? ''}
  diffLoadingKey={inspectorContext.diffLoadingKey ?? ''}
  commits={inspectorContext.commits ?? []}
  stashes={inspectorContext.stashes ?? []}
  {preferences}
  onClose={onCloseInspector}
  onCopyText={onCopyText}
  {onOpenInspector}
  {onRunGitAction}
/>

{#if showCommandPalette}
  <CommandPalette commands={commandPaletteCommands} onClose={() => showCommandPalette = false} />
{/if}

{#if showOpenRepositoryModal}
  <OpenRepositoryModal bind:repoPathInput {isLoadingRepo} {backendError} {preferences} onOpenRepository={onOpenRepository} onClose={() => showOpenRepositoryModal = false} />
{/if}

{#if showCloneRepositoryModal}
  <CloneRepositoryModal {preferences} {isLoadingRepo} {backendError} onCloneRepository={onCloneRepository} {onPrepareClone} {onCompleteClone} onClose={() => showCloneRepositoryModal = false} />
{/if}

{#if showSettingsModal}
  <SettingsModal {repo} bind:autoRefresh {themeFamily} {themeAppearance} {resolvedThemeMode} {preferences} {appUpdate} {onThemeFamilyChange} {onThemeAppearanceChange} onPreferencesChange={onPreferencesChange} onCheckForAppUpdate={onCheckForAppUpdate} onClose={() => showSettingsModal = false} />
{/if}

{#if showUpdatePrompt && appUpdate?.status === 'available'}
  <ReleaseUpdateDialog {appUpdate} onClose={onDismissUpdatePrompt} />
{/if}

{#if confirmationDialog}
  <ConfirmationDialog dialog={confirmationDialog} onClose={onCloseConfirmation} />
{/if}

{#if showCreateBranchModal}
  <CreateBranchDialog
    {branchName}
    {branchNameError}
    {branchNameDescription}
    {canCreateBranch}
    onBranchNameChange={(value) => branchName = value}
    onConfirm={onConfirmCreateBranch}
    onClose={onCloseCreateBranch}
  />
{/if}

{#if showCreateWorktreeModal}
  <CreateWorktreeDialog
    localBranches={inspectorContext.localBranches ?? []}
    remotes={inspectorContext.remotes ?? []}
    {isLoadingRepo}
    {actionBusy}
    onConfirm={onConfirmCreateWorktree}
    onClose={() => showCreateWorktreeModal = false}
  />
{/if}

{#if showResetBranchModal}
  <ResetBranchDialog
    {repo}
    {resetTargetCommit}
    {resetMode}
    onResetModeChange={(value) => resetMode = value}
    onConfirm={onConfirmResetBranch}
    onClose={onCloseResetBranch}
  />
{/if}

{#if showPushUpstreamModal}
  <PushUpstreamDialog {repo} onConfirm={onConfirmPushUpstream} onClose={() => showPushUpstreamModal = false} />
{/if}
