/**
 * Snake's own persisted records, under the `sn.` prefix declared in ./keys
 * (docs/SNAKE_RULES.md §11). Isolated from the shared records and from every
 * other game: corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. The saved-run schema checks a record's shape — types,
 * lengths, bounds — and then asks the rules whether play could have produced
 * it (`restoreSession`, game/serialize.ts), because the work of every check
 * there is fixed by the board — the replay and the layered walk of
 * game/history.ts included — and none is a solver search held back only by
 * a node limit: about ten milliseconds at worst even without a JIT (§11,
 * §17). The schema is also all that Backup & Restore runs on a record
 * (docs/architecture/backup.md), so asking here is what makes a backup
 * holding an impossible run refused whole, rather than "restored" and then
 * dropped when the game opens.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  CELL_COUNT,
  DEFAULT_SPEED,
  isDirection,
  isSpeed,
  MAX_RECORD_COUNT,
  MAX_SCORE,
  MAX_SEED_LENGTH,
  restoreSession,
  SPEEDS,
  type Direction,
  type Speed,
} from '../game';

import { SN_STORAGE_KEYS } from './keys';

export { SN_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: SN_STORAGE_KEYS.flags,
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
 * The speed last picked on the home (§7), and nothing else. Not a setting
 * that changes a run already under way — a run keeps the speed it began with
 * — only what the next new run starts at. Normal until somebody picks.
 */
export interface Prefs {
  schemaVersion: 1;
  speed: Speed;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: SN_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, speed: DEFAULT_SPEED }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    return isSpeed(raw.speed) ? { schemaVersion: 1, speed: raw.speed } : null;
  },
};

// ---------- statistics ----------

/**
 * One speed's record (§10). Four counts, no streak: this game has no reason
 * to know which days somebody played.
 */
export interface SpeedStats {
  /** Runs that started moving (ready → running), once each. */
  played: number;
  bestScore: number;
  /** Full boards (§4). */
  cleared: number;
  /** Seconds spent running — never paused, ready, or on the result card. */
  totalPlaySeconds: number;
}

export type Stats = { schemaVersion: 1 } & Record<Speed, SpeedStats>;

const emptySpeed = (): SpeedStats => ({
  played: 0,
  bestScore: 0,
  cleared: 0,
  totalPlaySeconds: 0,
});

/**
 * A speed's record, or null when its numbers cannot have come from play: a
 * best above the full board, or a clear without the full board's score as
 * the best (§11). Clears are deliberately not held to `played`: a suspended
 * run was counted when it started, and if the statistics were lost since
 * while its save survived, finishing it is a clear on a record that never
 * saw it start — real play, which must not throw the record away.
 */
function validateSpeed(raw: unknown): SpeedStats | null {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const bestScore = asInt(raw.bestScore, 0, MAX_SCORE);
  const cleared = asInt(raw.cleared, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  if (played === null || bestScore === null || cleared === null || totalPlaySeconds === null) {
    return null;
  }
  if (cleared > 0 && bestScore !== MAX_SCORE) return null;
  return { played, bestScore, cleared, totalPlaySeconds };
}

export const statsSchema: SchemaDef<Stats> = {
  key: SN_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    slow: emptySpeed(),
    normal: emptySpeed(),
    fast: emptySpeed(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const out = { schemaVersion: 1 as const } as Stats;
    for (const speed of SPEEDS) {
      const record = validateSpeed(raw[speed]);
      if (record === null) return null;
      out[speed] = record;
    }
    return out;
  },
};

// ---------- the suspended run ----------

/**
 * The one slot (§11): a run that has started and not ended, written on
 * Pause, background, leaving the screen and unmount — never per tick. A
 * board that never started is not written, and a finished run is removed.
 * The status is not part of it: a restored run always comes back paused.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  speed: Speed;
  /** Two base-36 characters per cell, head first (game/serialize.ts). */
  body: string;
  food: number;
  score: number;
  ticks: number;
  /** Whole seconds. */
  elapsedSeconds: number;
  /** The heading chosen while paused (§5); absent when none is. */
  next?: Direction;
  savedAt: number;
}

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: SN_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed, MAX_SEED_LENGTH);
    const body = asString(raw.body, CELL_COUNT * 2);
    const food = asInt(raw.food, 0, CELL_COUNT - 1);
    const score = asInt(raw.score, 0, MAX_SCORE);
    const ticks = asInt(raw.ticks, 0, MAX_RECORD_COUNT);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, MAX_RECORD_COUNT);
    const savedAt = asInt(raw.savedAt, 0, 1e15);

    if (
      seed === null ||
      seed.length === 0 ||
      !isSpeed(raw.speed) ||
      body === null ||
      body.length === 0 ||
      food === null ||
      score === null ||
      ticks === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }
    // Absent means "no heading chosen"; present, it has to be a direction.
    // Whether it is one `turn` could have kept is the rules' check below.
    if (raw.next !== undefined && !isDirection(raw.next)) return null;

    const record: PersistedGame = {
      schemaVersion: 1,
      seed,
      speed: raw.speed,
      body,
      food,
      score,
      ticks,
      elapsedSeconds,
      ...(raw.next === undefined ? {} : { next: raw.next }),
      savedAt,
    };
    // The rules' half (§11): a snake on the board, a history its body could
    // have had, food where the seed put it. The same function the load
    // builds the run with, so the two can never disagree about a record.
    return restoreSession(record) === null ? null : record;
  },
};
