import type { SchemaDef } from '../../../storage/schemas';
import { asInt, isRecord } from '../../../storage/validate';
import { createSession, ENEMY_COUNT, HEIGHT, STAGE_COUNT, WIDTH, type Session } from '../game';
import { IV_STORAGE_KEYS } from './keys';
export { IV_STORAGE_KEYS };
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
    const bestScore = asInt(raw.bestScore, 0, 14000);
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
export interface PersistedGame {
  schemaVersion: 1;
  session: Session;
  savedAt: number;
}
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
/** Validate structure and bounded work before restoring. No execution or search. */
export function restore(raw: unknown): Session | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !isRecord(raw.session)) return null;
  const value = raw.session;
  const base = createSession();
  const status = value.status;
  if (status !== 'ready' && status !== 'paused' && status !== 'running' && status !== 'between')
    return null;
  if (typeof value.started !== 'boolean' || (status !== 'ready' && !value.started)) return null;
  const stage = asInt(value.stage, 1, STAGE_COUNT);
  const score = asInt(value.score, 0, 14000);
  const lives = asInt(value.lives, 1, 3);
  const ticks = asInt(value.ticks, 0, 1e9);
  const elapsedSeconds = asInt(value.elapsedSeconds, 0, 1e9);
  const fireTicks = asInt(value.fireTicks, 0, 9);
  const enemyFireTicks = asInt(value.enemyFireTicks, 0, 42);
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
  for (const enemy of value.enemies) {
    if (!isRecord(enemy)) return null;
    const id = asInt(enemy.id, 0, ENEMY_COUNT - 1);
    if (
      id === null ||
      enemies.some((item) => item.id === id) ||
      !finite(enemy.x, 16, WIDTH - 16) ||
      !finite(enemy.y, 55, 401.999)
    )
      return null;
    enemies.push({ id, x: enemy.x, y: enemy.y });
  }
  if (
    (status === 'between') !== (enemies.length === 0) ||
    (status === 'between' && stage === STAGE_COUNT)
  )
    return null;
  const remainingScore = enemies.reduce(
    (sum, enemy) => sum + (4 - Math.floor(enemy.id / 7)) * 10,
    0,
  );
  if (score !== stage * 700 - remainingScore) return null;
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
    score,
    lives,
    playerX: value.playerX,
    direction: value.direction,
    enemies,
    bullets,
    covers,
    fireTicks,
    enemyFireTicks,
    invulnerableTicks,
    shotIndex,
    nextBulletId,
    ticks,
    elapsedSeconds,
  };
}
export function toPersisted(session: Session, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    session: session.status === 'running' ? { ...session, status: 'paused' } : session,
    savedAt,
  };
}
export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: IV_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    const session = restore(raw);
    return savedAt !== null && session ? toPersisted(session, savedAt) : null;
  },
};
