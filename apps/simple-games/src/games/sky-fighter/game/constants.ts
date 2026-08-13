/**
 * The production wave seed. A stage is a promise: every player, and the same
 * player across app updates, must meet the same waves
 * (docs/SKY_FIGHTER_RULES.md §1). Changing this string moves every stage —
 * the golden test makes that a decision instead of an accident.
 *
 * What is *not* derived from this seed: item drops and boss rewards, which
 * roll from the per-run seed instead, so two runs over the same skies still
 * grow different ships (§5).
 */
export const BOARD_SEED = 'sky-fighter-v1';

export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 640;

/** Where the ship starts; it may fly the whole box below SHIP_MIN_Y (§3). */
export const SHIP_START_Y = 578;
export const SHIP_RADIUS = 11;
/** The strip reserved for entering waves and the boss bar — no flying there. */
export const SHIP_MIN_Y = 90;
/** Keyboard nudge speed; a dragging finger sets the position outright. */
export const SHIP_SPEED = 420;

export const BULLET_SPEED = 540;
export const BULLET_RADIUS = 2.5;

/**
 * Firing cadence: the base interval, how much each Rapid level shaves off,
 * and the floor no build may pass — the screen must stay readable and a
 * low-end WebView must survive the bullet count (§5).
 */
export const FIRE_INTERVAL_MS = 200;
export const RAPID_STEP_MS = 22;
export const MIN_FIRE_INTERVAL_MS = 90;

/**
 * The weapon grows on independent axes, each a small capped level
 * (docs/SKY_FIGHTER_RULES.md §5). All of it is earned in play, free, and
 * gone when the run ends — never bought, never behind an ad, never carried
 * between runs (docs/PRODUCT_PRINCIPLES.md forbids all three).
 */
export const POWER_MAX_LEVEL = 4;
export const RAPID_MAX_LEVEL = 5;
export const SPREAD_MAX_LEVEL = 4;
export const MISSILE_MAX_LEVEL = 3;

/** Parallel barrels sit this far either side of the nose. */
export const BARREL_OFFSET = 5;

export const MISSILE_SPEED = 310;
/** Radians per second a missile may bend toward its mark — gentle, readable. */
export const MISSILE_TURN_RATE = 3.2;
export const MISSILE_RADIUS = 3;
export const MISSILE_INTERVAL_MS = 1500;
/** Missiles locked onto the boss carry this target id. */
export const BOSS_TARGET_ID = -1;

export const ITEM_RADIUS = 7;
export const ITEM_FALL_SPEED = 95;
/**
 * Per-kill drop rolls, smallest tier only (§5). One roll decides the kind:
 * rarest first. Tuned so stages 1–9 hand out a few weapon upgrades, the odd
 * repair, and almost never a Max Life — the big steps come from bosses.
 */
export const MAXLIFE_DROP_CHANCE = 0.004;
export const LIFE_DROP_CHANCE = 0.014;
export const WEAPON_DROP_CHANCE = 0.042;

/**
 * Three sizes, one concept: a downed enemy splits into two smaller ones until
 * the smallest is destroyed for good. Pressure comes from what the player's
 * own shots create.
 */
export const ENEMY_RADII = [22, 14, 9] as const;
/** Hits at zero bonus: the bomber soaks two, everything smaller one. */
export const ENEMY_BASE_HP = [2, 1, 1] as const;
export const ENEMY_SPLIT_SPEED = 52;
export const SMALLEST_TIER = ENEMY_RADII.length - 1;

export const ENEMY_FALL_MIN = 42;
export const ENEMY_FALL_MAX = 70;
export const FALL_SPEED_PER_WAVE = 3.5;
export const MAX_FALL_SPEED = 130;

/** Hearts: where a run starts and the most a run can ever hold (§6). */
export const STARTING_LIVES = 3;
export const MAX_LIVES_CAP = 6;
/** Grace after a hit: enemies pass through the ship instead of chaining. */
export const INVULNERABLE_MS = 1200;
/** Quiet beat between waves and stages — a breath, not a timer. */
export const WAVE_BREAK_MS = 900;

export const SCORE_PER_TIER = [10, 20, 30] as const;
/** A caught weapon crate with every axis capped converts to points instead. */
export const CAPPED_WEAPON_BONUS = 100;
/** A chosen Bonus reward (offered only when nothing else is left) pays this. */
export const REWARD_BONUS_SCORE = 500;

/**
 * Only the bomber tier shoots back.
 *
 * Arming every enemy would bury the screen and stack a fourth pressure on top
 * of splitting, contact and the boss. Arming the largest one instead gives
 * the tiers a tactical meaning: the bomber is the thing to kill first, and
 * killing it makes the sky quieter, because everything it breaks into is
 * unarmed.
 */
export const FIRING_TIER = 0;
/** Slow enough to read and step around, not to react to. */
export const ENEMY_BULLET_SPEED = 175;
export const ENEMY_BULLET_RADIUS = 2.5;
/** Long, and staggered per enemy so a formation never fires as one. */
export const ENEMY_FIRE_INTERVAL_MS = 2300;

/** Every tenth stage is a boss (§7): a plain rule, checkable at a glance. */
export const BOSS_STAGE_INTERVAL = 10;
/** How fast a boss descends to its fighting altitude on entry. */
export const BOSS_ENTRY_SPEED = 90;
export const BOSS_SCORE_BASE = 200;
export const BOSS_SCORE_PER_STAGE = 10;
