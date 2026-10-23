import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import { createSession, isSize, destinations, SIZES, type Session, type Size } from '../game';
import { ME_STORAGE_KEYS } from './keys';
export { ME_STORAGE_KEYS };
export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}
export const flagsSchema: SchemaDef<Flags> = {
  key: ME_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) =>
    isRecord(raw) && raw.schemaVersion === 1 && typeof raw.tutorialCompleted === 'boolean'
      ? { schemaVersion: 1, tutorialCompleted: raw.tutorialCompleted }
      : null,
};
export interface Prefs {
  schemaVersion: 1;
  size: Size;
}
export const prefsSchema: SchemaDef<Prefs> = {
  key: ME_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, size: 5 }),
  validate: (raw) =>
    isRecord(raw) && raw.schemaVersion === 1 && isSize(raw.size)
      ? { schemaVersion: 1, size: raw.size }
      : null,
};
export interface BoardStats {
  played: number;
  completed: number;
  best: number | null;
}
export interface Stats {
  schemaVersion: 1;
  totalPlaySeconds: number;
  boards: Record<Size, BoardStats>;
}
export const statsSchema: SchemaDef<Stats> = {
  key: ME_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    totalPlaySeconds: 0,
    boards: {
      5: { played: 0, completed: 0, best: null },
      7: { played: 0, completed: 0, best: null },
      9: { played: 0, completed: 0, best: null },
    },
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1 || !isRecord(raw.boards)) return null;
    const seconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (seconds === null) return null;
    const boards = {} as Record<Size, BoardStats>;
    for (const size of SIZES) {
      const item = raw.boards[size];
      if (!isRecord(item)) return null;
      const played = asInt(item.played, 0, 1e9);
      const completed = asInt(item.completed, 0, 1e9);
      const best = item.best === null ? null : asInt(item.best, 1, 1e9);
      if (played === null || completed === null || (best === null && item.best !== null))
        return null;
      boards[size] = { played, completed, best };
    }
    return { schemaVersion: 1, totalPlaySeconds: seconds, boards };
  },
};
export interface PersistedGame {
  schemaVersion: 1;
  size: Size;
  seed: number;
  history: number[];
  elapsedSeconds: number;
  cleared: boolean;
  savedAt: number;
}
export function restore(raw: unknown): Session | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !isSize(raw.size)) return null;
  const seed = asInt(raw.seed, 0, 0xffffffff);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e12);
  const cleared = asBool(raw.cleared);
  if (seed === null || elapsedSeconds === null || cleared === null || !Array.isArray(raw.history))
    return null;
  if (raw.history.length > 100_000) return null;
  const session = createSession(raw.size, seed);
  let position = 0;
  const history: number[] = [];
  for (const action of raw.history) {
    const target = asInt(action, 0, raw.size * raw.size - 1);
    if (
      target === null ||
      position === raw.size * raw.size - 1 ||
      !destinations(session.board, raw.size, position).includes(target)
    )
      return null;
    position = target;
    history.push(target);
  }
  if (position === raw.size * raw.size - 1) return null;
  return { ...session, position, history, elapsedSeconds, cleared };
}
export function toPersisted(session: Session, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    size: session.size,
    seed: session.seed,
    history: [...session.history],
    elapsedSeconds: session.elapsedSeconds,
    cleared: session.cleared,
    savedAt,
  };
}
export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: ME_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    if (savedAt === null) return null;
    const session = restore(raw);
    return session ? toPersisted(session, savedAt) : null;
  },
};
