/**
 * The early-release channel's one decision, pinned from both sides: which
 * titles are on it (a golden list — adding a game to the channel, or promoting
 * one off it, is a release decision and edits this file on purpose), and that
 * the guard answers by platform and by nothing else.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAMES } from './registry';

/** The titles in early release today (docs/WEB_VERSION.md「先行公開」, issue #194). */
const WEB_BETA_IDS = ['crown-grid', 'number-path', 'shape-regions'];

async function loadOn(native: boolean) {
  vi.resetModules();
  vi.doMock('@capacitor/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@capacitor/core')>();
    return {
      ...actual,
      Capacitor: {
        ...actual.Capacitor,
        isNativePlatform: () => native,
        getPlatform: () => (native ? 'android' : 'web'),
      },
    };
  });
  const channel = await import('./gameChannel');
  const search = await import('./gameSearch');
  const roots = await import('./lazyRoots');
  return { ...channel, ...search, ...roots };
}

afterEach(() => {
  vi.doUnmock('@capacitor/core');
  vi.resetModules();
});

describe('the web-beta channel', () => {
  it('holds exactly the titles this file says it does', () => {
    const declared = GAMES.filter((game) => game.channel === 'web-beta').map((game) => game.id);
    expect(declared).toEqual(WEB_BETA_IDS);
    // And a beta title is still a complete registry entry: keys for "Reset
    // Local Data" and schemas for Backup & Restore, on every build.
    for (const game of GAMES.filter((entry) => entry.channel === 'web-beta')) {
      expect(game.storageKeys.length).toBeGreaterThan(0);
      expect(typeof game.loadStorageSchemas).toBe('function');
    }
  });

  it('offers every title in the browser', async () => {
    const web = await loadOn(false);
    expect(web.availableGames().map((game) => game.id)).toEqual(GAMES.map((game) => game.id));
    for (const id of WEB_BETA_IDS) {
      expect(web.isAvailableGameId(id)).toBe(true);
      expect(web.findAvailableGame(id)?.id).toBe(id);
      expect(web.getLazyRoot(id as never)).not.toBeNull();
    }
    expect(web.searchGames('')).toHaveLength(GAMES.length);
  });

  it('keeps the beta titles off every door of the app build', async () => {
    const app = await loadOn(true);
    const offered = app.availableGames().map((game) => game.id);
    expect(offered).toEqual(
      GAMES.filter((game) => game.channel !== 'web-beta').map((game) => game.id),
    );
    for (const id of WEB_BETA_IDS) {
      expect(app.isAvailableGameId(id)).toBe(false);
      expect(app.findAvailableGame(id)).toBeUndefined();
      expect(app.getLazyRoot(id as never)).toBeNull();
      expect(app.searchGames(GAMES.find((game) => game.id === id)!.title)).toEqual([]);
    }
    // The released titles are untouched by any of this.
    expect(app.isAvailableGameId('sudoku')).toBe(true);
    expect(app.getLazyRoot('sudoku')).not.toBeNull();
    expect(app.searchGames('')).toHaveLength(offered.length);
  });

  it('answers null-ish ids the way the registry always has', async () => {
    const web = await loadOn(false);
    expect(web.isAvailableGameId(null)).toBe(false);
    expect(web.isAvailableGameId(undefined)).toBe(false);
    expect(web.isAvailableGameId('')).toBe(false);
    expect(web.isAvailableGameId('not-a-game')).toBe(false);
  });
});
