import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GAMES } from '../../app/registry';
import { ShareGameArtwork } from './ShareGameArtwork';

afterEach(cleanup);

describe('share game introductions', () => {
  it('can introduce every registered game without an external image or a game engine', () => {
    for (const game of GAMES) {
      const { container, unmount } = render(<ShareGameArtwork id={game.id} />);
      const svg = container.firstElementChild;
      expect(svg?.getAttribute('viewBox'), game.id).toBe('0 0 480 360');
      expect(svg?.getAttribute('aria-hidden'), game.id).toBe('true');
      expect(container.querySelector('image, script, foreignObject, use, a'), game.id).toBeNull();
      expect(container.querySelector('[href], [style]'), game.id).toBeNull();
      expect(container.querySelector('path, rect, circle'), game.id).not.toBeNull();
      unmount();
    }
  });

  it('uses dedicated unframed scenes where the shelf mark does not explain play', () => {
    for (const id of ['crown-grid', 'river-cargo', 'sudoku', 'number-path'] as const) {
      const { container, unmount } = render(<ShareGameArtwork id={id} />);
      expect(container.querySelector('.game-artwork'), id).toBeNull();
      // Scene drawings remain language-neutral; only actual puzzle digits
      // are drawn. All translated invitation and caption copy is outside.
      for (const text of container.querySelectorAll('text')) {
        expect(text.textContent, id).toMatch(/^[1-9]$/);
      }
      unmount();
    }
  });
});
