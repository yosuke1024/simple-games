import react from '@simple-games/eslint-config/react';

export default [
  { ignores: ['dist/', 'android/', 'node_modules/'] },
  ...react,
  {
    // The pure game logic must stay free of UI / platform dependencies.
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', '@capacitor/*', '@capacitor-community/*', '../ui/*', '../services/*', '../state/*', '../storage/*', '../i18n/*'],
              message: 'src/game/ is pure TypeScript: no UI, platform, or service imports.',
            },
          ],
        },
      ],
    },
  },
];
