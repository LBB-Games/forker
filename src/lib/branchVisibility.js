/** Pure helpers for branch visibility and branch-to-commit selection. */

export function pruneHiddenBranches(hidden, branches) {
  const known = new Set((branches ?? []).map((branch) => branch.name));
  return new Set([...hidden].filter((name) => known.has(name)));
}

export function pruneHiddenRemoteBranches(hidden, remoteBranches) {
  const known = new Set(remoteBranches ?? []);
  return new Set([...hidden].filter((name) => known.has(name)));
}

export function commitIdForBranch(commits, branchName) {
  const tagRef = branchName ? `tag: ${branchName}` : '';
  return commits.find((commit) => (commit.refs ?? []).includes(branchName))?.id
    ?? commits.find((commit) => tagRef && (commit.refs ?? []).includes(tagRef))?.id
    ?? commits.find((commit) => commit.branch === branchName)?.id
    ?? commits[0]?.id
    ?? '';
}

export function commitIdForStash(commits, stash) {
  const hashCandidate = stashBaseHash(stash);
  if (hashCandidate) {
    const normalized = hashCandidate.toLowerCase();
    const matchingCommit = commits.find((commit) => {
      const id = String(commit.id || '').toLowerCase();
      return id.startsWith(normalized) || normalized.startsWith(id);
    });
    if (matchingCommit) return matchingCommit.id;
  }

  if (stash?.branch) return commitIdForBranch(commits, stash.branch);
  return commits[0]?.id ?? '';
}

function stashBaseHash(stash) {
  const candidates = [stash?.message, stash?.subject].filter(Boolean);
  for (const value of candidates) {
    const match = String(value).match(/(?:^|\s)([0-9a-f]{4,40})(?:\s|$)/i);
    if (match) return match[1];
  }
  return '';
}
