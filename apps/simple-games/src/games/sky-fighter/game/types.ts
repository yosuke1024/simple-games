export interface Bullet {
  x: number;
  y: number;
  /** Carried per bullet so a fanned barrel is the same object as a straight one. */
  dx: number;
  dy: number;
}

/**
 * A homing shot. It remembers the craft it locked onto at launch; if that
 * craft dies first the missile flies on straight — no re-searching per frame
 * (docs/SKY_FIGHTER_RULES.md §5).
 */
export interface Missile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Enemy id, or BOSS_TARGET_ID when locked onto the boss. */
  targetId: number;
}

export type ItemKind = 'weapon' | 'life' | 'maxlife';

/** A falling pickup, caught with the ship the way a enemy is dodged. */
export interface Item {
  id: number;
  x: number;
  y: number;
  kind: ItemKind;
}

/** `tier` indexes ENEMY_RADII: 0 is the largest, SMALLEST_TIER is destroyed for good. */
export interface Enemy {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  tier: number;
  /** Hits left. Splitting happens when this reaches zero. */
  hp: number;
  /** Counts down to this craft's next shot. Only the bomber tier uses it. */
  fireCooldownMs?: number;
  /** Set on a non-lethal hit so the view can flash the craft briefly. */
  hitMs?: number;
}

/** Fired by a bomber or a boss. Slower than anything the player fires. */
export interface EnemyBullet {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export type BossKind = 'fighter' | 'bomber' | 'carrier';

/** The stage guardian (§7): one per boss stage, never mixed into waves. */
export interface Boss {
  kind: BossKind;
  x: number;
  y: number;
  dx: number;
  /** Altitude it descends to before starting its pattern. */
  targetY: number;
  radius: number;
  hp: number;
  maxHp: number;
  fireCooldownMs: number;
  /** Carrier only: counts down to the next pair of launched darts. */
  spawnCooldownMs: number;
  /** Set on a non-lethal hit so the view can flash the hull briefly. */
  hitMs?: number;
}

/**
 * The independent weapon axes (§5). Each is a small integer level with its
 * own cap; none of them touches lives, and lives never touch them (§6).
 */
export interface WeaponUpgrades {
  /** Damage per shot: 1 + power. */
  power: number;
  /** Shortens the firing interval, floored at MIN_FIRE_INTERVAL_MS. */
  rapid: number;
  /** How many barrels fire at once, and how wide they fan. */
  spread: number;
  /** Homing missiles launched alongside the guns. */
  missile: number;
}

export type WeaponUpgradeKind = keyof WeaponUpgrades;

/** Everything a boss reward can offer, and everything a pickup can announce. */
export type RewardKind = WeaponUpgradeKind | 'maxlife' | 'life' | 'bonus';

/** The last thing the player caught or chose, for the HUD's brief toast. */
export interface Pickup {
  kind: RewardKind;
  /** Monotonic, so the view can tell a new pickup from the previous one. */
  seq: number;
}

export type RunStatus = 'playing' | 'reward' | 'cleared' | 'failed';

export interface GameState {
  /** Wave seed: every run meets the same formations (§1). */
  seed: string;
  /** Per-run seed: drops and reward offers differ run to run (§5). */
  runSeed: string;
  /** The stage being flown. Advances within the run; a new run resets it. */
  level: number;
  shipX: number;
  shipY: number;
  bullets: Bullet[];
  missiles: Missile[];
  enemyBullets: EnemyBullet[];
  enemies: Enemy[];
  items: Item[];
  boss: Boss | null;
  upgrades: WeaponUpgrades;
  /** Offered after a boss falls; null whenever no choice is pending (§8). */
  rewardOptions: RewardKind[] | null;
  nextItemId: number;
  /** Index of the wave on screen; -1 before the first one enters. */
  waveInLevel: number;
  /** Counts down the quiet beat before the next wave or boss enters. */
  waveBreakMs: number;
  fireCooldownMs: number;
  missileCooldownMs: number;
  invulnerableMs: number;
  /** Current hearts. Independent of every weapon axis (§6). */
  lives: number;
  /** Hearts the run can hold, raised only by Max Life rewards (§6). */
  maxLives: number;
  pickup: Pickup | null;
  score: number;
  nextEnemyId: number;
  status: RunStatus;
}
