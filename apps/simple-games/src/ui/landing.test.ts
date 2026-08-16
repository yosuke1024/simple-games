import { describe, expect, it } from 'vitest';
import { gameLandingUrl } from './landing';

describe('gameLandingUrl', () => {
  it('links to the page in the reader’s language when one is written', () => {
    expect(gameLandingUrl('sudoku', 'ja')).toBe('https://pixapps.ai/simple-games/games/sudoku/ja/');
    expect(gameLandingUrl('nonogram', 'en')).toBe(
      'https://pixapps.ai/simple-games/games/nonogram/en/',
    );
    expect(gameLandingUrl('sliding-puzzle', 'es')).toBe(
      'https://pixapps.ai/simple-games/games/sliding-puzzle/es/',
    );
    expect(gameLandingUrl('block-puzzle', 'pt-br')).toBe(
      'https://pixapps.ai/simple-games/games/block-puzzle/pt-br/',
    );
    expect(gameLandingUrl('gomoku', 'fr')).toBe(
      'https://pixapps.ai/simple-games/games/gomoku/fr/',
    );
    expect(gameLandingUrl('kakuro', 'th')).toBe(
      'https://pixapps.ai/simple-games/games/kakuro/th/',
    );
    expect(gameLandingUrl('water-sort', 'vi')).toBe(
      'https://pixapps.ai/simple-games/games/water-sort/vi/',
    );
    expect(gameLandingUrl('solitaire', 'ko')).toBe(
      'https://pixapps.ai/simple-games/games/solitaire/ko/',
    );
  });

  it('falls back to English rather than pointing at a page that does not exist', () => {
    // The app ships fourteen locales; only some of them have written pages.
    for (const locale of ['zh-hant', 'hi', 'tr']) {
      expect(gameLandingUrl('minesweeper', locale)).toBe(
        'https://pixapps.ai/simple-games/games/minesweeper/en/',
      );
    }
  });

  it('links every game whose guide is published', () => {
    // Every id here must have a published guide on the landing site, in every
    // PAGE_LOCALES language — this list is what stops a "Learn More" button
    // from being wired up before the page it points at exists.
    for (const id of [
      'sudoku',
      'minesweeper',
      'nonogram',
      'number-match',
      'sliding-puzzle',
      'solitaire',
      'brick-breaker',
      'water-sort',
      'memory-match',
      'sky-fighter',
      'spider-solitaire',
      'freecell',
      '2048',
      'block-puzzle',
      'checkers',
      'reversi',
      'connect-four',
      'gomoku',
      'quick-math',
      'schulte-table',
      'number-recall',
      'bunny-hop',
      'hearts',
      'gin-rummy',
      'mahjong-solitaire',
      'ludo',
      'bubble-pop',
      'takuzu',
      'futoshiki',
      'kakuro',
    ]) {
      expect(gameLandingUrl(id, 'en')).toBe(`https://pixapps.ai/simple-games/games/${id}/en/`);
    }
  });

  it('offers no link for a game whose guide is not written yet', () => {
    // Every shipped title has a guide now, so the mechanism is exercised with
    // an id that is not a game at all: returning null is what keeps a future
    // title's tutorial from ending in a 404 before its pages go up.
    expect(gameLandingUrl('some-future-game', 'en')).toBeNull();
    expect(gameLandingUrl('some-future-game', 'ja')).toBeNull();
  });
});
