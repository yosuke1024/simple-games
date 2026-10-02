/**
 * The early-release channel's one decision, pinned from both sides: which
 * titles are on it (a golden list — adding a game to the channel, or promoting
 * one off it, is a release decision and edits this file on purpose), and that
 * the guard answers by platform and by nothing else.
 *
 * No registry title is on the channel any more, so the guard itself is
 * exercised with a synthetic `'web-beta'` entry spliced into the registry the
 * module under test sees. The mechanism stays for the next beta; a test that
 * needed a real beta title to run would silently stop testing it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAMES, type GameDefinition } from './registry';

/**
 * The titles in early release today (docs/WEB_VERSION.md「先行公開」): none.
 * The three of issue #194, the five genres of issue #197 and the three
 * practice-set titles of issue #210 all graduated into the app on 2026-10-02.
 * Putting a title back on the channel (`channel: 'web-beta'` in the registry)
 * adds its id here on purpose.
 */
const WEB_BETA_IDS: string[] = [];

/** A beta title that exists only in this file: a released game's shape, a channel of its own. */
const SYNTHETIC_BETA: GameDefinition = {
  ...GAMES.find((game) => game.id === 'sudoku')!,
  id: 'synthetic-beta' as GameDefinition['id'],
  title: 'Synthetic Beta',
  channel: 'web-beta',
};

async function loadOn(native: boolean, withBeta = false) {
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
  if (withBeta) {
    vi.doMock('./registry', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./registry')>();
      return { ...actual, GAMES: [...actual.GAMES, SYNTHETIC_BETA] };
    });
  }
  const channel = await import('./gameChannel');
  const search = await import('./gameSearch');
  const roots = await import('./lazyRoots');
  return { ...channel, ...search, ...roots };
}

afterEach(() => {
  vi.doUnmock('@capacitor/core');
  vi.doUnmock('./registry');
  vi.resetModules();
});

describe('the web-beta channel', () => {
  it('holds exactly the titles this file says it does', () => {
    const declared = GAMES.filter((game) => game.channel === 'web-beta').map((game) => game.id);
    expect(declared).toEqual(WEB_BETA_IDS);
    // And every registry entry is complete: keys for "Reset Local Data" and
    // schemas for Backup & Restore, on every build — a beta title included,
    // whenever there is one.
    for (const game of GAMES) {
      expect(game.storageKeys.length).toBeGreaterThan(0);
      expect(typeof game.loadStorageSchemas).toBe('function');
    }
  });

  it('offers every registry title on the app, now that none is held back', async () => {
    const app = await loadOn(true);
    expect(app.availableGames()).toHaveLength(GAMES.length);
    expect(app.availableGames().map((game) => game.id)).toEqual(GAMES.map((game) => game.id));
    for (const game of GAMES) {
      expect(app.isAvailableGameId(game.id)).toBe(true);
      expect(app.getLazyRoot(game.id)).not.toBeNull();
    }
    expect(app.searchGames('')).toHaveLength(GAMES.length);
  });

  it('offers every title in the browser', async () => {
    const web = await loadOn(false);
    expect(web.availableGames().map((game) => game.id)).toEqual(GAMES.map((game) => game.id));
    for (const game of GAMES) {
      expect(web.isAvailableGameId(game.id)).toBe(true);
      expect(web.findAvailableGame(game.id)?.id).toBe(game.id);
      expect(web.getLazyRoot(game.id)).not.toBeNull();
    }
    expect(web.searchGames('')).toHaveLength(GAMES.length);
  });

  describe('with a synthetic beta title in the registry', () => {
    const id = SYNTHETIC_BETA.id;

    it('offers it in the browser, on every door', async () => {
      const web = await loadOn(false, true);
      expect(web.availableGames().map((game) => game.id)).toEqual([
        ...GAMES.map((game) => game.id),
        id,
      ]);
      expect(web.isAvailableGameId(id)).toBe(true);
      expect(web.findAvailableGame(id)?.id).toBe(id);
      expect(web.getLazyRoot(id)).not.toBeNull();
      expect(web.searchGames(SYNTHETIC_BETA.title).map((game) => game.id)).toEqual([id]);
      expect(web.searchGames('')).toHaveLength(GAMES.length + 1);
    });

    it('keeps it off every door of the app build', async () => {
      const app = await loadOn(true, true);
      const offered = app.availableGames().map((game) => game.id);
      expect(offered).toEqual(GAMES.map((game) => game.id));
      expect(app.isAvailableGameId(id)).toBe(false);
      expect(app.findAvailableGame(id)).toBeUndefined();
      expect(app.getLazyRoot(id)).toBeNull();
      expect(app.searchGames(SYNTHETIC_BETA.title)).toEqual([]);
      // The released titles are untouched by any of this.
      expect(app.isAvailableGameId('sudoku')).toBe(true);
      expect(app.getLazyRoot('sudoku')).not.toBeNull();
      expect(app.searchGames('')).toHaveLength(offered.length);
    });
  });

  it('answers null-ish ids the way the registry always has', async () => {
    const web = await loadOn(false);
    expect(web.isAvailableGameId(null)).toBe(false);
    expect(web.isAvailableGameId(undefined)).toBe(false);
    expect(web.isAvailableGameId('')).toBe(false);
    expect(web.isAvailableGameId('not-a-game')).toBe(false);
  });
});
