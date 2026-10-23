import type { SchemaDef } from '../../../storage/schemas';
import { asInt, isRecord } from '../../../storage/validate';
import { WIDTH, HEIGHT, KINDS, fits, pieceAt, type Session, type Kind } from '../game';
import { FB_STORAGE_KEYS } from './keys';
export { FB_STORAGE_KEYS };
export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}
export const flagsSchema: SchemaDef<Flags> = {
  key: FB_STORAGE_KEYS.flags,
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
  bestScore: number;
  linesCleared: number;
  totalPlaySeconds: number;
}
export const statsSchema: SchemaDef<Stats> = {
  key: FB_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    bestScore: 0,
    linesCleared: 0,
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e12),
      bestScore = asInt(raw.bestScore, 0, 1e12);
    const linesCleared = asInt(raw.linesCleared, 0, 1e12),
      totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    return played === null ||
      bestScore === null ||
      linesCleared === null ||
      totalPlaySeconds === null
      ? null
      : { schemaVersion: 1, played, bestScore, linesCleared, totalPlaySeconds };
  },
};
export interface PersistedGame extends Session {
  schemaVersion: 1;
  savedAt: number;
}
export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: FB_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1 || !isRecord(raw.active)) return null;
    const seed = asInt(raw.seed, 0, 0xffffffff),
      pieceIndex = asInt(raw.pieceIndex, 0, 1e7);
    const score = asInt(raw.score, 0, 1e12),
      lines = asInt(raw.lines, 0, 4e7);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e12),
      savedAt = asInt(raw.savedAt, 0, 1e15);
    const x = asInt(raw.active.x, -3, WIDTH - 1),
      y = asInt(raw.active.y, 0, HEIGHT - 1),
      rotation = asInt(raw.active.rotation, 0, 3);
    if (
      seed === null ||
      pieceIndex === null ||
      score === null ||
      lines === null ||
      elapsedSeconds === null ||
      savedAt === null ||
      x === null ||
      y === null ||
      rotation === null
    )
      return null;
    if (raw.status !== 'ready' && raw.status !== 'paused' && raw.status !== 'running') return null;
    if (
      !Array.isArray(raw.board) ||
      raw.board.length !== WIDTH * HEIGHT ||
      raw.board.some((v) => asInt(v, 0, 7) === null)
    )
      return null;
    if (
      typeof raw.active.kind !== 'string' ||
      !KINDS.includes(raw.active.kind as Kind) ||
      raw.active.kind !== pieceAt(seed, pieceIndex)
    )
      return null;
    const board = [...raw.board] as number[];
    if (board.filter(Boolean).length !== pieceIndex * 4 - lines * WIDTH) return null;
    for (let row = 0; row < HEIGHT; row++)
      if (board.slice(row * WIDTH, (row + 1) * WIDTH).every(Boolean)) return null;
    const active = { kind: raw.active.kind as Kind, rotation, x, y };
    if (!fits(board, active)) return null;
    if (
      raw.status === 'ready' &&
      (pieceIndex !== 0 || score !== 0 || lines !== 0 || elapsedSeconds !== 0)
    )
      return null;
    return {
      schemaVersion: 1,
      seed,
      pieceIndex,
      score,
      lines,
      elapsedSeconds,
      savedAt,
      board,
      active,
      status: raw.status === 'ready' ? 'ready' : 'paused',
    };
  },
};
