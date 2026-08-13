/**
 * The production board seed. A level is a promise: every player, and the same
 * player across app updates, must see the same starting board
 * (docs/BUBBLE_POP_RULES.md §1). Changing this string moves every board — the
 * golden test makes that a decision instead of an accident.
 */
export const BOARD_SEED = 'bubble-pop-v1';

/**
 * Portrait board, 320 wide (docs/plans/2026-08-08-mahjong-bubble-ludo.md
 * §Bubble Pop), roughly 1:2 like the rest of this collection's Canvas games
 * (Brick Breaker is 360×640) — a single view, no camera or scroll. See
 * LOSS_LINE_Y below for how this height was sized against the deepest
 * starting row rather than picked first and squared against it after.
 */
export const BOARD_WIDTH = 320;
export const BOARD_HEIGHT = 672;

/**
 * 8 columns on the wide (even) rows. At 320px this puts the bubble diameter
 * at 40px — comfortable for a fingertip aim on a 320px screen. 9 columns
 * would shrink the diameter to ~35.5px with no even divisor of the board
 * width, forcing sub-pixel column edges; 8 keeps every column boundary an
 * integer and leaves the largest touch target the width still affords.
 */
export const COLUMNS = 8;

export const CELL_RADIUS = BOARD_WIDTH / (COLUMNS * 2);
export const CELL_DIAMETER = CELL_RADIUS * 2;

/**
 * Vertical spacing between adjacent hex rows. Two tangent circles one row
 * apart are offset by CELL_RADIUS horizontally, so the row pitch is the
 * other leg of a triangle whose hypotenuse is the diameter: sqrt((2r)^2 - r^2).
 */
export const ROW_HEIGHT = CELL_RADIUS * Math.sqrt(3);

/** Row 0's cell centers sit exactly one radius below the physical ceiling. */
export const GRID_TOP = CELL_RADIUS;

export const LAUNCHER_X = BOARD_WIDTH / 2;
export const LAUNCHER_Y = BOARD_HEIGHT - 24;

/**
 * The loss line (dotted, per spec): a bubble whose lowest edge reaches this
 * y fails the level outright, the same shape as Brick Breaker's
 * DESCENT_LINE_Y. Kept a full row and a half above the launcher so the
 * launcher itself is never in the danger band.
 *
 * The margin between the deepest starting row (row 8, levels.ts's rows = 9
 * at level 100) and this line is about 8 row heights at BOARD_HEIGHT = 672 —
 * i.e. at LEVEL_COUNT's descentEvery = 5 shots per drop, roughly 40 shots of
 * runway before an untouched bottom row fails the level. That is the
 * pressure §3 asks for: a wide margin (an earlier draft used ~22 rows, ~110
 * shots of runway) makes the loss line decorative, not a threat, and reads
 * as the clock-stripped-off timer the collection's brand forbids — the
 * margin has to be tight enough that clearing efficiently is the only way
 * through, the same as Brick Breaker's wall. 672 rather than a plainer 640
 * is not padding for its own sake: it is the smallest height inside the
 * requested 6–8 row band that a strengthened shooter (see below) could
 * clear the full shipped ladder against — 640 (≈7.1 rows) left 8 of 100
 * levels unclearable even with that shooter.
 *
 * A margin this tight only ships because clearability moved to the other
 * side of the equation: **the shooter, not the runway, is what's proven
 * strong enough.** autoplay.test.ts plays every one of the 100 shipped-seed
 * (BOARD_SEED) levels with a shooter that biases toward clearing the
 * *deepest* occupied rows first, not just any pop — see that file's
 * `scoreCellForColor` — because a shallow-but-large pop can leave the
 * dangerous bottom rows untouched even while it feels productive. A human
 * player, who can plan a shot around the whole board rather than one
 * greedy score, has more room than this bot does, not less.
 *
 * The clearability claim is scoped to BOARD_SEED specifically, not to
 * "boards in general": a level's identity is (BOARD_SEED, level), pinned by
 * compatibility.test.ts's golden, and autoplay.test.ts proves exactly that
 * frozen set of 100 boards is clearable — it does not and cannot promise
 * every hypothetical seed would be. That is by design, not a gap: changing
 * BOARD_SEED, the rng, the generator, or this geometry already fails the
 * golden and must be treated as shipping new levels, at which point
 * autoplay.test.ts has to be re-run (and will be, automatically, since it
 * runs on every change) before the new boards can be trusted.
 */
export const LOSS_LINE_Y = LAUNCHER_Y - ROW_HEIGHT * 1.5;

/**
 * Aim is clamped to this many radians off vertical in both directions —
 * about 70°, leaving at least 20° of headroom above horizontal. Below that
 * headroom a shot reads as "sideways" rather than "aimed", and — because the
 * simulator advances by a fixed vertical step regardless of how many walls a
 * shot bounces off — a shallower angle only costs more simulation steps, it
 * never risks not terminating (vy never changes sign in flight). 70° keeps
 * every legal shot inside a few hundred steps while still allowing a shot
 * that must bank off both walls to reach in behind a near-side cluster.
 */
export const AIM_MAX_ANGLE_FROM_VERTICAL = (70 * Math.PI) / 180;

/** Same-color connected group size that pops on placement. */
export const POP_MIN_CLUSTER = 3;

/**
 * The fixed physics timestep used inside `simulateShot` (Brick Breaker's
 * STEP_MS idiom). Resolution happens in one batched call rather than being
 * driven by rAF, so there is no per-frame accumulator to cap — the loop
 * itself is bounded by MAX_TRAJECTORY_STEPS below, and the returned path is
 * just data for the UI to replay.
 */
export const SHOT_STEP_MS = 1000 / 240;

/** Projectile speed, pixels per second. */
export const SHOT_SPEED = 720;

/**
 * Defensive cap on `simulateShot`'s internal loop. Vertical velocity never
 * changes sign in flight, so a shot from LAUNCHER_Y to the ceiling always
 * terminates in a bounded number of steps: distance / (speed * cos(angle) *
 * dt), independent of how many times it bounces off a side wall (bounces
 * only ever change the horizontal component). At the
 * AIM_MAX_ANGLE_FROM_VERTICAL clamp with BOARD_HEIGHT's runway that worst
 * case is around six hundred — guide.test.ts and autoplay.test.ts exercise
 * many thousands of real shots across the whole board and level range
 * without ever hitting this fallback. The cap exists only so a future
 * change to the geometry or clamp fails loudly (an unresolved shot lands at
 * the fallback cell, which reads as "wrong cell" in a test) instead of
 * hanging.
 */
export const MAX_TRAJECTORY_STEPS = 8000;

/**
 * Colors, ordered. The accent is oxblood (#712d2f, Phase 1 result) and the
 * aim guide is drawn in the accent color over the bubbles, so the palette
 * keeps clear of that hue family — v1 ships with no red bubble color
 * (docs/plans/2026-08-08-mahjong-bubble-ludo.md §Bubble Pop §12). Actual
 * paint colors belong to the UI layer; this is identifiers only, in the
 * fixed order lower levels' colors are a prefix of higher levels' — so
 * raising the level's color count only ever adds a color, never swaps one.
 */
export const COLOR_ORDER = ['blue', 'green', 'yellow', 'purple', 'orange', 'cyan'] as const;
