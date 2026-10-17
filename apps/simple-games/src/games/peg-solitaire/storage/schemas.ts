/**
 * Peg Solitaire's own persisted records, under the `pg.` prefix declared in
 * ./keys (docs/PEG_SOLITAIRE_RULES.md §11). Isolated from the shared records
 * and from every other game: corruption here can never take the shell or
 * another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. Every record is `schemaVersion: 1`; while the game is in
 * early release (registry `channel: 'web-beta'`) the shapes may still change,
 * and they freeze when it graduates (§11).
 *
 * There is one saved-game slot and no daily, so the two-slot rule
 * (src/test/savedGameSlots.test.ts) does not apply here.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import {
  BOARD_KINDS,
  geometryOf,
  isBoardKind,
  maxJumps,
  restoreSession,
  toRecord,
  type BoardKind,
} from '../game';

import { PG_STORAGE_KEYS } from './keys';

export { PG_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * The board chosen last (§7, §11): which board the home offers first when no
 * game is suspended, and which board the first run starts on. Nothing else —
 * in particular not the problem last dealt (§8).
 */
export interface Prefs {
  schemaVersion: 1;
  board: BoardKind;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: PG_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, board: 'english' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    // `isBoardKind`, not a lookup: a stored 'toString' names a property every
    // object has, and must read as "not a board", never as one (§11).
    return isBoardKind(raw.board) ? { schemaVersion: 1, board: raw.board } : null;
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: PG_STORAGE_KEYS.flags,
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
 * One board's record (§10). No streak, no score: how many games were begun,
 * the fewest pegs a finished game left, and how many perfect clears.
 */
export interface BoardStats {
  /** Games begun on this board (new board, retry, first run). Not resumes. */
  played: number;
  /** The fewest pegs a finished game left; null until one has finished. */
  best: number | null;
  /** Perfect clears: one peg left, in the ringed hole (§3). */
  perfect: number;
}

export type Stats = {
  schemaVersion: 1;
  totalPlaySeconds: number;
} & Record<BoardKind, BoardStats>;

export const emptyBoardStats = (): BoardStats => ({ played: 0, best: null, perfect: 0 });

/**
 * One board's record, field by field (§11). `played` is not compared with
 * the other fields — it can lag behind them legitimately (a suspended game
 * resumed after `pg.stats` alone fell back to its default), and refusing that
 * would throw away both boards' records and the play time at once. The one
 * cross-check is the one play cannot break: a perfect clear leaves one peg,
 * and `best` and `perfect` move in the same write.
 */
function validateBoardStats(raw: unknown, kind: BoardKind): BoardStats | null {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const perfect = asInt(raw.perfect, 0, 1e9);
  // A finished game played at least one jump, so it left at most
  // holes − 2 pegs; and never 0, since a jump always leaves its jumper.
  const best = raw.best === null ? null : asInt(raw.best, 1, maxJumps(geometryOf(kind)));
  if (played === null || perfect === null) return null;
  if (best === null && raw.best !== null) return null;
  if (perfect > 0 && best !== 1) return null;
  return { played, best, perfect };
}

export const statsSchema: SchemaDef<Stats> = {
  key: PG_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    english: emptyBoardStats(),
    triangle: emptyBoardStats(),
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (totalPlaySeconds === null) return null;
    const out = { schemaVersion: 1 as const } as Stats;
    for (const kind of BOARD_KINDS) {
      const board = validateBoardStats(raw[kind], kind);
      if (board === null) return null;
      out[kind] = board;
    }
    out.totalPlaySeconds = totalPlaySeconds;
    return out;
  },
};

// ---------- saved game ----------

/**
 * The one suspended game (§11): its problem and the jumps played, never the
 * board itself. The jump list is also the Undo history, so a resumed game can
 * still be taken back to its first position (§6).
 */
export interface PersistedGame {
  schemaVersion: 1;
  board: BoardKind;
  /** The hole that started empty (game/boards.ts index). */
  start: number;
  /** The ringed hole (game/boards.ts index). */
  target: number;
  /** Every jump played, oldest first, as [from, to]. */
  jumps: [number, number][];
  /** Seconds already booked for this game (statistics only; never shown). */
  elapsedSeconds: number;
  /**
   * Present, and true, only on a game whose perfect clear was undone: its
   * clear is already counted, and finishing it again must not count another
   * (§6, §10). Every other record goes without it; absent reads as false.
   */
  cleared?: true;
  /** When it was written (epoch ms). */
  savedAt: number;
}

/**
 * Fail-closed (§11): the record is replayed from the problem's opening
 * through the rules (`restoreSession`), so a board that play could not have
 * produced, a problem this game never deals, a finished game, a malformed
 * jump list, a clock out of range or a `cleared` that is not a boolean all
 * come back as null — and the player lands on the game's home with nothing
 * restored. What is returned is the record as the replay rebuilt it, so a
 * stored −0 reads as 0, a stored `cleared: false` is dropped like an absent
 * one, and an unknown extra field is dropped.
 */
export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: PG_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    if (savedAt === null) return null;
    const restored = restoreSession(raw);
    if (!restored.ok) return null;
    const record = toRecord(restored.session);
    return {
      schemaVersion: 1,
      board: record.board,
      start: record.start,
      target: record.target,
      jumps: record.jumps.map(([from, to]) => [from, to]),
      elapsedSeconds: record.elapsedSeconds,
      ...(record.cleared ? { cleared: true as const } : {}),
      savedAt,
    };
  },
};
