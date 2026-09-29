/**
 * The clue badge of docs/BOX_REGIONS_RULES.md §2 and §13: one SVG per clue,
 * the kind as the badge's proportion, the number inside it, and `free` as a
 * dashed wide-and-tall pair with a solid centre.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SHAPE_KINDS } from '../../game';
import { ClueBadge } from './ClueBadge';

afterEach(cleanup);

const badge = (kind: (typeof SHAPE_KINDS)[number], size: number | null) => {
  const { container } = render(<ClueBadge kind={kind} size={size} />);
  return container.querySelector('svg')!;
};

describe('the clue badge (§2, §13)', () => {
  it('is a silent picture that names its kind, with the number as ASCII digits inside', () => {
    for (const kind of SHAPE_KINDS) {
      const svg = badge(kind, 12);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('data-kind')).toBe(kind);
      expect(svg.querySelector('text')?.textContent).toBe('12');
      cleanup();
    }
  });

  it('draws nothing but the shape for a kind-only clue', () => {
    for (const kind of SHAPE_KINDS) {
      expect(badge(kind, null).querySelector('text')).toBeNull();
      cleanup();
    }
  });

  it('draws square as square, tall as taller, wide as wider — one solid badge each', () => {
    const size = (kind: 'square' | 'tall' | 'wide') => {
      const svg = badge(kind, 4);
      const solid = svg.querySelectorAll('.br-badge-fill');
      expect(solid).toHaveLength(1);
      expect(svg.querySelectorAll('.br-badge-dash')).toHaveLength(0);
      const rect = solid[0]!;
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

  it('draws free as a dashed wide and a dashed tall outline crossing at a solid square', () => {
    const svg = badge('free', 3);
    const dashes = [...svg.querySelectorAll('.br-badge-dash')];
    expect(dashes).toHaveLength(2);
    const wider = dashes.map(
      (rect) => Number(rect.getAttribute('width')) > Number(rect.getAttribute('height')),
    );
    // One wider than tall, one taller than wide.
    expect(wider.sort()).toEqual([false, true]);
    const centre = svg.querySelector('.br-badge-fill')!;
    expect(centre.getAttribute('width')).toBe(centre.getAttribute('height'));
  });
});
