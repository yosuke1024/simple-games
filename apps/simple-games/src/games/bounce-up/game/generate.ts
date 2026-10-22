/**
 * The tower (docs/BOUNCE_UP_RULES.md §3): segment i is drawn from its own
 * PRNG, `${seed}:seg:${i}`, and built on the previous segment's chain height
 * and centre (the prefix the run state carries as `gen`). No retries: every
 * segment costs a fixed handful of draws, and every draw is an integer.
 *
 * Each segment ≥ 1 holds one static platform on the safety chain, at most
 * GAP_MAX above the last and within the chain distance of it measured
 * directly (no wrap), and at most one extra platform halfway between the two
 * chain heights — static, moving (from segment 300) or vanishing (from 600).
 * Segment 0 is the floor, the board's full width.
 */
import {
  BOARD_WIDTH_PX,
  CHAIN_DISTANCE_PX,
  EXTRA_PERMILLE,
  GAP_MAX_PX,
  GAP_MIN_PX,
  MOVE_SPAN_PX,
  MOVE_SPEED,
  MOVING_FROM,
  PLATFORM_WIDTH_PX,
  RAMP_SEGMENTS,
  SUB,
  VANISHING_FROM,
} from './constants';
import { exactDiv } from './arith';
import { createRng, pickWeighted, randInt } from './rng';
import type { GenCursor, Motion, Platform, PlatformKind, PlatformWidth } from './types';

/** a at segment ≤ 0, b from RAMP_SEGMENTS on, linear between (floored) (§3). */
export function ramp(a: number, b: number, segment: number): number {
  const k = Math.min(Math.max(segment, 0), RAMP_SEGMENTS);
  return Math.floor((a * (RAMP_SEGMENTS - k) + b * k) / RAMP_SEGMENTS);
}

/** The gap range of segment i, whole px, inclusive (§3). */
export function gapRange(segment: number): { min: number; max: number } {
  return {
    min: ramp(GAP_MIN_PX.start, GAP_MIN_PX.end, segment),
    max: ramp(GAP_MAX_PX.start, GAP_MAX_PX.end, segment),
  };
}

/** The safety chain's direct horizontal bound for segment i, whole px (§3). */
export function chainDistance(segment: number): number {
  return ramp(CHAIN_DISTANCE_PX.start, CHAIN_DISTANCE_PX.end, segment);
}

export function extraPermille(segment: number): number {
  return ramp(EXTRA_PERMILLE.start, EXTRA_PERMILLE.end, segment);
}

const KINDS: readonly PlatformKind[] = ['static', 'moving', 'vanishing'];

/** Extra-platform kind weights (static, moving, vanishing) by segment (§3). */
export function kindWeights(segment: number): readonly number[] {
  if (segment >= VANISHING_FROM) return [2, 1, 1];
  if (segment >= MOVING_FROM) return [2, 1, 0];
  return [1, 0, 0];
}

export function platformWidthPx(width: PlatformWidth): number {
  return PLATFORM_WIDTH_PX[width];
}

/** The floor: segment 0, the board's full width, top at height 0 (§3). */
export function floorPlatform(): Platform {
  return {
    id: 0,
    segment: 0,
    kind: 'static',
    chain: true,
    top: 0,
    left: 0,
    width: BOARD_WIDTH_PX * SUB,
    motion: null,
  };
}

export const FLOOR_CURSOR: GenCursor = {
  next: 1,
  chainTop: 0,
  chainCenterPx: exactDiv(BOARD_WIDTH_PX, 2),
};

export interface Segment {
  readonly segment: number;
  readonly gapPx: number;
  readonly chain: Platform;
  readonly extra: Platform | null;
  readonly cursor: GenCursor;
}

/** Segment `cursor.next` of `seed`'s tower at this width (§3). */
export function generateSegment(seed: string, width: PlatformWidth, cursor: GenCursor): Segment {
  const i = cursor.next;
  const rng = createRng(`${seed}:seg:${i}`);
  const wPx = platformWidthPx(width);
  const half = exactDiv(wPx, 2);

  const gaps = gapRange(i);
  const gapPx = gaps.min + randInt(rng, gaps.max - gaps.min + 1);
  const chainTop = cursor.chainTop + gapPx * SUB;

  const d = chainDistance(i);
  const lo = Math.max(half, cursor.chainCenterPx - d);
  const hi = Math.min(BOARD_WIDTH_PX - half, cursor.chainCenterPx + d);
  const centerPx = lo + randInt(rng, hi - lo + 1);

  const chain: Platform = {
    id: i * 2,
    segment: i,
    kind: 'static',
    chain: true,
    top: chainTop,
    left: (centerPx - half) * SUB,
    width: wPx * SUB,
    motion: null,
  };

  let extra: Platform | null = null;
  if (randInt(rng, 1000) < extraPermille(i)) {
    const kind = KINDS[pickWeighted(rng, kindWeights(i))]!;
    const top = cursor.chainTop + Math.floor(gapPx / 2) * SUB;
    const room = BOARD_WIDTH_PX - wPx;
    let left: number;
    let motion: Motion | null = null;
    if (kind === 'moving') {
      const spanPx = Math.min(
        room,
        MOVE_SPAN_PX.min + randInt(rng, MOVE_SPAN_PX.max - MOVE_SPAN_PX.min + 1),
      );
      const loPx = randInt(rng, room - spanPx + 1);
      const speed = MOVE_SPEED.min + randInt(rng, MOVE_SPEED.max - MOVE_SPEED.min + 1);
      const span = spanPx * SUB;
      motion = { lo: loPx * SUB, span, speed, phase: randInt(rng, 2 * span) };
      left = motion.lo;
    } else {
      left = randInt(rng, room + 1) * SUB;
    }
    extra = { id: i * 2 + 1, segment: i, kind, chain: false, top, left, width: wPx * SUB, motion };
  }

  return {
    segment: i,
    gapPx,
    chain,
    extra,
    cursor: { next: i + 1, chainTop, chainCenterPx: centerPx },
  };
}

/** A moving platform's left edge at `tick` (the triangle wave of §3). */
export function platformLeft(platform: Platform, tick: number): number {
  const m = platform.motion;
  if (m === null) return platform.left;
  const period = 2 * m.span;
  const u = (((tick * m.speed + m.phase) % period) + period) % period;
  return m.lo + (u <= m.span ? u : period - u);
}

/**
 * Segments 1..count of a tower, built the way a run builds them: tests and the
 * bot use it to read the chain without running the physics.
 */
export function generateTower(seed: string, width: PlatformWidth, count: number): Segment[] {
  const out: Segment[] = [];
  let cursor = FLOOR_CURSOR;
  for (let n = 0; n < count; n++) {
    const s = generateSegment(seed, width, cursor);
    out.push(s);
    cursor = s.cursor;
  }
  return out;
}
