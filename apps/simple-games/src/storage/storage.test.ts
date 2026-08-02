import { describe, expect, it } from 'vitest';
import type { KVStore } from './kv';
import { createMemoryKV } from './kv';
import { clearLocalData, loadRecord, saveRecord } from './repo';
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
