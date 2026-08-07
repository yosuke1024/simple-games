/**
 * FreeCell's own persisted records, under the `fc.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/FREECELL_RULES.md §10). The saved board is checked as a
 * whole — 52 cards exactly once, foundations climbing their own suit — because
 * a board that breaks those rules cannot have come from play.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  CARD_COUNT,
  CASCADES,
  FREE_CELLS,
  isValidBoard,
  SUITS,
  type FreeCellBoard,
  type GameMode,
} from '../game';

import { FC_STORAGE_KEYS } from './keys';

export { FC_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: FC_STORAGE_KEYS.flags,
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
 * Deals, wins, and the honest ratio between them (§9). Deals are not screened
 * for winnability (§5), and a game can also be played into a dead end, so the
 * ratio is not a measure of skill alone — which is why it sits beside the
 * counts rather than replacing them.
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  won: number;
  totalPlaySeconds: number;
  /** Fewest moves in a won game, or null before the first win. */
  bestMoves: number | null;
  bestSeconds: number | null;
  /** Sparse map: YYYY-MM-DD → fewest moves for a won daily. */
  dailyMoves: Record<string, number>;
  /** Sparse map: YYYY-MM-DD → shortest winning time for that day. */
  dailySeconds: Record<string, number>;
}

/** A record big enough for years of dailies, small enough to stay bounded. */
const MAX_DAILY_ENTRIES = 2000;

function validateDailyMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const amount = asInt(value, 0, 1e9);
    if (
      asDateString(key) !== null &&
      amount !== null &&
      Object.keys(out).length < MAX_DAILY_ENTRIES
    ) {
      out[key] = amount;
    }
  }
  return out;
}

export const statsSchema: SchemaDef<Stats> = {
  key: FC_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    won: 0,
    totalPlaySeconds: 0,
    bestMoves: null,
    bestSeconds: null,
    dailyMoves: {},
    dailySeconds: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const won = asInt(raw.won, 0, 1e9);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    const bestMoves = raw.bestMoves === null ? null : asInt(raw.bestMoves, 0, 1e9);
    const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, 1e9);
    if (played === null || won === null || totalPlaySeconds === null) return null;
    if (bestMoves === null && raw.bestMoves !== null) return null;
    if (bestSeconds === null && raw.bestSeconds !== null) return null;
    return {
      schemaVersion: 1,
      played,
      won,
      totalPlaySeconds,
      bestMoves,
      bestSeconds,
      dailyMoves: validateDailyMap(raw.dailyMoves),
      dailySeconds: validateDailyMap(raw.dailySeconds),
    };
  },
};

// ---------- saved game ----------

export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  dailyDate: string | null;
  /** null for an empty cell. */
  cells: (number | null)[];
  foundations: number[][];
  cascades: number[][];
  moveCount: number;
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
function validateBoard(raw: Record<string, unknown>): FreeCellBoard | null {
  if (!Array.isArray(raw.cells) || raw.cells.length !== FREE_CELLS) return null;
  const cells: (number | null)[] = [];
  for (const item of raw.cells) {
    if (item === null) {
      cells.push(null);
      continue;
    }
    const card = asInt(item, 0, CARD_COUNT - 1);
    if (card === null) return null;
    cells.push(card);
  }

  if (!Array.isArray(raw.foundations) || raw.foundations.length !== SUITS.length) return null;
  const foundations: number[][] = [];
  for (const pile of raw.foundations) {
    const cards = asCardArray(pile);
    if (cards === null) return null;
    foundations.push(cards);
  }

  if (!Array.isArray(raw.cascades) || raw.cascades.length !== CASCADES) return null;
  const cascades: number[][] = [];
  for (const pile of raw.cascades) {
    const cards = asCardArray(pile);
    if (cards === null) return null;
    cascades.push(cards);
  }

  const board: FreeCellBoard = { cells, foundations, cascades };
  return isValidBoard(board) ? board : null;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'free' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const board = validateBoard(raw);
  const moveCount = asInt(raw.moveCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    board === null ||
    moveCount === null ||
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
    dailyDate,
    cells: [...board.cells],
    foundations: board.foundations.map((pile) => [...pile]),
    cascades: board.cascades.map((pile) => [...pile]),
    moveCount,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes.
 *
 * That is the whole point of passing the expected mode in. Without it, a
 * daily record sitting in the `free` key loads happily, and resuming
 * it switches the app to the daily slot: the player asks for one game and
 * is shown the other one, or a blank screen where the other one isn't.
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

/** Suspended free deal. */
export const gameSchema = gameSlotSchema(FC_STORAGE_KEYS.game, 'free');
/** Suspended daily deal, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(FC_STORAGE_KEYS.dailyGame, 'daily');
