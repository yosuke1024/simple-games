import react from '@simple-games/eslint-config/react';
const nearbyGames = [
  'yacht',
  'reversi',
  'connect-four',
  'gomoku',
  'checkers',
  'gin-rummy',
  'mancala',
  'dominoes',
  'dots-and-boxes',
  'chess',
  'nested-tic-tac-toe',
  'scopa',
  'nim',
];

export default [
  // The two native projects are generated and hold a copy of the built web
  // assets; neither is source this config has anything to say about.
  // prototypes/ holds throwaway Phase 0 prototypes (docs/plans — 「実機の Phase 0」):
  // single-file HTML pages and the Playwright scripts that drive them. Not
  // shipped, not imported by src/, written for Chromium 88, so not linted.
  { ignores: ['dist/', 'dist-web/', 'android/', 'ios/', 'node_modules/', 'prototypes/'] },
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
    ignores: ['src/games/**', 'src/app/registry.ts', 'src/nearby/**'],
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
  ...nearbyGames.map((game) => ({
    files: [`src/nearby/games/${game}.ts`, `src/nearby/games/${game}View.tsx`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `(?:^|/)games/(?!${game}/(?:game/(?!cpu(?:/|$)|ai(?:/|$))|ui/(?:components/|hooks/|use[A-Z][^/]*$|selection$|[^/]+\\.css$)|i18n(?:/|$)))`,
              message:
                'Nearby adapters may use only their own game rules and visual components; the import graph also rejects CPU/provider/storage/Club transitively.',
            },
          ],
        },
      ],
    },
  })),
  {
    files: ['src/nearby/**/*.{ts,tsx}'],
    ignores: ['src/nearby/games/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../games/**', '@/games/**', '../../games/**'],
              message:
                'Only the per-game Nearby adapter may enter src/games/. Nearby-owned ./games modules are allowed.',
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
