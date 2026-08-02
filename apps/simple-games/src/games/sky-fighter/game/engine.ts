import {
  BARREL_OFFSET,
  BARREL_SPREAD,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  ENEMY_RADII,
  FIRING_TIER,
  ENEMY_SPLIT_SPEED,
  BULLET_RADIUS,
  BULLET_SPEED,
  ENEMY_BULLET_RADIUS,
  ENEMY_BULLET_SPEED,
  ENEMY_FIRE_INTERVAL_MS,
  FIRE_INTERVAL_MS,
  INVULNERABLE_MS,
  POWER_MAX,
  POWER_MIN,
  SCORE_PER_TIER,
  SHIP_RADIUS,
  SHIP_Y,
  SMALLEST_TIER,
  STARTING_LIVES,
  TOKEN_DROP_CHANCE,
  TOKEN_FALL_SPEED,
  TOKEN_RADIUS,
  WAVE_BREAK_MS,
} from './constants';
import { wavesInLevel } from './levels';
import { createRng } from './rng';
import type { Bullet, Enemy, EnemyBullet, GameState, Token } from './types';
import { spawnWave } from './waves';

/**
 * A level attempt. Power always starts at the minimum: the arc from one barrel
 * to three belongs to the level, and carrying it forward would flatten every
 * level after the first (docs/PRODUCT_PRINCIPLES.md also rules out any
 * between-run progression that could later be sold).
 */
export function createInitialState(seed = 'prototype', level = 1): GameState {
  return {
    seed,
    level,
    shipX: BOARD_WIDTH / 2,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    tokens: [],
    power: POWER_MIN,
    nextTokenId: 1,
    waveInLevel: -1,
    waveBreakMs: WAVE_BREAK_MS,
    fireCooldownMs: 0,
    invulnerableMs: 0,
    lives: STARTING_LIVES,
    score: 0,
    nextEnemyId: 1,
    status: 'playing',
  };
}

export function setShipX(state: GameState, x: number): GameState {
  const clamped = Math.min(BOARD_WIDTH - SHIP_RADIUS, Math.max(SHIP_RADIUS, x));
  return { ...state, shipX: clamped };
}

export function moveShipBy(state: GameState, deltaX: number): GameState {
  return setShipX(state, state.shipX + deltaX);
}

function hits(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/**
 * The shot for a power level. One barrel is straight; two are parallel; three
 * fan out. Nothing else changes with power — not damage, not fire rate — so
 * what the player sees on screen is the whole rule.
 */
function volley(shipX: number, power: number): Bullet[] {
  const noseY = SHIP_Y - SHIP_RADIUS;
  if (power <= 1) return [{ x: shipX, y: noseY, dx: 0, dy: -BULLET_SPEED }];
  if (power === 2) {
    return [-BARREL_OFFSET, BARREL_OFFSET].map((offset) => ({
      x: shipX + offset,
      y: noseY,
      dx: 0,
      dy: -BULLET_SPEED,
    }));
  }
  return [-BARREL_SPREAD, 0, BARREL_SPREAD].map((angle) => ({
    x: shipX,
    y: noseY,
    dx: Math.sin(angle) * BULLET_SPEED,
    dy: -Math.cos(angle) * BULLET_SPEED,
  }));
}

/** A hit splits one enemy into two, or removes it if it was the smallest. */
function splitEnemy(enemy: Enemy, nextId: number): { children: Enemy[]; nextId: number } {
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
  }));
  return { children, nextId: id };
}

/**
 * Whether this kill leaves a token. Only the smallest tier can, so power is
 * earned by finishing a cascade rather than by chipping at the big ones.
 * Rolled from (seed, enemy id) so a level replays identically.
 */
function dropsToken(seed: string, enemy: Enemy): boolean {
  if (enemy.tier < SMALLEST_TIER) return false;
  return createRng(`${seed}:drop:${enemy.id}`)() < TOKEN_DROP_CHANCE;
}

export function step(state: GameState, dtMs: number): GameState {
  if (state.status !== 'playing') return state;
  const dt = dtMs / 1000;

  let {
    waveInLevel,
    waveBreakMs,
    nextEnemyId,
    nextTokenId,
    score,
    lives,
    invulnerableMs,
    fireCooldownMs,
    power,
  } = state;
  let enemies = state.enemies;
  let bullets = state.bullets;
  let tokens = state.tokens;

  // The quiet beat between waves. Nothing is on screen, nothing is chasing.
  if (waveBreakMs > 0) {
    waveBreakMs = Math.max(0, waveBreakMs - dtMs);
    if (waveBreakMs === 0) {
      waveInLevel += 1;
      const spawned = spawnWave(state.seed, state.level, waveInLevel, nextEnemyId);
      enemies = spawned.enemies;
      nextEnemyId = spawned.nextEnemyId;
    }
  }

  // Auto-fire: the player aims by moving, never by pressing.
  fireCooldownMs -= dtMs;
  const firing = waveBreakMs === 0 && enemies.length > 0;
  if (firing && fireCooldownMs <= 0) {
    bullets = [...bullets, ...volley(state.shipX, power)];
    fireCooldownMs = FIRE_INTERVAL_MS;
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

  // Bombers shoot back. Everything they break into is unarmed, so clearing a
  // bomber is what makes the sky quieter.
  const firedShots: EnemyBullet[] = [];
  enemies = enemies.map((enemy) => {
    if (enemy.tier !== FIRING_TIER) return enemy;
    if (enemy.y <= 0) return enemy;
    const cooldown = (enemy.fireCooldownMs ?? ENEMY_FIRE_INTERVAL_MS) - dtMs;
    if (cooldown > 0) return { ...enemy, fireCooldownMs: cooldown };
    firedShots.push({ x: enemy.x, y: enemy.y + ENEMY_RADII[enemy.tier]! });
    return { ...enemy, fireCooldownMs: ENEMY_FIRE_INTERVAL_MS };
  });

  let enemyBullets = [...state.enemyBullets, ...firedShots]
    .map((shot) => ({ ...shot, y: shot.y + ENEMY_BULLET_SPEED * dt }))
    .filter((shot) => shot.y - ENEMY_BULLET_RADIUS <= BOARD_HEIGHT);

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

  // Bullet vs enemy. One bullet spends itself on one enemy.
  const spentBullets = new Set<number>();
  const downedEnemies = new Set<number>();
  const spawnedChildren: Enemy[] = [];
  const droppedTokens: Token[] = [];
  // At most one token is ever on screen: a second would turn catching into
  // crowd control, and the drop is meant to be a moment, not a shower.
  let tokenSlotFree = tokens.length === 0 && power < POWER_MAX;
  for (let b = 0; b < bullets.length; b++) {
    const bullet = bullets[b]!;
    for (const enemy of enemies) {
      if (downedEnemies.has(enemy.id)) continue;
      const radius = ENEMY_RADII[enemy.tier]!;
      if (!hits(bullet.x, bullet.y, BULLET_RADIUS, enemy.x, enemy.y, radius)) continue;
      spentBullets.add(b);
      downedEnemies.add(enemy.id);
      score += SCORE_PER_TIER[enemy.tier]!;
      const split = splitEnemy(enemy, nextEnemyId);
      nextEnemyId = split.nextId;
      spawnedChildren.push(...split.children);
      if (tokenSlotFree && dropsToken(state.seed, enemy)) {
        droppedTokens.push({ id: nextTokenId++, x: enemy.x, y: enemy.y });
        tokenSlotFree = false;
      }
      break;
    }
  }
  if (spentBullets.size > 0) bullets = bullets.filter((_, i) => !spentBullets.has(i));
  if (downedEnemies.size > 0) enemies = enemies.filter((enemy) => !downedEnemies.has(enemy.id));
  if (spawnedChildren.length > 0) enemies = [...enemies, ...spawnedChildren];
  if (droppedTokens.length > 0) tokens = [...tokens, ...droppedTokens];

  // Enemies that get past the ship simply drift away. Only being hit costs a
  // life — letting one escape costs the points it was worth, nothing more.
  enemies = enemies.filter((enemy) => enemy.y - ENEMY_RADII[enemy.tier]! <= BOARD_HEIGHT);

  // Tokens fall straight and are caught with the ship — the same motion that
  // kills you, turned into the reward.
  tokens = tokens
    .map((token) => ({ ...token, y: token.y + TOKEN_FALL_SPEED * dt }))
    .filter((token) => token.y - TOKEN_RADIUS <= BOARD_HEIGHT);
  const caught = tokens.filter((token) =>
    hits(state.shipX, SHIP_Y, SHIP_RADIUS, token.x, token.y, TOKEN_RADIUS),
  );
  if (caught.length > 0) {
    const caughtIds = new Set(caught.map((token) => token.id));
    tokens = tokens.filter((token) => !caughtIds.has(token.id));
    power = Math.min(POWER_MAX, power + caught.length);
  }

  const carried = {
    ...state,
    bullets,
    enemyBullets,
    enemies,
    tokens,
    power,
    nextTokenId,
    waveInLevel,
    waveBreakMs,
    nextEnemyId,
    score,
    lives,
    invulnerableMs,
    fireCooldownMs,
  };

  invulnerableMs = Math.max(0, invulnerableMs - dtMs);
  if (invulnerableMs === 0) {
    const shotBy = enemyBullets.findIndex((shot) =>
      hits(state.shipX, SHIP_Y, SHIP_RADIUS, shot.x, shot.y, ENEMY_BULLET_RADIUS),
    );
    if (shotBy !== -1) {
      enemyBullets = enemyBullets.filter((_, i) => i !== shotBy);
      lives -= 1;
      power = Math.max(POWER_MIN, power - 1);
      invulnerableMs = INVULNERABLE_MS;
      if (lives <= 0) {
        return { ...carried, enemyBullets, power, lives: 0, invulnerableMs, status: 'failed' };
      }
    }
  }
  if (invulnerableMs === 0) {
    const struckBy = enemies.find((enemy) =>
      hits(state.shipX, SHIP_Y, SHIP_RADIUS, enemy.x, enemy.y, ENEMY_RADII[enemy.tier]!),
    );
    if (struckBy) {
      lives -= 1;
      // A hit costs a barrel, not the whole gun: the level gets harder without
      // being reset to the start.
      power = Math.max(POWER_MIN, power - 1);
      invulnerableMs = INVULNERABLE_MS;
      enemies = enemies.filter((enemy) => enemy.id !== struckBy.id);
      if (lives <= 0) {
        return {
          ...carried,
          enemies,
          enemyBullets,
          power,
          lives: 0,
          invulnerableMs,
          status: 'failed',
        };
      }
    }
  }

  // Wave settled (downed or escaped). The last wave of a level ends it; any
  // other one takes the beat before the next.
  if (waveBreakMs === 0 && waveInLevel >= 0 && enemies.length === 0) {
    if (waveInLevel >= wavesInLevel(state.level) - 1) {
      return { ...carried, enemies, enemyBullets, power, lives, invulnerableMs, status: 'cleared' };
    }
    waveBreakMs = WAVE_BREAK_MS;
  }

  return { ...carried, enemies, enemyBullets, power, lives, invulnerableMs, waveBreakMs };
}
