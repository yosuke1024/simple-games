import { describe, expect, it } from 'vitest';
import type { KVStore } from './kv';
import { createMemoryKV } from './kv';
import { clearLocalData, loadRecord, loadRecordWithStatus, saveRecord } from './repo';
import {
  CLUB_CONNECTIONS_MAX,
  CLUB_OUTBOX_MAX,
  clubConnectionsSchema,
  clubOutboxSchema,
  iapSchema,
  isClubEndpoint,
  settingsSchema,
  STORAGE_KEYS,
  type SchemaDef,
} from './schemas';

describe('loadRecord (shared records)', () => {
  it('returns defaults when nothing is stored', async () => {
    const kv = createMemoryKV();
    expect(await loadRecord(settingsSchema, kv)).toEqual(settingsSchema.defaultValue());
    expect(await loadRecord(iapSchema, kv)).toEqual(iapSchema.defaultValue());
  });

  it('returns defaults for corrupt JSON without crashing', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.settings]: '{not json!!',
      [STORAGE_KEYS.iap]: '[]',
    });
    expect(await loadRecord(settingsSchema, kv)).toEqual(settingsSchema.defaultValue());
    expect(await loadRecord(iapSchema, kv)).toEqual(iapSchema.defaultValue());
  });

  it('returns defaults for an unknown schemaVersion', async () => {
    const schemas: SchemaDef<unknown>[] = [settingsSchema, iapSchema];
    for (const schema of schemas) {
      const kv = createMemoryKV({ [schema.key]: JSON.stringify({ schemaVersion: 99 }) });
      expect(await loadRecord(schema, kv)).toEqual(schema.defaultValue());
    }
  });

  it('round-trips valid records', async () => {
    const kv = createMemoryKV();
    const settings = { ...settingsSchema.defaultValue(), theme: 'dark' as const, sound: false };
    await saveRecord(settingsSchema, settings, kv);
    expect(await loadRecord(settingsSchema, kv)).toEqual(settings);

    const iap = { schemaVersion: 1 as const, adRemovalPurchased: true, purchasedAt: 123 };
    await saveRecord(iapSchema, iap, kv);
    expect(await loadRecord(iapSchema, kv)).toEqual(iap);
  });

  it('rejects an iap record with a purchased flag of the wrong type', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.iap]: JSON.stringify({
        schemaVersion: 1,
        adRemovalPurchased: 'yes',
        purchasedAt: null,
      }),
    });
    expect(await loadRecord(iapSchema, kv)).toEqual(iapSchema.defaultValue());
  });
});

/**
 * A store that fails rather than answering. `preferencesKV` swallows its own
 * failures, so this is what any other `KVStore` — or a future one — looks like
 * when the device cannot answer at all.
 */
const unreadableKV = (): KVStore => ({
  get: () => Promise.reject(new Error('storage unavailable')),
  set: () => Promise.resolve(),
  remove: () => Promise.resolve(),
});

describe('loadRecordWithStatus (issue #96)', () => {
  it('reports a store that could not be read, and still hands back a value', async () => {
    const load = await loadRecordWithStatus(iapSchema, unreadableKV());
    expect(load.readable).toBe(false);
    expect(load.value).toEqual(iapSchema.defaultValue());
  });

  it('counts missing and corrupt data as read: the store answered', async () => {
    const empty = await loadRecordWithStatus(iapSchema, createMemoryKV());
    expect(empty).toEqual({ value: iapSchema.defaultValue(), readable: true });

    const corrupt = await loadRecordWithStatus(
      iapSchema,
      createMemoryKV({ [STORAGE_KEYS.iap]: '{not json!!' }),
    );
    expect(corrupt).toEqual({ value: iapSchema.defaultValue(), readable: true });
  });

  it('reports a stored record as read', async () => {
    const iap = { schemaVersion: 1 as const, adRemovalPurchased: true, purchasedAt: 123 };
    const kv = createMemoryKV({ [STORAGE_KEYS.iap]: JSON.stringify(iap) });
    expect(await loadRecordWithStatus(iapSchema, kv)).toEqual({ value: iap, readable: true });
  });

  it('loadRecord falls back to the default instead of rejecting', async () => {
    // The whole point of the guard: the failure stops here, where the caller
    // can see it, instead of unwinding through every await above it.
    expect(await loadRecord(settingsSchema, unreadableKV())).toEqual(settingsSchema.defaultValue());
  });

  it('a failed read does not strand the later operations on that key', async () => {
    let failNext = true;
    const kv: KVStore = {
      ...createMemoryKV(),
      get: () => {
        if (failNext) {
          failNext = false;
          return Promise.reject(new Error('storage unavailable'));
        }
        return Promise.resolve(null);
      },
    };
    expect((await loadRecordWithStatus(iapSchema, kv)).readable).toBe(false);
    expect((await loadRecordWithStatus(iapSchema, kv)).readable).toBe(true);
  });
});

describe('clearLocalData', () => {
  it('removes exactly the given keys', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.settings]: '{}',
      [STORAGE_KEYS.iap]: '{}',
      'nm.stats': '{}',
    });
    await clearLocalData([STORAGE_KEYS.settings, 'nm.stats'], kv);
    expect(await kv.get(STORAGE_KEYS.settings)).toBeNull();
    expect(await kv.get('nm.stats')).toBeNull();
    expect(await kv.get(STORAGE_KEYS.iap)).not.toBeNull();
  });
});

/**
 * Ordering under slow storage. Saves are fire-and-forget everywhere in the app
 * — a game must stay playable whether or not storage is keeping up — so more
 * than one operation on a key can be outstanding at once. What the player is
 * promised is that they finish in the order they were asked for; "Reset Local
 * Data" is where breaking that becomes visible, in both directions.
 */
describe('operations on one key under slow storage', () => {
  /** A store whose writes land only when released: the slow-device case. */
  function createSlowKV() {
    const map = new Map<string, string>();
    let release!: () => void;
    const landed = new Promise<void>((resolve) => (release = resolve));
    const kv: KVStore = {
      get: (key) => Promise.resolve(map.get(key) ?? null),
      set: async (key, value) => {
        await landed;
        map.set(key, value);
      },
      remove: (key) => {
        map.delete(key);
        return Promise.resolve();
      },
    };
    return { kv, release };
  }

  const purchased = { schemaVersion: 1 as const, adRemovalPurchased: true, purchasedAt: 1 };

  it('saves normally when nothing else is happening', async () => {
    const { kv, release } = createSlowKV();
    const write = saveRecord(iapSchema, purchased, kv);
    release();
    await write;

    expect(await loadRecord(iapSchema, kv)).toEqual(purchased);
  });

  it('does not let a save in flight outlive the delete that came after it', async () => {
    const { kv, release } = createSlowKV();
    const write = saveRecord(iapSchema, purchased, kv);
    const wipe = clearLocalData([STORAGE_KEYS.iap], kv);
    release();
    await Promise.all([write, wipe]);

    expect(await kv.get(STORAGE_KEYS.iap)).toBeNull();
  });

  /**
   * The mirror image, and the more expensive one to get wrong: the player
   * resets, then plays or changes a setting. That save was asked for last, so
   * it must survive — a straggler from before the reset must not take it down
   * with it.
   */
  it('keeps a save made after the delete, even with a straggler in flight', async () => {
    const { kv, release } = createSlowKV();
    const straggler = saveRecord(iapSchema, iapSchema.defaultValue(), kv);
    const wipe = clearLocalData([STORAGE_KEYS.iap], kv);
    const afterwards = saveRecord(iapSchema, purchased, kv);
    release();
    await Promise.all([straggler, wipe, afterwards]);

    expect(await loadRecord(iapSchema, kv)).toEqual(purchased);
  });

  it('applies two saves in the order they were asked for', async () => {
    const { kv, release } = createSlowKV();
    const first = saveRecord(iapSchema, iapSchema.defaultValue(), kv);
    const second = saveRecord(iapSchema, purchased, kv);
    release();
    await Promise.all([first, second]);

    expect(await loadRecord(iapSchema, kv)).toEqual(purchased);
  });

  it('does not let one stalled key hold up another', async () => {
    const { kv, release } = createSlowKV();
    const stalled = saveRecord(iapSchema, purchased, kv);

    // Would hang if every key shared one queue.
    await clearLocalData(['nm.stats'], kv);

    release();
    await stalled;
  });
});

/**
 * `saveRecord` is documented as never throwing, and every caller relies on it:
 * saves are made with `void saveRecord(...)`, so a throw would surface as an
 * unhandled rejection rather than as a save that quietly failed.
 */
describe('a value that cannot be serialised', () => {
  it('fails quietly instead of rejecting', async () => {
    const kv = createMemoryKV();
    const circular: { self?: unknown } = {};
    circular.self = circular;

    await expect(
      saveRecord(iapSchema, circular as unknown as ReturnType<typeof iapSchema.defaultValue>, kv),
    ).resolves.toBeUndefined();
    expect(await kv.get(STORAGE_KEYS.iap)).toBeNull();
  });
});

describe('Club connections record (docs/architecture/club.md §4-1)', () => {
  const connection = (over: Record<string, unknown> = {}) => ({
    endpoint: 'https://club.example.com',
    clubId: 'club-1',
    clubName: 'Friday Club',
    memberId: 'member-1',
    memberToken: 'secret-token',
    nickname: 'Ada',
    role: 'member',
    joinedAt: '2026-10-02T00:00:00.000Z',
    ...over,
  });
  const load = (connections: unknown[]) =>
    loadRecord(
      clubConnectionsSchema,
      createMemoryKV({
        [STORAGE_KEYS.club]: JSON.stringify({ schemaVersion: 1, connections }),
      }),
    );

  it('keeps the valid element when a neighbour is broken', async () => {
    const good = connection();
    const loaded = await load([
      { endpoint: 'https://broken.example.com' },
      'not an object',
      good,
      connection({ endpoint: 'https://b.example.com', memberToken: '' }),
    ]);
    expect(loaded.connections).toEqual([good]);
  });

  it('collapses a second connection to the same endpoint, keeping the first', async () => {
    const loaded = await load([
      connection({ nickname: 'First' }),
      connection({ nickname: 'Second', clubId: 'club-2' }),
      connection({ endpoint: 'https://other.example.com', clubId: 'club-3' }),
    ]);
    expect(loaded.connections.map((c) => c.nickname)).toEqual(['First', 'Ada']);
    expect(loaded.connections.map((c) => c.endpoint)).toEqual([
      'https://club.example.com',
      'https://other.example.com',
    ]);
  });

  it('caps the connections per device', async () => {
    const many = Array.from({ length: CLUB_CONNECTIONS_MAX + 3 }, (_, i) =>
      connection({ endpoint: `https://club${i}.example.com` }),
    );
    expect((await load(many)).connections).toHaveLength(CLUB_CONNECTIONS_MAX);
  });

  it('falls back to the default for corrupt JSON and an unknown version', async () => {
    const corrupt = createMemoryKV({ [STORAGE_KEYS.club]: '{nope' });
    expect(await loadRecord(clubConnectionsSchema, corrupt)).toEqual(
      clubConnectionsSchema.defaultValue(),
    );
    const future = createMemoryKV({
      [STORAGE_KEYS.club]: JSON.stringify({ schemaVersion: 2, connections: [connection()] }),
    });
    expect(await loadRecord(clubConnectionsSchema, future)).toEqual(
      clubConnectionsSchema.defaultValue(),
    );
  });

  it('accepts https and http to the loopback, and refuses a private-network http endpoint', () => {
    expect(isClubEndpoint('https://club.pixapps.ai')).toBe(true);
    expect(isClubEndpoint('http://localhost:5173')).toBe(true);
    expect(isClubEndpoint('http://127.0.0.1:8787')).toBe(true);
    expect(isClubEndpoint('http://192.168.1.2')).toBe(false);
    expect(isClubEndpoint('http://club.example.com')).toBe(false);
    expect(isClubEndpoint('ftp://club.example.com')).toBe(false);
    expect(isClubEndpoint(42)).toBe(false);
  });

  it('refuses an endpoint that is not exactly an origin', () => {
    expect(isClubEndpoint('https://club.pixapps.ai/')).toBe(false);
    expect(isClubEndpoint('https://club.pixapps.ai/join')).toBe(false);
    expect(isClubEndpoint('https://club.pixapps.ai?x=1')).toBe(false);
    expect(isClubEndpoint('https://club.pixapps.ai#invite=abc')).toBe(false);
  });

  it('drops a connection whose endpoint is refused', async () => {
    const loaded = await load([
      connection({ endpoint: 'http://192.168.1.2' }),
      connection({ endpoint: 'https://club.pixapps.ai/' }),
      connection({ endpoint: 'http://localhost:5173' }),
    ]);
    expect(loaded.connections.map((c) => c.endpoint)).toEqual(['http://localhost:5173']);
  });
});

describe('Club outbox record (docs/architecture/club.md §4-2)', () => {
  const item = (n: number, over: Record<string, unknown> = {}) => ({
    endpoint: 'https://club.example.com',
    challengeId: `challenge-${n}`,
    result: { contractVersion: 1, boardDigest: 'abc123', outcome: 'completed', facts: { n } },
    createdAt: '2026-10-02T00:00:00.000Z',
    ...over,
  });
  const load = (items: unknown[]) =>
    loadRecord(
      clubOutboxSchema,
      createMemoryKV({ [STORAGE_KEYS.clubOutbox]: JSON.stringify({ schemaVersion: 1, items }) }),
    );

  it('keeps the valid item when a neighbour is broken', async () => {
    const loaded = await load([
      item(1, { endpoint: 'http://192.168.1.2' }),
      item(2, { result: { contractVersion: 2 } }),
      item(3),
      null,
    ]);
    expect(loaded.items.map((i) => (i.kind === undefined ? i.challengeId : null))).toEqual([
      'challenge-3',
    ]);
  });

  it('caps the outbox and keeps the newest', async () => {
    const loaded = await load(Array.from({ length: CLUB_OUTBOX_MAX + 5 }, (_, i) => item(i)));
    expect(loaded.items).toHaveLength(CLUB_OUTBOX_MAX);
    const idOf = (i: (typeof loaded.items)[number] | undefined) =>
      i?.kind === undefined ? i?.challengeId : null;
    expect(idOf(loaded.items[0])).toBe('challenge-5');
    expect(idOf(loaded.items.at(-1))).toBe(`challenge-${CLUB_OUTBOX_MAX + 4}`);
  });

  describe('the automatic-send shapes', () => {
    const daily = (over: Record<string, unknown> = {}) => ({
      kind: 'daily',
      endpoint: 'https://club.example.com',
      createdAt: '2026-10-02T00:00:00.000Z',
      body: {
        gameId: 'nonogram',
        contractVersion: 1,
        params: { size: 10 },
        seed: 'nonogram-daily-2026-10-02',
        boardDigest: 'ng1:abc',
        title: null,
        daily: '2026-10-02',
        result: { outcome: 'completed', facts: { elapsedSeconds: 120 } },
      },
      ...over,
    });
    const ranking = (over: Record<string, unknown> = {}) => ({
      kind: 'ranking',
      endpoint: 'https://club.example.com',
      createdAt: '2026-10-02T00:00:00.000Z',
      body: {
        gameId: '2048',
        contractVersion: 1,
        paramsKey: 'classic',
        params: {},
        seed: '',
        boardDigest: null,
        outcome: 'completed',
        facts: { score: 2048 },
      },
      ...over,
    });
    const withBody = (base: { body: object }, body: Record<string, unknown>) => ({
      body: { ...base.body, ...body },
    });

    it('keeps the old form, a daily and a ranking side by side, in order', async () => {
      const loaded = await load([item(1), daily(), ranking()]);
      expect(loaded.items.map((i) => i.kind ?? 'result')).toEqual(['result', 'daily', 'ranking']);
    });

    it('keeps a ranking with an empty seed and a null digest, and a counted attempt', async () => {
      const loaded = await load([ranking({ attempts: 3 })]);
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0]?.attempts).toBe(3);
    });

    it.each([
      ['an unknown kind', { kind: 'other' }],
      ['a daily without a date', withBody(daily(), { daily: '2026-13-40' })],
      ['a daily with a title', withBody(daily(), { title: 'x' })],
      ['a daily with an empty seed', withBody(daily(), { seed: '' })],
      ['a daily with no digest', withBody(daily(), { boardDigest: null })],
      [
        'a daily with a seed longer than the server takes',
        withBody(daily(), { seed: 'x'.repeat(81) }),
      ],
      ['a game id the server would refuse', withBody(daily(), { gameId: 'Not A Game' })],
      ['params that are not an object', withBody(daily(), { params: [1] })],
      ['an unknown contract version', withBody(daily(), { contractVersion: 2 })],
      ['a ranking without a paramsKey', withBody(ranking(), { paramsKey: 'A B' })],
      ['a ranking with an empty digest', withBody(ranking(), { boardDigest: '' })],
      ['a ranking with facts that are not an object', withBody(ranking(), { facts: 3 })],
      ['a ranking with an unknown outcome', withBody(ranking(), { outcome: 'lost' })],
      ['attempts that are not a count', { attempts: -1 }],
      ['attempts past the cap', { attempts: 99 }],
    ])('drops %s and keeps its neighbour', async (_what, over) => {
      const base = String(_what).startsWith('a ranking') ? ranking() : daily();
      const loaded = await load([{ ...base, ...over }, ranking()]);
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0]?.kind).toBe('ranking');
    });
  });

  it('falls back to the default for an unknown version', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.clubOutbox]: JSON.stringify({ schemaVersion: 9, items: [item(1)] }),
    });
    expect(await loadRecord(clubOutboxSchema, kv)).toEqual(clubOutboxSchema.defaultValue());
  });
});
