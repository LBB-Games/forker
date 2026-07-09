const BRANCH_PALETTE_SIZE = 10;

export function branchColor(index = 0) {
  const safeIndex = Number.isFinite(index) && index > 0 ? index : 0;
  const paletteIndex = safeIndex % BRANCH_PALETTE_SIZE;
  return `var(--branch-color-${paletteIndex}, var(--accent, #6aa8ef))`;
}

export function branchColorMap(branchNames = []) {
  return uniqueBranchNames(branchNames).reduce((map, name, index) => {
    map.set(name, branchColor(index));
    return map;
  }, new Map());
}

function uniqueBranchNames(branchNames) {
  return [...new Set(branchNames.map((name) => String(name || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
