/**
 * Client-side filtering helpers for the commit log.
 *
 * Branch filtering uses the refs available in the loaded log snapshot. A commit is
 * visible when it is reachable from at least one visible local branch tip.
 */

/**
 * @param {Array<{ id: string, refs?: string[], parents?: string[] }>} commits
 * @param {Array<{ name: string }>} localBranches
 * @param {Set<string> | string[]} hiddenBranches
 * @param {string[]} remoteBranches
 * @param {Set<string> | string[]} hiddenRemoteBranches
 */
export function commitsReachableFromVisibleBranches(commits = [], localBranches = [], hiddenBranches = new Set(), remoteBranches = [], hiddenRemoteBranches = new Set()) {
  if (!commits.length) return [];

  const localNames = localBranches.map((branch) => branch.name).filter(Boolean);
  const remoteNames = remoteBranches.filter(Boolean);
  const allBranchNames = [...localNames, ...remoteNames];
  if (!allBranchNames.length) return commits;

  const hiddenLocal = asSet(hiddenBranches);
  const hiddenRemote = asSet(hiddenRemoteBranches);
  const visibleBranchNames = [
    ...localNames.filter((name) => !hiddenLocal.has(name)),
    ...remoteNames.filter((name) => !hiddenRemote.has(name)),
  ];
  if (!visibleBranchNames.length) return [];
  if (visibleBranchNames.length === allBranchNames.length) return commits;

  const tipIds = branchTipCommitIds(commits, visibleBranchNames);
  const reachableIds = reachableCommitIdsFromTips(commits, tipIds);
  return commits.filter((commit) => reachableIds.has(commit.id));
}

/**
 * @param {Array<{ id: string, refs?: string[] }>} commits
 * @param {string[]} branchNames
 */
export function branchTipCommitIds(commits = [], branchNames = []) {
  const visibleNames = new Set(branchNames);
  return commits
    .filter((commit) => (commit.refs ?? []).some((ref) => visibleNames.has(ref)))
    .map((commit) => commit.id)
    .filter(Boolean);
}

/**
 * @param {Array<{ id: string, parents?: string[] }>} commits
 * @param {string[]} tipIds
 */
export function reachableCommitIdsFromTips(commits = [], tipIds = []) {
  const byId = new Map(commits.map((commit) => [commit.id, commit]));
  const reachable = new Set();
  const stack = tipIds.filter((id) => byId.has(id));

  while (stack.length) {
    const id = stack.pop();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);

    const commit = byId.get(id);
    for (const parent of commit?.parents ?? []) {
      if (byId.has(parent) && !reachable.has(parent)) stack.push(parent);
    }
  }

  return reachable;
}

function asSet(value) {
  return value instanceof Set ? value : new Set(value ?? []);
}
