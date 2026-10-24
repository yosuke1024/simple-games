import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import { MODES, parseSession, type Mode, type Session } from '../game';
import { PR_STORAGE_KEYS } from './keys';
export { PR_STORAGE_KEYS };
export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}
export interface Prefs {
  schemaVersion: 1;
  mode: Mode;
}
export interface ModeStats {
  played: number;
  wins: number;
  losses: number;
}
export type Stats = { schemaVersion: 1; totalPlaySeconds: number } & Record<Mode, ModeStats>;
export const flagsSchema: SchemaDef<Flags> = {
  key: PR_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const value = asBool(raw.tutorialCompleted);
    return value === null ? null : { schemaVersion: 1, tutorialCompleted: value };
  },
};
export const prefsSchema: SchemaDef<Prefs> = {
  key: PR_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, mode: 'easy' }),
  validate: (raw) =>
    isRecord(raw) && raw.schemaVersion === 1 && MODES.includes(raw.mode as Mode)
      ? { schemaVersion: 1, mode: raw.mode as Mode }
      : null,
};
export const statsSchema: SchemaDef<Stats> = {
  key: PR_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    totalPlaySeconds: 0,
    easy: { played: 0, wins: 0, losses: 0 },
    normal: { played: 0, wins: 0, losses: 0 },
    hard: { played: 0, wins: 0, losses: 0 },
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (seconds === null) return null;
    const out = statsSchema.defaultValue();
    out.totalPlaySeconds = seconds;
    for (const mode of MODES) {
      const row = raw[mode];
      if (!isRecord(row)) return null;
      const played = asInt(row.played, 0, 1e9),
        wins = asInt(row.wins, 0, 1e9),
        losses = asInt(row.losses, 0, 1e9);
      if (played === null || wins === null || losses === null) return null;
      out[mode] = { played, wins, losses };
    }
    return out;
  },
};
export const gameSchema: SchemaDef<Session | null> = {
  key: PR_STORAGE_KEYS.saveGame,
  version: 1,
  defaultValue: () => null,
  validate: parseSession,
};
