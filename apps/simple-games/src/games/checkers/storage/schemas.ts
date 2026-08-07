/**
 * Checkers' own persisted records, under the `ck.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take
 * the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/CHECKERS_RULES.md §8).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  CELL_COUNT,
  CPU,
  DIFFICULTIES,
  PLAYER,
  isDifficulty,
  type Difficulty,
  type Side,
} from '../game';

import { CK_STORAGE_KEYS } from './keys';

export { CK_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * Which side opens next time (§1). It lives here rather than in the shared
 * settings record because it belongs to this game (docs/ARCHITECTURE.md), and
 * it is a preference rather than part of a match: changing it never touches
 * the game in progress, which keeps the side it was started with until it
 * ends.
 */
export interface Prefs {
  schemaVersion: 1;
  playerGoesFirst: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: CK_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, playerGoesFirst: true }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const playerGoesFirst = asBool(raw.playerGoesFirst);
    return playerGoesFirst === null ? null : { schemaVersion: 1, playerGoesFirst };
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: CK_STORAGE_KEYS.flags,
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
 * A record per opponent, and no streak (§7). Matches abandoned for a new one
 * count as played but never as lost — only matches that actually ended are
 * results, and the only thing to compare them against is the same device's
 * own history (§7).
 */
export interface OpponentStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export type Stats = {
  schemaVersion: 1;
  totalPlaySeconds: number;
} & Record<Difficulty, OpponentStats>;

const emptyOpponent = (): OpponentStats => ({ played: 0, wins: 0, losses: 0, draws: 0 });

const validateOpponent = (raw: unknown): OpponentStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const wins = asInt(raw.wins, 0, 1e9);
  const losses = asInt(raw.losses, 0, 1e9);
  const draws = asInt(raw.draws, 0, 1e9);
  if (played === null || wins === null || losses === null || draws === null) return null;
  return { played, wins, losses, draws };
};

export const statsSchema: SchemaDef<Stats> = {
  key: CK_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    totalPlaySeconds: 0,
    easy: emptyOpponent(),
    normal: emptyOpponent(),
    hard: emptyOpponent(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (totalPlaySeconds === null) return null;
    const out = { schemaVersion: 1 as const, totalPlaySeconds } as Stats;
    for (const difficulty of DIFFICULTIES) {
      const opponent = validateOpponent(raw[difficulty]);
      if (opponent === null) return null;
      out[difficulty] = opponent;
    }
    return out;
  },
};

// ---------- saved game ----------

/**
 * One slot, holding a match mid-play (§8). The undo history is not part of
 * it, and neither is the turn: turns strictly alternate in this game, so the
 * completed-turn count and the stored opener say whose move it is between
 * them (session.ts, restoreSession).
 *
 * `pendingJumpFrom` is here because a turn can be left half-played: a capture
 * sequence is forced to its end, and closing the app in the middle of one has
 * to come back to the middle of it, not to a position where the obligation
 * has quietly evaporated (§2, §8).
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  difficulty: Difficulty;
  /** Who opened this match (§1). The board alone cannot say it. */
  first: Side;
  /** One character per cell (serialize.ts). */
  board: string;
  moveCount: number;
  /** Turns since the last capture or man move, for the draw rule (§3). */
  quietPlies: number;
  /** The cell a forced sequence must go on from, or -1 for none (§2). */
  pendingJumpFrom: number;
  elapsedSeconds: number;
  savedAt: number;
}

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: CK_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed);
    const board = asString(raw.board, CELL_COUNT);
    const moveCount = asInt(raw.moveCount, 0, 1e9);
    const quietPlies = asInt(raw.quietPlies, 0, 1e9);
    const pendingJumpFrom = asInt(raw.pendingJumpFrom, -1, CELL_COUNT - 1);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    const first = raw.first === PLAYER || raw.first === CPU ? raw.first : null;

    if (
      seed === null ||
      seed.length === 0 ||
      board === null ||
      !isDifficulty(raw.difficulty) ||
      first === null ||
      moveCount === null ||
      quietPlies === null ||
      pendingJumpFrom === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }

    return {
      schemaVersion: 1,
      seed,
      difficulty: raw.difficulty,
      first,
      board,
      moveCount,
      quietPlies,
      pendingJumpFrom,
      elapsedSeconds,
      savedAt,
    };
  },
};
