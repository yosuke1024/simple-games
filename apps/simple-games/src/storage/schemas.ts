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
