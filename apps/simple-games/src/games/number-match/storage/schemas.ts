/**
 * Number Match's own persisted records, under the `nm.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never
 * take the shell or another game down, and adding a game never touches these.
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (spec §15.1).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  createScore,
  initialCellsForLevel,
  INITIAL_CELLS,
  MAX_CELLS,
  MAX_LEVEL,
  type GameMode,
  type ScoreState,
} from '../game';

import { NM_STORAGE_KEYS } from './keys';

export { NM_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
  /** Whether the player has been told what a wild does (§16). */
  wildIntroSeen: boolean;
  /** Whether the player has been told what a stone does (§16). */
  stoneIntroSeen: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: NM_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    tutorialCompleted: false,
    wildIntroSeen: false,
    stoneIntroSeen: false,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    if (tutorialCompleted === null) return null;
    // Flags added later default rather than reject: an existing record simply
    // has not seen them yet, which is not corruption.
    return {
      schemaVersion: 1,
      tutorialCompleted,
      wildIntroSeen: asBool(raw.wildIntroSeen) ?? false,
      stoneIntroSeen: asBool(raw.stoneIntroSeen) ?? false,
    };
  },
};

// ---------- statistics ----------

export interface ModeStats {
  played: number;
  cleared: number;
  gameOver: number;
  totalPlaySeconds: number;
  bestClearSeconds: number | null;
}

/**
 * v3 dropped the daily streak counters ("no streaks or artificial urgency",
 * docs/PRODUCT_PRINCIPLES.md). The daily completion record itself lives in
 * progress.bestDaily — a calendar of days played, not a chain to maintain.
 */
export interface Stats {
  schemaVersion: 3;
  level: ModeStats;
  daily: ModeStats;
}

const emptyModeStats = (): ModeStats => ({
  played: 0,
  cleared: 0,
  gameOver: 0,
  totalPlaySeconds: 0,
  bestClearSeconds: null,
});

const validateModeStats = (raw: unknown): ModeStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const cleared = asInt(raw.cleared, 0, 1e9);
  const gameOver = asInt(raw.gameOver, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const bestClearSeconds =
    raw.bestClearSeconds === null ? null : asInt(raw.bestClearSeconds, 0, 1e9);
  if (played === null || cleared === null || gameOver === null || totalPlaySeconds === null) {
    return null;
  }
  if (bestClearSeconds === null && raw.bestClearSeconds !== null) return null;
  return { played, cleared, gameOver, totalPlaySeconds, bestClearSeconds };
};

export const statsSchema: SchemaDef<Stats> = {
  key: NM_STORAGE_KEYS.stats,
  version: 3,
  defaultValue: () => ({
    schemaVersion: 3,
    level: emptyModeStats(),
    daily: emptyModeStats(),
  }),
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    // v1 → the "classic" bucket became the "level" bucket.
    // v2 → v3 simply drops the daily streak fields; validateModeStats ignores
    // the extra keys, so both migrate through the same path.
    const source = raw.schemaVersion === 1 ? { ...raw, level: raw.classic } : raw;
    if (raw.schemaVersion !== 1 && raw.schemaVersion !== 2 && raw.schemaVersion !== 3) return null;
    const level = validateModeStats(source.level);
    const daily = validateModeStats(source.daily);
    if (level === null || daily === null) return null;
    return { schemaVersion: 3, level, daily };
  },
};

// ---------- saved game ----------

/**
 * `fallbackScorableCells` is the board's starting cell count, used only for
 * saves written before the scoring budget existed (§12). Granting a full
 * board's budget is generous for a half-played save but never exceeds what an
 * honest clear of that board could have earned.
 */
const validateScore = (raw: unknown, fallbackScorableCells: number): ScoreState | null => {
  if (!isRecord(raw)) return null;
  const total = asInt(raw.total, 0, 1e9);
  const streakTenths = asInt(raw.streakTenths, 10, 20);
  const matchPoints = asInt(raw.matchPoints, 0, 1e9);
  const rowPoints = asInt(raw.rowPoints, 0, 1e9);
  const clearBonus = asInt(raw.clearBonus, 0, 1e9);
  const noHintBonus = asInt(raw.noHintBonus, 0, 1e9);
  if (
    total === null ||
    streakTenths === null ||
    matchPoints === null ||
    rowPoints === null ||
    clearBonus === null ||
    noHintBonus === null
  ) {
    return null;
  }
  // Integrity: the parts must add up.
  if (total !== matchPoints + rowPoints + clearBonus + noHintBonus) return null;
  const scorableCells =
    raw.scorableCells === undefined
      ? fallbackScorableCells
      : asInt(raw.scorableCells, 0, MAX_CELLS);
  if (scorableCells === null) return null;
  return {
    total,
    streakTenths,
    matchPoints,
    rowPoints,
    clearBonus,
    noHintBonus,
    scorableCells,
  };
};

export interface PersistedGame {
  schemaVersion: 2;
  mode: GameMode;
  seed: string;
  dailyDate: string | null;
  level: number | null;
  values: string;
  mask: string;
  score: ScoreState;
  moveCount: number;
  addCount: number;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  {
    if (!isRecord(raw)) return null;
    // v1 → v2 migration: daily games carry over with a fresh score; v1
    // "classic" games have no level context and are dropped (no resume).
    let source = raw;
    if (raw.schemaVersion === 1) {
      if (raw.mode !== 'daily') return null;
      source = { ...raw, schemaVersion: 2, level: null, score: createScore(INITIAL_CELLS) };
    }
    if (source.schemaVersion !== 2) return null;
    const mode = source.mode === 'level' || source.mode === 'daily' ? source.mode : null;
    const seed = asString(source.seed);
    const dailyDate = source.dailyDate === null ? null : asDateString(source.dailyDate);
    const level = source.level === null ? null : asInt(source.level, 1, MAX_LEVEL);
    // A stored board can never legally exceed the maximum board size.
    const values = asString(source.values, MAX_CELLS);
    const mask = asString(source.mask, MAX_CELLS);
    const score = validateScore(
      source.score,
      mode === 'level' && level !== null ? initialCellsForLevel(level) : INITIAL_CELLS,
    );
    const moveCount = asInt(source.moveCount, 0, 1e6);
    const addCount = asInt(source.addCount, 0, 1e6);
    const hintCount = asInt(source.hintCount, 0, 1e6);
    const elapsedSeconds = asInt(source.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(source.savedAt, 0, 1e15);
    if (
      mode === null ||
      seed === null ||
      seed.length === 0 ||
      values === null ||
      mask === null ||
      score === null ||
      moveCount === null ||
      addCount === null ||
      hintCount === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }
    if (dailyDate === null && source.dailyDate !== null) return null;
    if (level === null && source.level !== null) return null;
    if (mode === 'daily' && dailyDate === null) return null;
    if (mode === 'level' && level === null) return null;
    return {
      schemaVersion: 2,
      mode,
      seed,
      dailyDate,
      level,
      values,
      mask,
      score,
      moveCount,
      addCount,
      hintCount,
      elapsedSeconds,
      savedAt,
    };
  }
};

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes.
 *
 * That is the whole point of passing the expected mode in. Without it, a
 * daily record sitting in the `level` key loads happily, and resuming
 * it switches the app to the daily slot: the player asks for one game and
 * is shown the other one, or a blank screen where the other one isn't.
 */
function gameSlotSchema(key: string, expectedMode: GameMode): SchemaDef<PersistedGame | null> {
  return {
    key,
    version: 2,
    defaultValue: () => null,
    validate: (raw) => {
      const parsed = validatePersistedGame(raw);
      return parsed !== null && parsed.mode === expectedMode ? parsed : null;
    },
  };
}

/** Suspended level game. */
export const gameSchema = gameSlotSchema(NM_STORAGE_KEYS.game, 'level');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(NM_STORAGE_KEYS.dailyGame, 'daily');

/**
 * The level key as builds before the daily got its own slot left it: they kept
 * the daily game here too. Such a record is the one thing that key may hold
 * that is not a level game, and it is not corrupt — but it is readable only in
 * order to be moved. `gamePersistence.ts` reads it once, writes it to the daily
 * slot and clears the key. Nothing else may use this, and `gameSchema` above
 * still refuses it, so no daily record can be resumed as a level game.
 */
export const strandedDailySchema = gameSlotSchema(NM_STORAGE_KEYS.game, 'daily');

// ---------- level progress & personal best scores ----------

export interface TopScoreEntry {
  mode: GameMode;
  /** Level number ("42") or daily date ("2026-07-27"). */
  ref: string;
  score: number;
  at: number;
}

export interface Progress {
  schemaVersion: 2;
  /** Highest level the player may start (1..100). */
  highestUnlocked: number;
  /** Sparse map: level number (string) → best score. */
  bestScores: Record<string, number>;
  /** Sparse map: daily date (YYYY-MM-DD) → best score for that day's board. */
  bestDaily: Record<string, number>;
  /** Personal top scores, best first, max 10, deduped per level/date. */
  topScores: TopScoreEntry[];
}

export const TOP_SCORES_LIMIT = 10;

const validateTopScoreEntry = (raw: unknown): TopScoreEntry | null => {
  if (!isRecord(raw)) return null;
  const mode = raw.mode === 'level' || raw.mode === 'daily' ? raw.mode : null;
  const ref = asString(raw.ref, 12);
  const score = asInt(raw.score, 0, 1e9);
  const at = asInt(raw.at, 0, 1e15);
  if (mode === null || ref === null || ref.length === 0 || score === null || at === null) {
    return null;
  }
  return { mode, ref, score, at };
};

/** Malformed entries are dropped rather than rejecting the whole record. */
function validateBestScores(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const levelNumber = /^\d{1,3}$/.test(key) ? Number(key) : NaN;
    const score = asInt(value, 0, 1e9);
    if (levelNumber >= 1 && levelNumber <= MAX_LEVEL && score !== null) {
      // Canonical key (guards against e.g. zero-padded "042").
      out[String(levelNumber)] = Math.max(out[String(levelNumber)] ?? 0, score);
    }
  }
  return out;
}

function validateBestDaily(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const score = asInt(value, 0, 1e9);
    if (asDateString(key) !== null && score !== null && Object.keys(out).length < 2000) {
      out[key] = score;
    }
  }
  return out;
}

/**
 * Enforces the documented invariants: dedupe per (mode, ref) keeping the best,
 * then best-first order, then the cap. `keep` narrows which entries survive,
 * which is how the v2 migration drops the level side of the table.
 */
function validateTopScores(
  raw: unknown,
  keep: (entry: TopScoreEntry) => boolean = () => true,
): TopScoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const byRef = new Map<string, TopScoreEntry>();
  for (const rawEntry of raw) {
    const entry = validateTopScoreEntry(rawEntry);
    if (!entry || !keep(entry)) continue;
    const key = `${entry.mode}:${entry.ref}`;
    const existing = byRef.get(key);
    if (!existing || entry.score > existing.score) byRef.set(key, entry);
  }
  return [...byRef.values()]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, TOP_SCORES_LIMIT);
}

export const progressSchema: SchemaDef<Progress> = {
  key: NM_STORAGE_KEYS.progress,
  version: 2,
  defaultValue: () => ({
    schemaVersion: 2,
    highestUnlocked: 1,
    bestScores: {},
    bestDaily: {},
    topScores: [],
  }),
  validate: (raw) => {
    if (!isRecord(raw)) return null;

    // v1 → v2: the level list went from 999 levels to 100 (§11), which changed
    // what every level number means and every board behind it. Level progress
    // starts over rather than being reinterpreted: a best score carried across
    // would stand against a board that no longer exists, and a level number
    // rescaled onto the new list would unlock a board nobody has played. That
    // is also why the personal top-score table keeps only its daily rows — a
    // level row there is a score against a vanished board. Dailies are
    // untouched: their boards never came from the level list.
    if (raw.schemaVersion === 1) {
      return {
        schemaVersion: 2,
        highestUnlocked: 1,
        bestScores: {},
        bestDaily: validateBestDaily(raw.bestDaily),
        topScores: validateTopScores(raw.topScores, (entry) => entry.mode === 'daily'),
      };
    }

    if (raw.schemaVersion !== 2) return null;
    const highestUnlocked = asInt(raw.highestUnlocked, 1, MAX_LEVEL);
    if (highestUnlocked === null) return null;
    return {
      schemaVersion: 2,
      highestUnlocked,
      bestScores: validateBestScores(raw.bestScores),
      bestDaily: validateBestDaily(raw.bestDaily),
      topScores: validateTopScores(raw.topScores),
    };
  },
};
