/**
 * Solitaire's own persisted records, under the `so.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never
 * take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/SOLITAIRE_RULES.md §10). The saved board is checked as
 * a whole — 52 cards exactly once, legal foundations and runs — because a
 * board that breaks those rules cannot have come from play.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  CARD_COUNT,
  isValidBoard,
  SUITS,
  TABLEAU_PILES,
  type GameMode,
  type Pile,
  type SolitaireBoard,
} from '../game';

export const SO_STORAGE_KEYS = {
  game: 'so.saveGame',
  dailyGame: 'so.saveDaily',
  stats: 'so.stats',
  flags: 'so.flags',
  prefs: 'so.prefs',
} as const;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: SO_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- preferences ----------

/** Draw 1 / Draw 3 (§4). A game preference, not a shared shell setting. */
export interface Prefs {
  schemaVersion: 1;
  drawThree: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: SO_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, drawThree: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const drawThree = asBool(raw.drawThree);
    return drawThree === null ? null : { schemaVersion: 1, drawThree };
  },
};

// ---------- statistics ----------

/**
 * Deals, wins, and the honest ratio between them (§9): deals are not
 * screened for winnability (§5), and the numbers say so. Bests are records
 * of wins.
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
    if (asDateString(key) !== null && amount !== null && Object.keys(out).length < MAX_DAILY_ENTRIES) {
      out[key] = amount;
    }
  }
  return out;
}

export const statsSchema: SchemaDef<Stats> = {
  key: SO_STORAGE_KEYS.stats,
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
  drawThree: boolean;
  dailyDate: string | null;
  stock: number[];
  waste: number[];
  foundations: number[][];
  tableau: { down: number[]; up: number[] }[];
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
function validateBoard(raw: Record<string, unknown>): SolitaireBoard | null {
  const stock = asCardArray(raw.stock);
  const waste = asCardArray(raw.waste);
  if (stock === null || waste === null) return null;

  if (!Array.isArray(raw.foundations) || raw.foundations.length !== SUITS.length) return null;
  const foundations: number[][] = [];
  for (const pile of raw.foundations) {
    const cards = asCardArray(pile);
    if (cards === null) return null;
    foundations.push(cards);
  }

  if (!Array.isArray(raw.tableau) || raw.tableau.length !== TABLEAU_PILES) return null;
  const tableau: Pile[] = [];
  for (const pile of raw.tableau) {
    if (!isRecord(pile)) return null;
    const down = asCardArray(pile.down);
    const up = asCardArray(pile.up);
    if (down === null || up === null) return null;
    tableau.push({ down, up });
  }

  const board: SolitaireBoard = { stock, waste, foundations, tableau };
  return isValidBoard(board) ? board : null;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'free' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const drawThree = asBool(raw.drawThree);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const board = validateBoard(raw);
  const moveCount = asInt(raw.moveCount, 0, 1e9);
  const hintCount = asInt(raw.hintCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    drawThree === null ||
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
    drawThree,
    dailyDate,
    stock: [...board.stock],
    waste: [...board.waste],
    foundations: board.foundations.map((pile) => [...pile]),
    tableau: board.tableau.map((pile) => ({ down: [...pile.down], up: [...pile.up] })),
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
export const gameSchema = gameSlotSchema(SO_STORAGE_KEYS.game);
/** Suspended daily deal, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(SO_STORAGE_KEYS.dailyGame);
