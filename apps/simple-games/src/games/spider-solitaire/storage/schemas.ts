/**
 * Spider Solitaire's own persisted records, under the `ss.` prefix. Isolated
 * from the shared records and from every other game: corruption here can never
 * take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/SPIDER_SOLITAIRE_RULES.md §10). The saved board is
 * checked as a whole — 104 cards exactly once, ten columns, completed piles
 * that really are king-to-ace runs — because a board that breaks those rules
 * cannot have come from play.
 *
 * The difficulty is part of the saved game, not just of the preferences: the
 * suits a card reads as are derived from it (game/types.ts), so a board
 * restored at the wrong suit count would be a different game with the same
 * cards.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  CARD_COUNT,
  COLUMNS,
  isValidBoard,
  RUNS_TO_WIN,
  type GameMode,
  type Pile,
  type SpiderBoard,
  type SuitCount,
} from '../game';

import { SS_STORAGE_KEYS } from './keys';

export { SS_STORAGE_KEYS };

const asSuitCount = (raw: unknown): SuitCount | null =>
  raw === 1 || raw === 2 || raw === 4 ? raw : null;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: SS_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- preferences ----------

/** How many suits the next deal uses (§ difficulty). One is the gentlest. */
export interface Prefs {
  schemaVersion: 1;
  suitCount: SuitCount;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: SS_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, suitCount: 1 }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const suitCount = asSuitCount(raw.suitCount);
    return suitCount === null ? null : { schemaVersion: 1, suitCount };
  },
};

// ---------- statistics ----------

/**
 * Kept per difficulty (§9). One deal at four suits and one at one suit are not
 * the same achievement, and a single win rate over both would hide which is
 * which — the same reason Minesweeper counts its three sizes apart.
 */
export interface SuitStats {
  played: number;
  won: number;
  bestMoves: number | null;
  bestSeconds: number | null;
}

/** One day's record at one difficulty. The two bests move independently. */
export interface DailyResult {
  moves: number;
  seconds: number;
}

export interface Stats {
  schemaVersion: 1;
  /** Keyed by suit count: '1' | '2' | '4'. */
  perSuit: Record<string, SuitStats>;
  totalPlaySeconds: number;
  /**
   * Sparse map: YYYY-MM-DD → suit count ('1' | '2' | '4') → that day's record
   * at that difficulty.
   *
   * Nested by date rather than keyed by `date + suitCount`, because one record
   * has to answer two different questions and they must not be able to
   * disagree: what a player is playing against today (their own best at the
   * difficulty they chose, §7/§9) and how many dailies they have won at all
   * (§6 — the day count, which is just the number of keys here). A flat map
   * plus a separate set of won days would be the same fact stored twice.
   *
   * A date appears only once it has been won at some difficulty.
   */
  dailyResults: Record<string, Record<string, DailyResult>>;
}

/** A record big enough for years of dailies, small enough to stay bounded. */
const MAX_DAILY_ENTRIES = 2000;

function validateDailyResults(raw: unknown): Record<string, Record<string, DailyResult>> {
  const out: Record<string, Record<string, DailyResult>> = {};
  if (!isRecord(raw)) return out;
  for (const [date, bySuit] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_DAILY_ENTRIES) break;
    if (asDateString(date) === null || !isRecord(bySuit)) continue;
    const day: Record<string, DailyResult> = {};
    for (const key of ['1', '2', '4']) {
      const entry = bySuit[key];
      if (!isRecord(entry)) continue;
      const moves = asInt(entry.moves, 0, 1e9);
      const seconds = asInt(entry.seconds, 0, 1e9);
      if (moves === null || seconds === null) continue;
      day[key] = { moves, seconds };
    }
    // A date with nothing readable under it is not a day that was won, and
    // leaving it in would inflate the daily count (§6).
    if (Object.keys(day).length > 0) out[date] = day;
  }
  return out;
}

export const emptySuitStats = (): SuitStats => ({
  played: 0,
  won: 0,
  bestMoves: null,
  bestSeconds: null,
});

const defaultPerSuit = (): Record<string, SuitStats> => ({
  '1': emptySuitStats(),
  '2': emptySuitStats(),
  '4': emptySuitStats(),
});

function validatePerSuit(raw: unknown): Record<string, SuitStats> {
  const out = defaultPerSuit();
  if (!isRecord(raw)) return out;
  for (const key of ['1', '2', '4']) {
    const entry = raw[key];
    if (!isRecord(entry)) continue;
    const played = asInt(entry.played, 0, 1e9);
    const won = asInt(entry.won, 0, 1e9);
    const bestMoves = entry.bestMoves === null ? null : asInt(entry.bestMoves, 0, 1e9);
    const bestSeconds = entry.bestSeconds === null ? null : asInt(entry.bestSeconds, 0, 1e9);
    if (played === null || won === null) continue;
    if (bestMoves === null && entry.bestMoves !== null) continue;
    if (bestSeconds === null && entry.bestSeconds !== null) continue;
    out[key] = { played, won, bestMoves, bestSeconds };
  }
  return out;
}

export const statsSchema: SchemaDef<Stats> = {
  key: SS_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    perSuit: defaultPerSuit(),
    totalPlaySeconds: 0,
    dailyResults: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (totalPlaySeconds === null) return null;
    return {
      schemaVersion: 1,
      perSuit: validatePerSuit(raw.perSuit),
      totalPlaySeconds,
      dailyResults: validateDailyResults(raw.dailyResults),
    };
  },
};

// ---------- saved game ----------

export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  suitCount: SuitCount;
  dailyDate: string | null;
  stock: number[];
  tableau: { down: number[]; up: number[] }[];
  completed: number[][];
  moveCount: number;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const asCardArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length > CARD_COUNT) return null;
  const out: number[] = [];
  for (const item of value) {
    const card = asInt(item, 0, CARD_COUNT - 1);
    if (card === null) return null;
    out.push(card);
  }
  return out;
};

/** Rebuilds and rule-checks the whole board; null when it cannot be real. */
function validateBoard(raw: Record<string, unknown>, suitCount: SuitCount): SpiderBoard | null {
  const stock = asCardArray(raw.stock);
  if (stock === null) return null;

  if (!Array.isArray(raw.tableau) || raw.tableau.length !== COLUMNS) return null;
  const tableau: Pile[] = [];
  for (const pile of raw.tableau) {
    if (!isRecord(pile)) return null;
    const down = asCardArray(pile.down);
    const up = asCardArray(pile.up);
    if (down === null || up === null) return null;
    tableau.push({ down, up });
  }

  if (!Array.isArray(raw.completed) || raw.completed.length > RUNS_TO_WIN) return null;
  const completed: number[][] = [];
  for (const run of raw.completed) {
    const cards = asCardArray(run);
    if (cards === null) return null;
    completed.push(cards);
  }

  const board: SpiderBoard = { suitCount, stock, tableau, completed };
  return isValidBoard(board) ? board : null;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'free' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const suitCount = asSuitCount(raw.suitCount);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const board = suitCount === null ? null : validateBoard(raw, suitCount);
  const moveCount = asInt(raw.moveCount, 0, 1e9);
  const hintCount = asInt(raw.hintCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    suitCount === null ||
    board === null ||
    moveCount === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'free' && dailyDate !== null) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    suitCount,
    dailyDate,
    stock: [...board.stock],
    tableau: board.tableau.map((pile) => ({ down: [...pile.down], up: [...pile.up] })),
    completed: board.completed.map((run) => [...run]),
    moveCount,
    hintCount,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. Both hold the same record shape; the mode field inside
 * the record says which slot it belongs to (§10).
 */
function gameSlotSchema(key: string): SchemaDef<PersistedGame | null> {
  return { key, version: 1, defaultValue: () => null, validate: validatePersistedGame };
}

/** Suspended free deal. */
export const gameSchema = gameSlotSchema(SS_STORAGE_KEYS.game);
/** Suspended daily deal, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(SS_STORAGE_KEYS.dailyGame);
