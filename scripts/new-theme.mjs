#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const themeId = process.argv[2];

if (!themeId || !/^[a-z][a-z0-9-]*$/.test(themeId)) {
  console.error('Usage: npm run themes:new <theme-id>');
  console.error('Theme id must be kebab-case: lowercase letters, numbers, and hyphens.');
  process.exit(1);
}

const sourcePath = path.join(repoRoot, 'src/themes/template.js');
const targetPath = path.join(repoRoot, `src/themes/${themeId}.js`);

try {
  await fs.access(targetPath);
  console.error(`${path.relative(repoRoot, targetPath)} already exists.`);
  process.exit(1);
} catch {
  // Expected: the new theme file does not exist yet.
}

const label = themeId
  .split('-')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const template = await fs.readFile(sourcePath, 'utf8');
const content = template
  .replace("id: 'theme-id'", `id: '${themeId}'`)
  .replace("label: 'Theme Name'", `label: '${label}'`)
  .replace("description: 'Short product-facing description.'", "description: 'Describe the palette and intended feel.'");

await fs.writeFile(targetPath, content);

console.log(`Created ${path.relative(repoRoot, targetPath)}.`);
console.log('Next steps:');
console.log(`1. Fill the hex token values in src/themes/${themeId}.js.`);
console.log('2. Import and add the theme in src/themes/index.js.');
console.log('3. Run npm run themes:generate && npm run themes:check && npm run build.');
