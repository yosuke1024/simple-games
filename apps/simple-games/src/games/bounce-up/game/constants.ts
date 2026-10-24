/**
 * Every number docs/BOUNCE_UP_RULES.md fixes for the logic, in one place
 * (§2「定数」, §3). All are initial values (「初期値」): changing one is a
 * decision made in the same commit as the rules document, and most of them
 * move the golden tower in compatibility.test.ts.
 *
 * Units (§2): positions are integers in 1/120 px (`SUB`), speeds integers in
 * px/s, so one fixed step of 1/120 s moves the body by exactly its speed's
 * number of units. Heights grow upward from the floor's top surface (0).
 */
import { exactDiv } from './arith';

/** Sub-pixel units per logical px; also the steps per second. */
export const SUB = 120;
export const STEPS_PER_SECOND = 120;

/** The logical board (§1). */
export const BOARD_WIDTH_PX = 360;
export const BOARD_HEIGHT_PX = 640;
export const BOARD_WIDTH = BOARD_WIDTH_PX * SUB;
export const BOARD_HEIGHT = BOARD_HEIGHT_PX * SUB;

/** Gravity 1800 px/s²: the vertical speed drops by 15 px/s per step (§2). */
export const GRAVITY = 1800;
export const GRAVITY_PER_STEP = exactDiv(GRAVITY, STEPS_PER_SECOND);
/** The bounce: upward speed set on the step the body lands (§2). */
export const JUMP_SPEED = 760;
/** The body chases its target x at most this fast, px/s = units per step (§2). */
export const RUN_SPEED = 600;
/** The target x never leads the body by more than this (§4). */
export const LEAD_MAX = 48 * SUB;

/** The drawn body, 28 × 28 px; only the foot decides a landing (§2). */
export const BODY_WIDTH = 28 * SUB;
export const BODY_HEIGHT = 28 * SUB;
/** A landing counts while the body's centre is within this of a platform (§2). */
export const FOOT_HALF = 10 * SUB;

/** Platform widths: Wide is 1.5 × Normal (§1, §3). */
export const PLATFORM_WIDTH_PX = { normal: 64, wide: 96 } as const;
/** Drawn thickness only: a landing is decided on the top surface (§2). */
export const PLATFORM_THICKNESS = 10 * SUB;

/** The camera rises when the foot is more than this above the bottom edge (§2). */
export const CAMERA_ANCHOR = 280 * SUB;
/** At the start the floor sits this far above the bottom edge (§2). */
export const START_FLOOR_MARGIN = 96 * SUB;
/** Platforms are generated up to this far above the top edge (§2 step 8). */
export const GEN_AHEAD = 160 * SUB;
/** Platforms this far below the bottom edge are dropped (§2 step 8). */
export const PRUNE_BELOW = 64 * SUB;

/** Score = floor(maxHeight / SCORE_PX px) (§4). */
export const SCORE_PX = 10;

/** The frame loop's cap: steps run per frame, and the carry it may keep (§2). */
export const MAX_STEPS_PER_FRAME = 6;
/** Frame time is counted in 1/120,000 s: one step is exactly 1,000 of them (§2). */
export const FRAME_UNITS_PER_STEP = 1000;
export const FRAME_UNITS_PER_MS = 120;

/** Generation (§3). Ramps run from segment 1 to RAMP_SEGMENTS, then stay. */
export const RAMP_SEGMENTS = 180;
export const GAP_MIN_PX = { start: 48, end: 96 } as const;
export const GAP_MAX_PX = { start: 72, end: 128 } as const;
export const CHAIN_DISTANCE_PX = { start: 110, end: 170 } as const;
/** Chance of an extra platform in a segment, in ‰ (§3). */
export const EXTRA_PERMILLE = { start: 600, end: 350 } as const;
/** Kinds appear by segment index (§3, §12). */
export const MOVING_FROM = 40;
export const VANISHING_FROM = 60;
/** Short, readable phrases: 3–5 challenge steps, then 3–5 static rest steps. */
export const CHALLENGE_FROM = 20;
export const PHRASE_SEGMENTS = 8;
export const CHALLENGE_GAP_MIN = 90;
export const CHALLENGE_GAP_MAX = 110;
/** The required moving bridge travels farther than Normal's landing width. */
export const CHAIN_MOVE_SPAN_PX = 96;
export const CHAIN_MOVE_SPEED = 60;
/** Moving platforms: travel 96–224 px, speed 40–80 px/s (§3). */
export const MOVE_SPAN_PX = { min: 96, max: 224 } as const;
export const MOVE_SPEED = { min: 40, max: 80 } as const;

/** Work bounds on generation (§3「仕事量」, §11). */
export const GEN_PER_STEP_LIMIT = 4;
export const INITIAL_SEGMENTS_LIMIT = 40;

/** The share of the apex a segment's gap may use, in % (§3 invariant 1). */
export const GAP_APEX_PERCENT = 82;
/** The share of RUN_SPEED the safety chain may require, in % (§3 invariant 3). */
export const CHAIN_SPEED_PERCENT = 70;
