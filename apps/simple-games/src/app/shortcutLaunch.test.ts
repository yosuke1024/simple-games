/**
 * How a home-screen shortcut names a game, and how boot reads it back — an
 * Android pinned shortcut (issue #110) and an iOS quick action (issue #114)
 * alike. The address is the browser's own `?game=` contract, so the two
 * things pinned here are that the builder and the parser agree for every game
 * in the registry, and that nothing is read in the browser — the web is
 * unchanged by either feature, and that has to be a fact about the code
 * rather than about which plugins happen to answer.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, appMock } = vi.hoisted(() => ({
  capacitorMock: { platform: 'android' },
  appMock: { getLaunchUrl: vi.fn<() => Promise<{ url: string } | undefined>>() },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => capacitorMock.platform,
    isNativePlatform: () => capacitorMock.platform !== 'web',
  },
}));
vi.mock('@capacitor/app', () => ({ App: appMock }));

import { WEB_PLAY_URL } from '@simple-games/brand';
import { GAMES } from './registry';
import {
  gameIdFromShortcutUrl,
  initShortcutLaunch,
  resetShortcutLaunchForTesting,
  shortcutLaunchGame,
  shortcutUrlFor,
} from './shortcutLaunch';

beforeEach(() => {
  capacitorMock.platform = 'android';
  appMock.getLaunchUrl.mockReset().mockResolvedValue(undefined);
  resetShortcutLaunchForTesting();
});

describe('the address a shortcut carries', () => {
  it('is the browser version’s own address for the game', () => {
    expect(shortcutUrlFor('sudoku')).toBe(`${WEB_PLAY_URL}?game=sudoku`);
    expect(shortcutUrlFor('sudoku')).toBe('https://pixapps.ai/simple-games/play/?game=sudoku');
  });

  it('reads back to the same game for every title in the collection', () => {
    for (const game of GAMES) {
      expect(gameIdFromShortcutUrl(shortcutUrlFor(game.id)), game.id).toBe(game.id);
    }
  });

  it.each([
    ['an id this build does not carry', `${WEB_PLAY_URL}?game=retired-game`],
    ['an empty id', `${WEB_PLAY_URL}?game=`],
    ['the plain play address', WEB_PLAY_URL],
    ['something that is not an address', 'not a url'],
    ['no url at all', ''],
  ])('means the collection for %s', (_case, url) => {
    expect(gameIdFromShortcutUrl(url)).toBeNull();
  });

  it('means the collection for a launch with no URL', () => {
    expect(gameIdFromShortcutUrl(undefined)).toBeNull();
    expect(gameIdFromShortcutUrl(null)).toBeNull();
  });
});

describe('reading the launch at boot', () => {
  it('remembers the game the launch Intent named', async () => {
    appMock.getLaunchUrl.mockResolvedValue({ url: shortcutUrlFor('kakuro') });
    await initShortcutLaunch();
    expect(shortcutLaunchGame()).toBe('kakuro');
  });

  it('answers null for an ordinary launch, with no Intent data', async () => {
    await initShortcutLaunch();
    expect(shortcutLaunchGame()).toBeNull();
    expect(appMock.getLaunchUrl).toHaveBeenCalledTimes(1);
  });

  // A shortcut outlives the build that made it: a game withdrawn later must
  // land its old shortcut on the collection, not on an error.
  it('answers null for a shortcut to a game this build no longer carries', async () => {
    appMock.getLaunchUrl.mockResolvedValue({ url: `${WEB_PLAY_URL}?game=retired-game` });
    await initShortcutLaunch();
    expect(shortcutLaunchGame()).toBeNull();
  });

  it('forgets the previous launch before reading the next', async () => {
    appMock.getLaunchUrl.mockResolvedValue({ url: shortcutUrlFor('sudoku') });
    await initShortcutLaunch();
    appMock.getLaunchUrl.mockResolvedValue(undefined);
    await initShortcutLaunch();
    expect(shortcutLaunchGame()).toBeNull();
  });

  it('never rejects: a plugin that fails is an ordinary launch', async () => {
    appMock.getLaunchUrl.mockRejectedValue(new Error('no bridge'));
    await expect(initShortcutLaunch()).resolves.toBeUndefined();
    expect(shortcutLaunchGame()).toBeNull();
  });

  // The same plugin call, fed by AppDelegate.swift from the tapped quick
  // action's address instead of by the launcher's Intent (issue #114).
  it('reads the launch on iOS too, where a quick action carries the same address', async () => {
    capacitorMock.platform = 'ios';
    appMock.getLaunchUrl.mockResolvedValue({ url: shortcutUrlFor('freecell') });
    await initShortcutLaunch();
    expect(shortcutLaunchGame()).toBe('freecell');
  });

  it('asks nothing in the browser, where no shortcut can exist', async () => {
    capacitorMock.platform = 'web';
    await initShortcutLaunch();
    expect(appMock.getLaunchUrl).not.toHaveBeenCalled();
    expect(shortcutLaunchGame()).toBeNull();
  });
});
