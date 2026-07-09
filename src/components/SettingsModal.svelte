<script>
  import packageInfo from '../../package.json';
  import AppDropdown from './AppDropdown.svelte';
  import SettingsUpdateSection from './settings/SettingsUpdateSection.svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { trapFocus } from '../lib/focusTrap.js';
  import { loadPreferences, normalizePreferences, savePreferences as persistPreferences } from '../lib/preferences.js';
  import { themeAppearances, themeFamilies, themeSwatches } from '../lib/themes.js';

  /**
   * @typedef {Object} Props
   * @property {any} repo
   * @property {boolean} [autoRefresh]
   * @property {string} [themeFamily]
   * @property {string} [themeAppearance]
   * @property {string} [resolvedThemeMode]
   * @property {any} [preferences]
   * @property {any} [appUpdate]
   * @property {any} [onThemeFamilyChange]
   * @property {any} [onThemeAppearanceChange]
   * @property {any} [onPreferencesChange]
   * @property {any} [onCheckForAppUpdate]
   * @property {any} onClose
   */

  /** @type {Props} */
  let {
    repo,
    autoRefresh = $bindable(true),
    themeFamily = 'graphite',
    themeAppearance = 'system',
    resolvedThemeMode = 'dark',
    preferences = $bindable(loadPreferences()),
    appUpdate = {},
    onThemeFamilyChange = () => {},
    onThemeAppearanceChange = () => {},
    onPreferencesChange = () => {},
    onCheckForAppUpdate = () => {},
    onClose
  } = $props();

  const appVersion = packageInfo.version ?? '0.0.0';

  let activeSection = $state('appearance');
  let selectedThemeFamily = $state('graphite');
  let selectedThemeAppearance = $state('system');
  let selectedThemeMode = $state('dark');
  let selectedThemeFamilyInfo = $derived(themeFamilies.find((themeFamily) => themeFamily.id === selectedThemeFamily) ?? themeFamilies[0]);
  let showUpdateSection = $derived(!!appUpdate?.available || ['available', 'error', 'unavailable'].includes(appUpdate?.status));
  let isUpdateBusy = $derived(appUpdate?.status === 'checking');
  let footerVersionState = $derived(versionStateForUpdate(appUpdate));
  let canCheckFromFooter = $derived(['idle', 'current', 'error', 'unavailable'].includes(appUpdate?.status));

  $effect(() => {
    preferences.autoRefresh = autoRefresh;
  });

  $effect(() => {
    selectedThemeFamily = themeFamily;
    selectedThemeAppearance = themeAppearance;
    selectedThemeMode = resolvedThemeMode;
  });

  const sections = [
    ['appearance', 'Appearance', 'Theme'],
    ['repositories', 'Repositories', 'Locations and refresh'],
    ['git', 'Git', 'Executable and fetch'],
    ['review-commit', 'Review & Commit', 'Diffs and authoring'],
    ['safety', 'Safety', 'Confirmations'],
    ['tools', 'Tools', 'Editor and terminal'],
  ];

  const sectionTargets = {
    appearance: 'theme',
    repositories: 'location',
    git: 'git',
    'review-commit': 'diff',
    safety: 'risky',
    tools: 'tools'
  };

  const refreshIntervalOptions = [
    { value: '15', label: '15 seconds' },
    { value: '30', label: '30 seconds' },
    { value: '60', label: '1 minute' },
    { value: '300', label: '5 minutes' },
  ];
  const fetchBehaviorOptions = [
    { value: 'manual', label: 'Manual only' },
    { value: 'open', label: 'Auto-fetch on open' },
    { value: 'focus', label: 'Auto-fetch on open and focus' },
    { value: 'interval', label: 'Auto-fetch on interval' },
  ];
  const fetchIntervalOptions = [
    { value: '5', label: '5 minutes' },
    { value: '10', label: '10 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '60', label: '1 hour' },
  ];
  const diffViewOptions = [
    { value: 'unified', label: 'Unified' },
    { value: 'split', label: 'Split' },
  ];
  const amendBehaviorOptions = [
    { value: 'manual', label: 'Manual only' },
    { value: 'remember', label: 'Remember last choice' },
    { value: 'always', label: 'Default to amend' },
  ];
  const autoStageOptions = [
    { value: 'never', label: 'Never' },
    { value: 'tracked', label: 'Tracked files' },
    { value: 'all', label: 'All changes' },
  ];
  const headerButtonOptions = [
    ['showGitActionsButton', 'Git Actions menu', 'Show the complete Git actions menu in the main header.'],
    ['showOpenEditorButton', 'Open in editor', 'Show the editor shortcut when an editor command is configured.'],
    ['showOpenTerminalButton', 'Open in terminal', 'Show the terminal shortcut when a terminal command is configured.'],
    ['showCommandPaletteButton', 'Command palette', 'Show the command palette shortcut next to Settings.'],
    ['showToolbarCloneButton', 'Clone repository', 'Show a clone shortcut next to the open repository tab button.'],
  ];
  const changesFileActionOptions = [
    ['showToolbarStageButton', 'Stage / unstage selection', 'Stage or unstage selected files beside the Changes file filter.'],
    ['showToolbarStashButton', 'Stash changes', 'Stash tracked and untracked working tree changes beside the Changes file filter.'],
  ];
  const toolbarButtonOptions = [
    ['showRefreshButton', 'Refresh repository', 'Refresh repository state and remotes.'],
    ['showToolbarFetchButton', 'Fetch', 'Fetch from the configured remote.'],
    ['showToolbarPullButton', 'Pull', 'Pull from upstream.'],
    ['showToolbarPushButton', 'Push', 'Push the current branch.'],
    ['showToolbarForcePushButton', 'Force push', 'Force push with lease.'],
    ['showToolbarCreateBranchButton', 'Create branch', 'Open the create branch dialog.'],
    ['showToolbarBranchHistoryButton', 'Branch history', 'Open the current branch history inspector.'],
  ];
  const toolbarScreens = [
    ['OnChanges', 'Changes'],
    ['OnCommits', 'Commits'],
  ];
  function versionStateForUpdate(update) {
    if (update?.status === 'current') return { icon: '✓', label: 'Latest', tone: 'success' };
    if (update?.status === 'available' || update?.available) return { icon: '↥', label: 'Update available', tone: 'warning' };
    if (update?.status === 'checking') return { icon: '…', label: 'Checking', tone: 'neutral' };
    if (update?.status === 'unavailable') return { icon: '!', label: 'Release feed unavailable', tone: 'warning' };
    if (update?.status === 'error') return { icon: '!', label: 'Retry update check', tone: 'error' };
    return { icon: '↻', label: 'Check updates', tone: 'neutral' };
  }

  function savePreferences(nextPreferences = preferences) {
    const source = nextPreferences?.currentTarget ? preferences : nextPreferences;
    preferences = normalizePreferences({ ...source, autoRefresh });
    persistPreferences(preferences);
    onPreferencesChange(preferences);
  }

  function setPreference(key, value) {
    savePreferences({ ...preferences, [key]: value });
  }

  function selectThemeFamily(nextThemeFamily) {
    selectedThemeFamily = nextThemeFamily;
    onThemeFamilyChange(nextThemeFamily);
  }

  function selectThemeAppearance(nextThemeAppearance) {
    selectedThemeAppearance = nextThemeAppearance;
    onThemeAppearanceChange(nextThemeAppearance);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') onClose();
  }

  async function useHomeAsDefaultCloneLocation() {
    try {
      preferences.defaultRepoLocation = await invoke('home_directory');
      savePreferences();
    } catch {
      // Browser-only mode cannot resolve a system home directory.
    }
  }

  function handleDialogKeydown(event) {
    event.stopPropagation();
    handleKeydown(event);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" role="presentation" onclick={onClose}>
  <div class="settings-card modal-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1" use:trapFocus onclick={(event) => event.stopPropagation()} onkeydown={handleDialogKeydown}>
    <header class="settings-header compact">
      <h1 id="settings-title">Settings</h1>
      <button class="ui-icon-button icon-button" type="button" aria-label="Close settings" title="Close" onclick={onClose}>×</button>
    </header>

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Settings categories">
        {#each sections as [id, label, hint]}
          <a class="ui-row settings-nav-item" class:selected={activeSection === id} href={`#settings-${sectionTargets[id]}-title`} aria-current={activeSection === id ? 'true' : undefined} onclick={() => activeSection = id}>
            <span>{label}</span>
            <small>{hint}</small>
          </a>
        {/each}
      </nav>

      <div class="settings-content" onchange={savePreferences} oninput={savePreferences}>
        {#if showUpdateSection}
          <SettingsUpdateSection {appUpdate} {isUpdateBusy} {onCheckForAppUpdate} />
        {/if}

        <section class="settings-section" aria-labelledby="settings-theme-title">
          <div class="settings-section-heading">
            <h2 id="settings-theme-title">Theme</h2>
            <p>Choose a workbench theme family, then follow the system appearance or pin a specific mode. Changes apply immediately.</p>
          </div>
          <div class="settings-theme-control">
            <div class="settings-theme-dropdown">
              <span class="settings-control-label">Theme</span>
              <AppDropdown
                class="theme"
                value={selectedThemeFamily}
                options={themeFamilies}
                menuLabel="Theme family"
                getValue={(themeFamily) => themeFamily.id}
                getLabel={(themeFamily) => themeFamily.label}
                getDescription={(themeFamily) => themeFamily.description}
                onChange={(themeFamily) => selectThemeFamily(themeFamily.id)}
              >
                {#snippet trigger(themeFamily)}
                  <span class="settings-theme-trigger-copy">
                    <strong>{themeFamily?.label ?? selectedThemeFamilyInfo.label}</strong>
                    <small>{themeFamily?.description ?? selectedThemeFamilyInfo.description}</small>
                  </span>
                  <span class="settings-theme-trigger-meta" aria-hidden="true">
                    <span class="settings-theme-mini-swatches">
                      {#each themeSwatches(themeFamily ?? selectedThemeFamilyInfo, selectedThemeMode).slice(0, 4) as swatch}
                        <span style={`background: ${swatch}`}></span>
                      {/each}
                    </span>
                  </span>
                {/snippet}
                {#snippet option(themeFamily)}
                  <span class="settings-theme-option-copy">
                    <strong>{themeFamily.label}</strong>
                    <small>{themeFamily.description}</small>
                  </span>
                  <span class="settings-theme-mini-swatches" aria-hidden="true">
                    {#each themeSwatches(themeFamily, selectedThemeMode).slice(0, 4) as swatch}
                      <span style={`background: ${swatch}`}></span>
                    {/each}
                  </span>
                {/snippet}
              </AppDropdown>
            </div>
            <div class="settings-appearance-control" role="group" aria-label="Theme appearance">
              <div class="settings-appearance-heading">
                <span class="settings-control-label">Appearance</span>
                {#if selectedThemeAppearance === 'system'}
                  <span class="settings-control-label settings-resolved-mode">Resolved: {selectedThemeMode}</span>
                {/if}
              </div>
              <div class="settings-appearance-options">
                {#each themeAppearances as appearanceOption}
                  <button
                    type="button"
                    class:selected={selectedThemeAppearance === appearanceOption.id}
                    aria-pressed={selectedThemeAppearance === appearanceOption.id}
                    title={appearanceOption.id === 'system' ? `System (${selectedThemeMode})` : appearanceOption.label}
                    onclick={() => selectThemeAppearance(appearanceOption.id)}
                  >
                    {#if appearanceOption.id === 'system'}
                      <span aria-hidden="true">◐</span>
                    {:else if appearanceOption.id === 'light'}
                      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5M5.64 5.64l1.77 1.77M16.59 16.59l1.77 1.77M18.36 5.64l-1.77 1.77M7.41 16.59l-1.77 1.77"></path></svg>
                    {:else}
                      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M20.25 14.36A7.5 7.5 0 0 1 9.64 3.75a8.5 8.5 0 1 0 10.61 10.61Z"></path></svg>
                    {/if}
                    <span>{appearanceOption.label}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </section>

        <section class="settings-section" aria-labelledby="settings-buttons-title">
          <div class="settings-section-heading">
            <h2 id="settings-buttons-title">Visible buttons</h2>
            <p>Keep the chrome quiet by default, then pin the Git controls you use often.</p>
          </div>
          <div class="settings-button-groups">
            <div class="settings-button-group">
              <h3>Main header</h3>
              {#each headerButtonOptions as [key, label, description]}
                <label class="ui-panel-muted settings-row toggle-row"><span><strong>{label}</strong><small>{description}</small></span><span class="settings-switch"><input type="checkbox" checked={!!preferences[key]} onchange={(event) => setPreference(key, event.currentTarget.checked)} /><span aria-hidden="true"></span></span></label>
              {/each}
            </div>
            <div class="settings-button-group">
              <h3>Changes file actions</h3>
              {#each changesFileActionOptions as [key, label, description]}
                <label class="ui-panel-muted settings-row toggle-row"><span><strong>{label}</strong><small>{description}</small></span><span class="settings-switch"><input type="checkbox" checked={!!preferences[key]} onchange={(event) => setPreference(key, event.currentTarget.checked)} /><span aria-hidden="true"></span></span></label>
              {/each}
            </div>
            <div class="settings-button-group">
              <h3>Git toolbar</h3>
              {#each toolbarButtonOptions as [key, label, description]}
                <div class="ui-panel-muted settings-row toolbar-visibility-row">
                  <span><strong>{label}</strong><small>{description}</small></span>
                  <div class="toolbar-visibility-controls">
                    <div class="screen-toggles" aria-label={`${label} screens`}>
                      {#each toolbarScreens as [suffix, screenLabel]}
                        <label class="screen-toggle" class:active={!!preferences[`${key}${suffix}`]}><input type="checkbox" checked={!!preferences[`${key}${suffix}`]} onchange={(event) => setPreference(`${key}${suffix}`, event.currentTarget.checked)} /><span>{screenLabel}</span></label>
                      {/each}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </section>

        <section class="settings-section" aria-labelledby="settings-location-title">
          <div class="settings-section-heading">
            <h2 id="settings-location-title">Default clone/open location</h2>
            <p>Use a base folder when browsing, opening, or cloning repositories.</p>
          </div>
          <label class="settings-field"><span>Base folder</span><div class="settings-input-action ui-input-action"><input type="text" bind:value={preferences.defaultRepoLocation} placeholder="/Users/you/Code" /><button type="button" onclick={useHomeAsDefaultCloneLocation}>Use Home</button></div></label>
        </section>

        <section class="settings-section" aria-labelledby="settings-refresh-title">
          <div class="settings-section-heading">
            <h2 id="settings-refresh-title">Auto-refresh behavior</h2>
            <p>Tune when Forker refreshes repository state in the background.</p>
          </div>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Auto-refresh repository</strong><small>Refresh on a short interval while a repository is open.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={autoRefresh} /><span aria-hidden="true"></span></span></label>
          <div class="settings-grid two"><div class="settings-field"><span>Interval</span><AppDropdown class="compact" value={preferences.refreshInterval} options={refreshIntervalOptions} menuLabel="Refresh interval" onChange={(_option, value) => preferences.refreshInterval = value} /></div></div>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Refresh on focus</strong><small>Refresh when returning to the app.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.refreshOnFocus} /><span aria-hidden="true"></span></span></label>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Pause while editing commit message</strong><small>Avoid changing context while the commit composer has focus.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.pauseRefreshWhileEditing} /><span aria-hidden="true"></span></span></label>
        </section>

        <section class="settings-section" aria-labelledby="settings-fetch-title">
          <div class="settings-section-heading">
            <h2 id="settings-fetch-title">Fetch behavior</h2>
            <p>Decide how aggressively Forker checks remotes for incoming work.</p>
          </div>
          <div class="settings-field"><span>Fetch mode</span><AppDropdown class="compact" value={preferences.fetchBehavior} options={fetchBehaviorOptions} menuLabel="Fetch mode" onChange={(_option, value) => preferences.fetchBehavior = value} /></div>
          <div class="settings-field"><span>Fetch interval</span><AppDropdown class="compact" value={preferences.fetchInterval} options={fetchIntervalOptions} menuLabel="Fetch interval" onChange={(_option, value) => preferences.fetchInterval = value} /></div>
        </section>

        <section class="settings-section" aria-labelledby="settings-git-title">
          <div class="settings-section-heading">
            <h2 id="settings-git-title">Git executable path</h2>
            <p>Auto-detect works for most installs. Use a manual path for custom Git distributions.</p>
          </div>
          <div class="settings-segmented" role="radiogroup" aria-label="Git path mode">
            <label class:selected={preferences.gitPathMode === 'auto'}><input type="radio" name="gitPathMode" value="auto" bind:group={preferences.gitPathMode} /><span>Auto-detect</span></label>
            <label class:selected={preferences.gitPathMode === 'manual'}><input type="radio" name="gitPathMode" value="manual" bind:group={preferences.gitPathMode} /><span>Manual override</span></label>
          </div>
          <label class="settings-field"><span>Executable path</span><input type="text" bind:value={preferences.gitExecutablePath} disabled={preferences.gitPathMode === 'auto'} placeholder="/usr/local/bin/git" /></label>
        </section>

        <section class="settings-section" aria-labelledby="settings-diff-title">
          <div class="settings-section-heading">
            <h2 id="settings-diff-title">Diff preferences</h2>
            <p>Set default review density and line behavior.</p>
          </div>
          <div class="settings-grid two"><div class="settings-field"><span>View</span><AppDropdown class="compact" value={preferences.diffView} options={diffViewOptions} menuLabel="Diff view" onChange={(_option, value) => preferences.diffView = value} /></div><label class="settings-field"><span>Context lines</span><input type="number" min="0" max="20" bind:value={preferences.diffContextLines} /></label></div>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Show whitespace</strong><small>Make spaces and tabs visible in changed lines.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.showWhitespace} /><span aria-hidden="true"></span></span></label>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Line wrapping</strong><small>Wrap long diff lines instead of horizontal scrolling.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.wrapDiffLines} /><span aria-hidden="true"></span></span></label>
        </section>

        <section class="settings-section" aria-labelledby="settings-commit-title">
          <div class="settings-section-heading"><h2 id="settings-commit-title">Commit defaults</h2><p>Defaults for the commit composer and commit action.</p></div>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Sign commits</strong><small>Pass signing options when creating commits.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.signCommits} /><span aria-hidden="true"></span></span></label>
          <div class="settings-grid two"><div class="settings-field"><span>Amend behavior</span><AppDropdown class="compact" value={preferences.amendBehavior} options={amendBehaviorOptions} menuLabel="Amend behavior" onChange={(_option, value) => preferences.amendBehavior = value} /></div><div class="settings-field"><span>Auto-stage</span><AppDropdown class="compact" value={preferences.autoStagePreference} options={autoStageOptions} menuLabel="Auto-stage" onChange={(_option, value) => preferences.autoStagePreference = value} /></div></div>
          <label class="settings-field"><span>Commit message template</span><textarea rows="4" bind:value={preferences.commitMessageTemplate} placeholder="Summary\n\nDetails, ticket reference, or checklist…"></textarea></label>
        </section>

        <section class="settings-section" aria-labelledby="settings-branch-title">
          <div class="settings-section-heading"><h2 id="settings-branch-title">Branch defaults</h2><p>Defaults for new branches and remote cleanup.</p></div>
          <label class="settings-field"><span>Default branch name</span><input type="text" bind:value={preferences.defaultBranchName} placeholder="main" /></label>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Checkout after create</strong><small>Switch to a branch immediately after creating it.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.checkoutAfterCreate} /><span aria-hidden="true"></span></span></label>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Prune deleted remote branches</strong><small>Remove stale remote-tracking branches during fetch.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.pruneDeletedRemoteBranches} /><span aria-hidden="true"></span></span></label>
        </section>

        <section class="settings-section" aria-labelledby="settings-risky-title">
          <div class="settings-section-heading">
            <h2 id="settings-risky-title">Confirm risky actions</h2>
            <p>Keep confirmations on for irreversible or repository-wide operations.</p>
          </div>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Discard changes</strong><small>Ask before throwing away unstaged or staged file changes.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.confirmDiscardChanges} /><span aria-hidden="true"></span></span></label>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Reset branch</strong><small>Ask before moving the current branch pointer.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.confirmResetBranch} /><span aria-hidden="true"></span></span></label>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Force push</strong><small>Ask before overwriting remote history.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.confirmForcePush} /><span aria-hidden="true"></span></span></label>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Delete branch</strong><small>Ask before deleting local or remote branches.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.confirmDeleteBranch} /><span aria-hidden="true"></span></span></label>
          <label class="ui-panel-muted settings-row toggle-row"><span><strong>Cancel in-progress operations</strong><small>Ask before cancelling running Git jobs.</small></span><span class="settings-switch"><input type="checkbox" bind:checked={preferences.confirmCancelOperations} /><span aria-hidden="true"></span></span></label>
        </section>

        <section class="settings-section" aria-labelledby="settings-tools-title">
          <div class="settings-section-heading"><h2 id="settings-tools-title">External tools</h2><p>Configure commands used by “open in editor” and “open in terminal”.</p></div>
          <label class="settings-field"><span>Preferred editor command</span><input type="text" bind:value={preferences.preferredEditor} placeholder={'code --reuse-window {repo}'} /></label>
          <label class="settings-field"><span>Preferred terminal command</span><input type="text" bind:value={preferences.preferredTerminal} placeholder={'ghostty --working-directory={repo}'} /></label>
        </section>

        <section class="settings-section" aria-labelledby="settings-repository-title">
          <div class="settings-section-heading"><h2 id="settings-repository-title">Current repository</h2><p>Read-only context for the active repository.</p></div>
          <div class="settings-info-row"><span>Name</span><strong>{repo?.name || 'No repository open'}</strong></div>
          <div class="settings-info-row path-row"><span>Path</span><code>{repo?.path || '—'}</code></div>
        </section>

      </div>
    </div>

    <footer class="settings-footer">
      <p>
        Forker v{appVersion}
        {#if canCheckFromFooter}
          <button class="ui-button settings-version-state {footerVersionState.tone}" type="button" disabled={isUpdateBusy} aria-label="Check for Forker updates" title={(appUpdate?.status === 'error' || appUpdate?.status === 'unavailable') && appUpdate?.error ? appUpdate.error : 'Check for updates'} onclick={() => onCheckForAppUpdate()}>
            <span aria-hidden="true">{footerVersionState.icon}</span>
            <span>{footerVersionState.label}</span>
          </button>
        {:else}
          <span class="ui-button settings-version-state {footerVersionState.tone}" aria-label={`Update status: ${footerVersionState.label}`} title={footerVersionState.label}>
            <span aria-hidden="true">{footerVersionState.icon}</span>
            <span>{footerVersionState.label}</span>
          </span>
        {/if}
        · Changes save automatically.
      </p>
    </footer>
  </div>
</div>
