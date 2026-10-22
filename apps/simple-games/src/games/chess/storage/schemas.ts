/**
 * Chess's own persisted records, under the `ch.` prefix declared in ./keys.
 * Isolated from the shared records and from every other game: corruption here
 * can never take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/CHESS_RULES.md §7). There is no daily, so the two-slot
 * rule of src/test/savedGameSlots.test.ts does not apply: one slot holds the
 * one game in progress.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import { DIFFICULTIES, MAX_MOVE_LIST_LENGTH, isDifficulty, type Difficulty } from '../game';

import { CH_STORAGE_KEYS } from './keys';

export { CH_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * The side the next game starts with (§1, §7.2). A preference, not part of a
 * game: changing it never touches the game in progress, which keeps the side
 * it was started with until it ends. The difficulty is not here — the home's
 * buttons choose it and start the game, as on the four CPU boards (§14).
 */
export interface Prefs {
  schemaVersion: 1;
  playerIsWhite: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: CH_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, playerIsWhite: true }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const playerIsWhite = asBool(raw.playerIsWhite);
    return playerIsWhite === null ? null : { schemaVersion: 1, playerIsWhite };
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: CH_STORAGE_KEYS.flags,
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
 * A record per difficulty, and no streak (§7.3). A game abandoned for a new
 * one counts as played but never as lost — only games that actually ended are
 * results. No count per ending: the reason is on the result card, not kept.
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

const COUNT_MAX = 1e9;
const PLAY_SECONDS_MAX = 1e12;

const emptyOpponent = (): OpponentStats => ({ played: 0, wins: 0, losses: 0, draws: 0 });

const validateOpponent = (raw: unknown): OpponentStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, COUNT_MAX);
  const wins = asInt(raw.wins, 0, COUNT_MAX);
  const losses = asInt(raw.losses, 0, COUNT_MAX);
  const draws = asInt(raw.draws, 0, COUNT_MAX);
  if (played === null || wins === null || losses === null || draws === null) return null;
  return { played, wins, losses, draws };
};

/**
 * All or nothing: one count out of range, not an integer, of the wrong type,
 * or one difficulty missing, and the whole record falls back to zeros — never
 * a record stitched together from the parts that happened to read. The
 * scaffold's `{ schemaVersion: 1, played }` has no difficulty keys, so a
 * development device still holding it reads as the default too.
 */
export const statsSchema: SchemaDef<Stats> = {
  key: CH_STORAGE_KEYS.stats,
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
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, PLAY_SECONDS_MAX);
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

/** Seeds are `chess-<base-36 time>-<base-36 random>` (§5.4) — far below this. */
const SEED_MAX_LENGTH = 64;

/**
 * One slot, holding the game in progress (§7.1): the move list and what the
 * moves alone cannot say — the side the player took, the difficulty, the seed
 * — plus the play clock. The turn is not stored: it follows from the number
 * of moves.
 *
 * This validator checks the record's SHAPE (types, ranges, the move list's
 * length bound). What the move list MEANS — every move legal, nothing after
 * the end, not a finished game — is checked by replaying it against the same
 * engine the screen plays with, once, in storage/gamePersistence.ts
 * (`restoreSession`). A record either check refuses is no saved game at all:
 * the player lands on the home, and nothing new is started in its place. The
 * replay is not run here because it is the expensive part of loading a long
 * save (§13), and the loader would otherwise pay it twice.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  difficulty: Difficulty;
  /** The side the player took for this game (§1). */
  side: 'white' | 'black';
  /** UCI moves separated by single spaces (game/serialize.ts). */
  moves: string;
  elapsedSeconds: number;
  savedAt: number;
}

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: CH_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed, SEED_MAX_LENGTH);
    const moves = asString(raw.moves, MAX_MOVE_LIST_LENGTH);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    const side = raw.side === 'white' || raw.side === 'black' ? raw.side : null;
    if (
      seed === null ||
      seed.length === 0 ||
      moves === null ||
      !isDifficulty(raw.difficulty) ||
      side === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }
    return {
      schemaVersion: 1,
      seed,
      difficulty: raw.difficulty,
      side,
      moves,
      elapsedSeconds,
      savedAt,
    };
  },
};
