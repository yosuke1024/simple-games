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
  favorites: 'sg.favorites',
  club: 'sg.club',
  clubOutbox: 'sg.clubOutbox',
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

// ---------- pinned games ----------

/**
 * The games somebody pinned to the top of the collection home (issue #109).
 *
 * `sg.recent` above is a history the shell writes; this is a choice the player
 * makes and unmakes. That difference is the reason it exists at all — an
 * automatic list of the last two games opened can never be "the ones I always
 * want here", and stretching it to try would cost it the one job it does well.
 *
 * Ids only, in the order they were pinned. No counts, no times, no "last
 * played": the shelf is a set of doors, not a report on how they were used
 * (docs/PRODUCT_PRINCIPLES.md「ユーザーを急かさない」). Losing the record costs
 * nobody a saved game, which is why there is no migration to write and why
 * "Reset Local Data" may simply drop it.
 *
 * Ids are validated as strings only — storage does not know which games exist.
 * `app/favoriteGames.ts` drops the ones the registry no longer carries, so a
 * game withdrawn from a future build quietly leaves the shelf rather than
 * leaving a door to nowhere; the id stays in the record, so a game that comes
 * back comes back pinned.
 */
export interface FavoriteGames {
  schemaVersion: 1;
  ids: string[];
}

/**
 * A bound on the record, not a rule on the player. The collection has never
 * held this many games, so nobody reaches it by pinning; it is here so that a
 * corrupt — or hand-edited — record cannot grow without limit. When it does
 * bite, the newest entries are the ones kept, matching `sg.recent`.
 */
export const FAVORITE_GAMES_MAX = 64;

export const favoriteGamesSchema: SchemaDef<FavoriteGames> = {
  key: STORAGE_KEYS.favorites,
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
    return { schemaVersion: 1, ids: ids.slice(-FAVORITE_GAMES_MAX) };
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

// ---------- Club House: connections and the outbox ----------

/**
 * The Clubs this device has joined (docs/architecture/club.md §4-1). Owned by
 * the shell like `sg.iap` — the Club layer reads and writes it, but the boot
 * check "is this device connected?" and the backup / reset gates must read it
 * without loading that layer. One element per server; the member token is the
 * device's secret and the reason the record never travels in a backup
 * (src/backup/keys.ts).
 *
 * Validation is per element: a broken connection is dropped and the others
 * stay. Nothing of Core's depends on this record, so the worst a corrupt one
 * can do is make the device look unconnected (PRODUCT_PRINCIPLES「Club House」).
 */
export interface ClubConnection {
  /** Origin only — `https://club.example.com`. No path, query or trailing slash. */
  endpoint: string;
  clubId: string;
  /** The club's name as last read from the server; a display cache. */
  clubName: string;
  memberId: string;
  /** Secret. This device only; never in a backup. */
  memberToken: string;
  nickname: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface ClubConnections {
  schemaVersion: 1;
  /** Join order. Empty means not connected. */
  connections: ClubConnection[];
}

/** Connections per device, owner or member alike (club.md §4-1). */
export const CLUB_CONNECTIONS_MAX = 10;

/**
 * An endpoint the record accepts: https, or http to the loopback for
 * development. http to a private network is refused outright (club.md §4-1).
 * The value must be exactly an origin — a path, query or fragment is a
 * different address and is not quietly trimmed.
 */
export function isClubEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 200) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.origin !== value) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

function asClubConnection(raw: unknown): ClubConnection | null {
  if (!isRecord(raw)) return null;
  if (!isClubEndpoint(raw.endpoint)) return null;
  const clubId = asString(raw.clubId, 64);
  const clubName = asString(raw.clubName, 40);
  const memberId = asString(raw.memberId, 64);
  const memberToken = asString(raw.memberToken, 128);
  const nickname = asString(raw.nickname, 24);
  const joinedAt = asString(raw.joinedAt, 40);
  const role = raw.role === 'owner' || raw.role === 'member' ? raw.role : null;
  if (
    clubId === null ||
    clubId === '' ||
    clubName === null ||
    memberId === null ||
    memberId === '' ||
    memberToken === null ||
    memberToken === '' ||
    nickname === null ||
    joinedAt === null ||
    role === null
  ) {
    return null;
  }
  return {
    endpoint: raw.endpoint,
    clubId,
    clubName,
    memberId,
    memberToken,
    nickname,
    role,
    joinedAt,
  };
}

export const clubConnectionsSchema: SchemaDef<ClubConnections> = {
  key: STORAGE_KEYS.club,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, connections: [] }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    if (!Array.isArray(raw.connections)) return null;
    const connections: ClubConnection[] = [];
    for (const value of raw.connections) {
      const connection = asClubConnection(value);
      if (connection === null) continue;
      // One connection per server: a second nickname on the same Club is not a second Club.
      if (connections.some((c) => c.endpoint === connection.endpoint)) continue;
      connections.push(connection);
    }
    return { schemaVersion: 1, connections: connections.slice(0, CLUB_CONNECTIONS_MAX) };
  },
};

/**
 * Results the Club layer could not deliver yet (club.md §4-2, §10): the body
 * of a `POST /challenges/:id/results` and where it goes. Sent, oldest first,
 * the next time that Club's screen opens or the next result is sent — never
 * on a timer. Same gates as `sg.club`: not in a backup, wiped by reset.
 */
export interface ClubOutboxItem {
  endpoint: string;
  challengeId: string;
  result: {
    contractVersion: 1;
    boardDigest: string;
    outcome: 'completed' | 'played';
    facts: Record<string, unknown>;
  };
  createdAt: string;
}

export interface ClubOutbox {
  schemaVersion: 1;
  /** Send order. Past the cap the oldest are dropped. */
  items: ClubOutboxItem[];
}

export const CLUB_OUTBOX_MAX = 50;

function asOutboxItem(raw: unknown): ClubOutboxItem | null {
  if (!isRecord(raw) || !isClubEndpoint(raw.endpoint)) return null;
  const challengeId = asString(raw.challengeId, 64);
  const createdAt = asString(raw.createdAt, 40);
  if (challengeId === null || challengeId === '' || createdAt === null) return null;
  const result = raw.result;
  if (!isRecord(result) || result.contractVersion !== 1 || !isRecord(result.facts)) return null;
  const boardDigest = asString(result.boardDigest, 64);
  const outcome =
    result.outcome === 'completed' || result.outcome === 'played' ? result.outcome : null;
  if (boardDigest === null || boardDigest === '' || outcome === null) return null;
  return {
    endpoint: raw.endpoint,
    challengeId,
    result: { contractVersion: 1, boardDigest, outcome, facts: { ...result.facts } },
    createdAt,
  };
}

export const clubOutboxSchema: SchemaDef<ClubOutbox> = {
  key: STORAGE_KEYS.clubOutbox,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, items: [] }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    if (!Array.isArray(raw.items)) return null;
    const items: ClubOutboxItem[] = [];
    for (const value of raw.items) {
      const item = asOutboxItem(value);
      if (item !== null) items.push(item);
    }
    return { schemaVersion: 1, items: items.slice(-CLUB_OUTBOX_MAX) };
  },
};
