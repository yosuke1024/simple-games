/**
 * Bunny Hop's own persisted records, under the `bh.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take
 * the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Two records and no more. A real-time track cannot be suspended and restored
 * in any honest way — reopening the game would drop the runner straight into
 * a cactus — so leaving a run ends it, and the next one is free and instant
 * (docs/BUNNY_HOP_RULES.md §10).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';

import { BH_STORAGE_KEYS } from './keys';

export { BH_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: BH_STORAGE_KEYS.flags,
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
 * Counts, the personal best, and totals (§9). One best score for the whole
 * game, because every run starts at the same speed on an empty track — there
 * is no difficulty to keep separate records for. No streaks: this game has no
 * reason to know which days somebody played, so it does not record them.
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  bestScore: number;
  obstaclesPassed: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: BH_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    bestScore: 0,
    obstaclesPassed: 0,
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const bestScore = asInt(raw.bestScore, 0, 1e12);
    const obstaclesPassed = asInt(raw.obstaclesPassed, 0, 1e12);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (
      played === null ||
      bestScore === null ||
      obstaclesPassed === null ||
      totalPlaySeconds === null
    ) {
      return null;
    }
    return { schemaVersion: 1, played, bestScore, obstaclesPassed, totalPlaySeconds };
  },
};
