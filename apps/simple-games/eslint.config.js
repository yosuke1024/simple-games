import react from '@simple-games/eslint-config/react';

export default [
  { ignores: ['dist/', 'dist-web/', 'android/', 'node_modules/'] },
  ...react,
  {
    // Build-time tooling, not shipped code: it runs in Node, not the WebView,
    // so the browser globals the shared config assumes do not apply. Listed by
    // hand rather than pulling in `globals` — two names is not worth a
    // dependency, and this way the list says what the scripts actually use.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
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
