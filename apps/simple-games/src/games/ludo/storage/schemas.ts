/**
 * Ludo's own persisted records, under the `ld.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. Nothing here repairs anything.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  DIFFICULTIES,
  isDifficulty,
  isWithinWorkGate,
  MAX_CHOICES_TEXT,
  SCHEMA_VERSION,
  type Difficulty,
  type PersistedMatch,
} from '../game';

import { LD_STORAGE_KEYS } from './keys';

export { LD_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * How strong the three opponents are next time. It lives here rather than in
 * the shared settings record because it belongs to this game
 * (docs/ARCHITECTURE.md), and it is a preference rather than part of a match:
 * changing it never touches the match in progress, which keeps the difficulty
 * it was started with until it ends.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: LD_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'normal' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    return isDifficulty(raw.difficulty) ? { schemaVersion: 1, difficulty: raw.difficulty } : null;
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: LD_STORAGE_KEYS.flags,
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
 * A record per opponent strength, and no streak. Matches abandoned for a new
 * one count as played but never as lost — only matches that actually ended are
 * results, and the only thing to compare them against is the same device's own
 * history.
 *
 * **There is no `draws` column here, and Hearts' twin has one.** The reason is
 * the rules', not a simplification: Hearts is won by holding the fewest points
 * at four seats, so two seats sharing the lowest score is an ordinary outcome
 * the engine produces. Ludo is won by getting four pawns home, the match stops
 * the instant one seat does (docs/LUDO_RULES.md §2.8), and no second seat can
 * be level with that — a tie is not merely rare here, it is unreachable.
 *
 * A column that can only ever read zero is a promise the game cannot make good
 * on, so instead there is one: `played` may exceed `wins + losses`, and the
 * difference is the matches walked away from plus the matches that reached the
 * roll cap and ended with no contest (§2.7, §9). Those have no result to book —
 * they are not draws, nobody got home — and they are already counted as played.
 */
export interface OpponentStats {
  played: number;
  wins: number;
  losses: number;
}

export type Stats = {
  schemaVersion: 1;
  totalPlaySeconds: number;
} & Record<Difficulty, OpponentStats>;

const emptyOpponent = (): OpponentStats => ({ played: 0, wins: 0, losses: 0 });

const validateOpponent = (raw: unknown): OpponentStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const wins = asInt(raw.wins, 0, 1e9);
  const losses = asInt(raw.losses, 0, 1e9);
  if (played === null || wins === null || losses === null) return null;
  return { played, wins, losses };
};

export const statsSchema: SchemaDef<Stats> = {
  key: LD_STORAGE_KEYS.stats,
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
 * One slot, holding a suspended match: a seed, a strength, the number of rolls
 * completed, and the pawns the player chose (game/serialize.ts). Every other
 * fact about the match — the board, the faces, the CPU's moves, whose turn it
 * is — is derived from those, so none of them is stored.
 *
 * This schema checks the record's **shape** and nothing more. The decode is a
 * replay and it lives in `restoreSession`, one layer up; what is left here is
 * the part that has to happen before any of that: the work gate.
 *
 * **The gate goes up before the replay, not after** (§10.4). Restoring costs
 * one step per roll, so the bound on the number of rolls has to come from the
 * record's own fields while they are still just numbers and characters — a
 * record claiming a million rolls is turned away for a millionth of the work
 * it is asking for. `isWithinWorkGate` (game/serialize.ts) is that check, kept
 * next to the format it guards rather than copied here, and it is deliberately
 * the last thing this validator runs: everything above it is what makes the
 * fields the right types to hand it.
 */
export const gameSchema: SchemaDef<PersistedMatch | null> = {
  key: LD_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== SCHEMA_VERSION) return null;
    const seed = asString(raw.seed);
    const rollCount = asInt(raw.rollCount, 0, 1e9);
    // Bounded here as well as in the gate, so an enormous string is refused by
    // a length comparison rather than carried any further.
    const choices = asString(raw.choices, MAX_CHOICES_TEXT);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);

    if (
      seed === null ||
      seed.length === 0 ||
      !isDifficulty(raw.difficulty) ||
      rollCount === null ||
      choices === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }

    const record: PersistedMatch = {
      schemaVersion: SCHEMA_VERSION,
      seed,
      difficulty: raw.difficulty,
      rollCount,
      choices,
      elapsedSeconds,
      savedAt,
    };
    return isWithinWorkGate(record) ? record : null;
  },
};
