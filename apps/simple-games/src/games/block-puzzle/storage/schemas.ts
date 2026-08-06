/**
 * Block Puzzle's own persisted records, under the `bp.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never
 * take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/BLOCK_PUZZLE_RULES.md §10).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import { CELL_COUNT, TRAY_SIZE } from '../game';

import { BP_STORAGE_KEYS } from './keys';

export { BP_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: BP_STORAGE_KEYS.flags,
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
 * Counts, the personal best, and total time (§9). No streaks: this game has
 * no reason to know which days somebody played, so it does not record them.
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  bestScore: number;
  linesCleared: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: BP_STORAGE_KEYS.stats,
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
    const played = asInt(raw.played, 0, 1e9);
    const bestScore = asInt(raw.bestScore, 0, 1e12);
    const linesCleared = asInt(raw.linesCleared, 0, 1e12);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (
      played === null ||
      bestScore === null ||
      linesCleared === null ||
      totalPlaySeconds === null
    ) {
      return null;
    }
    return { schemaVersion: 1, played, bestScore, linesCleared, totalPlaySeconds };
  },
};

// ---------- saved game ----------

/**
 * The one suspended game (§10). It carries the position and the counters and
 * nothing else — the undo history is deliberately absent, so a resumed board
 * begins where it was left rather than mid-way through a chain of steps back.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  /** '0'/'1' per cell, row-major (serialize.ts). */
  board: string;
  /** Base-36 piece id per slot, '-' for a spent one. */
  tray: string;
  score: number;
  batchIndex: number;
  linesCleared: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const seed = asString(raw.seed);
  const board = asString(raw.board, CELL_COUNT);
  const tray = asString(raw.tray, TRAY_SIZE);
  const score = asInt(raw.score, 0, 1e12);
  const batchIndex = asInt(raw.batchIndex, 0, 1e9);
  const linesCleared = asInt(raw.linesCleared, 0, 1e12);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    seed === null ||
    seed.length === 0 ||
    board === null ||
    tray === null ||
    score === null ||
    batchIndex === null ||
    linesCleared === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    seed,
    board,
    tray,
    score,
    batchIndex,
    linesCleared,
    elapsedSeconds,
    savedAt,
  };
};

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: BP_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: validatePersistedGame,
};
