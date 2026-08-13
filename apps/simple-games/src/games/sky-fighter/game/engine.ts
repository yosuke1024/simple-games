import {
  BARREL_OFFSET,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BOSS_ENTRY_SPEED,
  BOSS_SCORE_BASE,
  BOSS_SCORE_PER_STAGE,
  BOSS_TARGET_ID,
  BULLET_RADIUS,
  BULLET_SPEED,
  CAPPED_WEAPON_BONUS,
  ENEMY_BULLET_RADIUS,
  ENEMY_BULLET_SPEED,
  ENEMY_FIRE_INTERVAL_MS,
  ENEMY_RADII,
  ENEMY_SPLIT_SPEED,
  FIRE_INTERVAL_MS,
  FIRING_TIER,
  INVULNERABLE_MS,
  ITEM_FALL_SPEED,
  ITEM_RADIUS,
  LIFE_DROP_CHANCE,
  MAXLIFE_DROP_CHANCE,
  MAX_LIVES_CAP,
  MIN_FIRE_INTERVAL_MS,
  MISSILE_INTERVAL_MS,
  MISSILE_RADIUS,
  MISSILE_SPEED,
  MISSILE_TURN_RATE,
  RAPID_STEP_MS,
  REWARD_BONUS_SCORE,
  SCORE_PER_TIER,
  SHIP_MIN_Y,
  SHIP_RADIUS,
  SHIP_START_Y,
  SMALLEST_TIER,
  STARTING_LIVES,
  WAVE_BREAK_MS,
  WEAPON_DROP_CHANCE,
} from './constants';
import { LEVEL_COUNT, bossSpec, enemyHp, isBossStage, wavesInLevel } from './levels';
import { createRng } from './rng';
import type {
  Boss,
  Bullet,
  Enemy,
  EnemyBullet,
  GameState,
  Item,
  ItemKind,
  Missile,
  RewardKind,
  RunStatus,
} from './types';
import { applyWeaponUpgrade, pickWeaponUpgrade, rollRewardOptions } from './upgrades';
import { spawnWave } from './waves';

/** How long a non-lethal hit keeps a craft flashing (view-only feedback). */
export const HIT_FLASH_MS = 90;

/**
 * A run. It starts at `level` and flies on, stage after stage, until the
 * lives run out or stage 100 falls — upgrades and hearts ride along inside
 * the run and never past its end (docs/SKY_FIGHTER_RULES.md §2, §5;
 * docs/PRODUCT_PRINCIPLES.md rules out any between-run progression).
 *
 * `runSeed` is what makes two runs over the same skies differ: the waves are
 * the seed's promise, but every drop and every boss offer rolls from here.
 */
export function createInitialState(
  seed = 'prototype',
  level = 1,
  runSeed = `${seed}:run`,
): GameState {
  return {
    seed,
    runSeed,
    level,
    shipX: BOARD_WIDTH / 2,
    shipY: SHIP_START_Y,
    bullets: [],
    missiles: [],
    enemyBullets: [],
    enemies: [],
    items: [],
    boss: null,
    upgrades: { power: 0, rapid: 0, spread: 0, missile: 0 },
    rewardOptions: null,
    nextItemId: 1,
    waveInLevel: -1,
    waveBreakMs: WAVE_BREAK_MS,
    fireCooldownMs: 0,
    missileCooldownMs: MISSILE_INTERVAL_MS,
    invulnerableMs: 0,
    lives: STARTING_LIVES,
    maxLives: STARTING_LIVES,
    pickup: null,
    score: 0,
    nextEnemyId: 1,
    status: 'playing',
  };
}

/** The box the ship may fly (§3): the whole board below the entry strip. */
export function setShipPos(state: GameState, x: number, y: number): GameState {
  const clampedX = Math.min(BOARD_WIDTH - SHIP_RADIUS, Math.max(SHIP_RADIUS, x));
  const clampedY = Math.min(BOARD_HEIGHT - SHIP_RADIUS, Math.max(SHIP_MIN_Y, y));
  if (clampedX === state.shipX && clampedY === state.shipY) return state;
  return { ...state, shipX: clampedX, shipY: clampedY };
}

export function moveShipBy(state: GameState, deltaX: number, deltaY = 0): GameState {
  return setShipPos(state, state.shipX + deltaX, state.shipY + deltaY);
}

function hits(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/** Damage one shot deals — Power's whole rule (§5). */
function shotDamage(power: number): number {
  return 1 + power;
}

/** Firing interval after Rapid, floored so no build outruns the screen (§5). */
export function fireInterval(rapid: number): number {
  return Math.max(MIN_FIRE_INTERVAL_MS, FIRE_INTERVAL_MS - rapid * RAPID_STEP_MS);
}

/**
 * The barrels per Spread level: one straight, a parallel pair, then fans.
 * Offsets are lateral, angles radians off straight up — the shape on screen
 * is the whole rule (§5).
 */
const SPREAD_PATTERNS: readonly (readonly { off: number; angle: number }[])[] = [
  [{ off: 0, angle: 0 }],
  [
    { off: -BARREL_OFFSET, angle: 0 },
    { off: BARREL_OFFSET, angle: 0 },
  ],
  [
    { off: 0, angle: 0 },
    { off: 0, angle: -0.2 },
    { off: 0, angle: 0.2 },
  ],
  [
    { off: -BARREL_OFFSET, angle: -0.08 },
    { off: BARREL_OFFSET, angle: 0.08 },
    { off: 0, angle: -0.26 },
    { off: 0, angle: 0.26 },
  ],
  [
    { off: 0, angle: 0 },
    { off: 0, angle: -0.16 },
    { off: 0, angle: 0.16 },
    { off: 0, angle: -0.32 },
    { off: 0, angle: 0.32 },
  ],
];

function volley(shipX: number, shipY: number, spread: number): Bullet[] {
  const noseY = shipY - SHIP_RADIUS;
  const pattern = SPREAD_PATTERNS[Math.min(spread, SPREAD_PATTERNS.length - 1)]!;
  return pattern.map(({ off, angle }) => ({
    x: shipX + off,
    y: noseY,
    dx: Math.sin(angle) * BULLET_SPEED,
    dy: -Math.cos(angle) * BULLET_SPEED,
  }));
}

/** A hit splits one enemy into two, or removes it if it was the smallest. */
function splitEnemy(
  enemy: Enemy,
  level: number,
  nextId: number,
): { children: Enemy[]; nextId: number } {
  if (enemy.tier >= SMALLEST_TIER) return { children: [], nextId };
  const tier = enemy.tier + 1;
  let id = nextId;
  const children: Enemy[] = [-1, 1].map((direction) => ({
    id: id++,
    x: enemy.x,
    y: enemy.y,
    dx: direction * ENEMY_SPLIT_SPEED,
    dy: enemy.dy,
    tier,
    hp: enemyHp(level, tier),
  }));
  return { children, nextId: id };
}

/**
 * What a kill leaves behind, if anything. Only the smallest tier drops, so
 * rewards are earned by finishing a cascade rather than by chipping at the
 * big ones. Rolled from (runSeed, enemy id): the same run replays the same,
 * but the next run's skies pay out differently (§5).
 */
function rollDrop(runSeed: string, enemy: Enemy, maxLivesCapped: boolean): ItemKind | null {
  if (enemy.tier < SMALLEST_TIER) return null;
  const roll = createRng(`${runSeed}:drop:${enemy.id}`)();
  if (roll < MAXLIFE_DROP_CHANCE) return maxLivesCapped ? 'life' : 'maxlife';
  if (roll < MAXLIFE_DROP_CHANCE + LIFE_DROP_CHANCE) return 'life';
  if (roll < MAXLIFE_DROP_CHANCE + LIFE_DROP_CHANCE + WEAPON_DROP_CHANCE) return 'weapon';
  return null;
}

/** The stage guardian enters from above the board, mid-width (§7). */
function createBoss(level: number): Boss {
  const spec = bossSpec(level);
  return {
    kind: spec.kind,
    x: BOARD_WIDTH / 2,
    y: -spec.radius,
    dx: spec.speed,
    targetY: spec.targetY,
    radius: spec.radius,
    hp: spec.hp,
    maxHp: spec.hp,
    fireCooldownMs: spec.fireIntervalMs,
    spawnCooldownMs: spec.spawnIntervalMs,
  };
}

function bossScore(level: number): number {
  return BOSS_SCORE_BASE + level * BOSS_SCORE_PER_STAGE;
}

/** Steers a missile toward its mark by at most the turn rate — no pathing. */
function steerMissile(missile: Missile, tx: number, ty: number, dt: number): Missile {
  const desired = Math.atan2(ty - missile.y, tx - missile.x);
  const current = Math.atan2(missile.dy, missile.dx);
  let delta = desired - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const turn = Math.max(-MISSILE_TURN_RATE * dt, Math.min(MISSILE_TURN_RATE * dt, delta));
  const heading = current + turn;
  return {
    ...missile,
    dx: Math.cos(heading) * MISSILE_SPEED,
    dy: Math.sin(heading) * MISSILE_SPEED,
  };
}

export function step(state: GameState, dtMs: number): GameState {
  if (state.status !== 'playing') return state;
  const dt = dtMs / 1000;

  let {
    level,
    waveInLevel,
    waveBreakMs,
    nextEnemyId,
    nextItemId,
    score,
    lives,
    maxLives,
    invulnerableMs,
    fireCooldownMs,
    missileCooldownMs,
    pickup,
    upgrades,
    rewardOptions,
  } = state;
  let enemies = state.enemies;
  let bullets = state.bullets;
  let missiles = state.missiles;
  let items = state.items;
  let boss = state.boss;
  let status: RunStatus = state.status;

  // The quiet beat between waves and stages. Nothing is on screen, nothing
  // is chasing. It ends with the next wave — or, every tenth stage, the boss.
  if (waveBreakMs > 0) {
    waveBreakMs = Math.max(0, waveBreakMs - dtMs);
    if (waveBreakMs === 0) {
      waveInLevel += 1;
      if (isBossStage(level)) {
        boss = createBoss(level);
      } else {
        const spawned = spawnWave(state.seed, level, waveInLevel, nextEnemyId);
        enemies = spawned.enemies;
        nextEnemyId = spawned.nextEnemyId;
      }
    }
  }

  // Auto-fire: the player aims by moving, never by pressing (§3).
  fireCooldownMs -= dtMs;
  const firing = waveBreakMs === 0 && (enemies.length > 0 || boss !== null);
  if (firing && fireCooldownMs <= 0) {
    bullets = [...bullets, ...volley(state.shipX, state.shipY, upgrades.spread)];
    fireCooldownMs = fireInterval(upgrades.rapid);
  }

  // Missiles launch on their own beat, locking onto whatever is nearest at
  // that instant — one search per launch, never one per frame (§5).
  missileCooldownMs -= dtMs;
  if (firing && upgrades.missile > 0 && missileCooldownMs <= 0) {
    const launched: Missile[] = [];
    for (let i = 0; i < upgrades.missile; i++) {
      const off = (i % 2 === 0 ? -1 : 1) * (8 + Math.floor(i / 2) * 6);
      const x = state.shipX + off;
      const y = state.shipY - 2;
      let targetId = boss !== null ? BOSS_TARGET_ID : -2;
      let best =
        boss !== null
          ? (boss.x - x) * (boss.x - x) + (boss.y - y) * (boss.y - y)
          : Number.POSITIVE_INFINITY;
      for (const enemy of enemies) {
        const d = (enemy.x - x) * (enemy.x - x) + (enemy.y - y) * (enemy.y - y);
        if (d < best) {
          best = d;
          targetId = enemy.id;
        }
      }
      launched.push({ x, y, dx: 0, dy: -MISSILE_SPEED, targetId });
    }
    missiles = [...missiles, ...launched];
    missileCooldownMs = MISSILE_INTERVAL_MS;
  }

  bullets = bullets
    .map((bullet: Bullet) => ({
      ...bullet,
      x: bullet.x + bullet.dx * dt,
      y: bullet.y + bullet.dy * dt,
    }))
    .filter(
      (bullet) =>
        bullet.y + BULLET_RADIUS > 0 &&
        bullet.x + BULLET_RADIUS > 0 &&
        bullet.x - BULLET_RADIUS < BOARD_WIDTH,
    );

  missiles = missiles
    .map((missile) => {
      let steered = missile;
      if (missile.targetId === BOSS_TARGET_ID) {
        if (boss !== null) steered = steerMissile(missile, boss.x, boss.y, dt);
      } else {
        const target = enemies.find((enemy) => enemy.id === missile.targetId);
        if (target !== undefined) steered = steerMissile(missile, target.x, target.y, dt);
      }
      return { ...steered, x: steered.x + steered.dx * dt, y: steered.y + steered.dy * dt };
    })
    .filter(
      (missile) =>
        missile.y + MISSILE_RADIUS > 0 &&
        missile.y - MISSILE_RADIUS < BOARD_HEIGHT &&
        missile.x + MISSILE_RADIUS > 0 &&
        missile.x - MISSILE_RADIUS < BOARD_WIDTH,
    );

  // Bombers shoot back. Everything they break into is unarmed, so clearing a
  // bomber is what makes the sky quieter (§4).
  const firedShots: EnemyBullet[] = [];
  enemies = enemies.map((enemy) => {
    const flashed =
      enemy.hitMs !== undefined
        ? { ...enemy, hitMs: enemy.hitMs > dtMs ? enemy.hitMs - dtMs : undefined }
        : enemy;
    if (flashed.tier !== FIRING_TIER) return flashed;
    if (flashed.y <= 0) return flashed;
    const cooldown = (flashed.fireCooldownMs ?? ENEMY_FIRE_INTERVAL_MS) - dtMs;
    if (cooldown > 0) return { ...flashed, fireCooldownMs: cooldown };
    firedShots.push({
      x: flashed.x,
      y: flashed.y + ENEMY_RADII[flashed.tier]!,
      dx: 0,
      dy: ENEMY_BULLET_SPEED,
    });
    return { ...flashed, fireCooldownMs: ENEMY_FIRE_INTERVAL_MS };
  });

  // The boss flies its pattern: descend to altitude, patrol the width, and
  // attack in its own voice — fan, curtain, or launched darts (§7).
  if (boss !== null) {
    const spec = bossSpec(level);
    let { x, y, dx, fireCooldownMs: bossFire, spawnCooldownMs: bossSpawn, hitMs } = boss;
    if (hitMs !== undefined) hitMs = hitMs > dtMs ? hitMs - dtMs : undefined;
    if (y < boss.targetY) {
      y = Math.min(boss.targetY, y + BOSS_ENTRY_SPEED * dt);
    } else {
      x += dx * dt;
      if (x - boss.radius < 0) {
        x = boss.radius;
        dx = Math.abs(dx);
      } else if (x + boss.radius > BOARD_WIDTH) {
        x = BOARD_WIDTH - boss.radius;
        dx = -Math.abs(dx);
      }
      bossFire -= dtMs;
      if (bossFire <= 0) {
        bossFire = spec.fireIntervalMs;
        if (boss.kind === 'bomber') {
          // A fixed curtain, straight from the hull: dodged by reading the
          // gaps, not by outrunning it.
          const n = spec.bulletCount;
          for (let i = 0; i < n; i++) {
            const angle = -0.55 + (1.1 * i) / (n - 1);
            firedShots.push({
              x,
              y: y + boss.radius,
              dx: Math.sin(angle) * spec.bulletSpeed,
              dy: Math.cos(angle) * spec.bulletSpeed,
            });
          }
        } else {
          // Fighter (and the carrier's lone gun): a fan aimed at where the
          // ship is now — flying away from your own past position is the counter.
          const aim = Math.atan2(state.shipX - x, state.shipY - y);
          const n = spec.bulletCount;
          for (let i = 0; i < n; i++) {
            const angle = aim + (n === 1 ? 0 : -0.3 + (0.6 * i) / (n - 1));
            firedShots.push({
              x,
              y: y + boss.radius * 0.6,
              dx: Math.sin(angle) * spec.bulletSpeed,
              dy: Math.cos(angle) * spec.bulletSpeed,
            });
          }
        }
      }
      if (boss.kind === 'carrier') {
        bossSpawn -= dtMs;
        // The carrier's real weapon is what it launches; a soft cap keeps a
        // neglected carrier from burying the screen.
        if (bossSpawn <= 0) {
          bossSpawn = spec.spawnIntervalMs;
          if (enemies.length < 6) {
            const dart = (side: number): Enemy => ({
              id: nextEnemyId++,
              x: Math.min(BOARD_WIDTH - 9, Math.max(9, x + side * boss!.radius * 0.8)),
              y: y + boss!.radius * 0.4,
              dx: side * 46,
              dy: 88,
              tier: SMALLEST_TIER,
              hp: enemyHp(level, SMALLEST_TIER),
            });
            enemies = [...enemies, dart(-1), dart(1)];
          }
        }
      }
    }
    boss = { ...boss, x, y, dx, fireCooldownMs: bossFire, spawnCooldownMs: bossSpawn, hitMs };
  }

  let enemyBullets = [...state.enemyBullets, ...firedShots]
    .map((shot) => ({ ...shot, x: shot.x + shot.dx * dt, y: shot.y + shot.dy * dt }))
    .filter(
      (shot) =>
        shot.y - ENEMY_BULLET_RADIUS <= BOARD_HEIGHT &&
        shot.y + ENEMY_BULLET_RADIUS >= 0 &&
        shot.x + ENEMY_BULLET_RADIUS >= 0 &&
        shot.x - ENEMY_BULLET_RADIUS <= BOARD_WIDTH,
    );

  enemies = enemies.map((enemy) => {
    const radius = ENEMY_RADII[enemy.tier]!;
    let x = enemy.x + enemy.dx * dt;
    let dx = enemy.dx;
    if (x - radius < 0) {
      x = radius;
      dx = Math.abs(dx);
    } else if (x + radius > BOARD_WIDTH) {
      x = BOARD_WIDTH - radius;
      dx = -Math.abs(dx);
    }
    return { ...enemy, x, dx, y: enemy.y + enemy.dy * dt };
  });

  // Player fire vs enemies and boss. One shot spends itself on one target;
  // hp is tracked through the pass so overkill never eats a second shot.
  const hpLeft = new Map<number, number>();
  for (const enemy of enemies) hpLeft.set(enemy.id, enemy.hp);
  let bossHpLeft = boss !== null ? boss.hp : 0;
  const damage = shotDamage(upgrades.power);
  const spentBullets = new Set<number>();
  const spentMissiles = new Set<number>();
  const flashedEnemies = new Set<number>();
  let bossFlashed = false;

  const resolveShot = (x: number, y: number, radius: number): boolean => {
    for (const enemy of enemies) {
      const left = hpLeft.get(enemy.id)!;
      if (left <= 0) continue;
      if (!hits(x, y, radius, enemy.x, enemy.y, ENEMY_RADII[enemy.tier]!)) continue;
      hpLeft.set(enemy.id, left - damage);
      if (left - damage > 0) flashedEnemies.add(enemy.id);
      return true;
    }
    if (boss !== null && bossHpLeft > 0 && hits(x, y, radius, boss.x, boss.y, boss.radius)) {
      bossHpLeft -= damage;
      if (bossHpLeft > 0) bossFlashed = true;
      return true;
    }
    return false;
  };

  for (let b = 0; b < bullets.length; b++) {
    const bullet = bullets[b]!;
    if (resolveShot(bullet.x, bullet.y, BULLET_RADIUS)) spentBullets.add(b);
  }
  for (let m = 0; m < missiles.length; m++) {
    const missile = missiles[m]!;
    if (resolveShot(missile.x, missile.y, MISSILE_RADIUS)) spentMissiles.add(m);
  }
  if (spentBullets.size > 0) bullets = bullets.filter((_, i) => !spentBullets.has(i));
  if (spentMissiles.size > 0) missiles = missiles.filter((_, i) => !spentMissiles.has(i));

  // Settle the damage: splits, scores, and at most one drop per pass — the
  // drop is meant to be a moment, not a shower (§5).
  const spawnedChildren: Enemy[] = [];
  const droppedItems: Item[] = [];
  let itemSlotFree = items.length === 0;
  let anyDowned = false;
  for (const enemy of enemies) {
    const left = hpLeft.get(enemy.id)!;
    if (left === enemy.hp) continue;
    if (left > 0) continue;
    anyDowned = true;
    score += SCORE_PER_TIER[enemy.tier]!;
    const split = splitEnemy(enemy, level, nextEnemyId);
    nextEnemyId = split.nextId;
    spawnedChildren.push(...split.children);
    if (itemSlotFree) {
      const kind = rollDrop(state.runSeed, enemy, maxLives >= MAX_LIVES_CAP);
      if (kind !== null) {
        droppedItems.push({ id: nextItemId++, x: enemy.x, y: enemy.y, kind });
        itemSlotFree = false;
      }
    }
  }
  enemies = enemies.map((enemy) => {
    const left = hpLeft.get(enemy.id)!;
    if (left === enemy.hp) return enemy;
    return { ...enemy, hp: left, hitMs: flashedEnemies.has(enemy.id) ? HIT_FLASH_MS : enemy.hitMs };
  });
  if (anyDowned) enemies = enemies.filter((enemy) => enemy.hp > 0);
  if (spawnedChildren.length > 0) enemies = [...enemies, ...spawnedChildren];
  if (droppedItems.length > 0) items = [...items, ...droppedItems];

  // The boss falls exactly once, and it is unmistakable: everything it owned
  // leaves with it, the stage is won, and — short of stage 100, which ends
  // the run — the choice of reward is offered (§7, §8).
  if (boss !== null) {
    if (bossHpLeft <= 0) {
      score += bossScore(level);
      boss = null;
      enemies = [];
      enemyBullets = [];
      missiles = [];
      if (level >= LEVEL_COUNT) {
        status = 'cleared';
      } else {
        status = 'reward';
        rewardOptions = rollRewardOptions(
          { ...state, upgrades, lives, maxLives },
          createRng(`${state.runSeed}:reward:${level}`),
        );
      }
    } else if (bossHpLeft < boss.hp) {
      boss = { ...boss, hp: bossHpLeft, hitMs: bossFlashed ? HIT_FLASH_MS : boss.hitMs };
    }
  }

  // Enemies that get past the ship simply drift away. Only being hit costs a
  // life — letting one escape costs the points it was worth, nothing more.
  enemies = enemies.filter((enemy) => enemy.y - ENEMY_RADII[enemy.tier]! <= BOARD_HEIGHT);

  // Items fall straight and are caught with the ship — the same motion that
  // kills you, turned into the reward (§5, §6).
  items = items
    .map((item) => ({ ...item, y: item.y + ITEM_FALL_SPEED * dt }))
    .filter((item) => item.y - ITEM_RADIUS <= BOARD_HEIGHT);
  const caught = items.filter((item) =>
    hits(state.shipX, state.shipY, SHIP_RADIUS, item.x, item.y, ITEM_RADIUS),
  );
  if (caught.length > 0) {
    const caughtIds = new Set(caught.map((item) => item.id));
    items = items.filter((item) => !caughtIds.has(item.id));
    for (const item of caught) {
      const seq = (pickup?.seq ?? 0) + 1;
      if (item.kind === 'weapon') {
        // A random axis, rolled in the game layer from the run's seed (§8).
        const roll = createRng(`${state.runSeed}:pick:${seq}`)();
        const kind = pickWeaponUpgrade(upgrades, roll);
        if (kind === null) {
          score += CAPPED_WEAPON_BONUS;
          pickup = { kind: 'bonus', seq };
        } else {
          upgrades = applyWeaponUpgrade(upgrades, kind);
          pickup = { kind, seq };
        }
      } else if (item.kind === 'maxlife' && maxLives < MAX_LIVES_CAP) {
        maxLives += 1;
        lives = Math.min(maxLives, lives + 1);
        pickup = { kind: 'maxlife', seq };
      } else {
        // A Life item — or a Max Life caught after the cap was reached.
        lives = Math.min(maxLives, lives + 1);
        pickup = { kind: 'life', seq };
      }
    }
  }

  const carried = {
    ...state,
    level,
    bullets,
    missiles,
    enemyBullets,
    enemies,
    items,
    boss,
    upgrades,
    rewardOptions,
    nextItemId,
    waveInLevel,
    waveBreakMs,
    nextEnemyId,
    score,
    lives,
    maxLives,
    pickup,
    invulnerableMs,
    fireCooldownMs,
    missileCooldownMs,
    status,
  };

  if (status !== 'playing') return carried;

  // Being hit — by a shot or by a hull — costs a life and a moment of grace,
  // and nothing else: the weapon is not touched (§6).
  invulnerableMs = Math.max(0, invulnerableMs - dtMs);
  if (invulnerableMs === 0) {
    const shotBy = enemyBullets.findIndex((shot) =>
      hits(state.shipX, state.shipY, SHIP_RADIUS, shot.x, shot.y, ENEMY_BULLET_RADIUS),
    );
    if (shotBy !== -1) {
      enemyBullets = enemyBullets.filter((_, i) => i !== shotBy);
      lives -= 1;
      invulnerableMs = INVULNERABLE_MS;
      if (lives <= 0) {
        return { ...carried, enemyBullets, lives: 0, invulnerableMs, status: 'failed' };
      }
    }
  }
  if (invulnerableMs === 0) {
    const struckBy = enemies.find((enemy) =>
      hits(state.shipX, state.shipY, SHIP_RADIUS, enemy.x, enemy.y, ENEMY_RADII[enemy.tier]!),
    );
    if (struckBy) {
      lives -= 1;
      invulnerableMs = INVULNERABLE_MS;
      enemies = enemies.filter((enemy) => enemy.id !== struckBy.id);
      if (lives <= 0) {
        return { ...carried, enemies, enemyBullets, lives: 0, invulnerableMs, status: 'failed' };
      }
    }
  }
  if (invulnerableMs === 0 && boss !== null) {
    if (hits(state.shipX, state.shipY, SHIP_RADIUS, boss.x, boss.y, boss.radius * 0.85)) {
      lives -= 1;
      invulnerableMs = INVULNERABLE_MS;
      if (lives <= 0) {
        return { ...carried, enemies, enemyBullets, lives: 0, invulnerableMs, status: 'failed' };
      }
    }
  }

  // Wave settled (downed or escaped). The last wave of a stage hands over to
  // the next stage — the run flies on; only lives end it (§2).
  if (waveBreakMs === 0 && boss === null && waveInLevel >= 0 && enemies.length === 0) {
    // The break is advertised as empty-screen: a bomber's last shot must not
    // outlive it and cost a life with no visible cause.
    enemyBullets = [];
    waveBreakMs = WAVE_BREAK_MS;
    if (waveInLevel >= wavesInLevel(level) - 1) {
      level += 1;
      waveInLevel = -1;
    }
  }

  return {
    ...carried,
    level,
    enemies,
    enemyBullets,
    lives,
    invulnerableMs,
    waveInLevel,
    waveBreakMs,
  };
}

/**
 * The player's answer to the boss offer (§8). Applies exactly the chosen
 * reward, closes the offer, and sends the run into the next stage's break.
 */
export function chooseReward(state: GameState, index: number): GameState {
  if (state.status !== 'reward' || state.rewardOptions === null) return state;
  const kind = state.rewardOptions[index];
  if (kind === undefined) return state;
  let { upgrades, lives, maxLives, score } = state;
  if (kind === 'maxlife') {
    if (maxLives < MAX_LIVES_CAP) {
      maxLives += 1;
      lives = Math.min(maxLives, lives + 1);
    }
  } else if (kind === 'life') {
    lives = Math.min(maxLives, lives + 1);
  } else if (kind === 'bonus') {
    score += REWARD_BONUS_SCORE;
  } else {
    upgrades = applyWeaponUpgrade(upgrades, kind);
  }
  return {
    ...state,
    upgrades,
    lives,
    maxLives,
    score,
    rewardOptions: null,
    status: 'playing',
    level: state.level + 1,
    waveInLevel: -1,
    waveBreakMs: WAVE_BREAK_MS,
  };
}

export type { RewardKind };
