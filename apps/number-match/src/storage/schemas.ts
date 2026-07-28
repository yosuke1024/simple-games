/**
 * Persisted record schemas. Every record carries a schemaVersion so future
 * versions can migrate. Validators never throw: corrupt data yields null and
 * callers fall back to safe defaults (spec §15.1).
 */
import { INITIAL_SCORE, MAX_CELLS, MAX_LEVEL, type GameMode, type ScoreState } from '../game';

export const STORAGE_KEYS = {
  game: 'nm.saveGame',
  settings: 'nm.settings',
  stats: 'nm.stats',
  flags: 'nm.flags',
  adState: 'nm.adState',
  rcCache: 'nm.rcCache',
  progress: 'nm.progress',
  /** Daily games suspend independently of level games (docs §14). */
  dailyGame: 'nm.saveDaily',
} as const;

export interface SchemaDef<T> {
  readonly key: string;
  /** Current schema version written by this build. */
  readonly version: number;
  readonly defaultValue: () => T;
  /**
   * Validates (and, for older versions, migrates) a parsed JSON value.
   * Returns null when the data is unusable.
   */
  readonly validate: (raw: unknown) => T | null;
}

// ---------- primitives ----------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asInt = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && Math.floor(v) === v && v >= min && v <= max
    ? v
    : null;

const asBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

const asString = (v: unknown, maxLen = 200): string | null =>
  typeof v === 'string' && v.length <= maxLen ? v : null;

const asDateString = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

// ---------- settings ----------

export const LANGUAGES = ['system', 'en', 'ja', 'hi', 'th', 'id'] as const;
export type LanguageSetting = (typeof LANGUAGES)[number];
export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemeSetting = (typeof THEMES)[number];

export interface Settings {
  schemaVersion: 1;
  language: LanguageSetting;
  theme: ThemeSetting;
  sound: boolean;
  vibration: boolean;
  reducedMotion: boolean;
}

export const settingsSchema: SchemaDef<Settings> = {
  key: STORAGE_KEYS.settings,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    language: 'system',
    theme: 'system',
    sound: true,
    vibration: true,
    reducedMotion: false,
  }),
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    if (raw.schemaVersion !== 1) return null;
    const language = LANGUAGES.includes(raw.language as LanguageSetting)
      ? (raw.language as LanguageSetting)
      : null;
    const theme = THEMES.includes(raw.theme as ThemeSetting) ? (raw.theme as ThemeSetting) : null;
    const sound = asBool(raw.sound);
    const vibration = asBool(raw.vibration);
    const reducedMotion = asBool(raw.reducedMotion);
    if (language === null || theme === null || sound === null || vibration === null || reducedMotion === null) {
      return null;
    }
    return { schemaVersion: 1, language, theme, sound, vibration, reducedMotion };
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    if (tutorialCompleted === null) return null;
    return { schemaVersion: 1, tutorialCompleted };
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

export interface Stats {
  schemaVersion: 2;
  level: ModeStats;
  daily: ModeStats & {
    lastCompletedDate: string | null;
    streak: number;
    bestStreak: number;
  };
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
  key: STORAGE_KEYS.stats,
  version: 2,
  defaultValue: () => ({
    schemaVersion: 2,
    level: emptyModeStats(),
    daily: { ...emptyModeStats(), lastCompletedDate: null, streak: 0, bestStreak: 0 },
  }),
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    // v1 → v2 migration: the "classic" bucket became the "level" bucket.
    let source = raw;
    if (raw.schemaVersion === 1) {
      source = { ...raw, schemaVersion: 2, level: raw.classic };
    }
    if (source.schemaVersion !== 2) return null;
    const level = validateModeStats(source.level);
    if (!isRecord(source.daily) || level === null) return null;
    const dailyBase = validateModeStats(source.daily);
    const lastCompletedDate =
      source.daily.lastCompletedDate === null ? null : asDateString(source.daily.lastCompletedDate);
    const streak = asInt(source.daily.streak, 0, 1e6);
    const bestStreak = asInt(source.daily.bestStreak, 0, 1e6);
    if (dailyBase === null || streak === null || bestStreak === null) return null;
    if (lastCompletedDate === null && source.daily.lastCompletedDate !== null) return null;
    return {
      schemaVersion: 2,
      level,
      daily: { ...dailyBase, lastCompletedDate, streak, bestStreak },
    };
  },
};

// ---------- saved game ----------

const validateScore = (raw: unknown): ScoreState | null => {
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
  return { total, streakTenths, matchPoints, rowPoints, clearBonus, noHintBonus };
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
      source = { ...raw, schemaVersion: 2, level: null, score: INITIAL_SCORE };
    }
    if (source.schemaVersion !== 2) return null;
    const mode = source.mode === 'level' || source.mode === 'daily' ? source.mode : null;
    const seed = asString(source.seed);
    const dailyDate = source.dailyDate === null ? null : asDateString(source.dailyDate);
    const level = source.level === null ? null : asInt(source.level, 1, MAX_LEVEL);
    // A stored board can never legally exceed the maximum board size.
    const values = asString(source.values, MAX_CELLS);
    const mask = asString(source.mask, MAX_CELLS);
    const score = validateScore(source.score);
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
 * One slot per mode. Both hold the same record shape; the mode field inside
 * the record is what says which slot it belongs to.
 */
function gameSlotSchema(key: string): SchemaDef<PersistedGame | null> {
  return { key, version: 2, defaultValue: () => null, validate: validatePersistedGame };
}

/** Suspended level game. */
export const gameSchema = gameSlotSchema(STORAGE_KEYS.game);
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(STORAGE_KEYS.dailyGame);

// ---------- level progress & personal best scores ----------

export interface TopScoreEntry {
  mode: GameMode;
  /** Level number ("42") or daily date ("2026-07-27"). */
  ref: string;
  score: number;
  at: number;
}

export interface Progress {
  schemaVersion: 1;
  /** Highest level the player may start (1..999). */
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

export const progressSchema: SchemaDef<Progress> = {
  key: STORAGE_KEYS.progress,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    highestUnlocked: 1,
    bestScores: {},
    bestDaily: {},
    topScores: [],
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const highestUnlocked = asInt(raw.highestUnlocked, 1, MAX_LEVEL);
    if (highestUnlocked === null || !isRecord(raw.bestScores) || !Array.isArray(raw.topScores)) {
      return null;
    }
    // Malformed entries are dropped rather than rejecting the whole record.
    const bestScores: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw.bestScores)) {
      const levelNumber = /^\d{1,3}$/.test(key) ? Number(key) : NaN;
      const score = asInt(value, 0, 1e9);
      if (levelNumber >= 1 && levelNumber <= MAX_LEVEL && score !== null) {
        // Canonical key (guards against e.g. zero-padded "042").
        bestScores[String(levelNumber)] = Math.max(bestScores[String(levelNumber)] ?? 0, score);
      }
    }
    // Absent in early records; defaults to empty.
    const bestDaily: Record<string, number> = {};
    if (isRecord(raw.bestDaily)) {
      for (const [key, value] of Object.entries(raw.bestDaily)) {
        const score = asInt(value, 0, 1e9);
        if (asDateString(key) !== null && score !== null && Object.keys(bestDaily).length < 2000) {
          bestDaily[key] = score;
        }
      }
    }
    // Enforce the documented invariants: dedupe per (mode, ref) keeping the
    // best, then best-first order, then the cap.
    const byRef = new Map<string, TopScoreEntry>();
    for (const rawEntry of raw.topScores) {
      const entry = validateTopScoreEntry(rawEntry);
      if (!entry) continue;
      const key = `${entry.mode}:${entry.ref}`;
      const existing = byRef.get(key);
      if (!existing || entry.score > existing.score) byRef.set(key, entry);
    }
    const topScores = [...byRef.values()]
      .sort((a, b) => b.score - a.score || a.at - b.at)
      .slice(0, TOP_SCORES_LIMIT);
    return { schemaVersion: 1, highestUnlocked, bestScores, bestDaily, topScores };
  },
};

// ---------- ad frequency counters ----------

export interface AdState {
  schemaVersion: 1;
  /** Number of app launches (sessions). */
  sessionCount: number;
  /** Lifetime play seconds, used only for interstitial gating. */
  totalPlaySeconds: number;
  /** Lifetime completed (cleared or game-over) games. */
  completedGames: number;
  lastInterstitialAt: number | null;
  /** Local date the daily counter belongs to. */
  interstitialDate: string;
  interstitialCountToday: number;
}

export const adStateSchema: SchemaDef<AdState> = {
  key: STORAGE_KEYS.adState,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    sessionCount: 0,
    totalPlaySeconds: 0,
    completedGames: 0,
    lastInterstitialAt: null,
    interstitialDate: '1970-01-01',
    interstitialCountToday: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const sessionCount = asInt(raw.sessionCount, 0, 1e9);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    const completedGames = asInt(raw.completedGames, 0, 1e9);
    const lastInterstitialAt =
      raw.lastInterstitialAt === null ? null : asInt(raw.lastInterstitialAt, 0, 1e15);
    const interstitialDate = asDateString(raw.interstitialDate);
    const interstitialCountToday = asInt(raw.interstitialCountToday, 0, 1e6);
    if (
      sessionCount === null ||
      totalPlaySeconds === null ||
      completedGames === null ||
      interstitialDate === null ||
      interstitialCountToday === null
    ) {
      return null;
    }
    if (lastInterstitialAt === null && raw.lastInterstitialAt !== null) return null;
    return {
      schemaVersion: 1,
      sessionCount,
      totalPlaySeconds,
      completedGames,
      lastInterstitialAt,
      interstitialDate,
      interstitialCountToday,
    };
  },
};

// ---------- remote config cache ----------

export interface RcCache {
  schemaVersion: 1;
  values: Record<string, boolean | number>;
  fetchedAt: number | null;
}

export const rcCacheSchema: SchemaDef<RcCache> = {
  key: STORAGE_KEYS.rcCache,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, values: {}, fetchedAt: null }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    if (!isRecord(raw.values)) return null;
    const values: Record<string, boolean | number> = {};
    for (const [k, v] of Object.entries(raw.values)) {
      if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) {
        values[k] = v;
      }
    }
    const fetchedAt = raw.fetchedAt === null ? null : asInt(raw.fetchedAt, 0, 1e15);
    if (fetchedAt === null && raw.fetchedAt !== null) return null;
    return { schemaVersion: 1, values, fetchedAt };
  },
};
