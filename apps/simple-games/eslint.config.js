import react from '@simple-games/eslint-config/react';

export default [
  // The two native projects are generated and hold a copy of the built web
  // assets; neither is source this config has anything to say about.
  { ignores: ['dist/', 'dist-web/', 'android/', 'ios/', 'node_modules/'] },
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
    // The shell never reaches into a game past the registry
    // (docs/ARCHITECTURE.md). This is the editor-speed echo of the real gate,
    // src/test/importBoundaries.test.ts, which also covers what globs cannot
    // (game-to-game imports across relative depths).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/games/**', 'src/app/registry.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/games/**', '@/games/**'],
              message:
                'Only app/registry.ts imports from src/games/ — the shell reaches no deeper (docs/ARCHITECTURE.md).',
            },
          ],
        },
      ],
    },
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
              group: [
                'react',
                'react-dom',
                '@capacitor/*',
                '@capacitor-community/*',
                '@/*',
                '../**',
              ],
              message:
                'games/*/game/ is pure TypeScript: no UI, platform, service, or storage imports.',
            },
          ],
        },
      ],
    },
  },
];
