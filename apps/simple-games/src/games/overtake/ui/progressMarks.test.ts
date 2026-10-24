/**
 * The progress strip's rings (docs/OVERTAKE_RULES.md §11「着順と進行バー」):
 * never covering one another, in course order, on the track, and moved no
 * more than the crowding needs.
 */
import { describe, expect, it } from 'vitest';
import { RIVAL_MARK_PX, spreadMarks } from './progressMarks';

const GAP = RIVAL_MARK_PX;

function minGap(xs: readonly number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  let gap = Infinity;
  for (let i = 1; i < sorted.length; i++) gap = Math.min(gap, sorted[i]! - sorted[i - 1]!);
  return gap;
}

describe('spreadMarks', () => {
  it('leaves marks that are already apart where they are', () => {
    expect(spreadMarks([10, 60, 120], 166, GAP)).toEqual([10, 60, 120]);
  });

  it('spreads a start where all three are level, in digit order, from the track start', () => {
    expect(spreadMarks([0, 0, 0], 166, GAP)).toEqual([0, 16, 32]);
  });

  it('spreads a finish at the far end without leaving the track', () => {
    expect(spreadMarks([166, 166, 166], 166, GAP)).toEqual([134, 150, 166]);
  });

  it('centres a bunch in the middle on where its members want to be', () => {
    const xs = spreadMarks([80, 82, 84], 166, GAP);
    expect(xs).toEqual([66, 82, 98]);
  });

  it('keeps course order: the one ahead stays ahead', () => {
    const xs = spreadMarks([90, 85, 88], 166, GAP);
    expect(xs[1]!).toBeLessThan(xs[2]!);
    expect(xs[2]!).toBeLessThan(xs[0]!);
    expect(minGap(xs)).toBeGreaterThanOrEqual(GAP - 1e-9);
  });

  it('merges a pair that its spreading pushes into a third', () => {
    // 50 and 52 spread to 43 and 59 — into 64's way; all three become one bunch.
    const xs = spreadMarks([50, 52, 64], 166, GAP);
    expect(minGap(xs)).toBeGreaterThanOrEqual(GAP - 1e-9);
    expect(xs[0]!).toBeLessThan(xs[1]!);
    expect(xs[1]!).toBeLessThan(xs[2]!);
  });

  it('never lets two rings overlap, on any spread of progress, on a narrow or a wide track', () => {
    for (const width of [120, 166, 240]) {
      for (let a = 0; a <= 100; a += 7) {
        for (let b = 0; b <= 100; b += 5) {
          for (let c = 0; c <= 100; c += 9) {
            const xs = spreadMarks(
              [a, b, c].map((p) => (p / 100) * width),
              width,
              GAP,
            );
            expect(minGap(xs)).toBeGreaterThanOrEqual(GAP - 1e-9);
            for (const x of xs) {
              expect(x).toBeGreaterThanOrEqual(0);
              expect(x).toBeLessThanOrEqual(width + 1e-9);
            }
          }
        }
      }
    }
  });
});
