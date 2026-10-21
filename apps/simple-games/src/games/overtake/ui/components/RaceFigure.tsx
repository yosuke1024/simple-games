/**
 * The Quick Rules figures (docs/OVERTAKE_RULES.md §10): small still scenes
 * drawn with the board's own pieces (../draw.ts) — the same car, traffic,
 * road and finish line the race draws, so a figure cannot drift from the
 * game. No text but the board's own ASCII digits, nothing moves, and nothing
 * is scheduled: one drawing on mount, again when the theme changes — the
 * shell's attributes or the OS's dark mode, as the board (§11「描画とループ」).
 */
import { useEffect, useRef } from 'react';
import { BOARD_WIDTH, CAR_LENGTH, CAR_WIDTH, SUB } from '../../game/constants';
import { CAR_DIMENSIONS } from '../../game/levels';
import { laneCenter } from '../../game/geometry';
import { drawCar, drawFinish, drawRoad, readPalette, type Palette } from '../draw';

/** The figure's window onto the board, logical px. */
export const FIGURE_HEIGHT = 220;

export type FigureKind = 'lanes' | 'ease' | 'finish';

const LANES = 3;
const carW = CAR_WIDTH / SUB;
const carL = CAR_LENGTH / SUB;
const sedan = CAR_DIMENSIONS.sedan;
const centre = (lane: number) => laneCenter(LANES, lane) / SUB;

function arrow(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  points: readonly (readonly [number, number])[],
): void {
  ctx.strokeStyle = palette.inkSoft;
  ctx.lineWidth = 3;
  ctx.setLineDash([2, 7]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);
  const [x1, y1] = points[points.length - 2]!;
  const [x2, y2] = points[points.length - 1]!;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.fillStyle = palette.inkSoft;
  ctx.beginPath();
  ctx.moveTo(x2 + Math.cos(angle) * 6, y2 + Math.sin(angle) * 6);
  ctx.lineTo(x2 + Math.cos(angle + 2.4) * 9, y2 + Math.sin(angle + 2.4) * 9);
  ctx.lineTo(x2 + Math.cos(angle - 2.4) * 9, y2 + Math.sin(angle - 2.4) * 9);
  ctx.closePath();
  ctx.fill();
}

/** One car of a figure, in the board's own logical px (draw.ts `drawCar`). */
export interface FigureCar {
  readonly look: 'player' | 'traffic' | 'rival';
  readonly centreX: number;
  readonly frontY: number;
  readonly width: number;
  readonly length: number;
  readonly digit: string | null;
}

/** What a figure shows, as data: the cars, the dotted route, the finish line. */
export interface FigureScene {
  readonly cars: readonly FigureCar[];
  readonly route: readonly (readonly [number, number])[] | null;
  readonly finishY: number | null;
}

const traffic = (centreX: number, frontY: number): FigureCar => ({
  look: 'traffic',
  centreX,
  frontY,
  width: sedan.width,
  length: sedan.length,
  digit: null,
});

const car = (
  look: 'player' | 'rival',
  centreX: number,
  frontY: number,
  digit: string | null = null,
): FigureCar => ({ look, centreX, frontY, width: carW, length: carL, digit });

/** A wall of sedans across every lane but `gap` — two to a lane, as §5 builds it. */
function wall(gap: number, frontY: number): FigureCar[] {
  const laneW = (BOARD_WIDTH - 56) / LANES;
  const cars: FigureCar[] = [];
  for (let lane = 0; lane < LANES; lane++) {
    if (lane === gap) continue;
    const left = 28 + laneW * lane;
    cars.push(traffic(left + sedan.width / 2, frontY));
    cars.push(traffic(left + laneW - sedan.width / 2, frontY));
  }
  return cars;
}

/**
 * The three scenes. The dotted route never crosses a car it would bump
 * (`RaceFigure.test.tsx`): a figure that taught a route through traffic
 * would teach a Bump.
 */
export function figureScene(kind: FigureKind): FigureScene {
  if (kind === 'lanes') {
    // Traffic ahead in the car's lane; the car moves over a lane to pass.
    return {
      cars: [traffic(centre(1), 18), car('player', centre(1), 140)],
      route: [
        [centre(1), 136],
        [centre(1) + 30, 112],
        [centre(2) - 6, 92],
      ],
      finishY: null,
    };
  }
  if (kind === 'ease') {
    // A wall with its gap in lane 0, the next (nearer) with its gap two lanes
    // over (§5). The route goes up through the near wall's gap, crosses in
    // the band between the walls — the room easing off buys — and goes up
    // into the far wall's gap.
    return {
      cars: [...wall(0, 0), ...wall(2, 100), car('player', centre(2), 162)],
      route: [
        [centre(2), 190],
        [centre(2), 94],
        [centre(0), 66],
        [centre(0), 46],
      ],
      finishY: null,
    };
  }
  // The finish, the car crossing it ahead of the three others.
  return {
    cars: [
      car('player', centre(1), 46),
      car('rival', centre(2), 104, '1'),
      car('rival', centre(0), 128, '2'),
      car('rival', centre(2) - 30, 168, '3'),
    ],
    route: null,
    finishY: 70,
  };
}

function drawFigure(ctx: CanvasRenderingContext2D, palette: Palette, kind: FigureKind): void {
  const scene = figureScene(kind);
  drawRoad(ctx, palette, LANES, 0, 0, FIGURE_HEIGHT);
  if (scene.finishY !== null) drawFinish(ctx, palette, scene.finishY);
  // Traffic first, then the route, then the player and the others on top.
  for (const c of scene.cars) {
    if (c.look === 'traffic') drawCar(ctx, palette, c.look, c.centreX, c.frontY, c.width, c.length);
  }
  if (scene.route !== null) arrow(ctx, palette, scene.route);
  for (const c of scene.cars) {
    if (c.look !== 'traffic') {
      drawCar(ctx, palette, c.look, c.centreX, c.frontY, c.width, c.length, c.digit);
    }
  }
}

export function RaceFigure({ kind }: { kind: FigureKind }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') ?? null;
    if (!canvas || !ctx) return undefined;
    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round((canvas.clientWidth || BOARD_WIDTH) * dpr));
      canvas.width = width;
      canvas.height = Math.max(1, Math.round((width * FIGURE_HEIGHT) / BOARD_WIDTH));
      const scale = width / BOARD_WIDTH;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawFigure(ctx, readPalette(), kind);
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-game'],
    });
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    media?.addEventListener('change', paint);
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', paint);
    };
  }, [kind]);

  return (
    <div className="tutorial-example" aria-hidden="true">
      <canvas ref={canvasRef} className="ot-figure" />
    </div>
  );
}
