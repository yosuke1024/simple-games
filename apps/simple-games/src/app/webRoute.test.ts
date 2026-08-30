/**
 * The URL contract the per-game guides link at (issue #83). These pages are
 * published — `https://pixapps.ai/simple-games/games/<id>/<locale>/` links to
 * `…/play/?game=<id>` in ten languages — so the parameter name and the set of
 * ids it accepts are not free to drift. The last case below is the one that
 * matters: it walks the registry, so a game added without a working address
 * fails here rather than in production.
 *
 * How the shell follows these addresses is App.route.test.tsx's subject.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAMES } from './registry';
import {
  GAME_PARAM,
  currentRouteGame,
  gameIdFromHref,
  hrefWithGame,
  popRoute,
  pushRoute,
  startRoute,
  webRoutingEnabled,
} from './webRoute';

const PLAY = 'https://pixapps.ai/simple-games/play/';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  window.history.replaceState(null, '', '/');
});

/**
 * A reload is a fresh JS context over the same session history, which is what
 * `vi.resetModules()` gives: the module registry is rebuilt while
 * `window.history` and the state on each entry survive. That is the whole
 * reason the depth is kept in `history.state` — a module variable passes every
 * other test in this file and fails here, because refreshing a game would
 * forget that the collection is a step behind it and start rewriting the
 * address instead of walking back.
 */
async function reload() {
  vi.resetModules();
  return import('./webRoute');
}

describe('the game a URL asks for', () => {
  it('is the id in the game parameter', () => {
    expect(gameIdFromHref(`${PLAY}?game=sudoku`)).toBe('sudoku');
  });

  it('is null when there is no parameter, so the address is the collection', () => {
    expect(gameIdFromHref(PLAY)).toBeNull();
  });

  it.each([
    ['an id no build ever carried', `${PLAY}?game=not-a-game`],
    ['an empty value', `${PLAY}?game=`],
    ['a different case — ids are the lowercase slugs, exactly', `${PLAY}?game=Sudoku`],
    ['a path that looks like one', `${PLAY}sudoku/`],
  ])('is null for %s, and never an error', (_case, href) => {
    expect(gameIdFromHref(href)).toBeNull();
  });

  it('reads past whatever else the link carried', () => {
    expect(gameIdFromHref(`${PLAY}?utm_source=guide&game=solitaire#top`)).toBe('solitaire');
  });

  it('accepts the all-numeric id like any other', () => {
    expect(gameIdFromHref(`${PLAY}?game=2048`)).toBe('2048');
  });

  // Not a list to keep in step by hand: every title in the collection has to
  // survive the round trip, including whichever one is added next.
  it('round-trips every game in the registry', () => {
    expect(GAMES.length).toBeGreaterThan(20);
    for (const game of GAMES) {
      expect(gameIdFromHref(`https://pixapps.ai${hrefWithGame(PLAY, game.id)}`)).toBe(game.id);
    }
  });
});

describe('writing the game into an address', () => {
  it('adds the parameter to a bare address', () => {
    expect(hrefWithGame(PLAY, 'sudoku')).toBe(`/simple-games/play/?${GAME_PARAM}=sudoku`);
  });

  it('replaces the game already there rather than repeating the parameter', () => {
    expect(hrefWithGame(`${PLAY}?game=sudoku`, 'solitaire')).toBe(
      '/simple-games/play/?game=solitaire',
    );
  });

  it('removes it for the collection', () => {
    expect(hrefWithGame(`${PLAY}?game=sudoku`, null)).toBe('/simple-games/play/');
  });

  // A campaign parameter belongs to the link the visitor followed. Dropping it
  // on the way into a game would quietly break whoever is reading it.
  it('leaves every other parameter and the fragment alone', () => {
    expect(hrefWithGame(`${PLAY}?utm_source=guide&game=sudoku#rules`, null)).toBe(
      '/simple-games/play/?utm_source=guide#rules',
    );
    expect(hrefWithGame(`${PLAY}?utm_source=guide#rules`, 'kakuro')).toBe(
      '/simple-games/play/?utm_source=guide&game=kakuro#rules',
    );
  });

  it('hands back anything it cannot parse untouched', () => {
    expect(hrefWithGame('not an address', 'sudoku')).toBe('not an address');
  });
});

describe('the history the shell keeps', () => {
  it('is on in the browser', () => {
    expect(webRoutingEnabled()).toBe(true);
  });

  it('settles an unknown id into the plain collection address without an entry', () => {
    window.history.replaceState(null, '', '/simple-games/play/?game=not-a-game');
    const before = window.history.length;
    startRoute(null);
    expect(window.location.search).toBe('');
    expect(currentRouteGame()).toBeNull();
    expect(window.history.length).toBe(before);
  });

  it('adds one entry per game opened from the collection', () => {
    window.history.replaceState(null, '', '/simple-games/play/');
    startRoute(null);
    const before = window.history.length;
    pushRoute('sudoku');
    expect(window.location.search).toBe('?game=sudoku');
    expect(window.history.length).toBe(before + 1);
  });

  // Arriving from a guide page: the entry behind belongs to that page, so
  // leaving the game must not consume it — the address is rewritten instead.
  it('rewrites in place when the shell pushed nothing to go back to', () => {
    window.history.replaceState(null, '', '/simple-games/play/?game=sudoku');
    startRoute('sudoku');
    const before = window.history.length;
    popRoute();
    expect(window.location.search).toBe('');
    expect(window.history.length).toBe(before);
  });

  it('still knows the collection is behind a game that was reloaded', async () => {
    window.history.replaceState(null, '', '/simple-games/play/');
    startRoute(null);
    pushRoute('sudoku');

    const reloaded = await reload();
    reloaded.startRoute('sudoku');
    const back = vi.spyOn(window.history, 'back');
    reloaded.popRoute();

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('still knows nothing is behind an address that was arrived at and reloaded', async () => {
    window.history.replaceState(null, '', '/simple-games/play/?game=sudoku');
    startRoute('sudoku');

    const reloaded = await reload();
    reloaded.startRoute('sudoku');
    const back = vi.spyOn(window.history, 'back');
    reloaded.popRoute();

    expect(back).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });
});
