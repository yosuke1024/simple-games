/**
 * Persisted record schemas. Every record carries a schemaVersion so future
 * versions can migrate. Validators never throw: corrupt data yields null and
 * callers fall back to safe defaults (spec §15.1).
 */
import type { GameMode } from '../game';

export const STORAGE_KEYS = {
  game: 'nm.saveGame',
  settings: 'nm.settings',
  stats: 'nm.stats',
  flags: 'nm.flags',
  adState: 'nm.adState',
  rcCache: 'nm.rcCache',
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
  schemaVersion: 1;
  classic: ModeStats;
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
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    classic: emptyModeStats(),
    daily: { ...emptyModeStats(), lastCompletedDate: null, streak: 0, bestStreak: 0 },
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const classic = validateModeStats(raw.classic);
    if (!isRecord(raw.daily) || classic === null) return null;
    const dailyBase = validateModeStats(raw.daily);
    const lastCompletedDate =
      raw.daily.lastCompletedDate === null ? null : asDateString(raw.daily.lastCompletedDate);
    const streak = asInt(raw.daily.streak, 0, 1e6);
    const bestStreak = asInt(raw.daily.bestStreak, 0, 1e6);
    if (dailyBase === null || streak === null || bestStreak === null) return null;
    if (lastCompletedDate === null && raw.daily.lastCompletedDate !== null) return null;
    return {
      schemaVersion: 1,
      classic,
      daily: { ...dailyBase, lastCompletedDate, streak, bestStreak },
    };
  },
};

// ---------- saved game ----------

export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  dailyDate: string | null;
  values: string;
  mask: string;
  moveCount: number;
  addCount: number;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const mode = raw.mode === 'classic' || raw.mode === 'daily' ? raw.mode : null;
    const seed = asString(raw.seed);
    const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
    const values = asString(raw.values, 1000);
    const mask = asString(raw.mask, 1000);
    const moveCount = asInt(raw.moveCount, 0, 1e6);
    const addCount = asInt(raw.addCount, 0, 1e6);
    const hintCount = asInt(raw.hintCount, 0, 1e6);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    if (
      mode === null ||
      seed === null ||
      seed.length === 0 ||
      values === null ||
      mask === null ||
      moveCount === null ||
      addCount === null ||
      hintCount === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }
    if (dailyDate === null && raw.dailyDate !== null) return null;
    if (mode === 'daily' && dailyDate === null) return null;
    return {
      schemaVersion: 1,
      mode,
      seed,
      dailyDate,
      values,
      mask,
      moveCount,
      addCount,
      hintCount,
      elapsedSeconds,
      savedAt,
    };
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
