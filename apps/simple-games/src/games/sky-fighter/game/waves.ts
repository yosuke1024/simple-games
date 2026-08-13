import {
  BOARD_WIDTH,
  DARTER_FALL_BONUS,
  ENEMY_KIND_GUN,
  ENEMY_KIND_RADIUS,
  ENEMY_KIND_TIER,
  MAX_FALL_SPEED,
} from './constants';
import { enemyFireIntervalMs, enemyHp, waveSpec } from './levels';
import { createRng } from './rng';
import type { Enemy, EnemyKind } from './types';

/**
 * Picks a craft from the stage's mix on one draw. Weights are relative, so a
 * stage that has not unlocked the heavy yet simply divides its share among the
 * kinds it does field — no renormalising by hand, no dead branches.
 */
function pickKind(mix: readonly { kind: EnemyKind; weight: number }[], roll: number): EnemyKind {
  let total = 0;
  for (const entry of mix) total += entry.weight;
  let cursor = roll * total;
  for (const entry of mix) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.kind;
  }
  return mix[mix.length - 1]!.kind;
}

/**
 * A wave is derived from (seed, level, waveInLevel), so the same level replays
 * identically and a test can assert on real generated content rather than a
 * hand-built board.
 */
export function spawnWave(
  seed: string,
  level: number,
  waveInLevel: number,
  nextEnemyId: number,
): { enemies: Enemy[]; nextEnemyId: number } {
  const rng = createRng(`${seed}:${level}:${waveInLevel}`);
  const spec = waveSpec(level, waveInLevel);
  const enemies: Enemy[] = [];
  let id = nextEnemyId;

  for (let i = 0; i < spec.count; i++) {
    const kind = pickKind(spec.mix, rng());
    const radius = ENEMY_KIND_RADIUS[kind];
    // Spread across the width in lanes so enemies never enter stacked.
    const lane = (BOARD_WIDTH / spec.count) * (i + 0.5);
    const jitter = (rng() - 0.5) * (BOARD_WIDTH / spec.count) * 0.5;
    const x = Math.min(BOARD_WIDTH - radius, Math.max(radius, lane + jitter));
    const fall = spec.speedMin + rng() * (spec.speedMax - spec.speedMin);
    // The darter dives; everything else keeps the wave's own pace.
    const dy = Math.min(MAX_FALL_SPEED, fall) + (kind === 'darter' ? DARTER_FALL_BONUS : 0);
    const fireIntervalMs = enemyFireIntervalMs(level, kind);
    enemies.push({
      id: id++,
      x,
      y: -radius - i * 18,
      dx: (rng() - 0.5) * 34,
      dy,
      tier: ENEMY_KIND_TIER[kind],
      kind,
      // Read from the level table, not rolled: adding it costs no rng draw,
      // so the pinned golden waves stay exactly where they were.
      hp: enemyHp(level, kind),
      // Staggered so a formation of gunships never fires on the same beat.
      fireCooldownMs:
        ENEMY_KIND_GUN[kind] === 'none' ? undefined : fireIntervalMs * (0.4 + rng() * 0.9),
    });
  }

  return { enemies, nextEnemyId: id };
}
