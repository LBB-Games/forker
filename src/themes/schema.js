// Theme files author a fixed palette per mode. The generated CSS emits only
// these standard colors plus the mode's branch colors.
export const standardThemeColorTokens = [
  'bg',
  'panel',
  'panel-2',
  'panel-3',
  'toolbar',
  'line',
  'line-soft',
  'text',
  'muted',
  'faint',
  'accent',
  'accent-soft',
  'success',
  'success-soft',
  'warning',
  'warning-soft',
  'danger',
  'danger-soft',
  'overlay',
  'overlay-soft',
  'shadow-strong',
  'shadow-medium',
  'shadow-soft',
];

export const branchColorCount = 10;
export const branchThemeColorTokens = Array.from(
  { length: branchColorCount },
  (_, index) => `branch-color-${index}`,
);

export const authoredRequiredThemeTokens = standardThemeColorTokens;
export const generatedRequiredThemeTokens = [
  ...standardThemeColorTokens,
  ...branchThemeColorTokens,
];
export const requiredThemeTokens = generatedRequiredThemeTokens;

export function branchColorTokens(branchColors = []) {
  return Object.fromEntries(
    branchColors.map((color, index) => [`branch-color-${index}`, color]),
  );
}

export function normalizeThemeTokens(tokens = {}, branchColors = []) {
  return {
    ...tokens,
    ...branchColorTokens(branchColors),
  };
}

function parseHexColor(value) {
  const match = value.trim().match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
  if (!match) return null;
  const [, rgb, alpha = 'ff'] = match;
  return {
    r: Number.parseInt(rgb.slice(0, 2), 16),
    g: Number.parseInt(rgb.slice(2, 4), 16),
    b: Number.parseInt(rgb.slice(4, 6), 16),
    a: Number.parseInt(alpha, 16) / 255,
  };
}

function toHexChannel(value) {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
}

function formatHexColor({ r, g, b, a = 1 }) {
  const alpha = a < 1 ? toHexChannel(a * 255) : '';
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}${alpha}`;
}

function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function parseMixPart(part) {
  const match = part.match(/^(.*?)(?:\s+([0-9.]+)%)?$/);
  return {
    color: match?.[1]?.trim() ?? part.trim(),
    percentage: match?.[2] === undefined ? null : Number.parseFloat(match[2]) / 100,
  };
}

function mixColors(first, second, firstWeight = 0.5) {
  const secondWeight = 1 - firstWeight;
  return {
    r: first.r * firstWeight + second.r * secondWeight,
    g: first.g * firstWeight + second.g * secondWeight,
    b: first.b * firstWeight + second.b * secondWeight,
    a: first.a * firstWeight + second.a * secondWeight,
  };
}

function resolveColorValue(value, tokens, seen = new Set()) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const hex = parseHexColor(trimmed);
  if (hex) return hex;

  const varMatch = trimmed.match(/^var\(--([a-zA-Z0-9-]+)\)$/);
  if (varMatch) {
    const token = varMatch[1];
    if (seen.has(token) || !(token in tokens)) return null;
    return resolveColorValue(tokens[token], tokens, new Set([...seen, token]));
  }

  const mixMatch = trimmed.match(/^color-mix\(in srgb,\s*(.*)\)$/);
  if (mixMatch) {
    const [firstPart, secondPart] = splitTopLevel(mixMatch[1]).map(parseMixPart);
    if (!firstPart || !secondPart) return null;
    const first = resolveColorValue(firstPart.color, tokens, seen);
    const second = resolveColorValue(secondPart.color, tokens, seen);
    if (!first || !second) return null;
    const firstWeight = firstPart.percentage ?? (secondPart.percentage === null ? 0.5 : 1 - secondPart.percentage);
    return mixColors(first, second, firstWeight);
  }

  return null;
}

export function resolveThemeColorTokens(tokens = {}) {
  const resolved = { ...tokens };
  let changed = true;

  while (changed) {
    changed = false;
    for (const [token, value] of Object.entries(resolved)) {
      if (typeof value !== 'string' || value.startsWith('#')) continue;
      const color = resolveColorValue(value, resolved);
      if (color) {
        resolved[token] = formatHexColor(color);
        changed = true;
      }
    }
  }

  return resolved;
}

function isColorLike(value) {
  return typeof value === 'string' && /^(#[0-9a-fA-F]{6,8}|color-mix\(|var\(|transparent$)/.test(value.trim());
}

function validateAuthoredTokens(themeId, mode, tokens = {}, errors) {
  for (const token of standardThemeColorTokens) {
    if (!(token in tokens)) {
      errors.push(`${themeId}/${mode} is missing standard color --${token}.`);
      continue;
    }

    if (!isColorLike(tokens[token])) {
      errors.push(`${themeId}/${mode} --${token} must be a hex, color-mix, or var() color value.`);
    }
  }

  for (const token of Object.keys(tokens)) {
    if (!standardThemeColorTokens.includes(token)) {
      errors.push(`${themeId}/${mode} defines non-standard theme color --${token}; use a standard token or branchColors.`);
    }
  }
}

function validateBranchColors(themeId, mode, branchColors, errors) {
  if (!Array.isArray(branchColors)) {
    errors.push(`${themeId}/${mode} is missing branchColors.`);
    return;
  }

  if (branchColors.length !== branchColorCount) {
    errors.push(`${themeId}/${mode} branchColors must contain exactly ${branchColorCount} colors.`);
  }

  branchColors.forEach((color, index) => {
    if (!isColorLike(color)) {
      errors.push(`${themeId}/${mode} branchColors[${index}] must be a hex, color-mix, or var() color value.`);
    }
  });
}

export function validateThemeDefinitions(themeDefinitions, themeModes) {
  const errors = [];
  const ids = new Set();
  const validModes = new Set(themeModes.map(({ id }) => id));
  const validColorSchemes = new Set(['dark', 'light']);

  for (const theme of themeDefinitions) {
    if (!theme?.id) errors.push('Theme is missing an id.');
    if (ids.has(theme.id)) errors.push(`Duplicate theme id: ${theme.id}`);
    ids.add(theme.id);

    for (const mode of Object.keys(theme?.modes ?? {})) {
      if (!validModes.has(mode)) errors.push(`${theme.id} has unsupported mode: ${mode}`);
    }

    for (const { id: mode } of themeModes) {
      const modeConfig = theme?.modes?.[mode];
      if (!modeConfig) {
        errors.push(`${theme.id} is missing ${mode} mode.`);
        continue;
      }

      if (!modeConfig.colorScheme) {
        errors.push(`${theme.id}/${mode} is missing colorScheme.`);
      } else if (!validColorSchemes.has(modeConfig.colorScheme)) {
        errors.push(`${theme.id}/${mode} has invalid colorScheme: ${modeConfig.colorScheme}`);
      }

      validateAuthoredTokens(theme.id, mode, modeConfig.authoredTokens ?? modeConfig.tokens, errors);
      validateBranchColors(theme.id, mode, modeConfig.branchColors, errors);
    }
  }

  return errors;
}
