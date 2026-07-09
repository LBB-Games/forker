import graphite from './graphite.js';
import papertrail from './papertrail.js';
import tokyo from './tokyo.js';
import nordic from './nordic.js';
import gruvbox from './gruvbox.js';
import solarized from './solarized.js';
import dracula from './dracula.js';
import vesper from './vesper.js';

export const defaultThemeFamily = 'graphite';
export const defaultThemeMode = 'dark';

export const themeModes = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

export const themeDefinitions = [
  graphite,
  papertrail,
  tokyo,
  nordic,
  gruvbox,
  solarized,
  dracula,
  vesper,
];

export const themeFamilies = themeDefinitions.map(({ id, label, description, swatches }) => ({
  id,
  label,
  description,
  swatches,
}));

export function themeDefinitionFor(themeFamily) {
  return themeDefinitions.find((theme) => theme.id === themeFamily) ?? themeDefinitions[0];
}
