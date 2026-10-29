/**
 * Everything the board draws, in logical px on the 360×640 board
 * (docs/OVERTAKE_RULES.md §1, §11「見た目」). The board (components/
 * OvertakeStage.tsx) and the Quick Rules figures (screens/TutorialScreen.tsx)
 * draw with these same pieces, so a figure can never show a car the race
 * does not (§10).
 *
 * Told apart by shape, fill and mark, never by colour alone: the player's car
 * is an ink fill, traffic an accent fill, the three other racers a blue fill
 * (`--ot-rival`, game content — overtake.css) with the same window cut-outs
 * and an ASCII digit 1–3 in `--ot-rival-ink`. Works are accent hatching, sand
 * an ink-soft stipple inside a thin ink-soft edge, a cone an accent triangle
 * on an ink-soft base line. The only text on the board is those digits (§11).
 * Every colour is a token read from computed style — none is written here but
 * the jsdom fallbacks (the light theme's values).
 *
 * Depth is physical, not decorative (§11「見た目」): a car and a works stand
 * LIFT px off the road — a `--line` copy of their own shape, drawn first and
 * lower, so only a bottom edge shows, as if lit from the top. What is painted
 * on the road (dashes, sand, the finish band, a cone's base) stays flat.
 *
 * Chromium 88 is the floor: corners are built with arcTo (`roundRect` is
 * Chromium 99), and nothing uses shadowBlur or ctx.filter (§11) — the
 * thickness is one plain fill.
 */
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CAR_LENGTH,
  CAR_WIDTH,
  PLAYER_SCREEN_Y,
  ROAD_LEFT,
  ROAD_RIGHT,
  SHOULDER_LEFT,
  SHOULDER_RIGHT,
  STEPS_PER_SECOND,
  SUB,
  TRAFFIC_SPEED,
  BUMP_BLINK_STEPS,
} from '../game/constants';
import type { RaceState } from '../game/race';
import type { CarState, Course, Obstacle, Zone } from '../game/types';

export interface Palette {
  surface: string;
  line: string;
  ink: string;
  inkSoft: string;
  accent: string;
  /**
   * The off-road beside the shoulders (`--ot-verge`, an alias in overtake.css:
   * `--line` in the light theme, `--paper` in the dark one, so the road reads
   * as the higher surface in both — §11).
   */
  verge: string;
  /** The other racers' fill (`--ot-rival`, game content — §11). */
  rival: string;
  /** Their digit on that fill (`--ot-rival-ink`, which is `var(--surface)`). */
  rivalInk: string;
}

/** Fallbacks are the light theme's tokens; only jsdom ever needs them. */
export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    surface: pick('--surface', '#fffdf8'),
    line: pick('--line', '#ddd7ca'),
    ink: pick('--ink', '#232a33'),
    inkSoft: pick('--ink-soft', '#5c6772'),
    accent: pick('--accent', '#8e3b46'),
    verge: pick('--ot-verge', '#ddd7ca'),
    rival: pick('--ot-rival', '#2453a8'),
    rivalInk: pick('--ot-rival-ink', '#fffdf8'),
  };
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export type CarLook = 'player' | 'traffic' | 'rival';

/**
 * How far a car or a works stands off the road, logical px (§11「見た目」):
 * about 2.2 CSS px at the board's usual 0.55 scale, the same few px as the
 * collection's keys and board frame. Straight down — the light comes from the
 * top — so there is no direction to choose and nothing leans.
 */
export const LIFT = 4;

/**
 * One car, seen from above, front up: a rounded body with a windscreen cut
 * near the front and a rear window near the back, on a `--line` thickness
 * LIFT lower. Its own shape, drawn here (§11) — no livery, no silhouette of
 * anyone else's car. The thickness goes first, under whatever alpha the caller
 * has set, so a blinking car (§4) blinks with its edge.
 */
export function drawCar(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  look: CarLook,
  centreX: number,
  frontY: number,
  width: number,
  length: number,
  digit: string | null = null,
): void {
  const x = centreX - width / 2;
  const radius = Math.min(7, width / 4);
  roundRectPath(ctx, x, frontY + LIFT, width, length, radius);
  ctx.fillStyle = palette.line;
  ctx.fill();
  roundRectPath(ctx, x, frontY, width, length, radius);
  ctx.fillStyle =
    look === 'player' ? palette.ink : look === 'rival' ? palette.rival : palette.accent;
  ctx.fill();
  if (look === 'rival') {
    // A hairline of surface around the body: racers pass through each other
    // (§4), so two rivals can overlap in a lane, and without an edge they read
    // as one long blue car with two digits (§11).
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.surface;
    ctx.stroke();
  }
  // The windows: the surface showing through the body.
  ctx.fillStyle = palette.surface;
  roundRectPath(ctx, x + 5, frontY + Math.min(12, length * 0.2), width - 10, 8, 2);
  ctx.fill();
  roundRectPath(ctx, x + 6, frontY + length - 13, width - 12, 5, 2);
  ctx.fill();
  // The digit sits between the two windows (§11): 18px tall on a 58px body
  // whose windscreen ends at 20 and rear window starts at 45.
  if (digit !== null) {
    ctx.fillStyle = look === 'rival' ? palette.rivalInk : palette.ink;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(digit, centreX, frontY + length / 2 + 1);
  }
}

/**
 * A closed outer lane: accent hatching inside an accent outline (§11), on an
 * opaque surface-coloured slab standing LIFT above the road. The slab is
 * opaque on purpose — the thickness must not show through it, and a closed
 * lane reads as a thing rather than as marks on the road.
 */
export function drawWorks(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = palette.line;
  ctx.fillRect(x, y + LIFT, width, height);
  ctx.fillStyle = palette.surface;
  ctx.fillRect(x, y, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let d = -width; d < height + width; d += 14) {
    ctx.moveTo(x, y + d);
    ctx.lineTo(x + width, y + d + width);
  }
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.accent;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
}

/**
 * The finish: a checkered band across the road, ink and `--line` (§11). Not
 * the surface: that is the road's own colour, so those squares vanished and
 * the band read as scattered ink. Flat, painted on the road.
 */
export function drawFinish(ctx: CanvasRenderingContext2D, palette: Palette, y: number): void {
  const left = ROAD_LEFT / SUB;
  const right = ROAD_RIGHT / SUB;
  const size = 8;
  for (let row = 0; row < 2; row++) {
    for (let col = 0, cx = left; cx < right; col++, cx += size) {
      ctx.fillStyle = (row + col) % 2 === 0 ? palette.ink : palette.line;
      ctx.fillRect(cx, y - size * (row + 1), Math.min(size, right - cx), size);
    }
  }
}

/** Lane dashes: 70 long, 140 apart, pitch 210 (§11). */
export const DASH_LENGTH = 70;
export const DASH_PITCH = 210;

/**
 * The road itself: surface, the shoulders as thin ink-soft lines with the
 * off-road beyond them in the verge colour, and the lane dashes at `ground`
 * px of ground travelled — so they stream past at the ground speed w + vT.
 */
export function drawRoad(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  lanes: number,
  ground: number,
  top = 0,
  bottom = BOARD_HEIGHT,
): void {
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, top, BOARD_WIDTH, bottom - top);
  ctx.fillStyle = palette.verge;
  ctx.fillRect(0, top, SHOULDER_LEFT / SUB, bottom - top);
  ctx.fillRect(SHOULDER_RIGHT / SUB, top, BOARD_WIDTH - SHOULDER_RIGHT / SUB, bottom - top);
  ctx.fillStyle = palette.inkSoft;
  ctx.fillRect(ROAD_LEFT / SUB - 1, top, 1.5, bottom - top);
  ctx.fillRect(ROAD_RIGHT / SUB - 0.5, top, 1.5, bottom - top);

  ctx.fillStyle = palette.line;
  const roadLeft = ROAD_LEFT / SUB;
  const laneWidth = (ROAD_RIGHT - ROAD_LEFT) / SUB / lanes;
  // A dash at ground position p sits at y = PLAYER_SCREEN_Y − (p − ground).
  const first = Math.floor((ground - (bottom - PLAYER_SCREEN_Y) - DASH_LENGTH) / DASH_PITCH);
  const last = Math.ceil((ground + PLAYER_SCREEN_Y - top) / DASH_PITCH);
  for (let lane = 1; lane < lanes; lane++) {
    const x = roadLeft + laneWidth * lane - 1.5;
    for (let k = first; k <= last; k++) {
      const p = k * DASH_PITCH;
      const yTop = PLAYER_SCREEN_Y - (p + DASH_LENGTH - ground);
      if (yTop > bottom || yTop + DASH_LENGTH < top) continue;
      ctx.fillRect(x, yTop, 3, DASH_LENGTH);
    }
  }
}

/** The stipple's pitch, logical px: a dot every 6 along a row, rows 6 apart. */
export const SAND_DOT_PITCH = 6;
/** The side of one stipple dot, logical px. */
export const SAND_DOT_SIZE = 1.5;

/**
 * Sand (§11「見た目」): ink-soft dots on a staggered 6px grid and a 1px
 * ink-soft edge, no fill — the road's dashes show through. `x`, `y`, `width`
 * and `height` are the patch on screen; `front` is the course position (px)
 * of its top edge, so the rows sit at fixed course px (multiples of the
 * pitch). Course coordinates move with traffic (§1), so the patch and its
 * dots stream past at the player's w, like the traffic — not with the lane
 * dashes, which go by at w + vT (`drawRoad`). Nothing moves on its own.
 */
export function drawSand(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  width: number,
  height: number,
  front: number,
  top = 0,
  bottom = BOARD_HEIGHT,
): void {
  const half = SAND_DOT_SIZE / 2;
  ctx.fillStyle = palette.inkSoft;
  ctx.beginPath();
  // Row k sits at course px k × pitch, i.e. y + (front − k × pitch) on screen.
  const firstRow = Math.ceil((front - height) / SAND_DOT_PITCH);
  const lastRow = Math.floor(front / SAND_DOT_PITCH);
  for (let k = firstRow; k <= lastRow; k++) {
    const dotY = y + front - k * SAND_DOT_PITCH;
    if (dotY < y + 1 || dotY > y + height - 1) continue;
    if (dotY < top - half || dotY > bottom + half) continue;
    // Odd rows step half a pitch over: the stagger.
    const shift = Math.abs(k) % 2 === 1 ? SAND_DOT_PITCH / 2 : 0;
    let dotX = Math.ceil((x + 1 - shift) / SAND_DOT_PITCH) * SAND_DOT_PITCH + shift;
    for (; dotX <= x + width - 1; dotX += SAND_DOT_PITCH) {
      ctx.rect(dotX - half, dotY - half, SAND_DOT_SIZE, SAND_DOT_SIZE);
    }
  }
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = palette.inkSoft;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

/** The cone's base line, logical px thick (§11). */
export const CONE_BASE = 2;

/**
 * One traffic cone (§11「見た目」): an accent triangle pointing forward (up)
 * in its box, on a 2px ink-soft base line along the box's rear edge. Static —
 * a touched cone neither falls nor moves (§4).
 */
export function drawCone(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.inkSoft;
  ctx.fillRect(x, y + height - CONE_BASE, width, CONE_BASE);
}

/** Draws one sand patch or cone; `frontY` is the screen y of its front. */
export function drawZone(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  zone: Zone,
  frontY: number,
): void {
  const width = (zone.right - zone.left) / SUB;
  const length = (zone.front - zone.rear) / SUB;
  const x = zone.left / SUB;
  if (zone.kind === 'sand') drawSand(ctx, palette, x, frontY, width, length, zone.front / SUB);
  else drawCone(ctx, palette, x, frontY, width, length);
}

/** Draws one piece of traffic; `y` is the screen y of its front. */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  obstacle: Obstacle,
  frontY: number,
): void {
  const width = (obstacle.right - obstacle.left) / SUB;
  const length = (obstacle.front - obstacle.rear) / SUB;
  const x = obstacle.left / SUB;
  if (obstacle.kind === 'works') drawWorks(ctx, palette, x, frontY, width, length);
  else drawCar(ctx, palette, 'traffic', x + width / 2, frontY, width, length);
}

/**
 * The Bump's blink (§4, §11): opacity 1 ↔ 0.35 every 0.25 s, counted in
 * steps, so it is the same on every device and never faster than 2 Hz. Not
 * stopped by Reduced Motion — it says "cannot be bumped right now".
 */
export const BLINK_HALF_STEPS = STEPS_PER_SECOND / 4;

export function blinkAlpha(car: CarState): number {
  if (car.blink <= 0) return 1;
  const elapsed = BUMP_BLINK_STEPS - car.blink;
  return Math.floor(elapsed / BLINK_HALF_STEPS) % 2 === 0 ? 0.35 : 1;
}

/** The whole board for one moment of a race. */
export function drawRace(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  course: Course,
  race: RaceState,
): void {
  const pr = race.player.r;
  const toY = (r: number) => PLAYER_SCREEN_Y - (r - pr) / SUB;
  const ground = pr / SUB + (TRAFFIC_SPEED * race.step) / STEPS_PER_SECOND;
  drawRoad(ctx, palette, course.lanes, ground);

  // Only what is on the board: course r from 170 px behind the player's
  // front (the bottom edge) to 470 px ahead of it (the top edge).
  const low = pr - (BOARD_HEIGHT - PLAYER_SCREEN_Y) * SUB;
  const high = pr + PLAYER_SCREEN_Y * SUB;

  // Sand is part of the road: drawn straight after it, under everything
  // else; the cones come after the sand and the finish, still under the
  // cars (§11). course.zones is sorted by rear, like the obstacles.
  const zonesInView = (kind: Zone['kind']) => {
    for (const zone of course.zones) {
      if (zone.rear > high) break;
      if (zone.kind === kind && zone.front >= low) drawZone(ctx, palette, zone, toY(zone.front));
    }
  };
  zonesInView('sand');
  const goalY = toY(course.length);
  if (goalY > -16 && goalY < BOARD_HEIGHT + 16) drawFinish(ctx, palette, goalY);
  zonesInView('cone');

  for (const obstacle of course.obstacles) {
    if (obstacle.rear > high) break;
    if (obstacle.front < low) continue;
    drawObstacle(ctx, palette, obstacle, toY(obstacle.front));
  }

  // The other racers pass through the player and each other (§4): drawn
  // first, 1 → 3, the player's car last on top.
  const carW = CAR_WIDTH / SUB;
  const carL = CAR_LENGTH / SUB;
  race.rivals.forEach((rival, i) => {
    const y = toY(rival.car.r);
    if (y > BOARD_HEIGHT || y + carL < 0) return;
    ctx.globalAlpha = blinkAlpha(rival.car);
    drawCar(ctx, palette, 'rival', rival.car.x / SUB, y, carW, carL, String(i + 1));
  });
  ctx.globalAlpha = blinkAlpha(race.player);
  drawCar(ctx, palette, 'player', race.player.x / SUB, PLAYER_SCREEN_Y, carW, carL);
  ctx.globalAlpha = 1;
}
