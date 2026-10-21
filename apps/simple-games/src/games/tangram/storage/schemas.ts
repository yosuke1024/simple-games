/**
 * Tangram's own persisted records, under the `tn.` prefix declared in ./keys
 * (docs/TANGRAM_RULES.md §8). Isolated from the shared records and from every
 * other game: corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults.
 *
 * A saved figure is checked by the schema's `validate` itself (§8「検証は
 * スキーマの validate 自身が行う」): beyond the storage layer's own fields
 * (`schemaVersion`, `savedAt`, the mode the slot is for), it hands the record
 * to `restoreSession`, which judges every placement with the same exact
 * geometry play uses. So a board play could not hold — out of the silhouette,
 * overlapping, inexact, a pivot the next turn could not carry, a finished
 * figure — is refused here, on a load and on a backup restore alike
 * (docs/architecture/backup.md「検証は各レコードの持ち主が行う」).
 *
 * Where a record holds a map of results, a malformed entry is dropped rather
 * than costing the player the whole history.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import {
  figureById,
  isCalendarDate,
  isTier,
  restoreSession,
  TIERS,
  toRecord,
  type GameMode,
  type SessionRecord,
  type Tier,
} from '../game';

import { TN_STORAGE_KEYS } from './keys';

export { TN_STORAGE_KEYS };

const asTier = (value: unknown): Tier | null => (isTier(value) ? value : null);

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: TN_STORAGE_KEYS.flags,
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
 * The one thing Tangram remembers across figures: the tier last chosen from
 * the home (§6, §8). Not a setting — nothing here changes how a figure
 * plays; it only decides which tier button the home leads with.
 */
export interface Prefs {
  schemaVersion: 1;
  tier: Tier;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: TN_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tier: 'easy' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tier = asTier(raw.tier);
    return tier === null ? null : { schemaVersion: 1, tier };
  },
};

// ---------- per-figure progress ----------

/** The most figures `best` keeps (§8): far more than the catalog holds. */
export const MAX_BEST_ENTRIES = 1000;

/**
 * Per figure (§7, §8): the fastest Free Play completion, and the figure last
 * started in each tier — what "next figure" counts on (§6). Daily
 * completions are not in here. A figure the catalog no longer has (removed
 * during the beta) is dropped on its own; the rest of the record stays.
 */
export interface Progress {
  schemaVersion: 1;
  /** Figure id → fastest completion in seconds. */
  best: Record<string, number>;
  /** The figure last started in Free Play, per tier. */
  last: Partial<Record<Tier, string>>;
}

export const progressSchema: SchemaDef<Progress> = {
  key: TN_STORAGE_KEYS.progress,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, best: {}, last: {} }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    if (!isRecord(raw.best) || !isRecord(raw.last)) return null;
    const best: Record<string, number> = {};
    for (const [id, value] of Object.entries(raw.best)) {
      const seconds = asInt(value, 0, 1e9);
      if (
        seconds !== null &&
        figureById(id) !== null &&
        Object.keys(best).length < MAX_BEST_ENTRIES
      ) {
        best[id] = seconds;
      }
    }
    const last: Partial<Record<Tier, string>> = {};
    for (const tier of TIERS) {
      const id = raw.last[tier];
      if (typeof id === 'string' && figureById(id) !== null) last[tier] = id;
    }
    return { schemaVersion: 1, best, last };
  },
};

// ---------- statistics ----------

export interface TierStats {
  /** Figures started: a new figure or a retry, never a resume (§7). */
  played: number;
  /** Completions — the same figure completed twice counts twice. */
  solved: number;
  totalPlaySeconds: number;
}

export interface DailyStats {
  played: number;
  totalPlaySeconds: number;
}

/**
 * Per tier, and the daily in a row of its own (§7 — not mixed into Medium,
 * pending the owner's call). The days the daily was completed are a sparse
 * map of dates to that day's fastest time: a set, never a run.
 */
export interface Stats {
  schemaVersion: 1;
  easy: TierStats;
  medium: TierStats;
  hard: TierStats;
  daily: DailyStats;
  /** Sparse map: YYYY-MM-DD → the day's fastest completion in seconds. */
  dailyTimes: Record<string, number>;
}

export const emptyTierStats = (): TierStats => ({ played: 0, solved: 0, totalPlaySeconds: 0 });

/** A record big enough for years of dailies, small enough to stay bounded (§8). */
export const MAX_DAILY_ENTRIES = 2000;

const validateTierStats = (raw: unknown): TierStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const solved = asInt(raw.solved, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  if (played === null || solved === null || totalPlaySeconds === null) return null;
  // Not checked against each other (§8): statistics and saves are separate
  // keys, and either can fall back to its default on its own.
  return { played, solved, totalPlaySeconds };
};

const validateDailyStats = (raw: unknown): DailyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  if (played === null || totalPlaySeconds === null) return null;
  return { played, totalPlaySeconds };
};

export const statsSchema: SchemaDef<Stats> = {
  key: TN_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    easy: emptyTierStats(),
    medium: emptyTierStats(),
    hard: emptyTierStats(),
    daily: { played: 0, totalPlaySeconds: 0 },
    dailyTimes: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const easy = validateTierStats(raw.easy);
    const medium = validateTierStats(raw.medium);
    const hard = validateTierStats(raw.hard);
    const daily = validateDailyStats(raw.daily);
    if (easy === null || medium === null || hard === null || daily === null) return null;
    if (!isRecord(raw.dailyTimes)) return null;

    // One unreadable date must not cost the player every other day they
    // completed, so bad entries are dropped rather than failing the record.
    const dailyTimes: Record<string, number> = {};
    for (const [date, value] of Object.entries(raw.dailyTimes)) {
      const seconds = asInt(value, 0, 1e9);
      if (
        isCalendarDate(date) &&
        seconds !== null &&
        Object.keys(dailyTimes).length < MAX_DAILY_ENTRIES
      ) {
        dailyTimes[date] = seconds;
      }
    }
    return { schemaVersion: 1, easy, medium, hard, daily, dailyTimes };
  },
};

// ---------- saved figure ----------

/**
 * One suspended figure (§8): what `toRecord` writes — the figure, the
 * non-fixed pieces on the board with their pivots, the clock — plus the
 * storage layer's `schemaVersion` and `savedAt`. Tray turns, the Undo history
 * and the status are not written.
 */
export interface PersistedGame extends SessionRecord {
  schemaVersion: 1;
  savedAt: number;
}

/**
 * The record when it is one play could have written, normalised to exactly
 * the fields above (stray fields are dropped, −0 reads as 0); null otherwise.
 */
function validatePersistedGame(raw: unknown): PersistedGame | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const savedAt = asInt(raw.savedAt, 0, 1e15);
  if (savedAt === null) return null;
  const restored = restoreSession(raw);
  if (!restored.ok) return null;
  return { schemaVersion: 1, ...toRecord(restored.session), savedAt: savedAt + 0 };
}

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes (src/test/savedGameSlots.test.ts).
 *
 * That is the whole point of passing the expected mode in. Without it, a
 * daily record sitting in the Free Play key loads happily, and resuming it
 * switches the app to the daily slot: the player asks for one figure and is
 * shown the other one, or a blank screen where the other one isn't.
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

/** The suspended Free Play figure. */
export const gameSchema = gameSlotSchema(TN_STORAGE_KEYS.game, 'free');
/** The suspended daily, kept separately so neither mode evicts the other (§8). */
export const dailyGameSchema = gameSlotSchema(TN_STORAGE_KEYS.dailyGame, 'daily');
