import packageInfo from '../../package.json';

const PASSIVE_UPDATE_CHECK_KEY = 'forker:last-passive-update-check-at';
const PASSIVE_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const LATEST_RELEASE_URL = 'https://github.com/LBB-Games/forker/releases/latest';
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/LBB-Games/forker/releases/latest';

function isLocalDevUrl() {
  if (typeof window === 'undefined') return true;
  return ['http:', 'https:'].includes(window.location.protocol) && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export function createInitialUpdateState() {
  return {
    status: 'idle',
    available: false,
    currentVersion: packageInfo.version ?? '0.0.0',
    version: '',
    date: '',
    body: '',
    releaseUrl: LATEST_RELEASE_URL,
    lastCheckedAt: 0,
    message: 'Check GitHub Releases for the latest Forker installer.',
    error: '',
  };
}

export function shouldRunPassiveUpdateCheck() {
  if (typeof window === 'undefined' || isLocalDevUrl()) return false;
  try {
    const lastCheckedAt = Number(localStorage.getItem(PASSIVE_UPDATE_CHECK_KEY) || 0);
    return !lastCheckedAt || Date.now() - lastCheckedAt > PASSIVE_UPDATE_INTERVAL_MS;
  } catch {
    return true;
  }
}

export function markPassiveUpdateCheck() {
  try {
    localStorage.setItem(PASSIVE_UPDATE_CHECK_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures. They should not block update checks.
  }
}

function describeUpdateError(error) {
  if (!error) return 'Unknown release check error.';
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error.message === 'string') return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function parseVersion(value) {
  const match = String(value || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function isNewerVersion(candidate, current) {
  const next = parseVersion(candidate);
  const existing = parseVersion(current);
  if (!next || !existing) return false;
  for (let index = 0; index < 3; index += 1) {
    if (next[index] > existing[index]) return true;
    if (next[index] < existing[index]) return false;
  }
  return false;
}

function releaseMetadata(release) {
  const version = String(release?.tag_name || release?.name || '').replace(/^v/i, '');
  return {
    currentVersion: packageInfo.version ?? '0.0.0',
    version,
    date: release?.published_at || '',
    body: release?.body || '',
    releaseUrl: release?.html_url || LATEST_RELEASE_URL,
  };
}

export async function checkForAppUpdate() {
  const checkedAt = Date.now();

  try {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (response.status === 404) {
      return {
        ...createInitialUpdateState(),
        status: 'unavailable',
        message: 'No public GitHub release feed was found for Forker.',
        error: 'GitHub returned 404 for the configured Forker releases endpoint.',
        lastCheckedAt: checkedAt,
      };
    }

    if (!response.ok) throw new Error(`GitHub returned ${response.status} ${response.statusText}`.trim());

    const release = await response.json();
    const metadata = releaseMetadata(release);
    const available = isNewerVersion(metadata.version, metadata.currentVersion);

    return {
      ...createInitialUpdateState(),
      ...metadata,
      available,
      status: available ? 'available' : 'current',
      message: available ? `Forker ${metadata.version} is available.` : 'Forker is up to date.',
      lastCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      ...createInitialUpdateState(),
      status: 'error',
      message: 'Could not check GitHub Releases.',
      error: describeUpdateError(error),
      lastCheckedAt: checkedAt,
    };
  }
}
