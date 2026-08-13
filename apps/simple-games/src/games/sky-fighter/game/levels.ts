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
import { BOSS_STAGE_INTERVAL, ENEMY_BASE_HP, SMALLEST_TIER } from './constants';
import type { BossKind } from './types';

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

export interface WaveSpec {
  /** Enemies entering this wave. */
  count: number;
  /**
   * Chance a enemy enters at the largest tier. A large enemy becomes seven
   * objects before it is gone (1 → 2 → 4), a medium one three — so this is the
   * lever that raises how crowded the screen gets, not just how fast.
   */
  bigChance: number;
  speedMin: number;
  speedMax: number;
}

export function waveSpec(level: number, waveInLevel: number): WaveSpec {
  const t = progress(level);
  const waves = wavesInLevel(level);
  const index = Math.min(waves - 1, Math.max(0, waveInLevel));
  const isFinal = index === waves - 1;
  // Within a level the waves tighten a little; the last one is the wall.
  const withinLevel = index * 3;
  return {
    count: 2 + Math.round(t * 3) + (isFinal ? 1 : 0),
    bigChance: 0.25 + t * 0.65,
    speedMin: 40 + t * 45 + withinLevel,
    speedMax: 62 + t * 58 + withinLevel,
  };
}

/** Every tenth stage is a boss (docs/SKY_FIGHTER_RULES.md §7). */
export function isBossStage(level: number): boolean {
  return clampLevel(level) % BOSS_STAGE_INTERVAL === 0;
}

/**
 * Hits an enemy of `tier` takes at this stage. Only the two splitting tiers
 * thicken with the ladder — the smallest stays a one-shot kill for the whole
 * hundred stages, so clearing a cascade never turns into chipping (§4).
 */
export function enemyHp(level: number, tier: number): number {
  const base = ENEMY_BASE_HP[tier] ?? 1;
  if (tier >= SMALLEST_TIER) return base;
  return base + Math.floor(clampLevel(level) / 25);
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
