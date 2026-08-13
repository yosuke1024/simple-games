import {
  BOARD_WIDTH,
  ENEMY_FIRE_INTERVAL_MS,
  ENEMY_RADII,
  FIRING_TIER,
  MAX_FALL_SPEED,
} from './constants';
import { enemyHp, waveSpec } from './levels';
import { createRng } from './rng';
import type { Enemy } from './types';

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
    const tier = rng() < spec.bigChance ? 0 : 1;
    const radius = ENEMY_RADII[tier]!;
    // Spread across the width in lanes so enemies never enter stacked.
    const lane = (BOARD_WIDTH / spec.count) * (i + 0.5);
    const jitter = (rng() - 0.5) * (BOARD_WIDTH / spec.count) * 0.5;
    const x = Math.min(BOARD_WIDTH - radius, Math.max(radius, lane + jitter));
    const dy = Math.min(MAX_FALL_SPEED, spec.speedMin + rng() * (spec.speedMax - spec.speedMin));
    enemies.push({
      id: id++,
      x,
      y: -radius - i * 18,
      dx: (rng() - 0.5) * 34,
      dy,
      tier,
      // Read from the level table, not rolled: adding it costs no rng draw,
      // so the pinned golden waves stay exactly where they were.
      hp: enemyHp(level, tier),
      // Staggered so a formation of bombers never fires on the same beat.
      fireCooldownMs:
        tier === FIRING_TIER ? ENEMY_FIRE_INTERVAL_MS * (0.4 + rng() * 0.9) : undefined,
    });
  }

  return { enemies, nextEnemyId: id };
}
