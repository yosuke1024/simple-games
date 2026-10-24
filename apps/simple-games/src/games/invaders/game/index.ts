/** Pure, bounded formation simulation. docs/INVADERS_RULES.md §§1–6. */
export const WIDTH = 360;
export const HEIGHT = 480;
export const PLAYER_Y = 438;
export const DEFENSE_Y = 412;
export const STAGE_COUNT = 20;
export const STEP_MS = 1000 / 30;
export const ENEMY_COUNT = 28;
export type Status = 'ready' | 'running' | 'paused' | 'between' | 'won' | 'lost';
export interface Enemy {
  id: number;
  x: number;
  y: number;
}
export interface Bullet {
  id: number;
  x: number;
  y: number;
  owner: 'player' | 'enemy';
}
export interface Cover {
  id: number;
  x: number;
  y: number;
  hp: number;
}
export interface Session {
  status: Status;
  started: boolean;
  stage: number;
  score: number;
  lives: number;
  playerX: number;
  enemies: Enemy[];
  bullets: Bullet[];
  covers: Cover[];
  direction: -1 | 1;
  fireTicks: number;
  enemyFireTicks: number;
  invulnerableTicks: number;
  shotIndex: number;
  nextBulletId: number;
  ticks: number;
  elapsedSeconds: number;
}
export const finished = (s: Session): boolean => s.status === 'won' || s.status === 'lost';
export function createSession(): Session {
  return {
    status: 'ready',
    started: false,
    stage: 1,
    score: 0,
    lives: 3,
    playerX: WIDTH / 2,
    enemies: formation(),
    bullets: [],
    covers: cover(),
    direction: 1,
    fireTicks: 0,
    enemyFireTicks: 25,
    invulnerableTicks: 30,
    shotIndex: 0,
    nextBulletId: 0,
    ticks: 0,
    elapsedSeconds: 0,
  };
}
function formation(): Enemy[] {
  return Array.from({ length: ENEMY_COUNT }, (_, id) => ({
    id,
    x: 60 + (id % 7) * 40,
    y: 55 + Math.floor(id / 7) * 32,
  }));
}
function cover(): Cover[] {
  return Array.from({ length: 15 }, (_, id) => {
    const cell = id % 5;
    return {
      id,
      x: 70 + Math.floor(id / 5) * 110 + (cell < 3 ? cell - 1 : cell === 3 ? -1 : 1) * 14,
      y: cell < 3 ? 367 : 381,
      hp: 2,
    };
  });
}
export function movePlayer(s: Session, x: number): Session {
  if (finished(s) || s.status === 'between' || !Number.isFinite(x)) return s;
  const playerX = Math.max(16, Math.min(WIDTH - 16, x));
  return playerX === s.playerX ? s : { ...s, playerX };
}
export function start(s: Session): Session {
  return s.status === 'ready' || s.status === 'paused'
    ? { ...s, started: true, status: 'running' }
    : s;
}
export function pause(s: Session): Session {
  return s.status === 'running' ? { ...s, status: 'paused' } : s;
}
export function nextStage(s: Session): Session {
  if (s.status !== 'between' || s.stage >= STAGE_COUNT) return s;
  return {
    ...s,
    status: 'ready',
    stage: s.stage + 1,
    enemies: formation(),
    covers: cover(),
    bullets: [],
    direction: 1,
    playerX: WIDTH / 2,
    fireTicks: 0,
    enemyFireTicks: 25,
    invulnerableTicks: 30,
  };
}
export function stageSpeed(stage: number, remaining: number): number {
  return 21 + stage * 2.5 + (ENEMY_COUNT - remaining) * 2;
}
export function enemyFirePeriod(stage: number): number {
  return Math.max(13, 42 - stage);
}
/** A step is exactly 1/30 s. The adapter never catches up more than four steps. */
export function step(s: Session): Session {
  if (s.status !== 'running') return s;
  let enemies = s.enemies.map((enemy) => ({ ...enemy }));
  let bullets = s.bullets.map((bullet) => ({ ...bullet }));
  const covers = s.covers.map((brick) => ({ ...brick }));
  let direction = s.direction;
  let score = s.score;
  let lives = s.lives;
  let invulnerableTicks = Math.max(0, s.invulnerableTicks - 1);
  let fireTicks = Math.max(0, s.fireTicks - 1);
  let enemyFireTicks = Math.max(0, s.enemyFireTicks - 1);
  let nextBulletId = s.nextBulletId;
  let shotIndex = s.shotIndex;
  const dx = (stageSpeed(s.stage, enemies.length) / 30) * direction;
  if (enemies.some((enemy) => enemy.x + dx < 17 || enemy.x + dx > WIDTH - 17)) {
    direction = direction === 1 ? -1 : 1;
    enemies = enemies.map((enemy) => ({ ...enemy, y: enemy.y + 12 }));
  } else enemies = enemies.map((enemy) => ({ ...enemy, x: enemy.x + dx }));
  const invaded = enemies.some((enemy) => enemy.y + 10 >= DEFENSE_Y);
  if (fireTicks === 0 && bullets.filter((bullet) => bullet.owner === 'player').length < 5) {
    bullets.push({ id: nextBulletId++, x: s.playerX, y: PLAYER_Y - 17, owner: 'player' });
    fireTicks = 9;
  }
  if (
    enemyFireTicks === 0 &&
    enemies.length &&
    bullets.filter((bullet) => bullet.owner === 'enemy').length < 8
  ) {
    // Only the lowest living invader in each column can fire. No RNG or search.
    const front = enemies.filter(
      (enemy) => !enemies.some((other) => other.id % 7 === enemy.id % 7 && other.y > enemy.y),
    );
    const shooter = front[(shotIndex * 3 + s.stage) % front.length]!;
    bullets.push({ id: nextBulletId++, x: shooter.x, y: shooter.y + 12, owner: 'enemy' });
    enemyFireTicks = enemyFirePeriod(s.stage);
    shotIndex += 1;
  }
  const surviving: Bullet[] = [];
  for (const bullet of bullets) {
    const beforeY = bullet.y;
    bullet.y += bullet.owner === 'player' ? -12 : (105 + s.stage * 4) / 30;
    const low = Math.min(beforeY, bullet.y);
    const high = Math.max(beforeY, bullet.y);
    // The closest intersected cover intercepts a projectile before its target.
    const bricks = covers.filter(
      (brick) =>
        brick.hp > 0 &&
        Math.abs(brick.x - bullet.x) <= 8 &&
        high >= brick.y - 8 &&
        low <= brick.y + 8,
    );
    const hitCover = bricks.sort((a, b) => (bullet.owner === 'player' ? b.y - a.y : a.y - b.y))[0];
    if (hitCover) {
      hitCover.hp -= 1;
      continue;
    }
    if (bullet.owner === 'player') {
      const hit = enemies
        .filter(
          (enemy) =>
            Math.abs(enemy.x - bullet.x) <= 12 && high >= enemy.y - 10 && low <= enemy.y + 10,
        )
        .sort((a, b) => b.y - a.y)[0];
      if (hit) {
        enemies = enemies.filter((enemy) => enemy.id !== hit.id);
        score += (4 - Math.floor(hit.id / 7)) * 10;
        continue;
      }
    } else if (
      Math.abs(bullet.x - s.playerX) <= 12 &&
      high >= PLAYER_Y - 10 &&
      low <= PLAYER_Y + 10
    ) {
      if (invulnerableTicks === 0) {
        lives -= 1;
        invulnerableTicks = 45;
      }
      continue;
    }
    if (bullet.y >= -15 && bullet.y <= HEIGHT + 15) surviving.push(bullet);
  }
  bullets = surviving;
  for (const brick of covers) {
    if (
      enemies.some((enemy) => Math.abs(enemy.x - brick.x) < 20 && Math.abs(enemy.y - brick.y) < 18)
    )
      brick.hp = 0;
  }
  const status: Status =
    lives <= 0 || invaded
      ? 'lost'
      : enemies.length === 0
        ? s.stage === STAGE_COUNT
          ? 'won'
          : 'between'
        : 'running';
  const ticks = s.ticks + 1;
  return {
    ...s,
    status,
    lives: Math.max(0, lives),
    enemies,
    bullets,
    covers,
    direction,
    score,
    fireTicks,
    enemyFireTicks,
    invulnerableTicks,
    nextBulletId,
    shotIndex,
    ticks,
    elapsedSeconds: Math.floor(ticks / 30),
  };
}
