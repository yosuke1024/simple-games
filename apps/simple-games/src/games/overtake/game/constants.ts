/**
 * Every number docs/OVERTAKE_RULES.md fixes for the logic, in one place
 * (§1 "定数"). All are initial values (「初期値」): changing one is a decision
 * made in the same commit as the rules document, and most of them move the
 * golden courses and the frozen pace table (§5, §6).
 *
 * Units (§1): positions are integers in 1/120 px (`SUB`), speeds integers in
 * px/s, so one fixed step of 1/120 s moves a car by exactly its speed's
 * number of units.
 */

/** Sub-pixel units per logical px; also the steps per second. */
export const SUB = 120;
export const STEPS_PER_SECOND = 120;

/** The logical board (§1). */
export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 640;
/** Where the player's front edge is drawn (§1). */
export const PLAYER_SCREEN_Y = 470;

/** The road surface, x ∈ [28, 332] px (§1). */
export const ROAD_LEFT = 28 * SUB;
export const ROAD_RIGHT = 332 * SUB;
export const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;
/** The shoulders' outer edges, x = 16 and 344 px (§1). */
export const SHOULDER_LEFT = 16 * SUB;
export const SHOULDER_RIGHT = 344 * SUB;

/** Every racer is 34 × 58 (§1). */
export const CAR_WIDTH = 34 * SUB;
export const CAR_HALF_WIDTH = 17 * SUB;
export const CAR_LENGTH = 58 * SUB;
/** Car centres are clamped to [33, 327] px so the body never leaves the shoulders. */
export const X_MIN = 33 * SUB;
export const X_MAX = 327 * SUB;
/** Centres whose whole body stays on the road surface, [45, 315] px (§5 R(v)). */
export const X_MIN_ROAD = 45 * SUB;
export const X_MAX_ROAD = 315 * SUB;

/** Speeds in px/s (§1). */
export const FULL_SPEED = 420;
export const MIN_TARGET_SPEED = 60;
export const BRAKE_SPAN = FULL_SPEED - MIN_TARGET_SPEED;
export const BRAKE_MAX = 1000;
/** Per-step speed change: 360 px/s² and 720 px/s² at 120 Hz. */
export const ACCEL_PER_STEP = 3;
export const DECEL_PER_STEP = 6;
/** Lateral follow: 440 px/s, i.e. 440 units per step. */
export const STEER_PER_STEP = 440;
/** The speed a car touching a shoulder is capped at: 55 % of full (§1, §4). */
export const SHOULDER_SPEED = 231;
/** The rolling start: every racer begins at this speed (§2). */
export const ROLLING_START_SPEED = 240;
/** Traffic's ground speed (§1). Only the dashes and the arithmetic use it. */
export const TRAFFIC_SPEED = 200;

/** Bump timers in steps (§4): hold 0.5 s, steering lock 0.3 s, blink 0.8 s. */
export const BUMP_HOLD_STEPS = 60;
export const BUMP_LOCK_STEPS = 36;
export const BUMP_BLINK_STEPS = 96;
/** Candidate passes per step when resolving overlaps (§4, §17). */
export const RESOLVE_PASS_LIMIT = 8;

/**
 * Which drag mapping the Drag control uses (§3). 'B' (sideways drag, ▼ held to
 * ease off; the drag's vertical is ignored) is what ships: the owner put the
 * game on `web-beta` on 2026-10-22 with the Phase 0 device trial waived for
 * now (not run), and §3 says a raise before that record goes out on 'B'.
 * Mode A (one finger, two axes) keeps its code and tests behind this constant
 * for a trial later; it goes only if such a trial fails (§18).
 */
export const DRAG_MAPPING: 'A' | 'B' = 'B';

/** Traffic seed (§5). Every player meets the same course on the same level. */
export const TRAFFIC_SEED = 'overtake-v1';
/** Traffic only lives inside [600, U − 400] px (§2, §5). */
export const TRAFFIC_START = 600 * SUB;
export const GOAL_CLEARANCE = 400 * SUB;
/** Room kept after the last gate target so a pair always fits (§5). */
export const GATE_TAIL = 700;
/** Work bound on generation: rows per course (§5, §17). */
export const GEN_ROW_LIMIT = 200;
/** σ of the second wall of the easy pair, in ‰ (§5, §7). */
export const EASY_SIGMA = 1100;

/** The starting grid (§2): front edge r and centre x, in units. */
export const PLAYER_START = { r: -90 * SUB, x: 152 * SUB } as const;
/** Rivals 1 (fastest) .. 3. */
export const RIVAL_STARTS = [
  { r: -90 * SUB, x: 256 * SUB },
  { r: 0, x: 208 * SUB },
  { r: 0, x: 104 * SUB },
] as const;
export const RIVAL_COUNT = 3;

/** Planner (§6): view window, decision cadence, speed grid. */
export const VIEW_DISTANCE = 480 * SUB;
export const DECISION_INTERVAL = 4;
export const SPEED_GRID_STEP = 20;
/**
 * Steps a held decision can lose at a constraint that relaxes (a window that
 * ends): the next decision comes at most DECISION_INTERVAL − 1 steps late
 * (§6 "判断の間隔の遅れ").
 */
export const DECISION_LAG = DECISION_INTERVAL - 1;
/**
 * Work bound on one planLane decision, in interval operations (§6, §17): the
 * candidates are tried only while the work so far is below it; at the bound
 * the planner stops and returns its crawl decision (`feasible: false`,
 * `capped: true`). Far above anything measured (93) — a guard, not a tuning.
 */
export const PLAN_WORK_LIMIT = 4000;

/** Work bound on a bot's race (§6, §17): 600 s. */
export const MAX_RACE_STEPS = 72_000;

/** Pace (§6): triangle period and phase in px, swing in percent. */
export const PACE_PERIOD = 4000;
export const PACE_PHASE = 1333;
export const PACE_SWING_PERCENT = 6;
/** Target times of rivals 2 and 3 relative to rival 1, in ‰ (§6). */
export const RIVAL_TIME_RATIOS = [1000, 1040, 1090] as const;
