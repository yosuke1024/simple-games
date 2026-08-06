/**
 * 2048's own persisted records, under the `tm.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/GAME_2048_RULES.md §10).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import { CELL_COUNT } from '../game';

import { TM_STORAGE_KEYS } from './keys';

export { TM_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: TM_STORAGE_KEYS.flags,
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
 * Five numbers, and no streak (§9). `bestScore` and `bestTile` are the only
 * records kept, and the only thing to compare them against is the same
 * device's own history — there is no ranking (§7).
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  bestScore: number;
  bestTile: number;
  /** How many games have reached 2048. A count, never a run of days (§9). */
  reached2048: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: TM_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    bestScore: 0,
    bestTile: 0,
    reached2048: 0,
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const bestScore = asInt(raw.bestScore, 0, 1e12);
    const bestTile = asInt(raw.bestTile, 0, 1e12);
    const reached2048 = asInt(raw.reached2048, 0, 1e9);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (
      played === null ||
      bestScore === null ||
      bestTile === null ||
      reached2048 === null ||
      totalPlaySeconds === null
    ) {
      return null;
    }
    return { schemaVersion: 1, played, bestScore, bestTile, reached2048, totalPlaySeconds };
  },
};

// ---------- saved game ----------

/**
 * One slot, holding a board mid-play (§10). The undo history is not part of
 * it: a resumed game starts from the position it was saved in, the same way
 * Sliding Puzzle's does.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  /** Base-36 exponent per cell (serialize.ts). */
  board: string;
  score: number;
  spawnIndex: number;
  reached2048: boolean;
  moveCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: TM_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed);
    const board = asString(raw.board, CELL_COUNT);
    const score = asInt(raw.score, 0, 1e12);
    const spawnIndex = asInt(raw.spawnIndex, 0, 1e9);
    const reached2048 = asBool(raw.reached2048);
    const moveCount = asInt(raw.moveCount, 0, 1e9);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);

    if (
      seed === null ||
      seed.length === 0 ||
      board === null ||
      score === null ||
      spawnIndex === null ||
      reached2048 === null ||
      moveCount === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }

    return {
      schemaVersion: 1,
      seed,
      board,
      score,
      spawnIndex,
      reached2048,
      moveCount,
      elapsedSeconds,
      savedAt,
    };
  },
};
