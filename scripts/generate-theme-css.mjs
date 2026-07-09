#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderThemeCss } from './theme-css-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'src/styles/themes/generated.css');
const checkOnly = process.argv.includes('--check');

let css = '';
try {
  css = renderThemeCss();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (checkOnly) {
  let current = '';
  try {
    current = await fs.readFile(outputPath, 'utf8');
  } catch {
    console.error(`${path.relative(repoRoot, outputPath)} does not exist. Run npm run themes:generate.`);
    process.exit(1);
  }

  if (current !== css) {
    console.error(`${path.relative(repoRoot, outputPath)} is out of date. Run npm run themes:generate.`);
    process.exit(1);
  }

  console.log('Theme CSS is up to date.');
} else {
  await fs.writeFile(outputPath, css);
  console.log(`Generated ${path.relative(repoRoot, outputPath)}.`);
}
