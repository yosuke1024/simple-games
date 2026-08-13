import type { EnemyGun, EnemyKind } from './types';

/**
 * The production wave seed. A stage is a promise: every player, and the same
 * player across app updates, must meet the same waves
 * (docs/SKY_FIGHTER_RULES.md §1). Changing this string moves every stage —
 * the golden test makes that a decision instead of an accident.
 *
 * This string is *chosen*, not incremented. The six-craft roster (§4) moved
 * every formation on its own, so the seed was renamed with it rather than
 * leaving `v1` pointing at skies no v1 player ever flew — and then the
 * candidates were auditioned on what stage 1 actually fields. `v2` drew twelve
 * unarmed fighters and a single bomber across its entire opening stage, which
 * is a poor first impression of a roster whose whole point is that the sky
 * shoots back. `v3` opens with bombers and gunships in each of the first four
 * stages. Hence the gap in the numbering: it counts seeds, not rosters.
 *
 * What is *not* derived from this seed: item drops and boss rewards, which
 * roll from the per-run seed instead, so two runs over the same skies still
 * grow different ships (§5).
 */
export const BOARD_SEED = 'sky-fighter-v3';

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
/** Hits at zero bonus, by size: the big ones soak two, everything smaller one. */
export const ENEMY_BASE_HP = [2, 1, 1] as const;
export const ENEMY_SPLIT_SPEED = 52;
export const SMALLEST_TIER = ENEMY_RADII.length - 1;

/**
 * The craft roster (§4). Size is one axis and kind is the other: the tier
 * below decides how big a craft is, how much it soaks and whether it can drop
 * anything, while the tables after it decide how it flies and what it fires.
 *
 * Three kinds form the splitting chain (bomber → fighter → scout) and three
 * enter waves as themselves. Every one of them is a plain table entry, so
 * adding the seventh craft is a row rather than a branch.
 */
export const ENEMY_KIND_TIER: Readonly<Record<EnemyKind, number>> = {
  bomber: 0,
  heavy: 0,
  fighter: 1,
  gunship: 1,
  scout: 2,
  darter: 2,
};

/** Radius per kind, read straight from its size class — one lookup per frame. */
export const ENEMY_KIND_RADIUS: Readonly<Record<EnemyKind, number>> = {
  bomber: ENEMY_RADII[ENEMY_KIND_TIER.bomber]!,
  heavy: ENEMY_RADII[ENEMY_KIND_TIER.heavy]!,
  fighter: ENEMY_RADII[ENEMY_KIND_TIER.fighter]!,
  gunship: ENEMY_RADII[ENEMY_KIND_TIER.gunship]!,
  scout: ENEMY_RADII[ENEMY_KIND_TIER.scout]!,
  darter: ENEMY_RADII[ENEMY_KIND_TIER.darter]!,
};

/**
 * What a downed craft becomes — two of it, or nothing.
 *
 * The heavy is the deliberate exception to "splitting quietens the sky" (§4):
 * it breaks into two *armed* gunships, so leaving one half-finished is worse
 * than never having shot it. Everything else calms down as it comes apart.
 */
export const ENEMY_KIND_SPLITS_INTO: Readonly<Record<EnemyKind, EnemyKind | null>> = {
  bomber: 'fighter',
  fighter: 'scout',
  heavy: 'gunship',
  gunship: 'scout',
  scout: null,
  darter: null,
};

/** Extra hits on top of the size class, for the kinds built to soak them. */
export const ENEMY_KIND_HP_BONUS: Readonly<Record<EnemyKind, number>> = {
  bomber: 0,
  fighter: 0,
  scout: 0,
  heavy: 2,
  gunship: 1,
  darter: 0,
};

/**
 * Points per kill. The chain pays by size, exactly as before; the three craft
 * that enter as themselves pay a little more, because each of them is a thing
 * the player chose to deal with rather than a piece of something bigger.
 */
export const ENEMY_KIND_SCORE: Readonly<Record<EnemyKind, number>> = {
  bomber: 10,
  fighter: 20,
  scout: 30,
  heavy: 20,
  gunship: 35,
  darter: 45,
};

/** Which gun a kind carries (§4). */
export const ENEMY_KIND_GUN: Readonly<Record<EnemyKind, EnemyGun>> = {
  bomber: 'straight',
  heavy: 'spread',
  gunship: 'aimed',
  fighter: 'none',
  scout: 'none',
  darter: 'none',
};

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

/** A caught weapon crate with every axis capped converts to points instead. */
export const CAPPED_WEAPON_BONUS = 100;
/** A chosen Bonus reward (offered only when nothing else is left) pays this. */
export const REWARD_BONUS_SCORE = 500;

/**
 * Three of the six kinds shoot, and each in its own voice (§4).
 *
 * Arming *every* craft would bury the screen and stack a fourth pressure on
 * top of splitting, contact and the boss. Arming three of them instead keeps
 * the roster tactical: what a craft fires is the reason to shoot it first, and
 * with one exception (the heavy) everything a craft breaks into is quieter
 * than the craft was.
 */
/** Slow enough to read and step around, not to react to. */
export const ENEMY_BULLET_SPEED = 175;
export const ENEMY_BULLET_RADIUS = 2.5;
/**
 * Base interval per gun, before the stage scaling in `enemyFireIntervalMs`.
 * All three are staggered per craft so a formation never fires as one.
 */
export const ENEMY_FIRE_INTERVAL_MS = 1900;
export const HEAVY_FIRE_INTERVAL_MS = 2800;
export const GUNSHIP_FIRE_INTERVAL_MS = 1600;
/** By stage 100 every enemy gun is this much quicker on the trigger. */
export const ENEMY_FIRE_STAGE_SCALE = 0.4;
/** No gun may cycle faster than this, whatever the stage. */
export const MIN_ENEMY_FIRE_INTERVAL_MS = 700;
/** The heavy's curtain: how many shots, and how wide it opens (radians). */
export const HEAVY_SPREAD_COUNT = 3;
export const HEAVY_SPREAD_ANGLE = 0.32;
/** A gunship's aim is deliberately imperfect — a lead, not a laser. */
export const GUNSHIP_AIM_JITTER = 0.09;

/**
 * The darter's flight model (§4): the one craft that comes for the ship
 * instead of falling past it. It leans toward the ship's column at a fixed
 * acceleration and is capped well under the ship's own speed, so it is always
 * out-flyable — the threat is that it arrives, not that it cannot be dodged.
 */
export const DARTER_STEER_ACCEL = 190;
export const DARTER_MAX_DX = 115;
/** Darters dive faster than the wave they entered with. */
export const DARTER_FALL_BONUS = 58;

/** Every tenth stage is a boss (§7): a plain rule, checkable at a glance. */
export const BOSS_STAGE_INTERVAL = 10;
/** How fast a boss descends to its fighting altitude on entry. */
export const BOSS_ENTRY_SPEED = 90;
export const BOSS_SCORE_BASE = 200;
export const BOSS_SCORE_PER_STAGE = 10;
