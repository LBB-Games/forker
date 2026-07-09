#!/usr/bin/env node
import { existsSync, mkdtempSync, mkdirSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const dirty = args.has('--dirty');
const dirArgIndex = process.argv.findIndex((arg) => arg === '--dir');
const root = dirArgIndex >= 0 && process.argv[dirArgIndex + 1]
  ? resolve(process.argv[dirArgIndex + 1])
  : mkdtempSync(join(tmpdir(), 'forker-remote-smoke-'));

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    stdio: options.quiet ? 'pipe' : ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const rendered = [command, ...commandArgs].join(' ');
    throw new Error(`Command failed (${rendered})\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function git(cwd, ...commandArgs) {
  return run('git', commandArgs, { cwd });
}

function configureRepo(cwd) {
  git(cwd, 'config', 'user.name', 'Forker Smoke Test');
  git(cwd, 'config', 'user.email', 'forker-smoke@example.invalid');
}

if (dirArgIndex >= 0 && existsSync(root) && readdirSync(root).length > 0) {
  throw new Error(`Refusing to create fixture in non-empty directory: ${root}`);
}

mkdirSync(root, { recursive: true });
const origin = join(root, 'origin.git');
const seed = join(root, 'seed');
const workbench = join(root, 'workbench-repo');
const collaborator = join(root, 'collaborator-repo');

run('git', ['init', '--bare', origin]);
run('git', ['init', seed]);
configureRepo(seed);
git(seed, 'branch', '-M', 'main');
writeFileSync(join(seed, 'README.md'), '# Forker smoke fixture\n\nInitial content for local remote testing.\n');
mkdirSync(join(seed, 'src'), { recursive: true });
writeFileSync(join(seed, 'src', 'app.js'), "export function greet() {\n  return 'hello forker';\n}\n");
git(seed, 'add', '.');
git(seed, 'commit', '-m', 'Initial commit');
git(seed, 'remote', 'add', 'origin', origin);
git(seed, 'push', '-u', 'origin', 'main');
git(seed, 'tag', 'v0.1.0');
git(seed, 'push', 'origin', 'v0.1.0');

git(seed, 'checkout', '-b', 'feature/remote-only');
writeFileSync(join(seed, 'remote-feature.txt'), 'This branch exists only on the remote until checked out.\n');
git(seed, 'add', '.');
git(seed, 'commit', '-m', 'Add remote-only feature branch');
git(seed, 'push', '-u', 'origin', 'feature/remote-only');
git(seed, 'checkout', 'main');

run('git', ['clone', origin, workbench]);
configureRepo(workbench);
run('git', ['clone', origin, collaborator]);
configureRepo(collaborator);

writeFileSync(join(collaborator, 'remote-change.txt'), 'A collaborator pushed this change after the workbench clone was made.\n');
git(collaborator, 'add', '.');
git(collaborator, 'commit', '-m', 'Add collaborator remote change');
git(collaborator, 'push', 'origin', 'main');

writeFileSync(join(workbench, 'local-only.txt'), 'A local commit that has not been pushed yet.\n');
git(workbench, 'add', '.');
git(workbench, 'commit', '-m', 'Add local workbench change');
git(workbench, 'fetch', 'origin');

if (dirty) {
  appendFileSync(join(workbench, 'README.md'), '\nUnstaged edit created by --dirty.\n');
  mkdirSync(join(workbench, 'notes'), { recursive: true });
  writeFileSync(join(workbench, 'notes', 'untracked.txt'), 'Untracked smoke-test file.\n');
}

console.log(`Created Forker local remote smoke fixture:\n\nRoot:          ${root}\nBare remote:   ${origin}\nOpen in app:   ${workbench}\nCollaborator:  ${collaborator}\n\nState:\n- ${workbench} tracks local bare remote ${origin}\n- main is intentionally diverged: one local commit ahead and one remote commit behind\n- origin/feature/remote-only is available for remote-branch checkout testing\n- tag v0.1.0 exists\n${dirty ? '- working tree includes one unstaged edit and one untracked file\n' : ''}\nUseful manual commands:\n  git -C "${workbench}" status --short --branch\n  git -C "${workbench}" log --oneline --decorate --graph --all -8\n  git -C "${collaborator}" commit --allow-empty -m "Another remote change" && git -C "${collaborator}" push origin main\n`);
