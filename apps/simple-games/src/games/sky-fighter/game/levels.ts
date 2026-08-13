/**
 * The difficulty ladder. 100 levels, like the rest of the collection.
 *
 * The shape that matters is *inside* a level, not across the ladder: every
 * level starts the player at one barrel and ends on its hardest wave, so the
 * arc "weak → armed → just barely" happens once per level instead of once per
 * install. Power never carries over, which is what keeps that arc repeatable.
 *
 * Every lever here is continuous in `level` — nothing saturates before 100.
 * An earlier endless build capped enemy count at wave 9 and fall speed at
 * wave 18, after which the game stopped changing; that is the failure this
 * table exists to avoid.
 */
import {
  BOSS_STAGE_INTERVAL,
  ENEMY_BASE_HP,
  ENEMY_FIRE_INTERVAL_MS,
  ENEMY_FIRE_STAGE_SCALE,
  ENEMY_KIND_GUN,
  ENEMY_KIND_HP_BONUS,
  ENEMY_KIND_TIER,
  GUNSHIP_FIRE_INTERVAL_MS,
  HEAVY_FIRE_INTERVAL_MS,
  MIN_ENEMY_FIRE_INTERVAL_MS,
  SMALLEST_TIER,
} from './constants';
import type { BossKind, EnemyKind } from './types';

export const LEVEL_COUNT = 100;

function clampLevel(level: number): number {
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)));
}

/** 0 at level 1, 1 at level 100. */
function progress(level: number): number {
  return (clampLevel(level) - 1) / (LEVEL_COUNT - 1);
}

/** The arc gets longer as well as sharper: 4 waves early, 6 by the end. */
export function wavesInLevel(level: number): number {
  return 4 + Math.floor((clampLevel(level) - 1) / 34);
}

/**
 * The kinds that may *enter* a wave, and the stage each one joins from.
 *
 * Scouts are missing on purpose: the smallest craft is something the player
 * makes by shooting, never something the stage hands them. The three armed or
 * diving kinds arrive early — a sky where nothing shoots back for ten stages
 * is a sky with nothing to learn in it — and their share keeps growing to 100.
 *
 * `weight` is relative, not a probability: one draw picks from the kinds
 * unlocked at that stage, so adding a kind never silently rescales the rest.
 */
interface KindEntry {
  kind: EnemyKind;
  fromStage: number;
  weight: (t: number) => number;
}

const WAVE_MIX: readonly KindEntry[] = [
  // The baseline craft: unarmed, splits into two scouts, always present.
  { kind: 'fighter', fromStage: 1, weight: (t) => 1.15 - t * 0.55 },
  // The straight-shooting slab that has been here since v1.
  { kind: 'bomber', fromStage: 1, weight: (t) => 0.4 + t * 0.7 },
  // Aimed fire, from the first stage: the craft that makes standing still
  // wrong. Rare at stage 1 and common by stage 100 — the sky answers back from
  // the opening wave, which is the difference the roster exists to make.
  { kind: 'gunship', fromStage: 1, weight: (t) => 0.32 + t * 0.8 },
  // The diver, from stage 3: unarmed, but it comes to the ship.
  { kind: 'darter', fromStage: 3, weight: (t) => 0.22 + t * 0.85 },
  // The curtain, from stage 8: rare, slow, and the one that splits into guns.
  { kind: 'heavy', fromStage: 8, weight: (t) => 0.12 + t * 0.6 },
];

export interface WaveSpec {
  /** Enemies entering this wave. */
  count: number;
  /**
   * The kinds this stage may send, with their relative weights. A big craft
   * becomes seven objects before it is gone (1 → 2 → 4), a medium one three,
   * so the mix is the lever for how crowded the screen gets — and now also
   * for how much of it shoots back.
   */
  mix: readonly { kind: EnemyKind; weight: number }[];
  speedMin: number;
  speedMax: number;
}

export function waveSpec(level: number, waveInLevel: number): WaveSpec {
  const stage = clampLevel(level);
  const t = progress(level);
  const waves = wavesInLevel(level);
  const index = Math.min(waves - 1, Math.max(0, waveInLevel));
  const isFinal = index === waves - 1;
  // Within a level the waves tighten a little; the last one is the wall.
  const withinLevel = index * 3;
  return {
    count: 3 + Math.round(t * 3) + (isFinal ? 1 : 0),
    mix: WAVE_MIX.filter((entry) => stage >= entry.fromStage).map((entry) => ({
      kind: entry.kind,
      weight: entry.weight(t),
    })),
    speedMin: 40 + t * 45 + withinLevel,
    speedMax: 62 + t * 58 + withinLevel,
  };
}

/** Every tenth stage is a boss (docs/SKY_FIGHTER_RULES.md §7). */
export function isBossStage(level: number): boolean {
  return clampLevel(level) % BOSS_STAGE_INTERVAL === 0;
}

/**
 * Hits a craft takes at this stage: its size class, plus what the kind is
 * built to soak. Only the larger sizes thicken with the ladder — the smallest
 * craft stay one-shot kills for the whole hundred stages, so clearing a
 * cascade never turns into chipping, and a darter is always answerable with a
 * single well-placed shot (§4).
 */
export function enemyHp(level: number, kind: EnemyKind): number {
  const tier = ENEMY_KIND_TIER[kind];
  const base = (ENEMY_BASE_HP[tier] ?? 1) + ENEMY_KIND_HP_BONUS[kind];
  if (tier >= SMALLEST_TIER) return base;
  return base + Math.floor(clampLevel(level) / 25);
}

/**
 * How long this craft waits between shots at this stage (§4). Every gun gets
 * quicker as the ladder climbs, and every gun stops at the same floor: the
 * screen has to stay readable at stage 100 on a weak WebView.
 */
export function enemyFireIntervalMs(level: number, kind: EnemyKind): number {
  const gun = ENEMY_KIND_GUN[kind];
  if (gun === 'none') return 0;
  const base =
    gun === 'spread'
      ? HEAVY_FIRE_INTERVAL_MS
      : gun === 'aimed'
        ? GUNSHIP_FIRE_INTERVAL_MS
        : ENEMY_FIRE_INTERVAL_MS;
  const scaled = base * (1 - progress(level) * ENEMY_FIRE_STAGE_SCALE);
  return Math.max(MIN_ENEMY_FIRE_INTERVAL_MS, Math.round(scaled));
}

export interface BossSpec {
  kind: BossKind;
  hp: number;
  radius: number;
  /** Horizontal patrol speed once at fighting altitude. */
  speed: number;
  targetY: number;
  fireIntervalMs: number;
  /** Shots per volley (fighter fan / bomber curtain / carrier's lone shot). */
  bulletCount: number;
  bulletSpeed: number;
  /** Carrier only: interval between launched dart pairs. */
  spawnIntervalMs: number;
}

const BOSS_KINDS: readonly BossKind[] = ['fighter', 'bomber', 'carrier'];

/**
 * The boss ladder (§7). Three archetypes cycle — stage 10 fighter, 20 bomber,
 * 30 carrier, 40 fighter again — while every lever below scales with the
 * stage, so the fourth fighter is not the first one. All of it is a plain
 * formula in stage, like the wave table above.
 */
export function bossSpec(level: number): BossSpec {
  const stage = clampLevel(level);
  const ordinal = Math.max(0, Math.floor(stage / BOSS_STAGE_INTERVAL) - 1);
  const kind = BOSS_KINDS[ordinal % BOSS_KINDS.length]!;
  const hp = 40 + stage * 4;
  if (kind === 'bomber') {
    return {
      kind,
      hp: Math.round(hp * 1.25),
      radius: 42,
      speed: 38 + stage * 0.4,
      targetY: 108,
      fireIntervalMs: Math.max(1300, 2600 - stage * 8),
      bulletCount: Math.min(9, 6 + Math.floor(stage / 30)),
      bulletSpeed: 150 + stage * 0.5,
      spawnIntervalMs: 0,
    };
  }
  if (kind === 'carrier') {
    return {
      kind,
      hp: Math.round(hp * 1.1),
      radius: 40,
      speed: 62 + stage * 0.5,
      targetY: 112,
      fireIntervalMs: Math.max(2200, 3400 - stage * 8),
      bulletCount: 1,
      bulletSpeed: 170 + stage * 0.5,
      spawnIntervalMs: Math.max(1500, 2900 - stage * 10),
    };
  }
  return {
    kind,
    hp,
    radius: 32,
    speed: 100 + stage * 0.7,
    targetY: 118,
    fireIntervalMs: Math.max(850, 1600 - stage * 5),
    bulletCount: Math.min(5, 3 + Math.floor(stage / 35)),
    bulletSpeed: 175 + stage * 0.6,
    spawnIntervalMs: 0,
  };
}
