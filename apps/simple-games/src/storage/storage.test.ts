import { describe, expect, it } from 'vitest';
import type { KVStore } from './kv';
import { createMemoryKV } from './kv';
import { clearLocalData, loadRecord, loadRecordWithStatus, saveRecord } from './repo';
import { iapSchema, settingsSchema, STORAGE_KEYS, type SchemaDef } from './schemas';

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
