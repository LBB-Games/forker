import {
  checkForAppUpdate,
  createInitialUpdateState,
  markPassiveUpdateCheck,
  shouldRunPassiveUpdateCheck,
} from './appUpdater.js';

/**
 * Owns release-check state and passive release notification behavior. Forker no
 * longer installs updates in-app; releases are downloaded from GitHub.
 */
export function createAppUpdateController({ showOperationNotice = () => {} } = {}) {
  let appUpdate = $state(createInitialUpdateState());
  let showUpdatePrompt = $state(false);

  async function checkAppUpdate({ automatic = false } = {}) {
    if (appUpdate.status === 'checking') return;
    appUpdate = { ...appUpdate, status: 'checking', message: 'Checking GitHub Releases…', error: '' };
    const result = await checkForAppUpdate();
    appUpdate = { ...appUpdate, ...result };
    if (automatic || result.status === 'current' || result.status === 'available') markPassiveUpdateCheck();
    if (result.status === 'available') {
      showUpdatePrompt = true;
      showOperationNotice(`Forker ${result.version} is available. Download it from GitHub Releases.`, 'success');
    }
  }

  function runPassiveAppUpdateCheck() {
    if (!shouldRunPassiveUpdateCheck()) return;
    checkAppUpdate({ automatic: true });
  }

  function dismissUpdatePrompt() {
    showUpdatePrompt = false;
  }

  return {
    get appUpdate() { return appUpdate; },
    get showUpdatePrompt() { return showUpdatePrompt; },
    checkAppUpdate,
    dismissUpdatePrompt,
    runPassiveAppUpdateCheck,
  };
}
