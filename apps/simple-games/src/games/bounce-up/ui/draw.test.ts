/**
 * The board's geometry (docs/BOUNCE_UP_RULES.md §2, §7): heights map to the
 * board with the camera, the best line sits at best × 10 px, a body across
 * an edge is drawn on both sides, and the three platform kinds are drawn as
 * three different silhouettes — read here from the drawing calls each makes,
 * because colour must never be the only difference (§7「足場の見分け」).
 */
import { describe, expect, it } from 'vitest';
import { BOARD_HEIGHT_PX, SUB } from '../game/constants';
import { createRun } from '../game/physics';
import { drawPlatform, drawRun, screenY, wrappedCentres, type Palette } from './draw';

const palette: Palette = {
  surface: 's',
  line: 'l',
  ink: 'i',
  inkSoft: 'k',
  accent: 'a',
  accentSoft: 'f',
};

/** A 2D context that records the calls a drawing makes, by name. */
function recorder() {
  const calls: string[] = [];
  const dashes: number[][] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (prop === 'setLineDash') {
          return (segments: number[]) => {
            dashes.push(segments);
            calls.push('setLineDash');
          };
        }
        return (..._args: unknown[]) => {
          calls.push(prop);
        };
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, dashes };
}

describe('draw', () => {
  it('maps a height to the board with the camera: the floor 96 px above the bottom at the start', () => {
    const run = createRun('draw', 'normal');
    expect(screenY(0, run.cameraBottom)).toBe(BOARD_HEIGHT_PX - 96);
    expect(screenY(100 * SUB, 0)).toBe(BOARD_HEIGHT_PX - 100);
  });

  it('draws a body across an edge on both sides, and one in the middle once', () => {
    expect(wrappedCentres(180)).toEqual([180]);
    expect(wrappedCentres(4)).toEqual([4, 364]);
    expect(wrappedCentres(356)).toEqual([356, -4]);
  });

  it('gives the three kinds three silhouettes: filled, edged with end marks, dashed outline', () => {
    const kinds = (['static', 'moving', 'vanishing'] as const).map((kind) => {
      const r = recorder();
      drawPlatform(r.ctx, palette, kind, 10, 100, 64);
      return r;
    });
    const [still, moving, vanishing] = kinds;
    expect(still!.calls).toContain('fill');
    expect(still!.calls).not.toContain('stroke');
    expect(moving!.calls.filter((c) => c === 'fill')).toHaveLength(2);
    expect(moving!.calls).toContain('stroke');
    expect(vanishing!.calls).not.toContain('fill');
    expect(vanishing!.dashes[0]!.length).toBeGreaterThan(0);
  });

  it('draws the best line only when there is a best', () => {
    const run = createRun('draw', 'normal');
    const without = recorder();
    drawRun(without.ctx, palette, run, { bestScore: 0, squash: false });
    const withBest = recorder();
    drawRun(withBest.ctx, palette, run, { bestScore: 20, squash: false });
    expect(without.dashes).toHaveLength(0);
    expect(withBest.dashes.some((d) => d.length > 0)).toBe(true);
  });
});
