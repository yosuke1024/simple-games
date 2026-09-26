/**
 * Hit & Blow's own persisted records, under the `hb.` prefix declared in
 * ./keys. Isolated from the shared records and from every other game:
 * corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/HIT_AND_BLOW_RULES.md §8). The schema checks a record's
 * shape; whether its guesses could have come from play for its difficulty is
 * the session's question, asked on load (storage/gamePersistence.ts).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import { DIFFICULTIES, isDifficulty, SLOTS_FOR, SYMBOL_COUNT, type Difficulty } from '../game';

import { HB_STORAGE_KEYS } from './keys';

export { HB_STORAGE_KEYS };

/** The longest guess any difficulty takes. */
const MAX_SLOTS = Math.max(...DIFFICULTIES.map((difficulty) => SLOTS_FOR[difficulty]));

/**
 * A sanity bound on a saved history, not a rule: there is no guess limit
 * (§5). Nobody reaches this by playing, and a record past it is not a game.
 */
const MAX_SAVED_GUESSES = 100_000;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: HB_STORAGE_KEYS.flags,
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
 * The one thing Hit & Blow remembers across games: the difficulty last
 * picked (§1). Not a setting — nothing here changes how a game plays; it
 * only saves choosing again.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: HB_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'easy' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    return isDifficulty(raw.difficulty) ? { schemaVersion: 1, difficulty: raw.difficulty } : null;
  },
};

// ---------- statistics ----------

/**
 * One difficulty's record (§7). `totalGuesses` sums the guesses of solved
 * games only, so the average is over games that ended — an abandoned game
 * never drags it.
 */
export interface DifficultyStats {
  played: number;
  solved: number;
  bestGuesses: number | null;
  totalGuesses: number;
}

export type Stats = {
  schemaVersion: 1;
  totalPlaySeconds: number;
} & Record<Difficulty, DifficultyStats>;

const emptyDifficulty = (): DifficultyStats => ({
  played: 0,
  solved: 0,
  bestGuesses: null,
  totalGuesses: 0,
});

const validateDifficulty = (raw: unknown): DifficultyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const solved = asInt(raw.solved, 0, 1e9);
  const totalGuesses = asInt(raw.totalGuesses, 0, 1e12);
  const bestGuesses = raw.bestGuesses === null ? null : asInt(raw.bestGuesses, 1, 1e9);
  if (played === null || solved === null || totalGuesses === null) return null;
  if (bestGuesses === null && raw.bestGuesses !== null) return null;
  return { played, solved, bestGuesses, totalGuesses };
};

export const statsSchema: SchemaDef<Stats> = {
  key: HB_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    totalPlaySeconds: 0,
    easy: emptyDifficulty(),
    normal: emptyDifficulty(),
    hard: emptyDifficulty(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (totalPlaySeconds === null) return null;
    const out = { schemaVersion: 1 as const, totalPlaySeconds } as Stats;
    for (const difficulty of DIFFICULTIES) {
      const record = validateDifficulty(raw[difficulty]);
      if (record === null) return null;
      out[difficulty] = record;
    }
    return out;
  },
};

// ---------- saved game ----------

/**
 * One slot, holding a game mid-play (§8). The secret is not part of it — the
 * seed deals it again on load (§2) — and neither is the row being composed.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  difficulty: Difficulty;
  /** Every checked guess, oldest first, as symbol indices. */
  guesses: number[][];
  elapsedSeconds: number;
  savedAt: number;
}

const validateGuesses = (raw: unknown): number[][] | null => {
  if (!Array.isArray(raw) || raw.length > MAX_SAVED_GUESSES) return null;
  const out: number[][] = [];
  for (const guess of raw) {
    if (!Array.isArray(guess) || guess.length === 0 || guess.length > MAX_SLOTS) return null;
    const symbols: number[] = [];
    for (const symbol of guess) {
      const value = asInt(symbol, 0, SYMBOL_COUNT - 1);
      if (value === null) return null;
      symbols.push(value);
    }
    out.push(symbols);
  }
  return out;
};

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: HB_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed);
    const guesses = validateGuesses(raw.guesses);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);

    if (
      seed === null ||
      seed.length === 0 ||
      !isDifficulty(raw.difficulty) ||
      guesses === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }

    return {
      schemaVersion: 1,
      seed,
      difficulty: raw.difficulty,
      guesses,
      elapsedSeconds,
      savedAt,
    };
  },
};
