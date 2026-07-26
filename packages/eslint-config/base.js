import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Base flat config for all Simple Games TypeScript code.
 * Pure TypeScript packages (game logic included) lint with this config.
 */
export default tseslint.config(js.configs.recommended, tseslint.configs.recommended, {
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
});
