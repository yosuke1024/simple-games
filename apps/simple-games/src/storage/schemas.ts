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
import { asBool, asInt, asString, isRecord } from './validate';

/** Shared records are prefixed `sg.`; game records use their own prefix. */
export const STORAGE_KEYS = {
  settings: 'sg.settings',
  iap: 'sg.iap',
  review: 'sg.review',
  recent: 'sg.recent',
  webAppPrompt: 'sg.webAppPrompt',
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
    if (
      language === null ||
      theme === null ||
      sound === null ||
      vibration === null ||
      reducedMotion === null
    ) {
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

// ---------- recently played ----------

/**
 * The shortcut row at the top of the collection home: the games most recently
 * opened, newest first. It exists so the list below can stay in a fixed,
 * hand-ordered sequence as the collection grows — the games somebody actually
 * plays stay one tap away without the order under them ever moving
 * (docs/ARCHITECTURE.md「コレクションホーム」).
 *
 * It is a shortcut and nothing else: no timestamps, no counts, no "continue
 * where you left off". Losing it costs nobody a saved game, which is why there
 * is no migration to write and why "Reset Local Data" may simply drop it.
 *
 * Ids are validated as strings only — storage does not know which games exist.
 * `app/recentGames.ts` drops ids the registry no longer carries, so a game that
 * is removed one day cannot leave an unopenable shortcut behind.
 */
export interface RecentGames {
  schemaVersion: 1;
  ids: string[];
}

/**
 * How many shortcuts the home shows. Two: enough for the pair most people
 * alternate between, few enough that the full list is still the page.
 */
export const RECENT_GAMES_LIMIT = 2;

export const recentGamesSchema: SchemaDef<RecentGames> = {
  key: STORAGE_KEYS.recent,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, ids: [] }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    if (!Array.isArray(raw.ids)) return null;
    const ids: string[] = [];
    for (const value of raw.ids) {
      const id = asString(value, 40);
      if (id === null) return null;
      if (!ids.includes(id)) ids.push(id);
    }
    return { schemaVersion: 1, ids: ids.slice(0, RECENT_GAMES_LIMIT) };
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
    if (
      gamesCompleted === null ||
      promptsShown === null ||
      nextPromptAt === null ||
      resolved === null
    ) {
      return null;
    }
    return { schemaVersion: 1, gamesCompleted, promptsShown, nextPromptAt, resolved };
  },
};

// ---------- the browser version's one-time app card ----------

/**
 * The web build's single, quiet pointer at the installed app
 * (docs/WEB_VERSION.md「アプリへの送客」). Two numbers is the whole record:
 * how many times a game has been left for the collection in this browser, and
 * whether the card has had its one showing.
 *
 * It is deliberately NOT part of `sg.review`. That record paces the store
 * review question by completed games and retires on an answer; folding a
 * second, differently-shaped ask into it would change what its counters mean
 * and make one flow's cadence a side effect of the other's.
 *
 * Nothing here is written on the app build — the counter is only ever
 * incremented behind a runtime guard (`services/webAppPrompt.ts`), so an
 * installed app never carries a record about installing itself.
 */
export interface WebAppPromptState {
  schemaVersion: 1;
  /** Games left for the collection in this browser. Counted, never timed. */
  gameExits: number;
  /** The card has had its one showing. Never shown again in this browser. */
  shown: boolean;
}

/**
 * Exits before the card is eligible. Two, because one is not yet a habit and
 * three is a visitor being asked late: the card should meet somebody who has
 * come back to the collection twice under their own steam.
 */
export const WEB_APP_PROMPT_AT = 2;

/**
 * The same card, one game earlier, for a visitor who arrived on a game rather
 * than on the collection — a shared link or a guide link put them there
 * (`?game=<id>`, docs/WEB_VERSION.md「URL(ゲーム別の入口)」).
 *
 * Why they are not the same number: somebody who opened the collection on
 * their own is browsing, and asking them about an app before they have played
 * twice is asking before they know what this is. Somebody who followed a link
 * a friend sent them was already recommended the thing — they arrived on one
 * game, and if they leave after that game they leave never having been told
 * an app exists. **Two is the wrong number for them, because they usually
 * only ever play one.**
 *
 * It is still not zero, and it is still once ever: the card comes after a
 * game, never before one, and it is a card in the page rather than anything
 * that interrupts (docs/WEB_VERSION.md「アプリへの送客」).
 */
export const WEB_APP_PROMPT_FROM_LINK_AT = 1;

export const webAppPromptSchema: SchemaDef<WebAppPromptState> = {
  key: STORAGE_KEYS.webAppPrompt,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, gameExits: 0, shown: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const gameExits = asInt(raw.gameExits, 0, 1e9);
    const shown = asBool(raw.shown);
    if (gameExits === null || shown === null) return null;
    return { schemaVersion: 1, gameExits, shown };
  },
};
