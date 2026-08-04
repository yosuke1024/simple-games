import '@testing-library/jest-dom/vitest';

/**
 * Register every game's message catalog before any test runs (issue #38).
 * In the app this happens when a game's chunk loads; tests that render a
 * game's screens directly never go through the registry's loaders, so the
 * catalogs are registered here instead — mirroring the shipped reality that
 * every string is always on the device. The one thing this hides, a chunk
 * entry point that forgot its own `import '../i18n'`, is covered statically
 * by test/gameI18nWiring.test.ts.
 */
import.meta.glob('../games/*/i18n/index.ts', { eager: true });
