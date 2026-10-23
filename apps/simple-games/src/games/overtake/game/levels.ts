/**
 * The ladder's levers (docs/OVERTAKE_RULES.md §7), all in one place, all
 * integer formulas (§1). 100 levels in 10 blocks; nothing new is added to the
 * rules along the way — only what is drawn (car kinds, arrangements, lanes).
 */
import { CAR_LENGTH, FULL_SPEED, SUB } from './constants';
import type { CarKind } from './types';

export const LEVEL_COUNT = 100;
/** `highestUnlocked` once Lv100 is cleared: "everything cleared" (§7). */
export const ALL_CLEARED = LEVEL_COUNT + 1;

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)));
}

/** Width × length per car kind, px (§1). */
export const CAR_DIMENSIONS: Record<CarKind, { readonly width: number; readonly length: number }> =
  {
    sedan: { width: 34, length: 58 },
    van: { width: 38, length: 70 },
    truck: { width: 42, length: 104 },
  };
/** A works zone closes one outer lane for this long, px (§1, §5). */
export const WORKS_LENGTH = 500;

/**
 * Sand and cones (§1, 2026-10-22), px, all initial values. Sand is one lane
 * wide and SAND_MIN_LENGTH + randInt(SAND_LENGTH_SPAN) long (150–250). A cone
 * is CONE_WIDTH × CONE_LENGTH; a group of 2–3 steps CONE_PITCH forward per
 * cone and always leaves at least CONE_CLEARANCE (car 34 + 4) of its lane open.
 */
export const SAND_MIN_LENGTH = 150;
export const SAND_LENGTH_SPAN = 101;
export const CONE_WIDTH = 12;
export const CONE_LENGTH = 14;
export const CONE_PITCH = 16;
export const CONE_CLEARANCE = 38;

/**
 * Lv6 on (cones weigh > 0): after this many template-drawn normal rows in a
 * row without sand or cones, the next normal row is one without a draw (§5
 * "1 コースの最小の数", §7). Initial value.
 */
export const ZONE_GAP = 4;

/** Integer weights the carver draws with (§5, §7). */
export interface TemplateWeights {
  readonly single: number;
  readonly two: number;
  readonly truck: number;
  readonly works: number;
  /** Appended last (§5): zero weights at the tail leave Lv1–5's draws unchanged. */
  readonly cones: number;
  readonly sand: number;
}

export interface LevelSpec {
  readonly level: number;
  /** Position in its block, 1..10. */
  readonly inBlock: number;
  readonly lanes: number;
  /** U₀ and U, px. */
  readonly baseLength: number;
  readonly length: number;
  readonly isFinal: boolean;
  /** σ(ℓ) of normal rows, ‰. */
  readonly sigma: number;
  /** s(ℓ), ‰. */
  readonly slack: number;
  /** n_gate(ℓ), 0 below Lv11. */
  readonly gatePairs: number;
  /** The constant speed every shipped course must be passable at (§5). */
  readonly checkSpeed: number;
  /** Kinds a single / two / wall may draw; trucks come only from the truck template and walls. */
  readonly smallKinds: readonly CarKind[];
  readonly wallKinds: readonly CarKind[];
  readonly templates: TemplateWeights;
  /** S-curves (two rows whose gaps swing opposite ways) from Lv11 (§5). */
  readonly sCurves: boolean;
}

/**
 * Blocks whose first level brings new vocabulary get +40 ‰ slack (§7). Lv6
 * (cones) and Lv16 (sand) are mid-block and get none (§7).
 */
export const VOCABULARY_HEADS: ReadonlySet<number> = new Set([11, 21, 31, 51]);

export function lanesFor(level: number): number {
  const l = clampLevel(level);
  if (l <= 20) return 3;
  if (l <= 50) return 4;
  return 5;
}

export function baseLengthFor(level: number): number {
  const l = clampLevel(level);
  return 16000 + Math.floor((10000 * (l - 1)) / 99);
}

export function lengthFor(level: number): number {
  const l = clampLevel(level);
  const base = baseLengthFor(l);
  return l % 10 === 0 ? Math.floor((base * 5) / 4) : base;
}

export function sigmaFor(level: number): number {
  const l = clampLevel(level);
  return 2200 - Math.floor((950 * (l - 1)) / 99);
}

export function slackFor(level: number): number {
  const l = clampLevel(level);
  const k = ((l - 1) % 10) + 1;
  const head = VOCABULARY_HEADS.has(l) ? 40 : 0;
  return Math.max(
    80,
    250 - Math.floor((170 * (l - 1)) / 99) - Math.floor((20 * (k - 1)) / 9) + head,
  );
}

/** Pair spacing is sized for a person who clears a wall before steering (§5). */
export const PAIR_SPEED = 300;
export const PAIR_REACTION_STEPS = 30; // 250 ms, including a 30 Hz input phase.
export const PAIR_MARGIN_STEPS = 2;
export const PAIR_STEER_MARGIN = 16 * SUB; // Centre ±8 px at either wall.

/** The introducing block keeps the gentler 6 → 15 pair ramp (2026-10-23). */
export const INTRO_GATE_PAIRS: readonly number[] = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
/** Existing density formula; the transition to four lanes is capped below. */
export const GATE_SLACK_SHARE = 500;

/** From Lv21, grow by at most one pair a level until the density formula is reached. */
export function gatePairsFor(level: number): number {
  const l = clampLevel(level);
  if (l < 11) return 0;
  if (l <= 20) return INTRO_GATE_PAIRS[l - 11]!;
  const numerator = slackFor(l) * lengthFor(l);
  const denominator = FULL_SPEED * GATE_SLACK_SHARE;
  return Math.min(15 + l - 21, Math.ceil(numerator / denominator) + 1);
}

/** A moderate speed, plus the separate delayed-human passage check (§5). */
export function checkSpeedFor(level: number): number {
  return clampLevel(level) < 11 ? FULL_SPEED : PAIR_SPEED;
}

export function levelSpec(level: number): LevelSpec {
  const l = clampLevel(level);
  const smallKinds: CarKind[] = l >= 11 ? ['sedan', 'van'] : ['sedan'];
  const wallKinds: CarKind[] = l >= 21 ? ['sedan', 'van', 'truck'] : smallKinds;
  return {
    level: l,
    inBlock: ((l - 1) % 10) + 1,
    lanes: lanesFor(l),
    baseLength: baseLengthFor(l),
    length: lengthFor(l),
    isFinal: l % 10 === 0,
    sigma: sigmaFor(l),
    slack: slackFor(l),
    gatePairs: gatePairsFor(l),
    checkSpeed: checkSpeedFor(l),
    smallKinds,
    wallKinds,
    templates: {
      single: 5,
      two: 3,
      truck: l >= 21 ? 2 : 0,
      works: l >= 31 ? 1 : 0,
      cones: l >= 6 ? 2 : 0,
      sand: l >= 16 ? 2 : 0,
    },
    sCurves: l >= 11,
  };
}

/** A car length in units, for callers that think in kinds. */
export function carLengthUnits(kind: CarKind): number {
  return CAR_DIMENSIONS[kind].length * SUB;
}

/** The window a row of this length occupies, units (§5: L_k + 58). */
export function windowLength(rowLength: number): number {
  return rowLength + CAR_LENGTH;
}
