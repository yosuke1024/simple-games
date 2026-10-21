/**
 * The shapes the logic passes around (docs/OVERTAKE_RULES.md §1, §2, §5).
 * Every number in them is an integer (§1「数の規則」): positions in 1/120 px
 * units, speeds in px/s, timers in steps.
 */

export type CarKind = 'sedan' | 'van' | 'truck';
export type ObstacleKind = CarKind | 'works';

/** A static piece of traffic in course coordinates (traffic does not move there, §1). */
export interface Obstacle {
  readonly kind: ObstacleKind;
  /** Lateral extent, units. */
  readonly left: number;
  readonly right: number;
  /** Extent along the course, units: rear (smaller r) to front. */
  readonly rear: number;
  readonly front: number;
}

/**
 * - `easy1` / `easy2`: the two walls every level opens with (§5 "ゆるめると楽な組").
 * - `gate1` / `gate2`: a required-slowdown pair from Lv11 (§5 "必須減速の組").
 * - `normal`: one filled from the templates (`works` is a normal row, §5).
 */
export type RowKind = 'normal' | 'easy1' | 'easy2' | 'gate1' | 'gate2';
export type RowTemplate = 'single' | 'two' | 'truck' | 'works' | 'wall' | 'empty';

export interface Row {
  readonly index: number;
  readonly kind: RowKind;
  readonly template: RowTemplate;
  /** Rear of the row's traffic, units (u_k). */
  readonly u: number;
  /** The row's length L_k (its longest piece), units. */
  readonly length: number;
  /** The lane of the carved gap (g_k). */
  readonly gap: number;
  /** D_k: from the previous row's window end to this row's window start, units (0 for row 1). */
  readonly lead: number;
  /** σ used for D_k in ‰ (0 for row 1). */
  readonly sigma: number;
  /** m_k used for D_k, units (0 for row 1). */
  readonly move: number;
  readonly obstacles: readonly Obstacle[];
  /**
   * For walls only: the gap interval G_k (lateral, units) — the one stretch
   * of [16, 344] px no traffic covers that is at least a car wide (§5).
   */
  readonly gapSpan: readonly [number, number] | null;
}

export interface Course {
  readonly level: number;
  readonly lanes: number;
  /** U, units. */
  readonly length: number;
  readonly rows: readonly Row[];
  /** Every obstacle, sorted by rear (then left) — what the physics queries. */
  readonly obstacles: readonly Obstacle[];
  /** Required-slowdown pairs actually placed (§5). */
  readonly gatePairs: number;
  /** 1 when the course fell back to "route only" (§5), else 0. */
  readonly fallbackCount: number;
  readonly fallbackReason: 'none' | 'row-limit' | 'verify';
}

/** One step's input (§1): a lateral target and a brake in ‰. */
export interface StepInput {
  /** Target centre x in units, or null to keep the current target. */
  readonly steerX: number | null;
  /** 0 = full throttle, 1000 = hardest. */
  readonly brake: number;
}

export const COAST: StepInput = { steerX: null, brake: 0 };

/** A racer's physical state — the player and the rivals share it (§1). */
export interface CarState {
  /** Front edge, units. */
  readonly r: number;
  /** Centre, units. */
  readonly x: number;
  /** Speed relative to traffic, px/s (= units per step). */
  readonly w: number;
  /** The lateral target the car follows, units. */
  readonly target: number;
  /** Bump timers: steps remaining (§4). */
  readonly hold: number;
  readonly lock: number;
  readonly blink: number;
  readonly bumps: number;
}
