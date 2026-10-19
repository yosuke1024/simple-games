/**
 * The early-release channel's one decision, pinned from both sides: which
 * titles are on it (a golden list — adding a game to the channel, or promoting
 * one off it, is a release decision and edits this file on purpose), and that
 * the guard answers by platform and by nothing else.
 *
 * The guard is exercised twice: with the real beta titles the registry
 * declares today, and with a synthetic `'web-beta'` entry spliced into the
 * registry the module under test sees. The synthetic one stays even while real
 * ones exist: the day the last of them graduates, a test that needed a real
 * beta title to run would silently stop testing the mechanism.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAMES, type GameDefinition } from './registry';

/**
 * The titles in early release today (docs/WEB_VERSION.md「先行公開」), in
 * registry order: the five new genres of
 * docs/plans/2026-10-17-unblock-snake-loop-bridges-peg.md (Nos. 42–46, on the
 * web since 2026-10-19), then the five of
 * docs/plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md
 * (Nos. 47–51, being built). The eleven before them — three of issue #194,
 * five of issue #197, three of issue #210 — all graduated into the app on
 * 2026-10-02. Putting a title on the channel, or promoting one off it, edits
 * this list on purpose.
 */
const WEB_BETA_IDS = [
  'unblock-puzzle',
  'snake',
  'loop-puzzle',
  'bridges',
  'peg-solitaire',
  'chess',
  'gem-swap',
  'pipe-link',
  'bounce-up',
  'echo-pads',
];

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

  it('offers exactly the released titles on the app, and keeps the beta ones off every door', async () => {
    const app = await loadOn(true);
    const released = GAMES.filter((game) => game.channel !== 'web-beta');
    const offered = app.availableGames().map((game) => game.id);
    expect(offered).toEqual(released.map((game) => game.id));
    expect(app.availableGames()).toHaveLength(GAMES.length - WEB_BETA_IDS.length);
    // Every released title is still behind every door it always was.
    for (const game of released) {
      expect(app.isAvailableGameId(game.id)).toBe(true);
      expect(app.findAvailableGame(game.id)?.id).toBe(game.id);
      expect(app.getLazyRoot(game.id)).not.toBeNull();
    }
    for (const id of WEB_BETA_IDS) {
      expect(app.isAvailableGameId(id)).toBe(false);
      expect(app.findAvailableGame(id)).toBeUndefined();
      expect(app.getLazyRoot(id as never)).toBeNull();
      expect(app.searchGames(GAMES.find((game) => game.id === id)!.title)).toEqual([]);
    }
    expect(app.searchGames('')).toHaveLength(released.length);
  });

  it('offers every title in the browser', async () => {
    const web = await loadOn(false);
    expect(web.availableGames().map((game) => game.id)).toEqual(GAMES.map((game) => game.id));
    for (const game of GAMES) {
      expect(web.isAvailableGameId(game.id)).toBe(true);
      expect(web.findAvailableGame(game.id)?.id).toBe(game.id);
      expect(web.getLazyRoot(game.id)).not.toBeNull();
    }
    // And each beta title answers to its own name in the browser's search —
    // the door the app build closes to it in the test above.
    for (const id of WEB_BETA_IDS) {
      const title = GAMES.find((game) => game.id === id)!.title;
      expect(web.searchGames(title).map((game) => game.id)).toEqual([id]);
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
      expect(offered).toEqual(
        GAMES.filter((game) => game.channel !== 'web-beta').map((game) => game.id),
      );
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
