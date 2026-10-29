/**
 * One gem is three paths, back to front (docs/GEM_SWAP_RULES.md §10): the
 * shadow it casts, its outline, and the facet. The shadow is the outline's own
 * path — pushed down by CSS, never blurred — so every cut casts the shadow of
 * its own shape, and the decoration stays out of the spoken board
 * (`aria-hidden`, no focus).
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GEM_SHAPES } from '../game';
import { GemIcon } from './components/GemIcon';

afterEach(cleanup);

describe('GemIcon (§10)', () => {
  for (const [kind, shape] of GEM_SHAPES.entries()) {
    it(`draws the ${shape} as its shadow, its outline and its facet`, () => {
      const { container } = render(<GemIcon kind={kind} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('focusable')).toBe('false');
      const paths = [...svg.querySelectorAll('path')];
      expect(paths.map((path) => path.getAttribute('class'))).toEqual([
        'gs-gem-shade',
        'gs-gem-body',
        'gs-gem-facet',
      ]);
      // The same shape, so the shadow is the cut's own and not a generic blob.
      expect(paths[0]!.getAttribute('d')).toBe(paths[1]!.getAttribute('d'));
      expect(paths[2]!.getAttribute('d')).not.toBe(paths[1]!.getAttribute('d'));
    });
  }

  it('draws nothing for a kind that is not a cut', () => {
    const { container } = render(<GemIcon kind={6} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
