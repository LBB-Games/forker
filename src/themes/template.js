import { defineTheme } from './factory.js';

// Copy this file to src/themes/<theme-id>.js, fill every standard color in both
// modes, then add the new theme to src/themes/index.js. Keep component-specific
// colors out of theme files; UI roles alias back to this fixed palette.
export default defineTheme({
  id: 'theme-id',
  label: 'Theme Name',
  description: 'Short product-facing description.',

  modes: {
    dark: {
      colorScheme: 'dark',
      tokens: {
        bg: '',
        panel: '',
        'panel-2': '',
        'panel-3': '',
        toolbar: '',
        line: '',
        'line-soft': '',
        text: '',
        muted: '',
        faint: '',
        accent: '',
        'accent-soft': '',
        success: '',
        'success-soft': '',
        warning: '',
        'warning-soft': '',
        danger: '',
        'danger-soft': '',
        overlay: '',
        'overlay-soft': '',
        'shadow-strong': '',
        'shadow-medium': '',
        'shadow-soft': '',
      },
      branchColors: [
        '', '', '', '', '', '', '', '', '', '',
      ],
    },

    light: {
      colorScheme: 'light',
      tokens: {
        bg: '',
        panel: '',
        'panel-2': '',
        'panel-3': '',
        toolbar: '',
        line: '',
        'line-soft': '',
        text: '',
        muted: '',
        faint: '',
        accent: '',
        'accent-soft': '',
        success: '',
        'success-soft': '',
        warning: '',
        'warning-soft': '',
        danger: '',
        'danger-soft': '',
        overlay: '',
        'overlay-soft': '',
        'shadow-strong': '',
        'shadow-medium': '',
        'shadow-soft': '',
      },
      branchColors: [
        '', '', '', '', '', '', '', '', '', '',
      ],
    },
  },
});
