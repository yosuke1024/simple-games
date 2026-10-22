/**
 * One fixed step of 1/120 s, and the run's state machine
 * (docs/BOUNCE_UP_RULES.md §2, §4): ready → running ⇄ paused → over.
 *
 * Integers only (§2「単位と数の規則」): positions in 1/120 px, speeds in px/s,
 * the only division a Math.floor of two integers. Nothing here reads a clock
 * or Math.random; the seed comes from state/.
 */
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BODY_HEIGHT,
  CAMERA_ANCHOR,
  FOOT_HALF,
  GEN_AHEAD,
  GEN_PER_STEP_LIMIT,
  GRAVITY_PER_STEP,
  INITIAL_SEGMENTS_LIMIT,
  JUMP_SPEED,
  LEAD_MAX,
  PRUNE_BELOW,
  RUN_SPEED,
  START_FLOOR_MARGIN,
} from './constants';
import { exactDiv } from './arith';
import { FLOOR_CURSOR, floorPlatform, generateSegment, platformLeft } from './generate';
import type { GenCursor, Platform, PlatformWidth, RunState, StepEvent, StepInput } from './types';

export const NO_INPUT: StepInput = { drag: 0, dir: 0 };

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Whether a body centred at x (in [0, BOARD_WIDTH)) stands over [left, left + width] (§2). */
export function overlaps(x: number, left: number, width: number): boolean {
  const lo = left - FOOT_HALF;
  const hi = left + width + FOOT_HALF;
  return (
    (x >= lo && x <= hi) ||
    (x - BOARD_WIDTH >= lo && x - BOARD_WIDTH <= hi) ||
    (x + BOARD_WIDTH >= lo && x + BOARD_WIDTH <= hi)
  );
}

interface Filled {
  platforms: Platform[];
  gen: GenCursor;
  generated: number;
  capped: boolean;
}

/**
 * Adds segments until the chain reaches GEN_AHEAD above the view's top edge,
 * at most `limit` of them (§3「仕事量」). Returns null when nothing was added.
 */
function fill(
  seed: string,
  width: PlatformWidth,
  platforms: readonly Platform[],
  gen: GenCursor,
  cameraBottom: number,
  limit: number,
): Filled | null {
  const ceiling = cameraBottom + BOARD_HEIGHT + GEN_AHEAD;
  if (gen.chainTop >= ceiling) return null;
  const out = platforms.slice();
  let cursor = gen;
  let generated = 0;
  while (cursor.chainTop < ceiling && generated < limit) {
    const s = generateSegment(seed, width, cursor);
    // The extra sits halfway below the chain platform, so pushing it first
    // keeps the list sorted by height.
    if (s.extra !== null) out.push(s.extra);
    out.push(s.chain);
    cursor = s.cursor;
    generated += 1;
  }
  return { platforms: out, gen: cursor, generated, capped: cursor.chainTop < ceiling };
}

/** A new run of `seed` at this width: the body on the floor, the world still (§4). */
export function createRun(seed: string, width: PlatformWidth): RunState {
  const cameraBottom = -START_FLOOR_MARGIN;
  const filled = fill(
    seed,
    width,
    [floorPlatform()],
    FLOOR_CURSOR,
    cameraBottom,
    INITIAL_SEGMENTS_LIMIT,
  )!;
  const x = exactDiv(BOARD_WIDTH, 2);
  return {
    seed,
    width,
    status: 'ready',
    tick: 0,
    x,
    y: 0,
    vy: 0,
    target: x,
    heldDir: 0,
    cameraBottom,
    maxHeight: 0,
    reachedSegment: 0,
    platforms: filled.platforms,
    gen: filled.gen,
    event: 'none',
    generatedLastStep: 0,
    genCapHits: filled.capped ? 1 : 0,
  };
}

/** ready → running: the first bounce off the floor (§4). */
export function start(s: RunState): RunState {
  if (s.status !== 'ready') return s;
  return { ...s, status: 'running', vy: JUMP_SPEED, event: 'none' };
}

/** running → paused, dropping held input: target back on the body, no direction (§4). */
export function pause(s: RunState): RunState {
  if (s.status !== 'running') return s;
  return { ...s, status: 'paused', target: s.x, heldDir: 0, event: 'none' };
}

/** paused → running, only ever on the player's action (§4). */
export function resume(s: RunState): RunState {
  if (s.status !== 'paused') return s;
  return { ...s, status: 'running', target: s.x, heldDir: 0, event: 'none' };
}

/** A usable held direction: −1, 0 or 1 (anything else reads as 0). */
function directionOf(dir: number): number {
  return dir === 1 || dir === -1 ? dir : 0;
}

/**
 * One step (§2「1 ステップの順序」). Anything but `running` comes back as the
 * same object: a late frame never moves a stopped world (§4).
 */
export function step(s: RunState, input: StepInput = NO_INPUT): RunState {
  if (s.status !== 'running') return s;
  const tick = s.tick + 1;

  // 2. The target x (§4): a held direction wins; a released one snaps the
  // target back to the body; otherwise the finger's movement is added.
  const dir = directionOf(input.dir);
  const drag = Number.isSafeInteger(input.drag) ? input.drag : 0;
  let target: number;
  if (dir !== 0) {
    target = s.x + dir * LEAD_MAX;
  } else {
    target = (s.heldDir !== 0 ? s.x : s.target) + drag;
  }
  target = clamp(target, s.x - LEAD_MAX, s.x + LEAD_MAX);

  // 3. Sideways at most RUN_SPEED, then wrap body and target together.
  let x = s.x + clamp(target - s.x, -RUN_SPEED, RUN_SPEED);
  if (x < 0 || x >= BOARD_WIDTH) {
    const shift = Math.floor(x / BOARD_WIDTH) * BOARD_WIDTH;
    x -= shift;
    target -= shift;
  }

  // 4. Vertical: speed first, then position (semi-implicit Euler).
  let vy = s.vy - GRAVITY_PER_STEP;
  const y0 = s.y;
  let y = y0 + vy;

  // 5. Land on the highest top surface crossed downward this step.
  let event: StepEvent = 'none';
  let platforms = s.platforms;
  let reachedSegment = s.reachedSegment;
  if (vy < 0) {
    let best: Platform | null = null;
    for (const p of platforms) {
      if (p.top > y0) break; // sorted by height: nothing above y0 can be crossed
      if (p.top < y) continue;
      if (best !== null && p.top <= best.top) continue;
      if (overlaps(x, platformLeft(p, tick), p.width)) best = p;
    }
    if (best !== null) {
      y = best.top;
      vy = JUMP_SPEED;
      event = 'bounce';
      if (best.segment > reachedSegment) reachedSegment = best.segment;
      if (best.kind === 'vanishing') {
        const gone = best;
        platforms = platforms.filter((p) => p !== gone);
        event = 'vanish';
      }
    }
  }

  // 6. Records and the camera (it never comes down).
  const maxHeight = y > s.maxHeight ? y : s.maxHeight;
  const cameraBottom = Math.max(s.cameraBottom, y - CAMERA_ANCHOR);

  // 7. Over once the whole body is below the bottom edge.
  const over = y + BODY_HEIGHT <= cameraBottom;
  if (over) event = 'over';

  // 8. Generate above, drop below.
  let gen = s.gen;
  let generated = 0;
  let genCapHits = s.genCapHits;
  const filled = fill(s.seed, s.width, platforms, gen, cameraBottom, GEN_PER_STEP_LIMIT);
  if (filled !== null) {
    platforms = filled.platforms;
    gen = filled.gen;
    generated = filled.generated;
    if (filled.capped) genCapHits += 1;
  }
  const floorLine = cameraBottom - PRUNE_BELOW;
  let drop = 0;
  while (drop < platforms.length && platforms[drop]!.top < floorLine) drop += 1;
  if (drop > 0) platforms = platforms.slice(drop);

  return {
    seed: s.seed,
    width: s.width,
    status: over ? 'over' : 'running',
    tick,
    x,
    y,
    vy,
    target,
    heldDir: dir,
    cameraBottom,
    maxHeight,
    reachedSegment,
    platforms,
    gen,
    event,
    generatedLastStep: generated,
    genCapHits,
  };
}

/** Every platform's left edge at the state's tick (for drawing and the bot). */
export function leftAt(s: RunState, p: Platform): number {
  return platformLeft(p, s.tick);
}

/**
 * The highest the foot rises above where it bounced, in units, under this
 * step's arithmetic (§2「頂点の高さ」): 18,875 with the initial constants.
 */
export function apexUnits(): number {
  let vy = JUMP_SPEED;
  let y = 0;
  let top = 0;
  while (vy > 0) {
    vy -= GRAVITY_PER_STEP;
    y += vy;
    if (y > top) top = y;
  }
  return top;
}

/**
 * Steps from a bounce until the falling foot crosses `rise` units above the
 * bounce (§3 invariant 3), or −1 if it never does (rise above the apex).
 * Bounded: the loop ends once the foot is below `rise` on the way down.
 */
export function airSteps(rise: number): number {
  let vy = JUMP_SPEED;
  let y = 0;
  for (let k = 1; ; k++) {
    vy -= GRAVITY_PER_STEP;
    const prev = y;
    y += vy;
    if (vy < 0) {
      if (prev >= rise && y <= rise) return k;
      if (prev < rise) return -1;
    }
  }
}
