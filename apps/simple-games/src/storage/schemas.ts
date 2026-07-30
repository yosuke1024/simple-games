/**
 * Records shared by the whole collection: settings and the ad-removal
 * purchase cache. Each game owns its own records (progress, statistics,
 * saved games) under `games/<id>/storage/`, so one game's corruption can
 * never take another game down.
 *
 * Every record carries a schemaVersion so future versions can migrate.
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults.
 */
import { asBool, asInt, isRecord } from './validate';

/** Shared records are prefixed `sg.`; game records use their own prefix. */
export const STORAGE_KEYS = {
  settings: 'sg.settings',
  iap: 'sg.iap',
  review: 'sg.review',
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

// ---------- settings ----------

/**
 * The picker's order: the device default first, then the languages by their
 * own names. `system` is not a locale — it means "follow the device", which is
 * what a fresh install uses so nobody is asked to choose before playing.
 */
export const LANGUAGES = [
  'system',
  'en',
  'ja',
  'hi',
  'th',
  'id',
  'vi',
  'ko',
  'zh-hans',
  'zh-hant',
  'es',
  'pt-br',
  'fr',
  'de',
  'tr',
] as const;
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

// ---------- ad-removal purchase cache ----------

/**
 * Local cache of the one-time "Remove Ads" entitlement. The store (Google
 * Play) is the source of truth; this cache keeps the entitlement working
 * offline and across launches. Losing it is never destructive — the player
 * can always restore the purchase from the store.
 */
export interface IapState {
  schemaVersion: 1;
  adRemovalPurchased: boolean;
  /** Epoch ms of the purchase or restore that set the flag; null if never. */
  purchasedAt: number | null;
}

export const iapSchema: SchemaDef<IapState> = {
  key: STORAGE_KEYS.iap,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, adRemovalPurchased: false, purchasedAt: null }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const adRemovalPurchased = asBool(raw.adRemovalPurchased);
    const purchasedAt = raw.purchasedAt === null ? null : asInt(raw.purchasedAt, 0, 1e15);
    if (adRemovalPurchased === null) return null;
    if (purchasedAt === null && raw.purchasedAt !== null) return null;
    return { schemaVersion: 1, adRemovalPurchased, purchasedAt };
  },
};

// ---------- store-review prompt ----------

/**
 * The quiet "Enjoying Simple Games?" flow (docs/REVIEW_PROMPT_POLICY.md):
 * completed games are counted across the whole collection, the question is
 * asked at most twice per install, and an answer — either direction —
 * retires it for good.
 */
export interface ReviewState {
  schemaVersion: 1;
  /** Completed (won) games across all titles, dailies included. */
  gamesCompleted: number;
  /** How many times the question has been shown (hard-capped). */
  promptsShown: number;
  /** The completion count that arms the next ask. */
  nextPromptAt: number;
  /** The player answered — never ask again. */
  resolved: boolean;
}

/** Completions before the first ask: engagement first, question later. */
export const REVIEW_FIRST_PROMPT_AT = 5;

export const reviewSchema: SchemaDef<ReviewState> = {
  key: STORAGE_KEYS.review,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    gamesCompleted: 0,
    promptsShown: 0,
    nextPromptAt: REVIEW_FIRST_PROMPT_AT,
    resolved: false,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const gamesCompleted = asInt(raw.gamesCompleted, 0, 1e9);
    const promptsShown = asInt(raw.promptsShown, 0, 100);
    const nextPromptAt = asInt(raw.nextPromptAt, 0, 1e9);
    const resolved = asBool(raw.resolved);
    if (gamesCompleted === null || promptsShown === null || nextPromptAt === null || resolved === null) {
      return null;
    }
    return { schemaVersion: 1, gamesCompleted, promptsShown, nextPromptAt, resolved };
  },
};
