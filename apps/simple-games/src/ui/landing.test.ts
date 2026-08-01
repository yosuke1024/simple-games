import { describe, expect, it } from 'vitest';
import { gameLandingUrl } from './landing';

describe('gameLandingUrl', () => {
  it('links to the page in the reader’s language when one is written', () => {
    expect(gameLandingUrl('sudoku', 'ja')).toBe(
      'https://pixapps.ai/simple-games/games/sudoku/ja/',
    );
    expect(gameLandingUrl('nonogram', 'en')).toBe(
      'https://pixapps.ai/simple-games/games/nonogram/en/',
    );
    expect(gameLandingUrl('sliding-puzzle', 'es')).toBe(
      'https://pixapps.ai/simple-games/games/sliding-puzzle/es/',
    );
  });

  it('falls back to English rather than pointing at a page that does not exist', () => {
    // The app ships fourteen locales; only some of them have written pages.
    for (const locale of ['th', 'zh-hant', 'pt-br', 'tr']) {
      expect(gameLandingUrl('minesweeper', locale)).toBe(
        'https://pixapps.ai/simple-games/games/minesweeper/en/',
      );
    }
  });

  it('covers every game in the collection', () => {
    for (const id of ['sudoku', 'minesweeper', 'nonogram', 'number-match', 'sliding-puzzle']) {
      expect(gameLandingUrl(id, 'en')).toBe(`https://pixapps.ai/simple-games/games/${id}/en/`);
    }
  });
});
