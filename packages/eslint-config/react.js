import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import base from './base.js';

/**
 * Flat config for React apps.
 * react-hooks rules are declared explicitly so the config does not depend on
 * the plugin's preset export shape (which has changed across major versions).
 */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];
