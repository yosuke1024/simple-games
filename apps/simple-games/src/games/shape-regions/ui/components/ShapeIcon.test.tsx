/**
 * The placed-shape math (docs/SHAPE_REGIONS_RULES.md §5): once a region
 * satisfies its clue, `ShapeIcon` draws that region's own cells with the
 * longer side of its bounding box filling the 16-unit viewBox and the
 * shorter side centred in it. Pins the [row, col] → [y, x] mapping and the
 * centering arithmetic, so a swapped row/column, or a dropped `normalize` /
 * short-axis centering step, fails a test instead of just still passing a
 * bare rect count.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ShapeIcon } from './ShapeIcon';

afterEach(cleanup);

const rectsOf = (container: HTMLElement): { x: number; y: number }[] =>
  Array.from(container.querySelectorAll('rect')).map((rect) => ({
    x: Number(rect.getAttribute('x')),
    y: Number(rect.getAttribute('y')),
  }));

const UNIT_6 = 16 / 6;
const INSET_6 = 0.4; // REAL_INSET_BY_SIZE[6]

describe('ShapeIcon places a region’s own cells (§5)', () => {
  it('lays a 1×6 line flat: one row, six increasing x, a single centred y', () => {
    const cells = [0, 1, 2, 3, 4, 5].map((col) => [0, col] as const);
    const { container } = render(<ShapeIcon category="line" cells={cells} />);
    const rects = rectsOf(container);
    expect(rects).toHaveLength(6);
    const expectedY = (16 - UNIT_6) / 2 + INSET_6; // short axis (1 row) centred
    for (const { y } of rects) expect(y).toBeCloseTo(expectedY, 5);
    expect(rects[0]!.x).toBeCloseTo(INSET_6, 5);
    expect(rects[5]!.x).toBeCloseTo(5 * UNIT_6 + INSET_6, 5);
    const xs = rects.map((r) => r.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it('lays a 6×1 line upright — the transpose of the 1×6 case', () => {
    const cells = [0, 1, 2, 3, 4, 5].map((row) => [row, 0] as const);
    const { container } = render(<ShapeIcon category="line" cells={cells} />);
    const rects = rectsOf(container);
    expect(rects).toHaveLength(6);
    const expectedX = (16 - UNIT_6) / 2 + INSET_6; // short axis (1 col) centred
    for (const { x } of rects) expect(x).toBeCloseTo(expectedX, 5);
    expect(rects[0]!.y).toBeCloseTo(INSET_6, 5);
    expect(rects[5]!.y).toBeCloseTo(5 * UNIT_6 + INSET_6, 5);
    const ys = rects.map((r) => r.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('centres a 2×3 block’s shorter axis (rows) inside the square viewBox', () => {
    const cells: (readonly [number, number])[] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ];
    const { container } = render(<ShapeIcon category="block" cells={cells} />);
    const rects = rectsOf(container);
    expect(rects).toHaveLength(6);
    const unit = 16 / 3; // the longer axis (3 cols) fills the viewBox
    const offsetY = ((3 - 2) * unit) / 2; // the 2-row axis is centred
    // Rects are rendered in cell order, so 0–2 are row 0 and 3–5 are row 1.
    for (const rect of rects.slice(0, 3)) expect(rect.y).toBeCloseTo(offsetY + INSET_6, 5);
    for (const rect of rects.slice(3, 6)) {
      expect(rect.y).toBeCloseTo(unit + offsetY + INSET_6, 5);
    }
    expect(rects[0]!.x).toBeCloseTo(INSET_6, 5);
    expect(rects[1]!.x).toBeCloseTo(unit + INSET_6, 5);
    expect(rects[2]!.x).toBeCloseTo(2 * unit + INSET_6, 5);
  });
});
