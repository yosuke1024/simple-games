import '@testing-library/jest-dom/vitest';

/**
 * Setup for the `dom` project only (vite.config.ts, `test.projects`): jest-dom's
 * matchers and the Club House catalog. The `game` project — `games/*\/game/`,
 * pure TypeScript — runs in plain Node with no setup file.
 *
 * Until 2026-10-23 this file also registered every game's message catalog by
 * globbing every `games/*\/i18n/index.ts` eagerly (issue #38), so that a test
 * could render a game's screens without the registry's loaders. Evaluated once
 * per test file, that cost grew with the number of games (56 games × 15 modules)
 * and was paid by a number of files that grows with the number of games too.
 * Now a test holds exactly what the app holds: a chunk entry point (`*Root.tsx`,
 * the settings sections) carries `import '../i18n'` (src/test/gameI18nWiring.test.ts
 * is the gate), so a test that renders through it has its game's strings, and a
 * test that renders a screen or component directly registers its own game's
 * catalog with the same one-line import
 * (scripts/codemods/2026-10-23-ui-tests-register-own-catalog.mjs). A catalog
 * that is missing shows up as raw keys, which the test's own assertions catch.
 * The shell's tests never depend on a game's catalog.
 */
// The Club House catalog (importBoundaries rule 5 exempts exactly this path
// for test infrastructure): club screens are rendered directly by their tests.
import.meta.glob('../club/i18n/index.ts', { eager: true });
