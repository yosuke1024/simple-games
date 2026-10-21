/**
 * Nested Tic-Tac-Toe's own persisted records, under the `nt.` prefix declared
 * in ./keys. Isolated from the shared records and from every other game:
 * corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/NESTED_TIC_TAC_TOE_RULES.md §8). There is no daily, so
 * the two-slot rule of src/test/savedGameSlots.test.ts does not apply: one
 * slot holds the one match in progress.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import { DIFFICULTIES, parseSavedGame, type Difficulty, type SavedGame } from '../game';

import { NT_STORAGE_KEYS } from './keys';

export { NT_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * Who moves first next time (§1, §8.4). A preference, not part of a match:
 * changing it never touches the match in progress, which keeps the side it
 * was started with until it ends. The difficulty is not here — the home's
 * buttons choose it, as on the four reference boards.
 */
export interface Prefs {
  schemaVersion: 1;
  playerGoesFirst: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: NT_STORAGE_KEYS.prefs,
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
  key: NT_STORAGE_KEYS.flags,
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
 * A record per opponent, and no streak (§7, §8.5). A match abandoned for a
 * new one counts as played but never as lost — only matches that actually
 * ended are results.
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
 * All or nothing (§8.5): one count out of range, not an integer, of the wrong
 * type, or one difficulty missing, and the whole record falls back to zeros —
 * never a record stitched together from the parts that happened to read. The
 * scaffold's `{ schemaVersion: 1, played }` has no difficulty keys, so a
 * development device still holding it reads as the default too.
 */
export const statsSchema: SchemaDef<Stats> = {
  key: NT_STORAGE_KEYS.stats,
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

/**
 * One slot, holding the match in progress as its move list (§8.1). The whole
 * check — shape, ranges, and a replay of every move from the empty board
 * against the same engine the screen plays with — lives in
 * game/serialize.ts `parseSavedGame`, beside the rules it replays against
 * (§8.2). Anything it refuses is no saved game at all: the player lands on
 * the home, and nothing new is started in its place.
 */
export type PersistedGame = SavedGame;

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: NT_STORAGE_KEYS.saveGame,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => parseSavedGame(raw),
};
