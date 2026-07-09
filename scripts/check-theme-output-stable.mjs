#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderThemeCss } from './theme-css-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(repoRoot, 'test/fixtures/themes.generated.css');

function firstDifference(a, b) {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) return index;
  }
  return a.length === b.length ? -1 : length;
}

function lineAndColumn(source, index) {
  const prefix = source.slice(0, index);
  const lines = prefix.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

const expected = await fs.readFile(fixturePath, 'utf8');
const actual = renderThemeCss();

if (actual !== expected) {
  const index = firstDifference(actual, expected);
  const actualPosition = lineAndColumn(actual, index);
  const expectedPosition = lineAndColumn(expected, index);
  console.error('Generated theme CSS differs from the stability fixture.');
  console.error(`First difference at byte ${index}.`);
  console.error(`Actual: ${actualPosition.line}:${actualPosition.column}`);
  console.error(`Expected: ${expectedPosition.line}:${expectedPosition.column}`);
  console.error('If this color change is intentional, regenerate test/fixtures/themes.generated.css.');
  process.exit(1);
}

console.log('Theme CSS matches the stability fixture.');
