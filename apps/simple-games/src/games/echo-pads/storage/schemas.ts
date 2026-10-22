/**
 * Echo Pads's own persisted records, under the `ep.` prefix declared in ./keys
 * (docs/ECHO_PADS_RULES.md §9). Isolated from the shared records and from
 * every other game: corruption here can never take the shell or another game
 * down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. They are fail-closed — a record the rules could not have
 * written is refused whole, not repaired — with one exception taken from
 * Tangram: an unreadable date in the list of completed dailies is dropped
 * rather than costing the player every other day.
 *
 * A saved run is checked by the slot schema itself: beyond the storage
 * layer's own fields (`schemaVersion`, `savedAt`, the mode the slot is for),
 * the record goes through `restoreSession`, which refuses every combination
 * the rules cannot produce (§9's list, the `game/` half). The checks that
 * need another record — the level unlocked, the attempt already handed out,
 * the daily dated today — are storage/gamePersistence.ts's.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import {
  DEFAULT_PACE,
  isLocalDateString,
  isPace,
  isUnlocked,
  LEVEL_COUNT,
  restoreSession,
  snapshotOf,
  STATS_ROWS,
  type EchoProgress,
  type EchoSnapshot,
  type GameMode,
  type Pace,
  type RowStats,
  type StatsRow,
} from '../game';

import { EP_STORAGE_KEYS } from './keys';

export { EP_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: EP_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- preferences ----------

/** The Pace and nothing else (§4, §9). It never splits a record. */
export interface Prefs {
  schemaVersion: 1;
  pace: Pace;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: EP_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, pace: DEFAULT_PACE }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    return isPace(raw.pace) ? { schemaVersion: 1, pace: raw.pace } : null;
  },
};

// ---------- progress ----------

/** §9 `ep.progress`: the game's EchoProgress plus the storage version. */
export interface Progress extends EchoProgress {
  schemaVersion: 1;
}

/** A counter far beyond any player, small enough to stay an exact integer. */
const MAX_COUNT = 1e9;

function validateProgress(raw: unknown): Progress | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const { cleared, nextAttempt, daily } = raw;
  if (!Array.isArray(cleared) || cleared.length !== LEVEL_COUNT) return null;
  if (!Array.isArray(nextAttempt) || nextAttempt.length !== LEVEL_COUNT) return null;
  const clearedOut: boolean[] = [];
  for (const value of cleared as unknown[]) {
    const flag = asBool(value);
    if (flag === null) return null;
    clearedOut.push(flag);
  }
  const attemptsOut: number[] = [];
  for (const value of nextAttempt as unknown[]) {
    const attempt = asInt(value, 0, MAX_COUNT);
    if (attempt === null) return null;
    attemptsOut.push(attempt);
  }
  let dailyOut: Progress['daily'] = null;
  if (daily !== null) {
    if (!isRecord(daily) || !isLocalDateString(daily.date)) return null;
    const dailyAttempt = asInt(daily.nextAttempt, 0, MAX_COUNT);
    if (dailyAttempt === null) return null;
    dailyOut = { date: daily.date, nextAttempt: dailyAttempt };
  }
  const progress: Progress = {
    schemaVersion: 1,
    cleared: clearedOut,
    nextAttempt: attemptsOut,
    daily: dailyOut,
  };
  for (let level = 1; level <= LEVEL_COUNT; level++) {
    // A level is cleared by playing it, and only an open level can be played
    // (§2): a cleared level behind a locked one is not a record play wrote.
    if (progress.cleared[level - 1] && !isUnlocked(progress, level)) return null;
    // Nor is a clear of a level never started.
    if (progress.cleared[level - 1] && progress.nextAttempt[level - 1] === 0) return null;
  }
  return progress;
}

export const progressSchema: SchemaDef<Progress> = {
  key: EP_STORAGE_KEYS.progress,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    cleared: new Array<boolean>(LEVEL_COUNT).fill(false),
    nextAttempt: new Array<number>(LEVEL_COUNT).fill(0),
    daily: null,
  }),
  validate: validateProgress,
};

// ---------- statistics ----------

/** §9 `ep.stats`: three rows and the days the daily was first cleared. */
export interface Stats {
  schemaVersion: 1;
  rows: Record<StatsRow, RowStats>;
  dailyDates: string[];
}

/** Years of dailies, and still bounded. */
export const MAX_DAILY_DATES = 2000;

const validateRow = (raw: unknown): RowStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, MAX_COUNT);
  const cleared = asInt(raw.cleared, 0, MAX_COUNT);
  const failed = asInt(raw.failed, 0, MAX_COUNT);
  const seconds = asInt(raw.seconds, 0, 1e12);
  if (played === null || cleared === null || failed === null || seconds === null) return null;
  // A run is counted when it starts and once more when it ends, in the same
  // record: more endings than starts is not something play writes.
  if (cleared + failed > played) return null;
  return { played, cleared, failed, seconds };
};

const emptyRow = (): RowStats => ({ played: 0, cleared: 0, failed: 0, seconds: 0 });

export const statsSchema: SchemaDef<Stats> = {
  key: EP_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    rows: { pads4: emptyRow(), pads6: emptyRow(), daily: emptyRow() },
    dailyDates: [],
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    if (!isRecord(raw.rows) || !Array.isArray(raw.dailyDates)) return null;
    const rows = {} as Record<StatsRow, RowStats>;
    for (const row of STATS_ROWS) {
      const parsed = validateRow(raw.rows[row]);
      if (parsed === null) return null;
      rows[row] = parsed;
    }
    // One unreadable date must not cost the player every other day (Tangram
    // §8's rule): bad entries and repeats are dropped, the rest kept, sorted.
    const dates = new Set<string>();
    for (const date of raw.dailyDates as unknown[]) {
      if (isLocalDateString(date) && dates.size < MAX_DAILY_DATES) dates.add(date);
    }
    return { schemaVersion: 1, rows, dailyDates: [...dates].sort() };
  },
};

// ---------- saved run ----------

/**
 * One suspended run (§9's table): the round boundary and whether input began,
 * never the sequence (it comes from the seed again) and never where the
 * presses had got to (decision 8 (B)). Plus `schemaVersion` and `savedAt`.
 */
export interface PersistedGame extends EchoSnapshot {
  schemaVersion: 1;
  savedAt: number;
}

/**
 * The record when it is one play could have written, normalised to exactly
 * the fields above (stray fields dropped); null otherwise.
 */
function validatePersistedGame(raw: unknown): PersistedGame | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const savedAt = asInt(raw.savedAt, 0, 1e15);
  if (savedAt === null) return null;
  const restored = restoreSession(raw as unknown as EchoSnapshot);
  const snapshot = restored === null ? null : snapshotOf(restored);
  if (snapshot === null) return null;
  return { schemaVersion: 1, ...snapshot, pacesHeard: [...snapshot.pacesHeard], savedAt };
}

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes (src/test/savedGameSlots.test.ts).
 */
function gameSlotSchema(key: string, expectedMode: GameMode): SchemaDef<PersistedGame | null> {
  return {
    key,
    version: 1,
    defaultValue: () => null,
    validate: (raw) => {
      const parsed = validatePersistedGame(raw);
      return parsed !== null && parsed.mode === expectedMode ? parsed : null;
    },
  };
}

/** The suspended level run. */
export const gameSchema = gameSlotSchema(EP_STORAGE_KEYS.game, 'level');
/** Today's suspended daily, kept apart so neither mode evicts the other (§9). */
export const dailyGameSchema = gameSlotSchema(EP_STORAGE_KEYS.dailyGame, 'daily');
