/**
 * Unblock Puzzle's own persisted records, under the `ub.` prefix declared in
 * ./keys (docs/UNBLOCK_PUZZLE_RULES.md §12). Isolated from the shared records
 * and from every other game: corruption here can never take the shell or
 * another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. These check the SHAPE of a record — types, ranges, the mode a
 * slot is for, a board string that is a board at all. Whether a saved game is
 * one play could have produced (a board this game deals, a move list that
 * replays, a daily that is that date's board, a game not already won) is the
 * game's own question, asked by `restoreSession` one layer out in
 * gamePersistence.ts: the rules have one implementation, in game/.
 *
 * Where a record holds a map of results, a malformed entry is dropped rather
 * than costing the player the whole history.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  CELL_COUNT,
  DAILY_DIFFICULTY,
  DIFFICULTIES,
  MOVE_LIMIT,
  decodeBoard,
  isDifficulty,
  type Difficulty,
  type GameMode,
} from '../game';

import { UB_STORAGE_KEYS } from './keys';

export { UB_STORAGE_KEYS };

const asDifficulty = (value: unknown): Difficulty | null => (isDifficulty(value) ? value : null);

/** The longest seed play writes, with room to spare (`unblock-puzzle-<difficulty>-<token>`). */
const MAX_SEED_LENGTH = 200;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: UB_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- preferences ----------

/**
 * The one thing Unblock Puzzle remembers across boards: the difficulty last
 * chosen (§9, §12). Not a setting — nothing here changes how a board plays;
 * it only saves choosing again.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: UB_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'easy' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const difficulty = asDifficulty(raw.difficulty);
    return difficulty === null ? null : { schemaVersion: 1, difficulty };
  },
};

// ---------- statistics ----------

export interface DifficultyStats {
  /** Boards started: a new board or a retry, never a resume (§10). */
  played: number;
  solved: number;
  /** Clears in exactly the board's fewest moves (§10). */
  optimal: number;
  totalPlaySeconds: number;
  bestSeconds: number | null;
}

/**
 * Per difficulty, plus the days the daily was cleared (§10). The daily record
 * is a map of dates to the fewest moves that day, never a run of them: there
 * is no streak anywhere here. The daily is Medium, so its plays and its time
 * are counted in the Medium row as well.
 */
export interface Stats {
  schemaVersion: 1;
  easy: DifficultyStats;
  medium: DifficultyStats;
  hard: DifficultyStats;
  /** Sparse map: YYYY-MM-DD → the fewest moves that day's board was cleared in. */
  dailyMoves: Record<string, number>;
}

export const emptyDifficultyStats = (): DifficultyStats => ({
  played: 0,
  solved: 0,
  optimal: 0,
  totalPlaySeconds: 0,
  bestSeconds: null,
});

const validateDifficultyStats = (raw: unknown): DifficultyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const solved = asInt(raw.solved, 0, 1e9);
  const optimal = asInt(raw.optimal, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, 1e9);
  if (played === null || solved === null || optimal === null || totalPlaySeconds === null) {
    return null;
  }
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  return { played, solved, optimal, totalPlaySeconds, bestSeconds };
};

/** A record big enough for years of dailies, small enough to stay bounded (§12). */
export const MAX_DAILY_ENTRIES = 2000;

export const statsSchema: SchemaDef<Stats> = {
  key: UB_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    easy: emptyDifficultyStats(),
    medium: emptyDifficultyStats(),
    hard: emptyDifficultyStats(),
    dailyMoves: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const easy = validateDifficultyStats(raw.easy);
    const medium = validateDifficultyStats(raw.medium);
    const hard = validateDifficultyStats(raw.hard);
    if (easy === null || medium === null || hard === null) return null;

    // One unreadable date must not cost the player every other day they
    // cleared, so bad entries are dropped rather than failing the record.
    const dailyMoves: Record<string, number> = {};
    if (isRecord(raw.dailyMoves)) {
      for (const [key, value] of Object.entries(raw.dailyMoves)) {
        const moves = asInt(value, 1, MOVE_LIMIT);
        if (
          asDateString(key) !== null &&
          moves !== null &&
          Object.keys(dailyMoves).length < MAX_DAILY_ENTRIES
        ) {
          dailyMoves[key] = moves;
        }
      }
    }

    return { schemaVersion: 1, easy, medium, hard, dailyMoves };
  },
};

// ---------- saved game ----------

/**
 * One suspended game (§11, §12): the board as dealt, its fewest moves, and the
 * moves played since — never the board in between. The board on screen is
 * the one the move list replays to, so a resumed game can still be undone
 * move by move. The status is not stored either: a record holds a game in
 * play, and a replay that ends on a solved board is history, not a save.
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  difficulty: Difficulty;
  dailyDate: string | null;
  /** The dealt board, 36 characters (game/serialize.ts `encodeBoard`). */
  board: string;
  minMoves: number;
  /** Two characters per move (game/serialize.ts `encodeMoves`). */
  moves: string;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'free' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed, MAX_SEED_LENGTH);
  const difficulty = asDifficulty(raw.difficulty);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const board = asString(raw.board, CELL_COUNT);
  const minMoves = asInt(raw.minMoves, 1, MOVE_LIMIT);
  const moves = asString(raw.moves, MOVE_LIMIT * 2);
  const hintCount = asInt(raw.hintCount, 0, 1e6);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    difficulty === null ||
    board === null ||
    minMoves === null ||
    moves === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'free' && dailyDate !== null) return null;
  // Every daily is medium (§9); a dated record at another difficulty cannot
  // have come from play, however well-formed its board is (§12).
  if (mode === 'daily' && difficulty !== DAILY_DIFFICULTY) return null;
  // Two characters per move: an odd length is a cut-off record.
  if (moves.length % 2 !== 0) return null;
  // A board string that is not a board under §1 (wrong length, a letter that
  // is not one straight block, an overlap, a horizontal block on the target's
  // row) is refused here already; whether it is a board this game DEALS is
  // restoreSession's question.
  if (decodeBoard(board) === null) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    difficulty,
    dailyDate,
    board,
    minMoves,
    moves,
    hintCount,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes (src/test/savedGameSlots.test.ts).
 *
 * That is the whole point of passing the expected mode in. Without it, a
 * daily record sitting in the Free Play key loads happily, and resuming it
 * switches the app to the daily slot: the player asks for one game and is
 * shown the other one, or a blank screen where the other one isn't.
 */
function gameSlotSchema(key: string, expectedMode: GameMode): SchemaDef<PersistedGame | null> {
  return {
    key,
    version: 1,
    defaultValue: () => null,
    validate: (raw) => {
      const parsed = validatePersistedGame(raw);
      return parsed !== null && parsed.mode === expectedMode ? parsed : null;
    },
  };
}

/** The suspended Free Play board. */
export const gameSchema = gameSlotSchema(UB_STORAGE_KEYS.game, 'free');
/** The suspended daily, kept separately so neither mode evicts the other (§11). */
export const dailyGameSchema = gameSlotSchema(UB_STORAGE_KEYS.dailyGame, 'daily');

/** For the statistics screen: the difficulties in table order. */
export { DIFFICULTIES };
