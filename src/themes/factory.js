import { normalizeThemeTokens, standardThemeColorTokens } from './schema.js';

const fallbackSwatchKeys = ['panel', 'panel-3', 'accent', 'success'];

const tokenAliases = {
  panel2: 'panel-2',
  panel3: 'panel-3',
  accentSoft: 'accent-soft',
  successSoft: 'success-soft',
  warningSoft: 'warning-soft',
  dangerSoft: 'danger-soft',
  lineSoft: 'line-soft',
  overlaySoft: 'overlay-soft',
  shadowStrong: 'shadow-strong',
  shadowMedium: 'shadow-medium',
  shadowSoft: 'shadow-soft',
};

function normalizeKeys(tokens = {}) {
  return Object.fromEntries(
    Object.entries(tokens).map(([key, value]) => [tokenAliases[key] ?? key, value]),
  );
}

function pickStandardTokens(tokens = {}) {
  return Object.fromEntries(
    standardThemeColorTokens
      .filter((token) => token in tokens)
      .map((token) => [token, tokens[token]]),
  );
}

function modeFromConfig(mode, config = {}) {
  const colorScheme = config.colorScheme ?? mode;
  const explicitTokens = normalizeKeys(config.tokens ?? config.palette ?? {});
  const branchColors = config.branchColors ?? [];
  const authoredTokens = pickStandardTokens(explicitTokens);

  return {
    colorScheme,
    authoredTokens,
    branchColors,
    tokens: normalizeThemeTokens(authoredTokens, branchColors),
  };
}

export function deriveSwatches(modes = {}) {
  return Object.fromEntries(
    Object.entries(modes).map(([mode, config]) => {
      const tokens = config.authoredTokens ?? config.tokens ?? config;
      return [mode, fallbackSwatchKeys.map((key) => tokens[key]).filter(Boolean)];
    }),
  );
}

export function defineTheme(config) {
  const modes = Object.fromEntries(
    Object.entries(config.modes ?? {}).map(([mode, modeConfig]) => [mode, modeFromConfig(mode, modeConfig)]),
  );

  return {
    id: config.id,
    label: config.label,
    description: config.description,
    swatches: config.swatches ?? deriveSwatches(modes),
    modes,
  };
}
