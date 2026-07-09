// Initial demo data shown before a repository snapshot is loaded from the Tauri backend.

/** @type {import('./types.js').RepoInfo} */
export const initialRepo = {
    name: 'git-desktop-client',
    path: '~/projects/forker/git-desktop-client',
    currentBranch: 'main',
    upstream: 'origin/main',
    hasUpstream: true,
    ahead: 2,
    behind: 0,
    changed: 7,
  };


/** @type {import('./types.js').BranchInfo[]} */
export const initialLocalBranches = [
    { name: 'main', meta: '2 ahead', current: true, color: 'accent', upstream: 'origin/main' },
    { name: 'feature/graph-lanes', meta: '4 ahead, 1 behind', color: 'branch-color-3', upstream: 'origin/feature/graph-lanes' },
    { name: 'fix/windows-paths', meta: '3 behind', color: 'warning', upstream: 'origin/fix/windows-paths' },
    { name: 'ui/fork-inspired-pages', meta: 'local', color: 'success' },
  ];


export const initialRemotes = ['origin/main', 'origin/develop', 'origin/feature/graph-lanes', 'origin/fix/windows-paths', 'upstream/main'];
export const initialTags = ['v0.2.0', 'v0.1.0'];

/** @type {import('./types.js').ConflictState} */
export const initialConflictState = {
  active: false,
  operation: null,
  operationLabel: 'None',
  files: [],
  nextStep: 'No conflict operation is active.',
};

/** @type {import('./types.js').StashInfo[]} */
export const initialStashes = [];


/** @type {import('./types.js').CommitInfo[]} */
export const initialCommits = [
    {
      id: 'c8a12f4',
      subject: 'Polish repository workspace layout',
      author: 'Avery Stone',
      date: '06/24/26 10:42',
      branch: 'main',
      refs: ['main', 'origin/main'],
      parents: ['bc77d91', '9fd31aa'],
      files: 12,
      insertions: 184,
      deletions: 41,
      lane: 'main',
      message: 'Tightens pane boundaries, table rhythm, and the working tree review layout.',
      changedPaths: ['src/App.svelte', 'src/styles.css', 'DESIGN.md'],
    },
    {
      id: 'bc77d91',
      subject: 'Separate changes and commits workspace modes',
      author: 'Mira Chen',
      date: '06/24/26 10:03',
      branch: 'ui/fork-inspired-pages',
      refs: ['ui/fork-inspired-pages'],
      parents: ['4d282e8'],
      files: 9,
      insertions: 241,
      deletions: 63,
      lane: 'success',
      message: 'Adds page-level navigation so status review and commit history have dedicated work surfaces.',
      changedPaths: ['src/App.svelte', 'docs/UI_PAGES.md'],
    },
    {
      id: '9fd31aa',
      subject: 'Render commit graph rows with stable alignment',
      author: 'Mira Chen',
      date: '06/24/26 09:24',
      branch: 'feature/graph-lanes',
      refs: ['feature/graph-lanes'],
      parents: ['7ab04d1'],
      files: 6,
      insertions: 96,
      deletions: 18,
      lane: 'branch-color-3',
      message: 'Introduces lane metadata that can be replaced by backend graph data later.',
      changedPaths: ['src/App.svelte', 'src/styles.css'],
    },
    {
      id: '7ab04d1',
      subject: 'Sketch staging and hunk review panel',
      author: 'Sam Rivera',
      date: '06/23/26 18:17',
      branch: 'fix/windows-paths',
      refs: ['fix/windows-paths'],
      parents: ['4d282e8'],
      files: 9,
      insertions: 118,
      deletions: 52,
      lane: 'warning',
      message: 'Mocks hunk-level staging and line-number display for the changes page.',
      changedPaths: ['src/App.svelte'],
    },
    {
      id: '4d282e8',
      subject: 'Create application shell and command bar',
      author: 'Avery Stone',
      date: '06/23/26 14:06',
      branch: 'main',
      refs: ['origin/main'],
      parents: ['1e5b999'],
      files: 18,
      insertions: 382,
      deletions: 24,
      lane: 'main',
      message: 'Builds the initial desktop app frame with persistent repository context.',
      changedPaths: ['src/App.svelte', 'src/main.js', 'src/styles.css'],
    },
    {
      id: '1e5b999',
      subject: 'Document cross-platform Git detection plan',
      author: 'Noor Patel',
      date: '06/22/26 16:32',
      branch: 'main',
      refs: [],
      parents: ['ab19c20'],
      files: 3,
      insertions: 88,
      deletions: 7,
      lane: 'main',
      message: 'Captures native Git CLI discovery and backend responsibilities.',
      changedPaths: ['GIT_DESKTOP_CLIENT_PLAN.md'],
    },
    {
      id: 'ab19c20',
      subject: 'Initial product plan',
      author: 'Avery Stone',
      date: '06/22/26 10:11',
      branch: 'main',
      refs: ['tag: v0.1.0'],
      parents: [],
      files: 1,
      insertions: 154,
      deletions: 0,
      lane: 'root',
      message: 'Adds the product plan and first architecture notes.',
      changedPaths: ['PRODUCT.md'],
    },
  ];


/** @type {import('./types.js').ChangedFile[]} */
export const initialChangedFiles = [];

/** @type {Record<string, import('./types.js').DiffRow[]>} */
export const initialDiffByFile = {
    'src/App.svelte': [
      { type: 'hunk', left: '', right: '', text: '@@ -1,11 +1,18 @@' },
      { type: 'same', left: '1', right: '1', text: '<script>' },
      { type: 'remove', left: '2', right: '', text: "-  const activeSection = 'changes';" },
      { type: 'add', left: '', right: '2', text: "+  let activePage = 'commits';" },
      { type: 'add', left: '', right: '3', text: "+  let selectedBranch = 'main';" },
      { type: 'add', left: '', right: '4', text: "+  let selectedCommitId = 'c8a12f4';" },
      { type: 'same', left: '3', right: '5', text: '  const repo = {' },
      { type: 'same', left: '4', right: '6', text: "    name: 'git-desktop-client'," },
      { type: 'add', left: '', right: '7', text: "+    currentBranch: 'main'," },
      { type: 'hunk', left: '', right: '', text: '@@ -78,6 +85,12 @@' },
      { type: 'add', left: '', right: '85', text: '+  function selectBranch(branchName) {' },
      { type: 'add', left: '', right: '86', text: '+    selectedBranch = branchName;' },
      { type: 'add', left: '', right: '87', text: "+    activePage = 'commits';" },
      { type: 'add', left: '', right: '88', text: '+    selectedCommitId = commits.find((commit) => commit.branch === branchName)?.id;' },
      { type: 'add', left: '', right: '89', text: '+  }' },
    ],
    'src/styles.css': [
      { type: 'hunk', left: '', right: '', text: '@@ -1,8 +1,15 @@' },
      { type: 'same', left: '1', right: '1', text: ':root {' },
      { type: 'remove', left: '2', right: '', text: '-  --bg: #0c1219;' },
      { type: 'add', left: '', right: '2', text: '+  --bg: #0b1015;' },
      { type: 'add', left: '', right: '3', text: '+  --panel: #12171c;' },
      { type: 'add', left: '', right: '4', text: '+  --toolbar: #1d2227;' },
      { type: 'same', left: '3', right: '5', text: '  color-scheme: dark;' },
      { type: 'hunk', left: '', right: '', text: '@@ -68,7 +82,8 @@ .workbench' },
      { type: 'remove', left: '68', right: '', text: '-  grid-template-columns: 248px minmax(450px, 1.18fr) minmax(430px, .92fr);' },
      { type: 'add', left: '', right: '82', text: '+  grid-template-columns: 255px minmax(0, 1fr);' },
      { type: 'add', left: '', right: '83', text: '+  background: var(--bg);' },
    ],
    'docs/UI_PAGES.md': [
      { type: 'hunk', left: '', right: '', text: '@@ -0,0 +1,9 @@' },
      { type: 'add', left: '', right: '1', text: '+# UI Pages' },
      { type: 'add', left: '', right: '2', text: '+' },
      { type: 'add', left: '', right: '3', text: '+The workspace has two primary pages:' },
      { type: 'add', left: '', right: '4', text: '+- Changes: working tree review, staging, diff, and commit composition.' },
      { type: 'add', left: '', right: '5', text: '+- Commits: branch-aware commit graph, history, and selected commit details.' },
      { type: 'add', left: '', right: '6', text: '+' },
      { type: 'add', left: '', right: '7', text: '+Selecting a local branch opens Commits and selects that branch\'s newest commit.' },
    ],
    'PRODUCT.md': [
      { type: 'hunk', left: '', right: '', text: '@@ -0,0 +1,8 @@' },
      { type: 'add', left: '', right: '1', text: '+# Product' },
      { type: 'add', left: '', right: '2', text: '+' },
      { type: 'add', left: '', right: '3', text: '+A precise desktop Git client for developers who review history and changes all day.' },
      { type: 'add', left: '', right: '4', text: '+' },
      { type: 'add', left: '', right: '5', text: '+The interface should feel composed, capable, compact, and trustworthy.' },
    ],
    'DESIGN.md': [
      { type: 'hunk', left: '', right: '', text: '@@ -0,0 +1,9 @@' },
      { type: 'add', left: '', right: '1', text: '+# Design System' },
      { type: 'add', left: '', right: '2', text: '+' },
      { type: 'add', left: '', right: '3', text: '+Use a dark, low-glare workbench theme with compact density.' },
      { type: 'add', left: '', right: '4', text: '+Changes and Commits are separate pages with shared navigation.' },
      { type: 'add', left: '', right: '5', text: '+State should be visible through text, shape, and restrained color.' },
    ],
    'notes/old-wireframe.md': [
      { type: 'hunk', left: '', right: '', text: '@@ -1,7 +0,0 @@' },
      { type: 'remove', left: '1', right: '', text: '-# Old Wireframe' },
      { type: 'remove', left: '2', right: '', text: '-' },
      { type: 'remove', left: '3', right: '', text: '-Single-pane prototype notes.' },
      { type: 'remove', left: '4', right: '', text: '-History, changes, and commit details were overloaded in one view.' },
      { type: 'remove', left: '5', right: '', text: '-Superseded by the page-based workbench.' },
    ],
  };