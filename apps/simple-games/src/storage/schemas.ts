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
import { asBool, asDateString, asInt, asString, isRecord } from './validate';

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
  /**
   * The device saw `clubAutoSendDisclosure` and joined, or accepted it on the
   * Club screen: finished games are sent to this Club by themselves. A
   * connection made before 2026-10-02 (the manual "Send to Club" build) has
   * none and sends nothing until its owner accepts there (club.md §4-1).
   * Additive: a record without it stays valid, schemaVersion stays 1.
   */
  autoSend?: true;
}

export interface ClubConnections {
  schemaVersion: 1;
  /** Join order. Empty means not connected. */
  connections: ClubConnection[];
  /**
   * Clubs this device disconnected from, kept so joining the same Club again
   * returns the same member instead of making a new one (club.md §4-1,
   * decision 43). Same shape and secret as a connection, so the record's
   * rules apply (never in a backup, wiped by Reset Local Data). Never sends,
   * never queues and never loads the Club layer at boot: the shell reads only
   * `connections`. Additive: absent means none, schemaVersion stays 1.
   */
  departed?: ClubConnection[];
}

/** Connections per device, owner or member alike (club.md §4-1). */
export const CLUB_CONNECTIONS_MAX = 10;

/** Departed Clubs kept for a way back; the oldest goes first (club.md §4-1). */
export const CLUB_DEPARTED_MAX = 10;

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
    // Anything but a literal `true` is "has not accepted": consent is never inferred.
    ...(raw.autoSend === true ? { autoSend: true as const } : {}),
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
    const kept = connections.slice(0, CLUB_CONNECTIONS_MAX);
    // Validated like connections, one per server; a Club that is connected again
    // is not also "departed". A broken list never costs the connections.
    const departed: ClubConnection[] = [];
    if (Array.isArray(raw.departed)) {
      for (const value of raw.departed) {
        const connection = asClubConnection(value);
        if (connection === null) continue;
        if (departed.some((c) => c.endpoint === connection.endpoint)) continue;
        if (kept.some((c) => c.endpoint === connection.endpoint)) continue;
        departed.push(connection);
      }
    }
    return {
      schemaVersion: 1,
      connections: kept,
      ...(departed.length > 0 ? { departed: departed.slice(-CLUB_DEPARTED_MAX) } : {}),
    };
  },
};

/**
 * Results the Club layer has not delivered yet (club.md §4-2, §10). Every
 * finished result is written here BEFORE it is sent and removed once the Club
 * answers, so a result survives the app being killed mid-request, an offline
 * moment, or a server that is down. Sent, oldest first, right after the player's
 * own next action — the next result, or opening a Club screen — never on a
 * timer and never at boot. Same gates as `sg.club`: not in a backup, wiped by
 * reset.
 *
 * Three shapes share one list. The bodies below are Core's own copy of the
 * request bodies in `club/api/types.ts` (Core must not import `club/`); the
 * validator checks them structurally, so a record the Club layer would be
 * refused on is dropped on load rather than blocking its Club's queue.
 *
 * - `daily`: `POST /challenges` — a daily everyone plays on the same board,
 *   which meets in that day's challenge (the server keeps the first result of
 *   each member).
 * - `ranking`: `POST /rankings/results` — a result in the game × mode table.
 *   Every finished game is its own row there (club.md §16-1, 2026-10-10), so
 *   nothing is merged: the item carries a random `clientId` (also in the body)
 *   that the server dedupes a resend on. An item without one was queued by an
 *   older build, which kept only the best per table; it stays valid.
 * - no `kind`: the original form, `POST /challenges/:id/results`. Builds before
 *   the automatic send wrote it; it stays valid and flushable.
 */
interface ClubOutboxBase {
  endpoint: string;
  createdAt: string;
  /** Failed deliveries that said something about the server rather than the network (club.md §10). */
  attempts?: number;
}

export interface ClubOutboxLegacyItem extends ClubOutboxBase {
  kind?: undefined;
  challengeId: string;
  result: {
    contractVersion: 1;
    boardDigest: string;
    outcome: 'completed' | 'played';
    facts: Record<string, unknown>;
  };
}

export interface ClubOutboxDailyItem extends ClubOutboxBase {
  kind: 'daily';
  body: {
    gameId: string;
    contractVersion: 1;
    params: Record<string, unknown>;
    seed: string;
    boardDigest: string;
    title: null;
    /** The day the board belongs to, `YYYY-MM-DD`. */
    daily: string;
    result: { outcome: 'completed' | 'played'; facts: Record<string, unknown> };
  };
}

export interface ClubOutboxRankingItem extends ClubOutboxBase {
  kind: 'ranking';
  /**
   * `^[A-Za-z0-9_-]{8,64}$` — a random token for this one result, the same as
   * `body.clientId` (club.md §4-2, §5-5: it names no device and no person).
   * Missing on an item an older build queued.
   */
  clientId?: string;
  body: {
    gameId: string;
    contractVersion: 1;
    paramsKey: string;
    params: Record<string, unknown>;
    seed: string;
    boardDigest: string | null;
    outcome: 'completed' | 'played';
    facts: Record<string, unknown>;
    clientId?: string;
  };
}

export type ClubOutboxItem = ClubOutboxLegacyItem | ClubOutboxDailyItem | ClubOutboxRankingItem;

export interface ClubOutbox {
  schemaVersion: 1;
  /** Send order. Past the cap the oldest are dropped. */
  items: ClubOutboxItem[];
}

/**
 * One result can fan out to every joined Club (up to ten), and a day offline
 * is a few dozen results. Rankings no longer coalesce (one row per result), so
 * this cap is the only bound: past it the oldest are dropped.
 */
export const CLUB_OUTBOX_MAX = 100;
/** A failed delivery counted this many times is given up on (club.md §10). */
export const CLUB_OUTBOX_MAX_ATTEMPTS = 5;

const GAME_ID = /^[a-z0-9-]{1,40}$/;
const PARAMS_KEY = /^[a-z0-9-]{1,40}$/;
/** The server's own shape for a ranking `clientId` (club.md §16-1). */
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

const asClientId = (v: unknown): string | null =>
  typeof v === 'string' && CLIENT_ID.test(v) ? v : null;

const asOutcome = (v: unknown): 'completed' | 'played' | null =>
  v === 'completed' || v === 'played' ? v : null;

/** A real calendar day, `YYYY-MM-DD` — the server refuses anything else. */
function asRealDate(v: unknown): string | null {
  const date = asDateString(v);
  if (date === null) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

function asBody(raw: unknown): Record<string, unknown> | null {
  return isRecord(raw) ? { ...raw } : null;
}

/** The item as stored, or null when it is not one of the three shapes. */
export function validateClubOutboxItem(raw: unknown): ClubOutboxItem | null {
  if (!isRecord(raw) || !isClubEndpoint(raw.endpoint)) return null;
  const createdAt = asString(raw.createdAt, 40);
  if (createdAt === null) return null;
  const attempts =
    raw.attempts === undefined ? undefined : asInt(raw.attempts, 0, CLUB_OUTBOX_MAX_ATTEMPTS);
  if (attempts === null) return null;
  const base = {
    endpoint: raw.endpoint,
    createdAt,
    ...(attempts === undefined ? {} : { attempts }),
  };

  if (raw.kind === undefined) {
    const challengeId = asString(raw.challengeId, 64);
    if (challengeId === null || challengeId === '') return null;
    const result = raw.result;
    if (!isRecord(result) || result.contractVersion !== 1 || !isRecord(result.facts)) return null;
    const boardDigest = asString(result.boardDigest, 64);
    const outcome = asOutcome(result.outcome);
    if (boardDigest === null || boardDigest === '' || outcome === null) return null;
    return {
      ...base,
      challengeId,
      result: { contractVersion: 1, boardDigest, outcome, facts: { ...result.facts } },
    };
  }

  const body = isRecord(raw.body) ? raw.body : null;
  if (body === null || body.contractVersion !== 1) return null;
  const gameId = asString(body.gameId, 40);
  const seed = asString(body.seed, 80);
  const params = asBody(body.params);
  if (gameId === null || !GAME_ID.test(gameId) || seed === null || params === null) return null;

  if (raw.kind === 'daily') {
    const boardDigest = asString(body.boardDigest, 64);
    const date = asRealDate(body.daily);
    const result = isRecord(body.result) ? body.result : null;
    if (boardDigest === null || boardDigest === '' || date === null || seed === '') return null;
    if (body.title !== null || result === null || !isRecord(result.facts)) return null;
    const outcome = asOutcome(result.outcome);
    if (outcome === null) return null;
    return {
      ...base,
      kind: 'daily',
      body: {
        gameId,
        contractVersion: 1,
        params,
        seed,
        boardDigest,
        title: null,
        daily: date,
        result: { outcome, facts: { ...result.facts } },
      },
    };
  }

  if (raw.kind === 'ranking') {
    const paramsKey = asString(body.paramsKey, 40);
    let boardDigest: string | null = null;
    if (body.boardDigest !== null) {
      boardDigest = asString(body.boardDigest, 64);
      if (boardDigest === null || boardDigest === '') return null;
    }
    const outcome = asOutcome(body.outcome);
    if (paramsKey === null || !PARAMS_KEY.test(paramsKey)) return null;
    if (outcome === null || !isRecord(body.facts)) return null;
    // The item's own `clientId` decides; the body's stands in only when the item
    // has none. A malformed one is dropped alone — the result is still worth
    // sending, and without a token it is treated as an older build's item.
    const clientId = asClientId(raw.clientId === undefined ? body.clientId : raw.clientId);
    return {
      ...base,
      kind: 'ranking',
      ...(clientId === null ? {} : { clientId }),
      body: {
        gameId,
        contractVersion: 1,
        paramsKey,
        params,
        seed,
        boardDigest,
        outcome,
        facts: { ...body.facts },
        ...(clientId === null ? {} : { clientId }),
      },
    };
  }
  return null;
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
      const item = validateClubOutboxItem(value);
      if (item !== null) items.push(item);
    }
    return { schemaVersion: 1, items: items.slice(-CLUB_OUTBOX_MAX) };
  },
};
