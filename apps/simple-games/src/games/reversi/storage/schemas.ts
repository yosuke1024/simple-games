/**
 * Reversi's own persisted records, under the `rv.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take
 * the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/REVERSI_RULES.md §9).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  BLACK,
  CELL_COUNT,
  DIFFICULTIES,
  isDifficulty,
  WHITE,
  type Difficulty,
  type Player,
} from '../game';

import { RV_STORAGE_KEYS } from './keys';

export { RV_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * Which colour the player takes next time (§1). Black opens, so this is also
 * the choice of moving first or second. It lives here rather than in the
 * shared settings record because it belongs to this game
 * (docs/ARCHITECTURE.md), and it is a preference rather than part of a match:
 * changing it never touches the match in progress, which keeps the colour it
 * was started with until it ends.
 */
export interface Prefs {
  schemaVersion: 1;
  playerIsBlack: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: RV_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, playerIsBlack: true }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const playerIsBlack = asBool(raw.playerIsBlack);
    return playerIsBlack === null ? null : { schemaVersion: 1, playerIsBlack };
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: RV_STORAGE_KEYS.flags,
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
 * A record per opponent, and no streak (§8). Matches abandoned for a new one
 * count as played but never as lost — only matches that actually ended are
 * results, and the only thing to compare them against is the same device's
 * own history (§8).
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
  key: RV_STORAGE_KEYS.stats,
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
 * One slot, holding a match mid-play (§9). The undo history is not part of
 * it: a resumed match starts from the position it was saved in.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  difficulty: Difficulty;
  /** The colour the player took for this match (§1). */
  playerColor: Player;
  /** One character per cell (serialize.ts). */
  board: string;
  /** Whose turn: black or white — not derivable from the discs, because
   *  passes break the alternation (§4). */
  toMove: Player;
  moveCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: RV_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed);
    const board = asString(raw.board, CELL_COUNT);
    const moveCount = asInt(raw.moveCount, 0, 1e9);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    const toMove = raw.toMove === BLACK || raw.toMove === WHITE ? raw.toMove : null;
    const playerColor =
      raw.playerColor === BLACK || raw.playerColor === WHITE ? raw.playerColor : null;

    if (
      seed === null ||
      seed.length === 0 ||
      board === null ||
      !isDifficulty(raw.difficulty) ||
      playerColor === null ||
      toMove === null ||
      moveCount === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }

    return {
      schemaVersion: 1,
      seed,
      difficulty: raw.difficulty,
      playerColor,
      board,
      toMove,
      moveCount,
      elapsedSeconds,
      savedAt,
    };
  },
};
