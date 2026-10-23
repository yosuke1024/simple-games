import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import { restoreSession, type Action } from '../game';
import { TP_STORAGE_KEYS } from './keys';
export { TP_STORAGE_KEYS };
export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}
export interface Stats {
  schemaVersion: 1;
  played: number;
  wins: number;
  bestRemaining: number | null;
  totalPlaySeconds: number;
}
export interface PersistedGame {
  schemaVersion: 1;
  seed: number;
  actions: Action[];
  elapsedSeconds: number;
  countedWin: boolean;
  savedAt: number;
}
export const flagsSchema: SchemaDef<Flags> = {
  key: TP_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate(raw) {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};
export const statsSchema: SchemaDef<Stats> = {
  key: TP_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    wins: 0,
    bestRemaining: null,
    totalPlaySeconds: 0,
  }),
  validate(raw) {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e12);
    const wins = asInt(raw.wins, 0, 1e12);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    const bestRemaining = raw.bestRemaining === null ? null : asInt(raw.bestRemaining, 0, 28);
    if (
      played === null ||
      wins === null ||
      totalPlaySeconds === null ||
      (raw.bestRemaining !== null && bestRemaining === null)
    )
      return null;
    return { schemaVersion: 1, played, wins, bestRemaining, totalPlaySeconds };
  },
};
export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: TP_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate(raw) {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    const session = restoreSession(raw);
    if (savedAt === null || !session || session.status !== 'playing') return null;
    return {
      schemaVersion: 1,
      seed: session.seed,
      actions: session.actions,
      elapsedSeconds: session.elapsedSeconds,
      countedWin: session.countedWin,
      savedAt,
    };
  },
};
