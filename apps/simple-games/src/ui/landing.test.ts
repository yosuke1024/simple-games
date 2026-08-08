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
  });

  it('falls back to English rather than pointing at a page that does not exist', () => {
    // The app ships fourteen locales; only some of them have written pages.
    for (const locale of ['th', 'zh-hant', 'pt-br', 'tr']) {
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
    ]) {
      expect(gameLandingUrl(id, 'en')).toBe(`https://pixapps.ai/simple-games/games/${id}/en/`);
    }
  });

  it('offers no link for a title that is not in the published list', () => {
    // Every shipped title has a guide today, so this exercises the mechanism
    // with a future id: a title that ships before its guide is written gets
    // null, which keeps the tutorial's last screen from ending in a 404. The
    // button appears in the release after its pages go up.
    expect(gameLandingUrl('some-future-game', 'en')).toBeNull();
    expect(gameLandingUrl('some-future-game', 'ja')).toBeNull();
  });
});
