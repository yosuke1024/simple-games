export interface Bullet {
  x: number;
  y: number;
  /** Carried per bullet so a fanned barrel is the same object as a straight one. */
  dx: number;
  dy: number;
}

/** The dropped power-up: a tiny ship, caught the way a enemy is dodged. */
export interface Token {
  id: number;
  x: number;
  y: number;
}

/** `tier` indexes ENEMY_RADII: 0 is the largest, SMALLEST_TIER is destroyed for good. */
export interface Enemy {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  tier: number;
  /** Counts down to this craft's next shot. Only the bomber tier uses it. */
  fireCooldownMs?: number;
}

/** Fired by a bomber, straight down. Slower than anything the player fires. */
export interface EnemyBullet {
  x: number;
  y: number;
}

export type RunStatus = 'playing' | 'cleared' | 'failed';

export interface GameState {
  seed: string;
  level: number;
  shipX: number;
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  enemies: Enemy[];
  tokens: Token[];
  /** Barrels currently firing, POWER_MIN..POWER_MAX. Reset every level. */
  power: number;
  nextTokenId: number;
  /** Index of the wave on screen; -1 before the first one enters. */
  waveInLevel: number;
  /** Counts down the quiet beat before the next wave enters. */
  waveBreakMs: number;
  fireCooldownMs: number;
  invulnerableMs: number;
  lives: number;
  score: number;
  nextEnemyId: number;
  status: RunStatus;
}
