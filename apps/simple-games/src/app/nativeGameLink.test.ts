import { describe, expect, it } from 'vitest';
import { nativeGameTarget } from './nativeGameLink';

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
