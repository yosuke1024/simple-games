/**
 * The registry's channels, pinned from both sides: which titles are on each
 * (golden lists — putting a game on a channel, moving it from one to the
 * other, or promoting it off is a release decision and edits this file on
 * purpose), and that the guard answers by channel and platform and by nothing
 * else.
 *
 * The guard is exercised twice: with the real titles the registry declares
 * today, and with synthetic entries spliced into the registry the module
 * under test sees — one `'web-beta'`, one `'in-development'`. The synthetic
 * ones stay even while real ones exist: the day the last of them graduates,
 * a test that needed a real one to run would silently stop testing the
 * mechanism.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAMES, type GameDefinition } from './registry';

/**
 * The titles in early release today (docs/WEB_VERSION.md「先行公開」), in
 * registry order: the five new genres of
 * docs/plans/2026-10-17-unblock-snake-loop-bridges-peg.md (Nos. 42–46, on the
 * web since 2026-10-19), and three of the five of
 * docs/plans/2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md
 * (Nos. 53, 54 and 56), playable and on this channel since 2026-10-21 but not
 * yet synced to the web. The eleven before them — three of issue #194, five
 * of issue #197, three of issue #210 — all graduated into the app on
 * 2026-10-02. Putting a title on the channel, or promoting one off it, edits
 * this list on purpose.
 */
const WEB_BETA_IDS = [
  'unblock-puzzle',
  'snake',
  'loop-puzzle',
  'bridges',
  'peg-solitaire',
  'make-the-target',
  'nested-tic-tac-toe',
  'tangram',
];

/**
 * The titles in development today, in registry order: the five of
 * docs/plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md
 * (Nos. 47–51), scaffolds since 2026-10-20 with no game behind them yet, and
 * two of the 2026-10-20 plan's five (Nos. 52 and 55), playable but held back
 * by their rules documents: Overtake until the Phase 0 device result is
 * recorded (docs/OVERTAKE_RULES.md §3), Scopa until the product owner decides
 * how its CPU beat resumes (docs/SCOPA_RULES.md §4.2). No build offers them on
 * any door. Each moves to WEB_BETA_IDS in the change that makes it playable
 * (or, for those two, that lifts the hold), and that change edits this list on
 * purpose — as three of the 2026-10-20 plan's five did on 2026-10-21.
 */
const IN_DEVELOPMENT_IDS = [
  'chess',
  'gem-swap',
  'pipe-link',
  'bounce-up',
  'echo-pads',
  'overtake',
  'scopa',
];

/** A beta title that exists only in this file: a released game's shape, a channel of its own. */
const SYNTHETIC_BETA: GameDefinition = {
  ...GAMES.find((game) => game.id === 'sudoku')!,
  id: 'synthetic-beta' as GameDefinition['id'],
  title: 'Synthetic Beta',
  channel: 'web-beta',
};

/** An in-development title that exists only in this file, the same way. */
const SYNTHETIC_IN_DEVELOPMENT: GameDefinition = {
  ...GAMES.find((game) => game.id === 'sudoku')!,
  id: 'synthetic-in-development' as GameDefinition['id'],
  title: 'Synthetic In Development',
  channel: 'in-development',
};

async function loadOn(native: boolean, withSynthetic = false) {
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
  if (withSynthetic) {
    vi.doMock('./registry', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./registry')>();
      return {
        ...actual,
        GAMES: [...actual.GAMES, SYNTHETIC_BETA, SYNTHETIC_IN_DEVELOPMENT],
      };
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

const released = GAMES.filter((game) => game.channel === undefined);
const inBrowser = GAMES.filter((game) => game.channel !== 'in-development');

/** Every door, closed: what "not offered" means for one id on one build. */
function expectClosed(build: Awaited<ReturnType<typeof loadOn>>, id: string, title: string) {
  expect(build.isAvailableGameId(id), id).toBe(false);
  expect(build.findAvailableGame(id), id).toBeUndefined();
  expect(build.getLazyRoot(id as never), id).toBeNull();
  expect(build.searchGames(title), id).toEqual([]);
}

describe('the channels', () => {
  it('hold exactly the titles this file says they do', () => {
    const beta = GAMES.filter((game) => game.channel === 'web-beta').map((game) => game.id);
    expect(beta).toEqual(WEB_BETA_IDS);
    const building = GAMES.filter((game) => game.channel === 'in-development').map(
      (game) => game.id,
    );
    expect(building).toEqual(IN_DEVELOPMENT_IDS);
    // And every registry entry is complete: keys for "Reset Local Data" and
    // schemas for Backup & Restore, on every build — a beta or in-development
    // title included, whenever there is one.
    for (const game of GAMES) {
      expect(game.storageKeys.length).toBeGreaterThan(0);
      expect(typeof game.loadStorageSchemas).toBe('function');
    }
  });

  it('offers exactly the released titles on the app, and keeps the others off every door', async () => {
    const app = await loadOn(true);
    const offered = app.availableGames().map((game) => game.id);
    expect(offered).toEqual(released.map((game) => game.id));
    expect(app.availableGames()).toHaveLength(
      GAMES.length - WEB_BETA_IDS.length - IN_DEVELOPMENT_IDS.length,
    );
    // Every released title is still behind every door it always was.
    for (const game of released) {
      expect(app.isAvailableGameId(game.id)).toBe(true);
      expect(app.findAvailableGame(game.id)?.id).toBe(game.id);
      expect(app.getLazyRoot(game.id)).not.toBeNull();
    }
    for (const id of [...WEB_BETA_IDS, ...IN_DEVELOPMENT_IDS]) {
      expectClosed(app, id, GAMES.find((game) => game.id === id)!.title);
    }
    expect(app.searchGames('')).toHaveLength(released.length);
  });

  it('offers the released and beta titles in the browser, and keeps the in-development ones off every door', async () => {
    const web = await loadOn(false);
    expect(web.availableGames().map((game) => game.id)).toEqual(inBrowser.map((game) => game.id));
    for (const game of inBrowser) {
      expect(web.isAvailableGameId(game.id)).toBe(true);
      expect(web.findAvailableGame(game.id)?.id).toBe(game.id);
      expect(web.getLazyRoot(game.id)).not.toBeNull();
    }
    // Each beta title answers to its own name in the browser's search — the
    // door the app build closes to it in the test above.
    for (const id of WEB_BETA_IDS) {
      const title = GAMES.find((game) => game.id === id)!.title;
      expect(web.searchGames(title).map((game) => game.id)).toEqual([id]);
    }
    // An in-development title is a scaffold with no game behind it, or a game
    // its rules document holds back from the channel: the browser closes the
    // same doors to it that the app closes to a beta title
    // (docs/WEB_VERSION.md「遊べるものだけを出す」).
    for (const id of IN_DEVELOPMENT_IDS) {
      expectClosed(web, id, GAMES.find((game) => game.id === id)!.title);
    }
    expect(web.searchGames('')).toHaveLength(inBrowser.length);
  });

  describe('with a synthetic beta title and a synthetic in-development title in the registry', () => {
    const betaId = SYNTHETIC_BETA.id;
    const buildingId = SYNTHETIC_IN_DEVELOPMENT.id;

    it('offers the beta one in the browser, on every door, and never the in-development one', async () => {
      const web = await loadOn(false, true);
      expect(web.availableGames().map((game) => game.id)).toEqual([
        ...inBrowser.map((game) => game.id),
        betaId,
      ]);
      expect(web.isAvailableGameId(betaId)).toBe(true);
      expect(web.findAvailableGame(betaId)?.id).toBe(betaId);
      expect(web.getLazyRoot(betaId)).not.toBeNull();
      expect(web.searchGames(SYNTHETIC_BETA.title).map((game) => game.id)).toEqual([betaId]);
      expectClosed(web, buildingId, SYNTHETIC_IN_DEVELOPMENT.title);
      expect(web.searchGames('')).toHaveLength(inBrowser.length + 1);
    });

    it('keeps both off every door of the app build', async () => {
      const app = await loadOn(true, true);
      const offered = app.availableGames().map((game) => game.id);
      expect(offered).toEqual(released.map((game) => game.id));
      expectClosed(app, betaId, SYNTHETIC_BETA.title);
      expectClosed(app, buildingId, SYNTHETIC_IN_DEVELOPMENT.title);
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
