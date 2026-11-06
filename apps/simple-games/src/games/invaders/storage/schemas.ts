import type { SchemaDef } from '../../../storage/schemas';
import { asInt, isRecord } from '../../../storage/validate';
import {
  createSession,
  DIVE_EVERY_MAX,
  DIVE_GRACE_TICKS,
  DIVE_MAX,
  DIVE_TICKS,
  DIVER_SLOT_MAX_Y,
  ENEMY_COUNT,
  ENEMY_FIRE_TICKS_MAX,
  expectedScore,
  HEIGHT,
  isLayoutId,
  layoutSlots,
  STAGE_COUNT,
  WIDTH,
  type Dive,
  type LayoutId,
  type Session,
} from '../game';
import { IV_STORAGE_KEYS } from './keys';
export { IV_STORAGE_KEYS };
/**
 * The most a score may hold. The published v1 build could reach 14,000 (twenty full blocks);
 * the stage table now tops out lower, but a record is never refused for a score an older build
 * could honestly earn.
 */
const SCORE_CAP = 14000;
export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}
export const flagsSchema: SchemaDef<Flags> = {
  key: IV_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) =>
    isRecord(raw) && raw.schemaVersion === 1 && typeof raw.tutorialCompleted === 'boolean'
      ? { schemaVersion: 1, tutorialCompleted: raw.tutorialCompleted }
      : null,
};
export interface Stats {
  schemaVersion: 1;
  played: number;
  cleared: number;
  bestScore: number;
  bestStage: number;
  totalPlaySeconds: number;
}
export const statsSchema: SchemaDef<Stats> = {
  key: IV_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    cleared: 0,
    bestScore: 0,
    bestStage: 0,
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const cleared = asInt(raw.cleared, 0, 1e9);
    const bestScore = asInt(raw.bestScore, 0, SCORE_CAP);
    const bestStage = asInt(raw.bestStage, 0, STAGE_COUNT);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (
      played === null ||
      cleared === null ||
      cleared > played ||
      bestScore === null ||
      bestStage === null ||
      totalPlaySeconds === null
    )
      return null;
    return { schemaVersion: 1, played, cleared, bestScore, bestStage, totalPlaySeconds };
  },
};
/**
 * The saved run. Version 2 (2026-11-06) added the stage's formation shape, the score the stage
 * began at, the dive clock and a dive in flight per invader (docs/INVADERS_RULES.md §7).
 * A version 1 record is the one shape that build could hold — the full block, every earlier
 * stage worth 700 — and is read as exactly that; its formation is kept, not re-dealt.
 */
export interface PersistedGame {
  schemaVersion: 2;
  session: Session;
  savedAt: number;
}
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
function asDive(raw: unknown): Dive | null {
  if (!isRecord(raw)) return null;
  const t = asInt(raw.t, 0, DIVE_TICKS - 1);
  if (t === null || !finite(raw.px, 16, WIDTH - 16) || (raw.side !== -1 && raw.side !== 1))
    return null;
  return { t, px: raw.px, side: raw.side };
}
/** Validate structure and bounded work before restoring. No execution or search. */
export function restore(raw: unknown): Session | null {
  if (!isRecord(raw) || !isRecord(raw.session)) return null;
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) return null;
  const legacy = raw.schemaVersion === 1;
  const value = raw.session;
  const base = createSession();
  const status = value.status;
  if (status !== 'ready' && status !== 'paused' && status !== 'running' && status !== 'between')
    return null;
  if (typeof value.started !== 'boolean' || (status !== 'ready' && !value.started)) return null;
  const stage = asInt(value.stage, 1, STAGE_COUNT);
  const score = asInt(value.score, 0, SCORE_CAP);
  const lives = asInt(value.lives, 1, 3);
  const ticks = asInt(value.ticks, 0, 1e9);
  const elapsedSeconds = asInt(value.elapsedSeconds, 0, 1e9);
  const fireTicks = asInt(value.fireTicks, 0, 9);
  const enemyFireTicks = asInt(value.enemyFireTicks, 0, ENEMY_FIRE_TICKS_MAX);
  const invulnerableTicks = asInt(value.invulnerableTicks, 0, 45);
  const shotIndex = asInt(value.shotIndex, 0, 1e9);
  const nextBulletId = asInt(value.nextBulletId, 0, 1e9);
  if (
    stage === null ||
    score === null ||
    score % 10 !== 0 ||
    lives === null ||
    ticks === null ||
    elapsedSeconds !== Math.floor(ticks / 30) ||
    fireTicks === null ||
    enemyFireTicks === null ||
    invulnerableTicks === null ||
    shotIndex === null ||
    nextBulletId === null ||
    !finite(value.playerX, 16, WIDTH - 16) ||
    (value.direction !== -1 && value.direction !== 1)
  )
    return null;
  // What version 2 records and version 1 could only mean.
  const layout: LayoutId | null = legacy ? 'full' : isLayoutId(value.layout) ? value.layout : null;
  const stageScoreBase = legacy
    ? (stage - 1) * 700
    : asInt(value.stageScoreBase, 0, (stage - 1) * 700);
  const diveTicks = legacy ? DIVE_GRACE_TICKS : asInt(value.diveTicks, 0, DIVE_EVERY_MAX);
  if (
    layout === null ||
    stageScoreBase === null ||
    stageScoreBase % 10 !== 0 ||
    diveTicks === null ||
    (!value.started && layout !== 'full')
  )
    return null;
  const slots = layoutSlots(layout);
  if (
    !Array.isArray(value.enemies) ||
    value.enemies.length > ENEMY_COUNT ||
    !Array.isArray(value.bullets) ||
    value.bullets.length > 13 ||
    !Array.isArray(value.covers) ||
    value.covers.length !== 15
  )
    return null;
  const enemies: Session['enemies'] = [];
  let diving = 0;
  for (const enemy of value.enemies) {
    if (!isRecord(enemy)) return null;
    const id = asInt(enemy.id, 0, ENEMY_COUNT - 1);
    // A diver's empty slot may have sunk past the defence line while it is away (the run goes
    // on until it glides back — §3); an invader in the line below the line has landed.
    const dive = !legacy && enemy.dive !== undefined ? asDive(enemy.dive) : null;
    if (!legacy && enemy.dive !== undefined && dive === null) return null;
    if (
      id === null ||
      !slots.includes(id) ||
      enemies.some((item) => item.id === id) ||
      !finite(enemy.x, 16, WIDTH - 16) ||
      !finite(enemy.y, 55, dive ? DIVER_SLOT_MAX_Y : 401.999)
    )
      return null;
    if (dive) {
      diving += 1;
      enemies.push({ id, x: enemy.x, y: enemy.y, dive });
    } else enemies.push({ id, x: enemy.x, y: enemy.y });
  }
  if (diving > DIVE_MAX) return null;
  if (
    (status === 'between') !== (enemies.length === 0) ||
    (status === 'between' && stage === STAGE_COUNT)
  )
    return null;
  if (score !== expectedScore({ stageScoreBase, layout, enemies })) return null;
  const bullets: Session['bullets'] = [];
  for (const bullet of value.bullets) {
    if (!isRecord(bullet)) return null;
    const id = asInt(bullet.id, 0, nextBulletId - 1);
    if (
      id === null ||
      bullets.some((item) => item.id === id) ||
      !finite(bullet.x, 0, WIDTH) ||
      !finite(bullet.y, -15, HEIGHT + 15) ||
      (bullet.owner !== 'player' && bullet.owner !== 'enemy')
    )
      return null;
    bullets.push({ id, x: bullet.x, y: bullet.y, owner: bullet.owner });
  }
  if (
    bullets.filter((bullet) => bullet.owner === 'player').length > 5 ||
    bullets.filter((bullet) => bullet.owner === 'enemy').length > 8
  )
    return null;
  const covers: Session['covers'] = [];
  for (let id = 0; id < 15; id += 1) {
    const brick: unknown = value.covers[id];
    const expected = base.covers[id]!;
    if (!isRecord(brick) || brick.id !== id || brick.x !== expected.x || brick.y !== expected.y)
      return null;
    const hp = asInt(brick.hp, 0, 2);
    if (hp === null) return null;
    covers.push({ ...expected, hp });
  }
  if (!value.started && (ticks !== 0 || stage !== 1 || score !== 0 || lives !== 3)) return null;
  return {
    status: status === 'running' ? 'paused' : status,
    started: value.started,
    stage,
    layout,
    score,
    stageScoreBase,
    lives,
    playerX: value.playerX,
    direction: value.direction,
    enemies,
    bullets,
    covers,
    fireTicks,
    enemyFireTicks,
    invulnerableTicks,
    diveTicks,
    shotIndex,
    nextBulletId,
    ticks,
    elapsedSeconds,
  };
}
export function toPersisted(session: Session, savedAt: number): PersistedGame {
  return {
    schemaVersion: 2,
    session: session.status === 'running' ? { ...session, status: 'paused' } : session,
    savedAt,
  };
}
export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: IV_STORAGE_KEYS.game,
  version: 2,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    const session = restore(raw);
    return savedAt !== null && session ? toPersisted(session, savedAt) : null;
  },
};
