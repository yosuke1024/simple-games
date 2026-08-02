/**
 * The production wave seed. A level is a promise: every player, and the same
 * player across app updates, must meet the same waves
 * (docs/SKY_FIGHTER_RULES.md §1). Changing this string moves every level —
 * the golden test makes that a decision instead of an accident.
 */
export const BOARD_SEED = 'sky-fighter-v1';

export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 640;

export const SHIP_Y = 578;
export const SHIP_RADIUS = 11;
/** Keyboard nudge speed; a dragging finger sets the position outright. */
export const SHIP_SPEED = 420;

export const BULLET_SPEED = 540;
export const BULLET_RADIUS = 2.5;
export const FIRE_INTERVAL_MS = 200;

/**
 * Power is one axis and one axis only: how many barrels fire. It is earned in
 * play, free, and gone when the run ends — never bought, never behind an ad,
 * never carried between runs (docs/PRODUCT_PRINCIPLES.md forbids all three).
 *
 * The level is readable from the shots themselves, so it costs no HUD, no
 * icon legend and no translated string.
 */
export const POWER_MIN = 1;
export const POWER_MAX = 3;
/** Parallel barrels at power 2 sit this far either side of the nose. */
export const BARREL_OFFSET = 5;
/** Outer barrels at power 3 fan out by this much (radians). */
export const BARREL_SPREAD = 0.2;

export const TOKEN_RADIUS = 7;
export const TOKEN_FALL_SPEED = 95;
/** Chance a kill leaves a token behind. Rolled deterministically per enemy. */
export const TOKEN_DROP_CHANCE = 0.22;

/**
 * Three sizes, one concept: a hit splits a enemy into two smaller ones until
 * the smallest is destroyed for good. No enemy types, no enemy fire — the pressure
 * comes from what the player's own shots create.
 */
export const ENEMY_RADII = [22, 14, 9] as const;
export const ENEMY_SPLIT_SPEED = 52;
export const SMALLEST_TIER = ENEMY_RADII.length - 1;

export const ENEMY_FALL_MIN = 42;
export const ENEMY_FALL_MAX = 70;
export const FALL_SPEED_PER_WAVE = 3.5;
export const MAX_FALL_SPEED = 130;

export const STARTING_LIVES = 3;
/** Grace after a hit: enemies pass through the ship instead of chaining. */
export const INVULNERABLE_MS = 1200;
/** Quiet beat between waves — the game's only pause, and it is not a timer. */
export const WAVE_BREAK_MS = 900;

export const SCORE_PER_TIER = [10, 20, 30] as const;

/**
 * Only the bomber shoots back.
 *
 * Arming every enemy would bury the screen and stack a fourth pressure on top
 * of splitting, contact and the barrel you lose when hit. Arming the largest
 * one instead gives the tiers a tactical meaning they did not have: the bomber
 * is the thing to kill first, and killing it makes the sky quieter, because
 * everything it breaks into is unarmed.
 */
export const FIRING_TIER = 0;
/** Slow enough to read and step around, not to react to. */
export const ENEMY_BULLET_SPEED = 175;
export const ENEMY_BULLET_RADIUS = 2.5;
/** Long, and staggered per enemy so a formation never fires as one. */
export const ENEMY_FIRE_INTERVAL_MS = 2300;
