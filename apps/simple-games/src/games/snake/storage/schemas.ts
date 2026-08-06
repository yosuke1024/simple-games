/**
 * Snake's own persisted records, under the `sn.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * There is deliberately no saved-game slot: a real-time board is not
 * restorable in any honest way — restoring one would mean a snake that starts
 * moving the instant the screen appears — so leaving the board abandons the
 * attempt and the retry is free (docs/SNAKE_RULES.md §10). There is no
 * progress record either: Snake has no level ladder to remember (§7), so the
 * two records below are the whole of what this game keeps.
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import { CELL_COUNT } from '../game/constants';

import { SN_STORAGE_KEYS } from './keys';

export { SN_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: SN_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

/**
 * Two personal records and two totals (§9). Both records are kept because
 * neither restates the other: a late meal is worth ten times an early one, so
 * a short greedy run can outscore a long careful one. No streaks, and nothing
 * that leaves the device.
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  bestScore: number;
  bestLength: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: SN_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    bestScore: 0,
    bestLength: 0,
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const bestScore = asInt(raw.bestScore, 0, 1e12);
    // A length can never exceed the board, so a stored one that does is data
    // this build did not write.
    const bestLength = asInt(raw.bestLength, 0, CELL_COUNT);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (played === null || bestScore === null || bestLength === null || totalPlaySeconds === null) {
      return null;
    }
    return { schemaVersion: 1, played, bestScore, bestLength, totalPlaySeconds };
  },
};
