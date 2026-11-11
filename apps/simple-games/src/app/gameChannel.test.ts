/**
 * The registry's channels, pinned from both sides: which titles are on each
 * (golden lists — putting a game on a channel, moving it from one to the
 * other, or promoting it off is a release decision and edits this file on
 * purpose), and that the guard answers by channel and platform and by nothing
 * else.
 *
 * The guard is exercised twice: with the real titles the registry declares
 * today, and with synthetic entries spliced into the registry the module
 * under test sees — one `'web-beta'`, one `'in-development'`, one withheld
 * from iOS. The synthetic ones stay even while real ones exist: the day the
 * last of them graduates, a test that needed a real one to run would silently
 * stop testing the mechanism.
 *
 * Three builds answer: the browser, the Android app and the iOS app. The iOS
 * app differs from Android by one field, `unavailableOn: 'ios'`, which is not
 * a channel — a withheld title is released everywhere else.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IOS_WITHHELD_GAME_IDS } from './iosWithheldGames';
import { GAMES, type GameDefinition } from './registry';

/**
 * The titles in early release today (docs/WEB_VERSION.md「先行公開」), in
 * registry order — none since 2026-10-29. That day the product owner
 * graduated all twenty that were on the channel into the app (v1.7.0;
 * docs/RELEASE_CHECKLIST.md §0): the five of
 * docs/plans/2026-10-17-unblock-snake-loop-bridges-peg.md (Nos. 42–46, on the
 * web since 2026-10-19), Gem Swap / Pipe Link / Bounce Up / Echo Pads of
 * docs/plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md (on
 * the web since 2026-10-23), Overtake / Make the Target / Tangram of
 * docs/plans/2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md
 * (since 2026-10-22), Light Grid / Color Flood / Three Peaks / Knight's Tour
 * (Nos. 57–61) and Invaders / Paddle Rally / Hanoi Towers / Maze Escape
 * (Nos. 62–66), the last eight since 2026-10-23. Chess, Nested Tic-Tac-Toe,
 * Scopa and Nim had graduated on 2026-10-25, and the eleven of issues #194,
 * #197 and #210 on 2026-10-02. The synthetic beta entry below keeps the guard
 * tested while this list is empty. Putting a title on the channel, or
 * promoting one off it, edits this list on purpose. Frost Route and River
 * Cargo, the last two, graduated with the owner's approval on 2026-11-07.
 */
const WEB_BETA_IDS: string[] = [];

/**
 * The titles in development today, in registry order: Falling Blocks (No. 63),
 * withdrawn from the early-release channel on 2026-10-29 by the product
 * owner's decision — its seven tetrominoes in a ten-wide well with a preview
 * and a landing outline are the combination Tetris Holding v. Xio Interactive
 * (2012) treated as protected expression, the reason
 * docs/plans/2026-08-07-checkers-and-gomoku.md had passed on the genre
 * (docs/FALLING_BLOCKS_RULES.md). It stays here until it is remade away from
 * that combination or dropped. Before it, the last were the five of
 * docs/plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md
 * (Nos. 47–51), scaffolds from 2026-10-20 until they became playable on
 * 2026-10-22 and moved to WEB_BETA_IDS — as the 2026-10-20 plan's five did
 * (three on 2026-10-21, Overtake and Scopa on 2026-10-22). The next scaffold
 * of scripts/new-game.mjs joins this list on purpose, and leaves it in the
 * change that makes it playable. The synthetic in-development entry below
 * keeps the guard's closed doors tested even when this list is empty.
 */
// Marble Weave was withdrawn on 2026-11-03 after the owner declined inclusion.
const IN_DEVELOPMENT_IDS: string[] = ['falling-blocks', 'marble-weave'];

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

/**
 * The titles the iOS app leaves out, in registry order
 * (docs/PRODUCT_PRINCIPLES.md「iOS で出さないタイトル」). App Store Review
 * rejected 1.8.4 (10804) on 2026-11-10 under guideline 2.3.6: simulated
 * gambling is accepted only from an organisation's developer account, and
 * this app is published from an individual one. The product owner decided on
 * 2026-11-11 to withhold these two from the iOS app only — Android and the
 * browser version, Safari on an iPhone included, keep them. Adding a title
 * here, or giving one back to iOS, is a release decision and edits this list
 * on purpose.
 */
const NOT_ON_IOS: string[] = ['texas-holdem', 'blackjack'];

/** A released title withheld from iOS that exists only in this file, the same way. */
const SYNTHETIC_NOT_ON_IOS: GameDefinition = {
  ...GAMES.find((game) => game.id === 'sudoku')!,
  id: 'synthetic-not-on-ios' as GameDefinition['id'],
  title: 'Synthetic Not On iOS',
  unavailableOn: 'ios',
};

type Platform = 'web' | 'android' | 'ios';

/** The module graph one build sees, with `extra` entries appended to its registry. */
async function loadOn(platform: Platform, extra: readonly GameDefinition[] = []) {
  vi.resetModules();
  vi.doMock('@capacitor/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@capacitor/core')>();
    return {
      ...actual,
      Capacitor: {
        ...actual.Capacitor,
        isNativePlatform: () => platform !== 'web',
        getPlatform: () => platform,
      },
    };
  });
  if (extra.length > 0) {
    vi.doMock('./registry', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./registry')>();
      return {
        ...actual,
        GAMES: [...actual.GAMES, ...extra],
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
const onIos = released.filter((game) => !NOT_ON_IOS.includes(game.id));
const SYNTHETIC_CHANNELS = [SYNTHETIC_BETA, SYNTHETIC_IN_DEVELOPMENT];

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
    // Seven Nearby-capable beta games graduated with the owner's approval on 2026-11-04,
    // and Frost Route / River Cargo on 2026-11-07.
    expect(beta).toHaveLength(0);
    expect(GAMES.filter((game) => game.channel === undefined)).toHaveLength(80);
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

  it('offers exactly the released titles on the Android app, and keeps the others off every door', async () => {
    const app = await loadOn('android');
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
    const web = await loadOn('web');
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
    // An in-development title is a scaffold with no game behind it: the
    // browser closes the same doors to it that the app closes to a beta title
    // (docs/WEB_VERSION.md「遊べるものだけを出す」). None is in the registry
    // today; the synthetic one below keeps this tested.
    for (const id of IN_DEVELOPMENT_IDS) {
      expectClosed(web, id, GAMES.find((game) => game.id === id)!.title);
    }
    expect(web.searchGames('')).toHaveLength(inBrowser.length);
  });

  describe('with a synthetic beta title and a synthetic in-development title in the registry', () => {
    const betaId = SYNTHETIC_BETA.id;
    const buildingId = SYNTHETIC_IN_DEVELOPMENT.id;

    it('offers the beta one in the browser, on every door, and never the in-development one', async () => {
      const web = await loadOn('web', SYNTHETIC_CHANNELS);
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

    it('keeps both off every door of the Android app', async () => {
      const app = await loadOn('android', SYNTHETIC_CHANNELS);
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
    const web = await loadOn('web');
    expect(web.isAvailableGameId(null)).toBe(false);
    expect(web.isAvailableGameId(undefined)).toBe(false);
    expect(web.isAvailableGameId('')).toBe(false);
    expect(web.isAvailableGameId('not-a-game')).toBe(false);
  });
});

/**
 * The iOS app (app/iosWithheldGames.ts). One build ships to both stores; the
 * iOS app answers like the Android one except for the titles marked
 * `unavailableOn: 'ios'`, which it keeps off every door Android and the
 * browser open to them. They stay registered — their keys for "Reset Local
 * Data" and their schemas for Backup & Restore — so a backup made on Android
 * restores on an iPhone without losing those records.
 */
describe('the titles the iOS app leaves out', () => {
  it('are exactly the golden list, and the leaf the Nearby layer reads names the same ids in the same order', () => {
    const withheld = GAMES.filter((game) => game.unavailableOn === 'ios').map((game) => game.id);
    expect(withheld).toEqual(NOT_ON_IOS);
    // src/nearby may not import the registry, so it reads its own copy
    // (src/test/importBoundaries.test.ts); the two must never drift.
    expect([...IOS_WITHHELD_GAME_IDS]).toEqual(withheld);
    expect(new Set(IOS_WITHHELD_GAME_IDS)).toEqual(new Set(withheld));
    // 'ios' is the only value the field takes, and only released titles carry
    // it: a withheld title is on every other build.
    for (const game of GAMES) {
      expect([undefined, 'ios'], game.id).toContain(game.unavailableOn);
      if (game.unavailableOn) expect(game.channel, game.id).toBeUndefined();
    }
    // No Club challenge either: the Club's Today list and Directory name a
    // challenge's game from the registry directly, so a contract here would be
    // a door the gate does not stand in front of.
    for (const id of NOT_ON_IOS) {
      const game = GAMES.find((entry) => entry.id === id)!;
      expect(game.challenge, id).toBeUndefined();
      // Still registered on every build (the header's "deliberately NOT gated").
      expect(game.storageKeys.length, id).toBeGreaterThan(0);
      expect(typeof game.loadStorageSchemas, id).toBe('function');
    }
  });

  it('are off every door of the iOS app, which offers the other released titles in registry order', async () => {
    const ios = await loadOn('ios');
    expect(ios.availableGames().map((game) => game.id)).toEqual(onIos.map((game) => game.id));
    expect(ios.availableGames()).toHaveLength(78);
    for (const game of onIos) {
      expect(ios.isAvailableGameId(game.id), game.id).toBe(true);
      expect(ios.findAvailableGame(game.id)?.id, game.id).toBe(game.id);
      expect(ios.getLazyRoot(game.id), game.id).not.toBeNull();
    }
    for (const id of NOT_ON_IOS) {
      expectClosed(ios, id, GAMES.find((game) => game.id === id)!.title);
    }
    // Nor does any part of either name find them (no other title contains these).
    for (const query of ['Blackjack', 'Texas', 'Hold', 'hold’em']) {
      expect(ios.searchGames(query), query).toEqual([]);
    }
    expect(ios.searchGames('')).toHaveLength(onIos.length);
    // The beta and in-development titles are off the iOS app as they are off Android.
    for (const id of [...WEB_BETA_IDS, ...IN_DEVELOPMENT_IDS]) {
      expectClosed(ios, id, GAMES.find((game) => game.id === id)!.title);
    }
  });

  it.each(['android', 'web'] as const)(
    'are on every door of the %s build, as before',
    async (platform) => {
      const build = await loadOn(platform);
      for (const id of NOT_ON_IOS) {
        expect(build.isAvailableGameId(id), id).toBe(true);
        expect(build.findAvailableGame(id)?.id, id).toBe(id);
        expect(build.getLazyRoot(id as never), id).not.toBeNull();
      }
      expect(build.searchGames('Blackjack').map((game) => game.id)).toEqual(['blackjack']);
      expect(build.searchGames('Texas').map((game) => game.id)).toEqual(['texas-holdem']);
      expect(build.searchGames('Hold').map((game) => game.id)).toEqual(['texas-holdem']);
      expect(build.availableGames().map((game) => game.id)).toEqual(
        (platform === 'web' ? inBrowser : released).map((game) => game.id),
      );
    },
  );

  describe('with a synthetic title withheld from iOS in the registry', () => {
    const id = SYNTHETIC_NOT_ON_IOS.id;

    it('keeps it off every door of the iOS app, beside the beta and in-development ones', async () => {
      const ios = await loadOn('ios', [...SYNTHETIC_CHANNELS, SYNTHETIC_NOT_ON_IOS]);
      expect(ios.availableGames().map((game) => game.id)).toEqual(onIos.map((game) => game.id));
      expectClosed(ios, id, SYNTHETIC_NOT_ON_IOS.title);
      expectClosed(ios, SYNTHETIC_BETA.id, SYNTHETIC_BETA.title);
      expectClosed(ios, SYNTHETIC_IN_DEVELOPMENT.id, SYNTHETIC_IN_DEVELOPMENT.title);
      expect(ios.isAvailableGameId('sudoku')).toBe(true);
    });

    it.each(['android', 'web'] as const)('offers it on the %s build', async (platform) => {
      const build = await loadOn(platform, [SYNTHETIC_NOT_ON_IOS]);
      expect(build.availableGames().map((game) => game.id)).toEqual([
        ...(platform === 'web' ? inBrowser : released).map((game) => game.id),
        id,
      ]);
      expect(build.isAvailableGameId(id)).toBe(true);
      expect(build.getLazyRoot(id)).not.toBeNull();
      expect(build.searchGames(SYNTHETIC_NOT_ON_IOS.title).map((game) => game.id)).toEqual([id]);
    });
  });
});
