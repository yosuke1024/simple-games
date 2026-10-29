/**
 * The board's geometry (docs/BOUNCE_UP_RULES.md §2, §7): heights map to the
 * board with the camera, the best line sits at best × 10 px, a body across
 * an edge is drawn on both sides, and the three platform kinds are drawn as
 * three different silhouettes — read here from the drawing calls each makes,
 * because colour must never be the only difference (§7「足場の見分け」). The
 * paper foot under a cloud and the body's weight are pinned here too: where
 * they are drawn, and that they never move the landing line or the foot.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_HEIGHT_PX, JUMP_SPEED, SUB } from '../game/constants';
import { createRun } from '../game/physics';
import {
  PLATFORM_LIFT,
  REST,
  SETTLE_STEPS,
  bodyScale,
  drawBody,
  drawPlatform,
  drawRun,
  screenY,
  weightOf,
  wrappedCentres,
  type Palette,
} from './draw';

const palette: Palette = {
  surface: 's',
  line: 'l',
  ink: 'i',
  inkSoft: 'k',
  accent: 'a',
  accentSoft: 'f',
};

/**
 * A 2D context that records the calls a drawing makes, by name, plus the
 * colour each `fill` was made in, the y of every point of every path (a path
 * starts at `beginPath`), and the arguments of `fillRect`.
 */
function recorder() {
  const calls: string[] = [];
  const dashes: number[][] = [];
  const fills: unknown[] = [];
  const paths: number[][] = [];
  const rects: number[][] = [];
  const state: Record<string, unknown> = {};
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
        return (...args: number[]) => {
          calls.push(prop);
          if (prop === 'fill') fills.push(state.fillStyle);
          if (prop === 'beginPath') paths.push([]);
          if (prop === 'moveTo' || prop === 'lineTo') paths[paths.length - 1]?.push(args[1]!);
          if (prop === 'quadraticCurveTo') paths[paths.length - 1]?.push(args[1]!, args[3]!);
          if (prop === 'fillRect') rects.push(args);
        };
      },
      set: (_target, prop: string, value: unknown) => {
        state[prop] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, dashes, fills, paths, rects };
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
    // The foot, the cloud, and the two end marks in one fill.
    expect(moving!.calls.filter((c) => c === 'fill')).toHaveLength(3);
    expect(moving!.calls).toContain('stroke');
    expect(vanishing!.calls).not.toContain('fill');
    expect(vanishing!.dashes[0]!.length).toBeGreaterThan(0);
  });

  it('draws the best line only when there is a best', () => {
    const run = createRun('draw', 'normal');
    const without = recorder();
    drawRun(without.ctx, palette, run, { bestScore: 0, scale: REST });
    const withBest = recorder();
    drawRun(withBest.ctx, palette, run, { bestScore: 20, scale: REST });
    expect(without.dashes).toHaveLength(0);
    expect(withBest.dashes.some((d) => d.length > 0)).toBe(true);
  });
});

describe('the paper foot (§7)', () => {
  const draw = (kind: 'static' | 'moving' | 'vanishing') => {
    const r = recorder();
    drawPlatform(r.ctx, palette, kind, 10, 100, 64);
    return r;
  };

  it('stands static and moving clouds on a line-coloured foot drawn first, and gives vanishing none', () => {
    // static: foot, cloud. moving: foot, cloud, end marks. vanishing: nothing filled.
    expect(draw('static').fills).toEqual([palette.line, palette.accent]);
    expect(draw('moving').fills).toEqual([palette.line, palette.accentSoft, palette.ink]);
    expect(draw('vanishing').fills).toEqual([]);
    // The paths behind those fills: static foot + cloud, moving foot + cloud + marks, vanishing its outline alone.
    expect(draw('static').paths).toHaveLength(2);
    expect(draw('moving').paths).toHaveLength(3);
    expect(draw('vanishing').paths).toHaveLength(1);
  });

  it('draws the foot lower than the cloud, so the landing line stays the cloud’s top edge', () => {
    for (const kind of ['static', 'moving'] as const) {
      const { paths } = draw(kind);
      const [foot, cloud] = paths;
      expect(Math.min(...foot!)).toBe(100 + PLATFORM_LIFT);
      expect(Math.min(...cloud!)).toBe(100);
      // Only the rim below shows: the foot reaches the same distance lower.
      expect(Math.max(...foot!) - Math.max(...cloud!)).toBe(PLATFORM_LIFT);
    }
  });

  it('is 3 logical px, about the 2 CSS px lift of a shared key at the web board’s scale', () => {
    expect(PLATFORM_LIFT).toBe(3);
  });
});

describe('the body’s weight (§7)', () => {
  it('is flat at a landing: 0.8 tall and wider by 1/√0.8', () => {
    const at = bodyScale(0, JUMP_SPEED);
    expect(at.sy).toBeCloseTo(0.8, 10);
    expect(at.sx).toBeCloseTo(1 / Math.sqrt(0.8), 10);
  });

  it('is exactly REST at the top of the arc once settled, and for a body that never bounced', () => {
    expect(bodyScale(SETTLE_STEPS, 0)).toEqual(REST);
    expect(bodyScale(SETTLE_STEPS + 50, 0)).toEqual(REST);
    expect(bodyScale(Number.POSITIVE_INFINITY, 0)).toEqual(REST);
  });

  it('settles in SETTLE_STEPS, rising monotonically from the squash to the stretch the speed asks for', () => {
    expect(SETTLE_STEPS).toBe(12);
    let last = 0;
    for (let since = 0; since <= SETTLE_STEPS; since++) {
      const { sy } = bodyScale(since, JUMP_SPEED);
      expect(sy).toBeGreaterThan(last);
      last = sy;
    }
    expect(bodyScale(SETTLE_STEPS, JUMP_SPEED).sy).toBeCloseTo(1.08, 10);
    // A body that never bounced is drawn at its speed alone.
    expect(bodyScale(Number.POSITIVE_INFINITY, JUMP_SPEED).sy).toBeCloseTo(1.08, 10);
  });

  it('stretches the same going up and coming down, and not past JUMP_SPEED', () => {
    const up = bodyScale(SETTLE_STEPS, JUMP_SPEED / 2);
    const down = bodyScale(SETTLE_STEPS, -JUMP_SPEED / 2);
    expect(up).toEqual(down);
    expect(up.sy).toBeCloseTo(1.04, 10);
    expect(bodyScale(SETTLE_STEPS, -3 * JUMP_SPEED).sy).toBeCloseTo(1.08, 10);
  });

  it('keeps its volume (width² × height = 1) and stays inside the old squash’s width', () => {
    for (let since = 0; since <= SETTLE_STEPS; since++) {
      for (const vy of [-2 * JUMP_SPEED, -JUMP_SPEED / 3, 0, JUMP_SPEED / 2, JUMP_SPEED]) {
        const { sx, sy } = bodyScale(since, vy);
        expect(sx * sx * sy).toBeCloseTo(1, 10);
        expect(sx).toBeGreaterThan(0.95);
        expect(sx).toBeLessThan(1.14);
      }
    }
  });

  it('never reads a negative time as a stronger squash than a landing', () => {
    expect(bodyScale(-5, JUMP_SPEED)).toEqual(bodyScale(0, JUMP_SPEED));
  });

  it('is drawn on its foot: the lowest point of the body is `foot` at every weight', () => {
    for (const scale of [REST, bodyScale(0, JUMP_SPEED), bodyScale(SETTLE_STEPS, JUMP_SPEED)]) {
      const r = recorder();
      drawBody(r.ctx, palette, 100, 300, scale);
      const [body] = r.paths;
      expect(Math.max(...body!)).toBe(300);
      // Taller means higher above the foot, never lower.
      expect(Math.min(...body!)).toBeCloseTo(300 - 28 * scale.sy, 10);
    }
  });

  it('puts the eyes where they were at rest, and moves them out with the width', () => {
    const rest = recorder();
    drawBody(rest.ctx, palette, 100, 300, REST);
    expect(rest.rects.map((r) => r[0])).toEqual([93, 103]);
    const flat = bodyScale(0, JUMP_SPEED);
    const wide = recorder();
    drawBody(wide.ctx, palette, 100, 300, flat);
    expect(wide.rects.map((r) => r[0])).toEqual([100 - 7 * flat.sx, 100 + 3 * flat.sx]);
  });

  it('is REST under Reduced Motion at any time and speed, and bodyScale otherwise', () => {
    // The flattening and the stretch are the two motions this view adds (§7);
    // the board asks for its weight only through this, so both stop together.
    expect(weightOf(true, 0, JUMP_SPEED)).toEqual(REST);
    expect(weightOf(true, 3, -JUMP_SPEED)).toEqual(REST);
    expect(weightOf(true, SETTLE_STEPS, JUMP_SPEED)).toEqual(REST);
    expect(weightOf(false, 0, JUMP_SPEED)).toEqual(bodyScale(0, JUMP_SPEED));
    expect(weightOf(false, 5, JUMP_SPEED / 2)).toEqual(bodyScale(5, JUMP_SPEED / 2));
  });

  it('is what drawRun draws the body at', () => {
    const run = createRun('draw', 'normal');
    const at = (scale: typeof REST) => {
      const r = recorder();
      drawRun(r.ctx, palette, run, { bestScore: 0, scale });
      return r.rects.map((rect) => rect[0]);
    };
    expect(at(bodyScale(0, JUMP_SPEED))).not.toEqual(at(REST));
  });
});
