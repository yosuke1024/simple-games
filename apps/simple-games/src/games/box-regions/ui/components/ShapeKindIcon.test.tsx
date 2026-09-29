/**
 * The four kind symbols of docs/BOX_REGIONS_RULES.md §2 and §13: inline SVG
 * outlines, no text, and each kind drawn in its own proportion.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SHAPE_KINDS } from '../../game';
import { ShapeKindIcon } from './ShapeKindIcon';

afterEach(cleanup);

const outline = (kind: (typeof SHAPE_KINDS)[number]) => {
  const { container } = render(<ShapeKindIcon kind={kind} />);
  return container.querySelector('svg')!;
};

describe('kind symbols (§13)', () => {
  it('draws every kind as a silent, text-free SVG', () => {
    for (const kind of SHAPE_KINDS) {
      const svg = outline(kind);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('data-kind')).toBe(kind);
      expect(svg.textContent).toBe('');
      cleanup();
    }
  });

  it('draws square as square, tall as taller, wide as wider', () => {
    const size = (kind: 'square' | 'tall' | 'wide') => {
      const rect = outline(kind).querySelector('rect')!;
      const result = [Number(rect.getAttribute('width')), Number(rect.getAttribute('height'))];
      cleanup();
      return result as [number, number];
    };
    const [sw, sh] = size('square');
    expect(sw).toBe(sh);
    const [tw, th] = size('tall');
    expect(th).toBeGreaterThan(tw);
    const [ww, wh] = size('wide');
    expect(ww).toBeGreaterThan(wh);
  });

  it('draws free as two opposite corners and no outline', () => {
    const svg = outline('free');
    expect(svg.querySelector('rect')).toBeNull();
    expect(svg.querySelectorAll('path')).toHaveLength(2);
  });
});
