import { beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom is the browser; a test that needs an app says which one.
const { capacitorMock } = vi.hoisted(() => ({ capacitorMock: { platform: 'web' } }));
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => capacitorMock.platform !== 'web',
      getPlatform: () => capacitorMock.platform,
    },
  };
});

import { nativeGameTarget } from './nativeGameLink';

beforeEach(() => {
  capacitorMock.platform = 'web';
});

describe('native game links', () => {
  it.each([
    'https://pixapps.ai/simple-games/share/sudoku/',
    'https://pixapps.ai/simple-games/share/sudoku',
    'com.pixapps.simplegames://share/sudoku',
    'https://pixapps.ai/simple-games/play/?game=sudoku',
  ])('opens the same game from %s', (url) => {
    expect(nativeGameTarget(url)).toEqual({ gameId: 'sudoku' });
  });

  it.each([
    'https://pixapps.ai/simple-games/share/new-game/',
    'https://pixapps.ai/simple-games/share/falling-blocks/',
    'https://pixapps.ai/simple-games/share/',
    'com.pixapps.simplegames://share/marble-weave',
  ])('falls back to the collection for an unavailable target: %s', (url) => {
    expect(nativeGameTarget(url)).toEqual({ gameId: null });
  });

  it.each([
    undefined,
    '',
    'not a URL',
    'http://pixapps.ai/simple-games/share/sudoku/',
    'https://evil.example/simple-games/share/sudoku/',
    'https://pixapps.ai.evil.example/simple-games/share/sudoku/',
    'https://pixapps.ai@evil.example/simple-games/share/sudoku/',
    'https://evil@pixapps.ai/simple-games/share/sudoku/',
    'https://pixapps.ai:8080/simple-games/share/sudoku/',
    'https://pixapps.ai/simple-games/?game=sudoku',
    'https://pixapps.ai/simple-games/shareevil/sudoku/',
    'https://pixapps.ai/simple-games/share/sudoku/nested/',
    'https://pixapps.ai/simple-games/share/%2fsudoku/',
    'https://pixapps.ai/simple-games/share/sudoku/?game=minesweeper',
    'https://pixapps.ai/simple-games/share/sudoku/#invite=untrusted',
    'https://pixapps.ai/simple-games/play/?game=sudoku&game=solitaire',
    'com.pixapps.simplegames://other/sudoku',
    'com.pixapps.simplegames://share/sudoku/extra',
    'https://club.pixapps.ai/join?game=sudoku',
  ])('ignores unrelated, malformed or ambiguous URLs: %s', (url) => {
    expect(nativeGameTarget(url)).toBeNull();
  });
});

/**
 * A title the iOS app leaves out (app/iosWithheldGames.ts) is a trusted link
 * to a game this app does not have: the iOS app opens the collection for it,
 * exactly as for a retired id, while Android opens the game.
 */
describe('links to a title the iOS app leaves out', () => {
  const links = [
    ['https://pixapps.ai/simple-games/share/blackjack/', 'blackjack'],
    ['https://pixapps.ai/simple-games/share/texas-holdem/', 'texas-holdem'],
    ['com.pixapps.simplegames://share/texas-holdem', 'texas-holdem'],
    ['com.pixapps.simplegames://share/blackjack', 'blackjack'],
    ['https://pixapps.ai/simple-games/play/?game=blackjack', 'blackjack'],
    ['https://pixapps.ai/simple-games/play/?game=texas-holdem', 'texas-holdem'],
  ] as const;

  it.each(links)('open the collection on iOS: %s', (url) => {
    capacitorMock.platform = 'ios';
    expect(nativeGameTarget(url)).toEqual({ gameId: null });
  });

  it.each(links)('open the game on Android: %s', (url, id) => {
    capacitorMock.platform = 'android';
    expect(nativeGameTarget(url)).toEqual({ gameId: id });
  });

  it('leave the other titles alone on iOS', () => {
    capacitorMock.platform = 'ios';
    expect(nativeGameTarget('https://pixapps.ai/simple-games/share/sudoku/')).toEqual({
      gameId: 'sudoku',
    });
    expect(nativeGameTarget('com.pixapps.simplegames://share/hearts')).toEqual({
      gameId: 'hearts',
    });
  });
});
