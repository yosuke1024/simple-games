/**
 * Backgammon's own persisted records, under the `bk.` prefix declared in
 * ./keys. Isolated from the shared records and from every other game:
 * corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. The saved match is validated here only as far as its shape
 * and the work gate go (docs/BACKGAMMON_RULES.md §9.3); whether its steps
 * were legal is the replay's question, in game/persistence.ts.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import { decodeTurn, MAX_STEPS_PER_TURN, type PersistedMatch } from '../game/persistence';
import { MAX_ROLLS } from '../game/session';
import { DIFFICULTIES, isDifficulty, type Difficulty } from '../game/types';

import { BK_STORAGE_KEYS } from './keys';

export { BK_STORAGE_KEYS };

// ---------- preferences ----------

/** The strength the next match starts at (§1). Never changes one in play. */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: BK_STORAGE_KEYS.prefs,
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
  key: BK_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

/** The record against one strength (§8). No streak, no gammon count. */
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

function asOpponentStats(raw: unknown): OpponentStats | null {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const wins = asInt(raw.wins, 0, 1e9);
  const losses = asInt(raw.losses, 0, 1e9);
  if (played === null || wins === null || losses === null) return null;
  return { played, wins, losses };
}

export const statsSchema: SchemaDef<Stats> = {
  key: BK_STORAGE_KEYS.stats,
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
    const perDifficulty: Partial<Record<Difficulty, OpponentStats>> = {};
    for (const difficulty of DIFFICULTIES) {
      const record = asOpponentStats(raw[difficulty]);
      if (record === null) return null;
      perDifficulty[difficulty] = record;
    }
    return {
      schemaVersion: 1,
      totalPlaySeconds,
      easy: perDifficulty.easy!,
      normal: perDifficulty.normal!,
      hard: perDifficulty.hard!,
    };
  },
};

// ---------- the suspended match ----------

/**
 * The one saved match, as game/persistence.ts writes it (§9.1). Validation
 * here is the work gate: shape, ranges, and a turn list no longer than the
 * roll count. Legality is the replay's job.
 */
export const gameSchema: SchemaDef<PersistedMatch | null> = {
  key: BK_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed);
    const rollCount = asInt(raw.rollCount, 0, MAX_ROLLS - 1);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    if (
      seed === null ||
      seed.length === 0 ||
      !isDifficulty(raw.difficulty) ||
      rollCount === null ||
      elapsedSeconds === null ||
      savedAt === null ||
      !Array.isArray(raw.turns) ||
      raw.turns.length > rollCount
    ) {
      return null;
    }
    const turns: number[][] = [];
    for (const turn of raw.turns as unknown[]) {
      if (!Array.isArray(turn) || turn.length > MAX_STEPS_PER_TURN * 2) return null;
      const flat: number[] = [];
      for (const value of turn as unknown[]) {
        const n = asInt(value, 1, 25);
        if (n === null) return null;
        flat.push(n);
      }
      if (decodeTurn(flat) === null) return null;
      turns.push(flat);
    }
    return {
      schemaVersion: 1,
      seed,
      difficulty: raw.difficulty,
      rollCount,
      turns,
      elapsedSeconds,
      savedAt,
    };
  },
};
