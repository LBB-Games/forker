#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.cwd();
const rustRoot = join(root, 'src-tauri', 'src');
const frontRoot = join(root, 'src');
const libPath = join(rustRoot, 'lib.rs');

function walk(dir, exts) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path, exts));
    else if (exts.includes(extname(path))) out.push(path);
  }
  return out;
}

function toSnake(name) {
  return name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

const rustCommands = new Set();
for (const file of walk(rustRoot, ['.rs'])) {
  const text = readFileSync(file, 'utf8');
  const re = /#\[tauri::command(?:\([^\]]*\))?\]\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/g;
  for (const match of text.matchAll(re)) rustCommands.add(toSnake(match[1]));
}

const lib = readFileSync(libPath, 'utf8');
const handlerMatch = lib.match(/generate_handler!\s*\[([\s\S]*?)\]/m);
if (!handlerMatch) {
  console.error('Could not find tauri::generate_handler![...] in src-tauri/src/lib.rs');
  process.exit(1);
}
const registered = new Set(
  handlerMatch[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(toSnake)
);

const frontendInvokes = new Set();
for (const file of walk(frontRoot, ['.js', '.ts', '.svelte'])) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\b(?:invoke|invokeCommand)\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
    frontendInvokes.add(match[1]);
  }
}

const unregisteredRust = [...rustCommands].filter((cmd) => !registered.has(cmd)).sort();
const missingRust = [...registered].filter((cmd) => !rustCommands.has(cmd)).sort();
const frontendMissing = [...frontendInvokes].filter((cmd) => !registered.has(cmd)).sort();
const unusedRegistered = [...registered].filter((cmd) => !frontendInvokes.has(cmd)).sort();

let failed = false;
function section(title, values, fail = true) {
  if (!values.length) return;
  if (fail) failed = true;
  console.log(`\n${title}`);
  for (const value of values) console.log(`  - ${value}`);
}

console.log(`Tauri command manifest: ${rustCommands.size} Rust commands, ${registered.size} registered, ${frontendInvokes.size} literal frontend invokes.`);
section('Rust commands not registered in generate_handler:', unregisteredRust);
section('Registered commands without a matching #[tauri::command] function:', missingRust);
section('Frontend literal invokes not registered in generate_handler:', frontendMissing);
section('Registered commands not found as literal frontend invokes (informational; may be dynamic):', unusedRegistered, false);

if (failed) process.exit(1);
console.log('Tauri command manifest check passed.');
