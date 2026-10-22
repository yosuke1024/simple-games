/**
 * Pipe Link's own persisted records, under the `pn.` prefix declared in
 * ./keys. Isolated from the shared records and from every other game:
 * corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/PIPE_LINK_RULES.md §7). Where a record holds a map of
 * results, a malformed entry is dropped rather than costing the player the
 * whole history.
 *
 * The saved-game validator is the whole of the check, in one fail-closed
 * step (§7): the shape, the ranges, the size the difficulty promises, and
 * then what the strings mean — an answer that is a solved arrangement of the
 * board (a spanning tree of degree three or less, no pipe off the edge),
 * types that are that answer's own, every orientation inside its tile's
 * period, a source on the board, a current board not yet solved. It reads
 * them through the same `fromRecord` the game resumes with, so the two can
 * never disagree. All of it is linear in the board's size; no search runs
 * (§4「仕事量と上限」). Backup & Restore runs exactly this (docs/architecture/
 * backup.md), so a backup cannot carry what the game would refuse — and
 * there is no "valid on disk, refused on open" record (§7).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, isRecord } from '../../../storage/validate';
import {
  DIFFICULTIES,
  MAX_COUNTER,
  fromRecord,
  isDifficulty,
  toRecord,
  type Difficulty,
  type GameMode,
  type SessionRecord,
} from '../game';

import { PN_STORAGE_KEYS } from './keys';

export { PN_STORAGE_KEYS };

const asDifficulty = (value: unknown): Difficulty | null => (isDifficulty(value) ? value : null);

/**
 * A YYYY-MM-DD the calendar has. `asDateString` checks the spelling only, so
 * 2026-02-30 would pass it; a day that never happens cannot be a day the
 * daily was played, nor today's.
 */
const asCalendarDate = (value: unknown): string | null => {
  const text = asDateString(value);
  if (text === null) return null;
  const [y, m, d] = text.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? text
    : null;
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: PN_STORAGE_KEYS.flags,
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
 * The one thing Pipe Link remembers across boards: the difficulty last
 * chosen (§7, §8). Not a setting — nothing here changes how a board plays; it
 * only saves choosing again.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: PN_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'easy' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const difficulty = asDifficulty(raw.difficulty);
    return difficulty === null ? null : { schemaVersion: 1, difficulty };
  },
};

// ---------- statistics ----------

/** One difficulty's Free Play record (§8). */
export interface DifficultyStats {
  played: number;
  solved: number;
  totalPlaySeconds: number;
  bestSeconds: number | null;
}

/**
 * The daily's own play record (§8 — kept apart from Medium, like Bridges;
 * provisional until the owner settles one rule). Its clears are the dates in
 * `dailyTimes` — a set, never a run — so nothing here could count a streak.
 */
export interface DailyStats {
  played: number;
  totalPlaySeconds: number;
}

/**
 * Per difficulty, the daily kept apart from them, and the days the daily was
 * cleared (§8). The total play time is the sum of the four
 * `totalPlaySeconds`; it is never stored on its own, so it cannot disagree
 * with them. Turns are not recorded at all (§3「手の数え方」).
 */
export interface Stats {
  schemaVersion: 1;
  easy: DifficultyStats;
  medium: DifficultyStats;
  hard: DifficultyStats;
  daily: DailyStats;
  /** Sparse map: YYYY-MM-DD → best clear time in seconds for that day. */
  dailyTimes: Record<string, number>;
}

const emptyDifficultyStats = (): DifficultyStats => ({
  played: 0,
  solved: 0,
  totalPlaySeconds: 0,
  bestSeconds: null,
});

const validateDifficultyStats = (raw: unknown): DifficultyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, MAX_COUNTER);
  const solved = asInt(raw.solved, 0, MAX_COUNTER);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, MAX_COUNTER);
  if (played === null || solved === null || totalPlaySeconds === null) return null;
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  return { played, solved, totalPlaySeconds, bestSeconds };
};

const validateDailyStats = (raw: unknown): DailyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, MAX_COUNTER);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  return played === null || totalPlaySeconds === null ? null : { played, totalPlaySeconds };
};

/** A record big enough for years of dailies, small enough to stay bounded (§8). */
export const MAX_DAILY_ENTRIES = 2000;

export const statsSchema: SchemaDef<Stats> = {
  key: PN_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    easy: emptyDifficultyStats(),
    medium: emptyDifficultyStats(),
    hard: emptyDifficultyStats(),
    daily: { played: 0, totalPlaySeconds: 0 },
    dailyTimes: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const easy = validateDifficultyStats(raw.easy);
    const medium = validateDifficultyStats(raw.medium);
    const hard = validateDifficultyStats(raw.hard);
    const daily = validateDailyStats(raw.daily);
    if (easy === null || medium === null || hard === null || daily === null) return null;

    // One unreadable date must not cost the player every other day they
    // cleared, so bad entries are dropped rather than failing the record.
    const dailyTimes: Record<string, number> = {};
    if (isRecord(raw.dailyTimes)) {
      for (const [key, value] of Object.entries(raw.dailyTimes)) {
        const seconds = asInt(value, 0, MAX_COUNTER);
        if (
          asCalendarDate(key) !== null &&
          seconds !== null &&
          Object.keys(dailyTimes).length < MAX_DAILY_ENTRIES
        ) {
          dailyTimes[key] = seconds;
        }
      }
    }

    return { schemaVersion: 1, easy, medium, hard, daily, dailyTimes };
  },
};

// ---------- saved game ----------

/**
 * One suspended game (§7): `game/session.ts`'s `SessionRecord` with the
 * storage layer's version and timestamp around it. Types are one letter per
 * cell, orientations one digit per cell, row-major.
 *
 * There is no undo history, on purpose: it is the largest thing a record
 * could hold and the one thing nobody misses (§6).
 */
export interface PersistedGame extends SessionRecord {
  readonly schemaVersion: 1;
  /** When it was saved (ms). Read by nothing; kept for a person reading a backup. */
  readonly savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const savedAt = asInt(raw.savedAt, 0, 1e15);
  if (savedAt === null) return null;
  // A date the calendar does not have is not today's daily, however it is
  // spelled; `fromRecord` checks the spelling, this checks the day exists.
  if (raw.dailyDate !== null && asCalendarDate(raw.dailyDate) === null) return null;
  // Everything else — shape, ranges, the preset's size, and what the strings
  // mean — is the same reader the game resumes through (§7).
  const session = fromRecord(raw);
  if (session === null) return null;
  // Rebuilt from what was read, so nothing the record carried beyond the
  // fields above travels on.
  return { schemaVersion: 1, ...toRecord(session), savedAt };
};

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is
 * corrupt data, not an instruction to switch modes (src/test/savedGameSlots.test.ts).
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

/** Suspended difficulty game. */
export const gameSchema = gameSlotSchema(PN_STORAGE_KEYS.game, 'difficulty');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(PN_STORAGE_KEYS.dailyGame, 'daily');

/** For the statistics screen: the difficulties in table order. */
export { DIFFICULTIES };
