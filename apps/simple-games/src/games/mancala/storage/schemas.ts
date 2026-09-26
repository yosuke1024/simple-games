/**
 * Mancala's own persisted records, under the `mc.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take
 * the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/MANCALA_RULES.md §8).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  BOARD_SIZE,
  DIFFICULTIES,
  isDifficulty,
  isSide,
  TOTAL_SEEDS,
  type Difficulty,
  type Side,
} from '../game';

import { MC_STORAGE_KEYS } from './keys';

export { MC_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * Which side the player takes next time (§1). It lives here rather than in
 * the shared settings record because it belongs to this game
 * (docs/ARCHITECTURE.md), and it is a preference rather than part of a match:
 * changing it never touches the game in progress, which keeps the side it
 * was started with until it ends.
 */
export interface Prefs {
  schemaVersion: 1;
  playerGoesFirst: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: MC_STORAGE_KEYS.prefs,
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
  key: MC_STORAGE_KEYS.flags,
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
 * own history (§7). The same shape as Connect Four's, field for field.
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
  key: MC_STORAGE_KEYS.stats,
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
 * it. The turn is: an extra turn (§2.1) breaks the alternation, so the board
 * cannot say whose move it is.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  difficulty: Difficulty;
  /** Who opened this match (§1). */
  first: Side;
  /** Fourteen seed counts in index order (game/types.ts). */
  pits: number[];
  toMove: Side;
  moveCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: MC_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed);
    const moveCount = asInt(raw.moveCount, 0, 1e9);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    const pits =
      Array.isArray(raw.pits) && raw.pits.length === BOARD_SIZE
        ? raw.pits.map((count) => asInt(count, 0, TOTAL_SEEDS))
        : null;

    if (
      seed === null ||
      seed.length === 0 ||
      !isDifficulty(raw.difficulty) ||
      !isSide(raw.first) ||
      !isSide(raw.toMove) ||
      pits === null ||
      pits.some((count) => count === null) ||
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
      first: raw.first,
      pits: pits as number[],
      toMove: raw.toMove,
      moveCount,
      elapsedSeconds,
      savedAt,
    };
  },
};
