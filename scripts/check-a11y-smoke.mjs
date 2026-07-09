#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'src/components/CommandPalette.svelte',
    patterns: ['role="dialog"', 'role="combobox"', 'role="listbox"', 'aria-activedescendant', 'Escape'],
  },
  {
    file: 'src/components/CommitLog.svelte',
    patterns: ['role="listbox"', 'role="option"', 'aria-selected', 'aria-activedescendant', 'handleCommitKeydown'],
  },
  {
    file: 'src/components/FileTree.svelte',
    patterns: ['role="tree"', 'role="treeitem"', 'aria-multiselectable', 'aria-expanded', 'handleTreeKeydown'],
  },
  {
    file: 'src/components/RepositoryColumnPicker.svelte',
    patterns: ['role="tree"', 'role="treeitem"', 'aria-activedescendant', 'handleKeydown'],
  },
  {
    file: 'src/components/ResizeHandle.svelte',
    patterns: ['role="separator"', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'onkeydown'],
  },
  {
    file: 'src/components/ModalFrame.svelte',
    patterns: ['role="dialog"', 'aria-modal="true"', 'use:trapFocus', 'Escape'],
  },
];

const failures = [];
for (const check of checks) {
  const source = readFileSync(check.file, 'utf8');
  for (const pattern of check.patterns) {
    if (!source.includes(pattern)) failures.push(`${check.file}: missing ${pattern}`);
  }
}

if (failures.length) {
  console.error('Accessibility smoke checks failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Accessibility smoke checks passed (${checks.length} components).`);
