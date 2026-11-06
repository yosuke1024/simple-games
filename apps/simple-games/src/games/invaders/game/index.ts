/** Pure, bounded formation simulation. docs/INVADERS_RULES.md §§1–6. */
import {
  COLS,
  DIVE_GRACE_TICKS,
  layoutPoints,
  layoutSlots,
  pointsFor,
  ROWS,
  stageSpec,
  type FireMode,
  type LayoutId,
} from './stages';
export {
  DIVE_EVERY_MAX,
  DIVE_GRACE_TICKS,
  DIVE_MAX,
  isLayoutId,
  LAYOUT_IDS,
  layoutPoints,
  layoutSlots,
  MAX_SCORE,
  pointsFor,
  STAGES,
  stageSpec,
} from './stages';
export type { FireMode, LayoutId, StageSpec } from './stages';
export const WIDTH = 360;
export const HEIGHT = 480;
export const PLAYER_Y = 438;
export const DEFENSE_Y = 412;
export const STAGE_COUNT = 20;
export const STEP_MS = 1000 / 30;
export const ENEMY_COUNT = ROWS * COLS;
/**
 * A dive (§3): the swoop from the formation to where the ship stood when it left, a short run
 * off the bottom, then the glide back in from the top to its own slot. Every phase is a plain
 * function of the tick count, so the path is the same on every device and can be read ahead.
 */
export const DIVE_SWOOP_TICKS = 72;
export const DIVE_EXIT_TICKS = 6;
export const DIVE_RETURN_TICKS = 45;
export const DIVE_TICKS = DIVE_SWOOP_TICKS + DIVE_EXIT_TICKS + DIVE_RETURN_TICKS;
/**
 * How far a diver's slot may have sunk past the defence line while it is away: the line can
 * reverse about six times in one dive, 18 px each, from just above the line (§3, §7). The save
 * validator accepts a diver's slot down to here; an invader in the line is still held at the
 * line, since one below it has already landed.
 */
export const DIVER_SLOT_MAX_Y = HEIGHT + 40;
/** The second shot of a burst pair follows the first this many ticks later (§3). */
export const BURST_GAP_TICKS = 5;
/** No wait between enemy shots is ever longer than this; the save validator holds the same line. */
export const ENEMY_FIRE_TICKS_MAX = 70;
export type Status = 'ready' | 'running' | 'paused' | 'between' | 'won' | 'lost';
export interface Dive {
  /** Ticks since launch, 0 … DIVE_TICKS − 1. */
  t: number;
  /** Where the ship was when the dive began: the swoop's target. */
  px: number;
  /** Which way the swoop bulges first. */
  side: -1 | 1;
}
export interface Enemy {
  id: number;
  /** The slot in the formation. A diver's slot keeps moving with the line while it is away. */
  x: number;
  y: number;
  dive?: Dive;
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
  /** The shape this stage's formation was dealt as (§1). */
  layout: LayoutId;
  score: number;
  /** The score when this stage began; this stage's kills are the difference. */
  stageScoreBase: number;
  lives: number;
  playerX: number;
  enemies: Enemy[];
  bullets: Bullet[];
  covers: Cover[];
  direction: -1 | 1;
  fireTicks: number;
  enemyFireTicks: number;
  invulnerableTicks: number;
  /** Counts down to the next dive launch on stages that have them. */
  diveTicks: number;
  shotIndex: number;
  nextBulletId: number;
  ticks: number;
  elapsedSeconds: number;
}
export const finished = (s: Session): boolean => s.status === 'won' || s.status === 'lost';
export function createSession(): Session {
  const spec = stageSpec(1);
  return {
    status: 'ready',
    started: false,
    stage: 1,
    layout: spec.layout,
    score: 0,
    stageScoreBase: 0,
    lives: 3,
    playerX: WIDTH / 2,
    enemies: formation(spec.layout, spec.drop),
    bullets: [],
    covers: cover(),
    direction: 1,
    fireTicks: 0,
    enemyFireTicks: 25,
    invulnerableTicks: 30,
    diveTicks: DIVE_GRACE_TICKS,
    shotIndex: 0,
    nextBulletId: 0,
    ticks: 0,
    elapsedSeconds: 0,
  };
}
/** The formation a stage is dealt: the layout's slots, `drop` steps of 12 px lower than stage 1. */
export function formation(layout: LayoutId, drop: number): Enemy[] {
  return layoutSlots(layout).map((id) => ({
    id,
    x: 60 + (id % COLS) * 40,
    y: 55 + drop * 12 + Math.floor(id / COLS) * 32,
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
  const spec = stageSpec(s.stage + 1);
  return {
    ...s,
    status: 'ready',
    stage: s.stage + 1,
    layout: spec.layout,
    stageScoreBase: s.score,
    enemies: formation(spec.layout, spec.drop),
    covers: cover(),
    bullets: [],
    direction: 1,
    playerX: WIDTH / 2,
    fireTicks: 0,
    enemyFireTicks: 25,
    invulnerableTicks: 30,
    diveTicks: DIVE_GRACE_TICKS,
  };
}
/**
 * Horizontal speed of the formation. The stage sets the floor; every kill adds the same share
 * of the thinning bonus, so a formation of fourteen reaches the same top speed as one of
 * twenty-eight on its last invader (the full block's 2 px/s per kill, exactly as before).
 */
export function stageSpeed(stage: number, remaining: number, total = ENEMY_COUNT): number {
  return 21 + stage * 2.5 + (54 * (total - remaining)) / Math.max(1, total - 1);
}
export function enemyFirePeriod(stage: number): number {
  return Math.max(13, 42 - stage);
}
/** Where an invader is drawn and hit: its slot, or the point on its dive at this tick (§3). */
export function enemyPosition(enemy: Enemy): { x: number; y: number } {
  const dive = enemy.dive;
  if (!dive) return { x: enemy.x, y: enemy.y };
  if (dive.t < DIVE_SWOOP_TICKS) {
    // A quadratic curve from the slot to the ship's position at launch, bulging to one side on
    // the way. Its control point is kept inside the walls, so the whole curve is.
    const s = dive.t / DIVE_SWOOP_TICKS;
    const u = 1 - s;
    const cx = Math.max(16, Math.min(WIDTH - 16, enemy.x + dive.side * 150));
    const cy = (enemy.y + PLAYER_Y) / 2;
    return {
      x: u * u * enemy.x + 2 * u * s * cx + s * s * dive.px,
      y: u * u * enemy.y + 2 * u * s * cy + s * s * PLAYER_Y,
    };
  }
  if (dive.t < DIVE_SWOOP_TICKS + DIVE_EXIT_TICKS) {
    return { x: dive.px, y: PLAYER_Y + (dive.t - DIVE_SWOOP_TICKS) * 14 };
  }
  const r = (dive.t - DIVE_SWOOP_TICKS - DIVE_EXIT_TICKS) / DIVE_RETURN_TICKS;
  return { x: enemy.x, y: -24 + (enemy.y + 24) * r };
}
/** The lowest invader still in line in each column: the only ones that fire or leave to dive. */
function frontLine(enemies: readonly Enemy[]): Enemy[] {
  return enemies.filter(
    (enemy) =>
      !enemy.dive &&
      !enemies.some(
        (other) => !other.dive && other.id % COLS === enemy.id % COLS && other.y > enemy.y,
      ),
  );
}
/** The front invader whose column is closest to the ship; the lower id on a tie. */
function nearestToShip(front: readonly Enemy[], playerX: number): Enemy | undefined {
  let best: Enemy | undefined;
  for (const enemy of front) {
    if (
      best === undefined ||
      Math.abs(enemy.x - playerX) < Math.abs(best.x - playerX) ||
      (Math.abs(enemy.x - playerX) === Math.abs(best.x - playerX) && enemy.id < best.id)
    )
      best = enemy;
  }
  return best;
}
function shooter(
  front: readonly Enemy[],
  mode: FireMode,
  shotIndex: number,
  stage: number,
  playerX: number,
): Enemy | undefined {
  if (front.length === 0) return undefined;
  if (mode === 'aimed') return nearestToShip(front, playerX);
  return front[(shotIndex * 3 + stage) % front.length];
}
/** A step is exactly 1/30 s. The adapter never catches up more than four steps. */
export function step(s: Session): Session {
  if (s.status !== 'running') return s;
  const spec = stageSpec(s.stage);
  const total = layoutSlots(s.layout).length;
  let enemies = s.enemies.map((enemy) => ({ ...enemy }));
  let bullets = s.bullets.map((bullet) => ({ ...bullet }));
  const covers = s.covers.map((brick) => ({ ...brick }));
  let direction = s.direction;
  let score = s.score;
  let lives = s.lives;
  let invulnerableTicks = Math.max(0, s.invulnerableTicks - 1);
  let fireTicks = Math.max(0, s.fireTicks - 1);
  let enemyFireTicks = Math.max(0, s.enemyFireTicks - 1);
  let diveTicks = Math.max(0, s.diveTicks - 1);
  let nextBulletId = s.nextBulletId;
  let shotIndex = s.shotIndex;
  // The line moves as one body, slots and all: a diver's slot travels with it, so the walls
  // are read from every slot and a dive never turns the formation around.
  const dx = (stageSpeed(s.stage, enemies.length, total) / 30) * direction;
  if (enemies.some((enemy) => enemy.x + dx < 17 || enemy.x + dx > WIDTH - 17)) {
    direction = direction === 1 ? -1 : 1;
    enemies = enemies.map((enemy) => ({ ...enemy, y: enemy.y + spec.descent }));
  } else enemies = enemies.map((enemy) => ({ ...enemy, x: enemy.x + dx }));
  // Dives in flight advance; one that has glided home rejoins the line.
  enemies = enemies.map((enemy) => {
    if (!enemy.dive) return enemy;
    const t = enemy.dive.t + 1;
    if (t >= DIVE_TICKS) {
      const { dive: _done, ...home } = enemy;
      return home;
    }
    return { ...enemy, dive: { ...enemy.dive, t } };
  });
  // The line lands, not a dive: a swoop crossing the defence line is not a landing, and a
  // diver whose empty slot has sunk past the line lands the moment it glides back into it —
  // read after the dives advance, so that moment is the one the player sees.
  const invaded = enemies.some((enemy) => !enemy.dive && enemy.y + 10 >= DEFENSE_Y);
  // A launch, on its own clock: the front invader above the ship leaves the line and swoops
  // at where the ship is now. No RNG — the stage's interval and the ship's column decide.
  if (spec.diveEvery > 0 && diveTicks === 0) {
    const inFlight = enemies.filter((enemy) => enemy.dive).length;
    const diver =
      inFlight < spec.diveMax ? nearestToShip(frontLine(enemies), s.playerX) : undefined;
    if (diver) {
      const side: -1 | 1 = diver.x <= s.playerX ? -1 : 1;
      enemies = enemies.map((enemy) =>
        enemy.id === diver.id ? { ...enemy, dive: { t: 0, px: s.playerX, side } } : enemy,
      );
      diveTicks = spec.diveEvery;
    }
  }
  if (fireTicks === 0 && bullets.filter((bullet) => bullet.owner === 'player').length < 5) {
    bullets.push({ id: nextBulletId++, x: s.playerX, y: PLAYER_Y - 17, owner: 'player' });
    fireTicks = 9;
  }
  if (
    enemyFireTicks === 0 &&
    enemies.length &&
    bullets.filter((bullet) => bullet.owner === 'enemy').length < 8
  ) {
    // Only the lowest living invader in each column can fire (§3). Which of them does is the
    // stage's voice: the fixed rotation, the one above the ship, or the rotation in pairs.
    const front = frontLine(enemies);
    const gunner = shooter(front, spec.fire, shotIndex, s.stage, s.playerX);
    if (gunner) {
      bullets.push({ id: nextBulletId++, x: gunner.x, y: gunner.y + 12, owner: 'enemy' });
      // A burst is a pair: the second shot follows close behind, then the line rests longer
      // than the rotation would, so a pair-firing stage sends more shots in bunches, not more
      // shots overall (§3).
      enemyFireTicks =
        spec.fire !== 'burst'
          ? enemyFirePeriod(s.stage)
          : shotIndex % 2 === 0
            ? BURST_GAP_TICKS
            : Math.min(ENEMY_FIRE_TICKS_MAX, Math.round(enemyFirePeriod(s.stage) * 1.6));
      shotIndex += 1;
    }
  }
  const placed = enemies.map((enemy) => ({ enemy, at: enemyPosition(enemy) }));
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
    if (bullet.owner === 'player') {
      // The line is always above the bunkers, but a diver may be passing below one: the
      // bullet spends itself on whichever it reaches first on its way up.
      const hit = placed
        .filter(
          ({ at }) => Math.abs(at.x - bullet.x) <= 12 && high >= at.y - 10 && low <= at.y + 10,
        )
        .sort((a, b) => b.at.y - a.at.y)[0];
      if (hit && (!hitCover || hit.at.y > hitCover.y)) {
        enemies = enemies.filter((enemy) => enemy.id !== hit.enemy.id);
        placed.splice(placed.indexOf(hit), 1);
        score += pointsFor(hit.enemy.id);
        continue;
      }
      if (hitCover) {
        hitCover.hp -= 1;
        continue;
      }
    } else if (hitCover) {
      hitCover.hp -= 1;
      continue;
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
  // A diver that reaches the ship costs a life, like a shot would, and flies on: the stage is
  // cleared by shooting, never by being rammed.
  if (
    invulnerableTicks === 0 &&
    placed.some(
      ({ enemy, at }) =>
        enemy.dive && Math.abs(at.x - s.playerX) <= 14 && Math.abs(at.y - PLAYER_Y) <= 14,
    )
  ) {
    lives -= 1;
    invulnerableTicks = 45;
  }
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
    diveTicks,
    nextBulletId,
    shotIndex,
    ticks,
    elapsedSeconds: Math.floor(ticks / 30),
  };
}
/** The score a session must show for its stage and formation: the invariant every save keeps. */
export function expectedScore(s: Pick<Session, 'stageScoreBase' | 'layout' | 'enemies'>): number {
  return (
    s.stageScoreBase +
    layoutPoints(s.layout) -
    s.enemies.reduce((sum, enemy) => sum + pointsFor(enemy.id), 0)
  );
}
