import react from '@simple-games/eslint-config/react';

export default [
  { ignores: ['dist/', 'android/', 'node_modules/'] },
  ...react,
  {
    // Each game's logic must stay free of UI / platform / storage
    // dependencies — portable to a future static web build as-is
    // (docs/ARCHITECTURE.md). '../**' bans every import that leaves game/.
    files: ['src/games/*/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', '@capacitor/*', '@capacitor-community/*', '@/*', '../**'],
              message:
                'games/*/game/ is pure TypeScript: no UI, platform, service, or storage imports.',
            },
          ],
        },
      ],
    },
  },
];
