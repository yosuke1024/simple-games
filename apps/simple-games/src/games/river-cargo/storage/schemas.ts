import type { SchemaDef } from '../../../storage/schemas';
import { asInt, isRecord } from '../../../storage/validate';
import {
  act,
  createSession,
  puzzleById,
  isMode,
  MODES,
  type Session,
  type Mode,
  type Action,
} from '../game';
import { RG_STORAGE_KEYS } from './keys';
export { RG_STORAGE_KEYS };
export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}
export const flagsSchema: SchemaDef<Flags> = {
  key: RG_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) =>
    isRecord(raw) && raw.schemaVersion === 1 && typeof raw.tutorialCompleted === 'boolean'
      ? { schemaVersion: 1, tutorialCompleted: raw.tutorialCompleted }
      : null,
};
export interface Prefs {
  schemaVersion: 1;
  mode: Mode;
}
export const prefsSchema: SchemaDef<Prefs> = {
  key: RG_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, mode: 'easy' }),
  validate: (raw) =>
    isRecord(raw) && raw.schemaVersion === 1 && isMode(raw.mode)
      ? { schemaVersion: 1, mode: raw.mode }
      : null,
};
export interface BoardStats {
  played: number;
  completed: number;
  best: number | null;
}
export interface Stats {
  schemaVersion: 2;
  puzzles: Record<string, BoardStats>;
  totalPlaySeconds: number;
  boards: Record<Mode, BoardStats>;
}
export const statsSchema: SchemaDef<Stats> = {
  key: RG_STORAGE_KEYS.stats,
  version: 2,
  defaultValue: () => ({
    schemaVersion: 2,
    puzzles: {},
    totalPlaySeconds: 0,
    boards: {
      easy: { played: 0, completed: 0, best: null },
      normal: { played: 0, completed: 0, best: null },
      hard: { played: 0, completed: 0, best: null },
    },
  }),
  validate: (raw) => {
    if (
      !isRecord(raw) ||
      (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) ||
      !isRecord(raw.boards)
    )
      return null;
    const seconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (seconds === null) return null;
    const boards = {} as Record<Mode, BoardStats>;
    for (const mode of MODES) {
      const b = raw.boards[mode];
      if (!isRecord(b)) return null;
      const played = asInt(b.played, 0, 1e9),
        completed = asInt(b.completed, 0, 1e9),
        best = b.best === null ? null : asInt(b.best, 0, 1e9);
      if (
        played === null ||
        completed === null ||
        completed > played ||
        (best === null && b.best !== null)
      )
        return null;
      boards[mode] = { played, completed, best };
    }
    const puzzles: Record<string, BoardStats> = {};
    if (raw.schemaVersion === 2) {
      if (!isRecord(raw.puzzles)) return null;
      for (const [id, b] of Object.entries(raw.puzzles)) {
        if (!puzzleById(id) || !isRecord(b)) return null;
        const played = asInt(b.played, 0, 1e9),
          completed = asInt(b.completed, 0, 1e9),
          best = b.best === null ? null : asInt(b.best, 0, 1e9);
        if (
          played === null ||
          completed === null ||
          completed > played ||
          (best === null && b.best !== null)
        )
          return null;
        puzzles[id] = { played, completed, best };
      }
    } else
      for (const mode of MODES) {
        if (boards[mode].played) puzzles[mode + '-1'] = { ...boards[mode] };
      }
    return { schemaVersion: 2, puzzles, totalPlaySeconds: seconds, boards };
  },
};
export interface PersistedGame {
  schemaVersion: 2;
  puzzleId: string;
  seed: number;
  mode: Mode;
  actions: Action[];
  elapsedSeconds: number;
  savedAt: number;
}
export function restore(raw: unknown): Session | null {
  if (
    !isRecord(raw) ||
    (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) ||
    !isMode(raw.mode) ||
    !Array.isArray(raw.actions) ||
    raw.actions.length > 512
  )
    return null;
  const seed = asInt(raw.seed, 0, 0xffffffff),
    elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e12);
  if (seed === null || elapsedSeconds === null) return null;
  const puzzleId = raw.schemaVersion === 1 ? raw.mode + '-1' : raw.puzzleId;
  if (typeof puzzleId !== 'string' || puzzleById(puzzleId)?.mode !== raw.mode) return null;
  let session = createSession(raw.mode, seed, puzzleId);
  for (const action of raw.actions) {
    const next = act(session, action as Action);
    if (!next) return null;
    session = next;
  }
  return session.status === 'playing' ? { ...session, elapsedSeconds } : null;
}
export function toPersisted(s: Session, savedAt: number): PersistedGame {
  return {
    schemaVersion: 2,
    puzzleId: s.puzzleId,
    seed: s.seed,
    mode: s.mode,
    actions: s.actions,
    elapsedSeconds: s.elapsedSeconds,
    savedAt,
  };
}
export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: RG_STORAGE_KEYS.game,
  version: 2,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    if (savedAt === null) return null;
    const s = restore(raw);
    return s ? toPersisted(s, savedAt) : null;
  },
};
