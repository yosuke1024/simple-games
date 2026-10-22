/**
 * What the board draws (docs/OVERTAKE_RULES.md §11「見た目」, §16「描画」),
 * on a 2D context stand-in that records every call with the colour in force
 * when it was made: the palette reads the rival tokens, a rival is a blue car
 * with the traffic's window cut-outs and its digit in `--ot-rival-ink`, and
 * the board draws sand and cones — only those on the board, sand straight
 * after the road, cones before the cars.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BOARD_HEIGHT, PLAYER_SCREEN_Y, SUB } from '../game/constants';
import { assembleCourse } from '../game/course';
import { courseFor, createRace } from '../game/race';
import type { Course, Obstacle, Zone } from '../game/types';
import {
  CONE_BASE,
  SAND_DOT_PITCH,
  SAND_DOT_SIZE,
  drawCar,
  drawRace,
  drawSand,
  readPalette,
  type Palette,
} from './draw';

interface Call {
  readonly op: string;
  readonly args: readonly unknown[];
  readonly fillStyle: string;
  readonly strokeStyle: string;
  readonly font: string;
  readonly lineWidth: number;
}

/** A context that keeps a log of its calls instead of pixels. */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const state = { fillStyle: '', strokeStyle: '', font: '', lineWidth: 1 };
  const ctx = new Proxy(state as unknown as CanvasRenderingContext2D, {
    get: (target, prop) => {
      if (typeof prop === 'string' && prop in state) return state[prop as keyof typeof state];
      return (...args: unknown[]) => {
        calls.push({ op: String(prop), args, ...state });
      };
    },
    set: (_target, prop, value) => {
      (state as Record<string, unknown>)[String(prop)] = value;
      return true;
    },
  });
  return { ctx, calls };
}

/** Distinct names for every token, so a call says which one it used. */
const PALETTE: Palette = {
  surface: 'SURFACE',
  line: 'LINE',
  ink: 'INK',
  inkSoft: 'INK_SOFT',
  accent: 'ACCENT',
  rival: 'RIVAL',
  rivalInk: 'RIVAL_INK',
};

describe('readPalette', () => {
  let style: HTMLStyleElement | null = null;

  afterEach(() => {
    style?.remove();
    style = null;
  });

  it('reads --ot-rival and --ot-rival-ink from the page', () => {
    style = document.createElement('style');
    style.textContent =
      ':root { --ot-rival: #123456; --ot-rival-ink: #abcdef; --accent: #654321; }';
    document.head.appendChild(style);
    const palette = readPalette();
    expect(palette.rival).toBe('#123456');
    expect(palette.rivalInk).toBe('#abcdef');
    expect(palette.accent).toBe('#654321');
  });

  it('falls back to the light theme’s values where nothing is declared (jsdom)', () => {
    const palette = readPalette();
    expect(palette.rival).toBe('#2453a8');
    expect(palette.rivalInk).toBe(palette.surface);
    expect(palette.surface).toBe('#fffdf8');
  });
});

describe('drawCar', () => {
  const fills = (calls: Call[]) => calls.filter((c) => c.op === 'fill').map((c) => c.fillStyle);

  it('draws a rival as a blue body with two windows cut out and its digit in rival ink', () => {
    const { ctx, calls } = recorder();
    drawCar(ctx, PALETTE, 'rival', 100, 200, 34, 58, '2');
    // The body, then the windscreen and the rear window in the surface.
    expect(fills(calls)).toEqual(['RIVAL', 'SURFACE', 'SURFACE']);
    // One hairline of surface around the body, right after its fill, so two
    // overlapping rivals still read as two cars (§11).
    const strokes = calls.filter((c) => c.op === 'stroke');
    expect(strokes).toHaveLength(1);
    expect([strokes[0]!.strokeStyle, strokes[0]!.lineWidth]).toEqual(['SURFACE', 1.5]);
    const bodyAt = calls.findIndex((c) => c.op === 'fill' && c.fillStyle === 'RIVAL');
    const firstWindowAt = calls.findIndex((c) => c.op === 'fill' && c.fillStyle === 'SURFACE');
    const strokeAt = calls.indexOf(strokes[0]!);
    expect(strokeAt).toBeGreaterThan(bodyAt);
    expect(strokeAt).toBeLessThan(firstWindowAt);
    const text = calls.filter((c) => c.op === 'fillText');
    expect(text).toHaveLength(1);
    expect(text[0]!.args.slice(0, 2)).toEqual(['2', 100]);
    expect(text[0]!.fillStyle).toBe('RIVAL_INK');
    expect(text[0]!.font).toMatch(/^700 18px /);
    // Between the windows: the windscreen ends at 220, the rear window starts at 245.
    const y = text[0]!.args[2] as number;
    expect(y - 9).toBeGreaterThanOrEqual(220);
    expect(y + 9).toBeLessThanOrEqual(245);
  });

  it('keeps traffic an accent body and the player an ink body, both with windows and no digit', () => {
    for (const [look, body] of [
      ['traffic', 'ACCENT'],
      ['player', 'INK'],
    ] as const) {
      const { ctx, calls } = recorder();
      drawCar(ctx, PALETTE, look, 100, 200, 34, 58);
      expect(fills(calls), look).toEqual([body, 'SURFACE', 'SURFACE']);
      expect(calls.some((c) => c.op === 'fillText')).toBe(false);
    }
  });
});

describe('drawSand', () => {
  const dots = (calls: Call[]) =>
    calls
      .filter((c) => c.op === 'rect')
      .map((c) => [
        (c.args[0] as number) + SAND_DOT_SIZE / 2,
        (c.args[1] as number) + SAND_DOT_SIZE / 2,
      ]);

  it('stipples ink-soft dots on a staggered grid inside a 1px edge, with no fill of the patch', () => {
    const { ctx, calls } = recorder();
    drawSand(ctx, PALETTE, 60, 100, 60, 150, 1000);
    expect(calls.some((c) => c.op === 'fillRect')).toBe(false);
    const fill = calls.filter((c) => c.op === 'fill');
    expect(fill.map((c) => c.fillStyle)).toEqual(['INK_SOFT']);
    const edge = calls.filter((c) => c.op === 'strokeRect');
    expect(edge).toHaveLength(1);
    expect(edge[0]!.strokeStyle).toBe('INK_SOFT');
    expect(edge[0]!.lineWidth).toBe(1);
    const points = dots(calls);
    expect(points.length).toBeGreaterThan(200);
    const rows = new Map<number, number[]>();
    for (const [x, y] of points) {
      expect(x).toBeGreaterThan(60);
      expect(x).toBeLessThan(120);
      expect(y).toBeGreaterThan(100);
      expect(y).toBeLessThan(250);
      rows.set(y!, [...(rows.get(y!) ?? []), x!]);
    }
    const ys = [...rows.keys()].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]! - ys[i - 1]!).toBe(SAND_DOT_PITCH);
      // The stagger: the next row is half a pitch over.
      const shift = Math.abs(rows.get(ys[i]!)![0]! - rows.get(ys[i - 1]!)![0]!);
      expect(shift).toBe(SAND_DOT_PITCH / 2);
    }
  });

  it('pins the dots to course px, so they stream with traffic and never move on their own', () => {
    const at = (y: number, front: number) => {
      const { ctx, calls } = recorder();
      drawSand(ctx, PALETTE, 60, y, 60, 150, front);
      // The course px of each dot: front − (dotY − y).
      return dots(calls).map(([x, dotY]) => `${x}:${front - (dotY! - y)}`);
    };
    const before = at(100, 1000);
    for (const key of before) expect(Number(key.split(':')[1]) % SAND_DOT_PITCH).toBe(0);
    // Scrolled by 4 px: the same patch, the same dots in course px.
    expect(at(104, 1000)).toEqual(before);
  });
});

/**
 * A three-lane course with the given zones and nothing else, unless traffic
 * (sorted by rear, as the course keeps it) or a finish position (px) is given.
 */
function zoneCourse(zones: Zone[], obstacles: Obstacle[] = [], finish?: number): Course {
  const base = assembleCourse(16, 3, 4000 * SUB, []);
  return {
    ...base,
    length: finish === undefined ? base.length : finish * SUB,
    obstacles: [...obstacles].sort((a, b) => a.rear - b.rear),
    zones: [...zones].sort((a, b) => a.rear - b.rear),
  };
}

const sand = (left: number, rear: number, length: number): Zone => ({
  kind: 'sand',
  left: left * SUB,
  right: (left + 60) * SUB,
  rear: rear * SUB,
  front: (rear + length) * SUB,
});
const cone = (left: number, rear: number): Zone => ({
  kind: 'cone',
  left: left * SUB,
  right: (left + 12) * SUB,
  rear: rear * SUB,
  front: (rear + 14) * SUB,
});

const sandEdges = (calls: Call[]) =>
  calls.filter((c) => c.op === 'strokeRect' && c.lineWidth === 1);
const coneBases = (calls: Call[]) =>
  calls.filter((c) => c.op === 'fillRect' && c.args[2] === 12 && c.args[3] === CONE_BASE);

describe('drawRace draws the zones on the board', () => {
  it('draws only the sand and cones in view, in the §11 order: road, sand, finish, cones, traffic, rivals, player', () => {
    const race = createRace(16);
    const pr = race.player.r / SUB;
    // The board shows course px pr − 170 … pr + 470.
    const finish = pr + 400;
    const course = zoneCourse(
      [
        sand(60, pr + 100, 200),
        sand(160, pr + 900, 200), // ahead of the top edge
        sand(160, pr - 600, 200), // behind the bottom edge
        cone(100, pr + 300),
        cone(116, pr + 316),
        cone(100, pr + 1200), // ahead of the top edge
      ],
      // One car of traffic in view, in the right lane.
      [
        {
          kind: 'sedan',
          left: 260 * SUB,
          right: 294 * SUB,
          rear: (pr + 50) * SUB,
          front: (pr + 108) * SUB,
        },
      ],
      finish,
    );
    const { ctx, calls } = recorder();
    drawRace(ctx, PALETTE, course, race);

    const edges = sandEdges(calls);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.args).toEqual([60.5, PLAYER_SCREEN_Y - 300 + 0.5, 59, 199]);
    const bases = coneBases(calls);
    expect(bases.map((c) => c.args.slice(0, 2))).toEqual([
      [100, PLAYER_SCREEN_Y - 314 + 14 - CONE_BASE],
      [116, PLAYER_SCREEN_Y - 330 + 14 - CONE_BASE],
    ]);
    for (const base of bases) expect(base.fillStyle).toBe('INK_SOFT');
    // Each cone's triangle is an accent fill, its apex at the front's centre.
    const apexes = calls.filter((c) => c.op === 'moveTo' && c.args[0] === 106);
    expect(apexes.map((c) => c.args[1])).toEqual([PLAYER_SCREEN_Y - 314]);

    // Order (§11, §16): the road's surface, the sand, the finish, the cones,
    // the traffic, then the racers.
    const first = (pred: (c: Call) => boolean) => calls.findIndex(pred);
    const road = first((c) => c.op === 'fillRect' && c.fillStyle === 'SURFACE');
    const sandAt = calls.indexOf(edges[0]!);
    const goalY = PLAYER_SCREEN_Y - (finish - pr);
    const finishCells = calls.filter(
      (c) =>
        c.op === 'fillRect' &&
        c.args[3] === 8 &&
        (c.args[1] === goalY - 8 || c.args[1] === goalY - 16),
    );
    expect(finishCells.length).toBeGreaterThan(0);
    const finishAt = calls.indexOf(finishCells[0]!);
    const finishEnd = calls.indexOf(finishCells[finishCells.length - 1]!);
    const coneAt = first((c) => c.op === 'fill' && c.fillStyle === 'ACCENT');
    const lastBase = calls.indexOf(bases[bases.length - 1]!);
    // The traffic's body: the first accent fill after the last cone's base.
    const trafficAt = calls.findIndex(
      (c, i) => i > lastBase && c.op === 'fill' && c.fillStyle === 'ACCENT',
    );
    const rivalAt = first((c) => c.op === 'fill' && c.fillStyle === 'RIVAL');
    const playerAt = first((c) => c.op === 'fill' && c.fillStyle === 'INK');
    expect(road).toBeGreaterThan(-1);
    expect(sandAt).toBeGreaterThan(road);
    expect(finishAt).toBeGreaterThan(sandAt);
    expect(coneAt).toBeGreaterThan(finishEnd);
    expect(trafficAt).toBeGreaterThan(lastBase);
    expect(rivalAt).toBeGreaterThan(trafficAt);
    expect(playerAt).toBeGreaterThan(rivalAt);
  });

  it('draws the three rivals blue with their digits 1–3 in rival ink', () => {
    const race = createRace(1);
    const { ctx, calls } = recorder();
    drawRace(ctx, PALETTE, zoneCourse([]), race);
    const digits = calls.filter((c) => c.op === 'fillText');
    expect(digits.map((c) => [c.args[0], c.fillStyle])).toEqual([
      ['1', 'RIVAL_INK'],
      ['2', 'RIVAL_INK'],
      ['3', 'RIVAL_INK'],
    ]);
    expect(calls.filter((c) => c.op === 'fill' && c.fillStyle === 'RIVAL')).toHaveLength(3);
    // No accent outline is left on a racer; the only strokes on the rivals are
    // their surface hairlines.
    expect(calls.some((c) => c.op === 'stroke' && c.strokeStyle === 'ACCENT')).toBe(false);
    expect(calls.filter((c) => c.op === 'stroke' && c.strokeStyle === 'SURFACE')).toHaveLength(3);
  });

  it('draws a shipped course’s sand and cones when the player reaches them (Lv16)', () => {
    const course = courseFor(16);
    const race = createRace(16);
    for (const kind of ['sand', 'cone'] as const) {
      const zone = course.zones.find((z) => z.kind === kind);
      expect(zone, kind).toBeDefined();
      // Put the player 100 px short of it: it is on the board.
      const player = { ...race.player, r: zone!.rear - 100 * SUB };
      const { ctx, calls } = recorder();
      drawRace(ctx, PALETTE, course, { ...race, player });
      const y = PLAYER_SCREEN_Y - (zone!.front - player.r) / SUB;
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(BOARD_HEIGHT);
      const x = zone!.left / SUB;
      if (kind === 'sand') {
        expect(sandEdges(calls).some((c) => c.args[0] === x + 0.5 && c.args[1] === y + 0.5)).toBe(
          true,
        );
      } else {
        expect(coneBases(calls).some((c) => c.args[0] === x)).toBe(true);
      }
    }
  });
});
