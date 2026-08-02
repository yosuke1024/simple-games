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
 * Saves are fire-and-forget everywhere in the app — a game must stay playable
 * whether or not storage is keeping up — so a write can still be in flight
 * when the player deletes their data. If it lands afterwards it recreates the
 * record, and "Reset Local Data" has told the player something untrue.
 */
describe('a write already in flight when the data is wiped', () => {
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

  it('does not resurrect the record it was writing', async () => {
    const { kv, release } = createSlowKV();
    const write = saveRecord(iapSchema, iapSchema.defaultValue(), kv);

    await clearLocalData([STORAGE_KEYS.iap], kv);
    release();
    await write;

    expect(await kv.get(STORAGE_KEYS.iap)).toBeNull();
  });

  it('still saves normally when no wipe happened', async () => {
    const { kv, release } = createSlowKV();
    const value = { ...iapSchema.defaultValue(), adRemovalPurchased: true };
    const write = saveRecord(iapSchema, value, kv);

    release();
    await write;

    expect(await loadRecord(iapSchema, kv)).toEqual(value);
  });

  it('keeps a write that started after the wipe', async () => {
    const { kv, release } = createSlowKV();
    await clearLocalData([STORAGE_KEYS.iap], kv);

    const write = saveRecord(iapSchema, iapSchema.defaultValue(), kv);
    release();
    await write;

    expect(await kv.get(STORAGE_KEYS.iap)).not.toBeNull();
  });
});
