/**
 * Backup & Restore end to end (issue #160).
 *
 * The subject of these tests is somebody's saved life in this app: thirty
 * games' worth of levels, statistics and half-finished boards, in a file that
 * is the only copy. So the questions asked here are the destructive ones —
 * what happens to the data already on the device when the file is wrong, when
 * it is from another version, when the store refuses a write halfway through.
 *
 * The records below are written out as literals rather than built by calling
 * into a game, for two reasons. The shell may not import game code
 * (src/test/importBoundaries.test.ts), and a literal pins the RELEASED shape
 * of a payload the way `app/gameKeys.test.ts` pins released keys: if a game
 * changes its save format, a round trip of the old shape has to keep working
 * or a real player's backup has stopped restoring.
 */
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';
import { createMemoryKV, type KVStore } from '../storage/kv';
import { loadRaw } from '../storage/repo';
import { STORAGE_KEYS } from '../storage/schemas';
import { createBackup } from './export';
import { BACKUP_MAX_BYTES, serializeBackup, backupFileName } from './format';
import { backupKeys } from './keys';
import { applyBackup, readBackup, readBackupFile } from './restore';

const META = {
  appVersion: '1.2.2',
  platform: 'android',
  now: new Date('2026-09-08T09:30:00.000Z'),
};

/** A suspended Sudoku level game, in the shape the game writes it. */
const SUDOKU_SUSPENDED = {
  schemaVersion: 1,
  mode: 'level',
  seed: 'level-7-abc',
  difficulty: 'medium',
  dailyDate: null,
  level: 7,
  givens: '53007000060019500009800006080006000340080300170002000606000028000041900500008007'.padEnd(
    81,
    '0',
  ),
  entries: '0'.repeat(81),
  notes: '',
  solution:
    '53467891267219534819834256785796142342685379171923846959387412428146935364512987'.padEnd(
      81,
      '9',
    ),
  mistakeCount: 2,
  hintCount: 1,
  elapsedSeconds: 245,
  savedAt: 1_757_000_000_000,
};

const SUDOKU_PROGRESS_V2 = {
  schemaVersion: 2,
  highestUnlocked: 12,
  bestTimes: { '1': 240, '2': 300 },
  dailyTimes: { '2026-09-01': 420 },
};

/** The same record as it was written before the 999 → 100 level change. */
const SUDOKU_PROGRESS_V1 = {
  schemaVersion: 1,
  highestUnlocked: 412,
  bestTimes: { '411': 900 },
  dailyTimes: { '2026-07-27': 300, '2026-07-28': 280 },
};

const SETTINGS = {
  schemaVersion: 1,
  language: 'ja',
  theme: 'dark',
  sound: false,
  vibration: true,
  reducedMotion: true,
};

const key = {
  sudokuGame: 'sd.saveGame',
  sudokuProgress: 'sd.progress',
  minesFlags: 'ms.flags',
} as const;

/** A device with a few games played on it. */
function playedDevice(extra: Record<string, string> = {}): KVStore {
  return createMemoryKV({
    [STORAGE_KEYS.settings]: JSON.stringify(SETTINGS),
    [STORAGE_KEYS.favorites]: JSON.stringify({ schemaVersion: 1, ids: ['sudoku', 'hearts'] }),
    [STORAGE_KEYS.recent]: JSON.stringify({ schemaVersion: 1, ids: ['sudoku'] }),
    [key.sudokuGame]: JSON.stringify(SUDOKU_SUSPENDED),
    [key.sudokuProgress]: JSON.stringify(SUDOKU_PROGRESS_V2),
    ...extra,
  });
}

async function dump(kv: KVStore, keys: readonly string[]): Promise<Record<string, string | null>> {
  const values = await Promise.all(keys.map((k) => loadRaw(k, kv)));
  return Object.fromEntries(keys.map((k, index) => [k, values[index] ?? null]));
}

const container = (over: Record<string, unknown> = {}) => ({
  formatVersion: 1,
  createdAt: '2026-09-08T09:30:00.000Z',
  appVersion: '1.2.2',
  platform: 'ios',
  data: {},
  ...over,
});

const text = (over: Record<string, unknown> = {}) => JSON.stringify(container(over));

describe('export', () => {
  it('carries every record the device has, and names the file by date', async () => {
    const backup = await createBackup(META, playedDevice());

    expect(backup.formatVersion).toBe(1);
    expect(backup.createdAt).toBe('2026-09-08T09:30:00.000Z');
    expect(backup.appVersion).toBe('1.2.2');
    expect(backup.platform).toBe('android');
    expect(Object.keys(backup.data).sort()).toEqual(
      [
        STORAGE_KEYS.settings,
        STORAGE_KEYS.favorites,
        STORAGE_KEYS.recent,
        key.sudokuGame,
        key.sudokuProgress,
      ].sort(),
    );
    expect(backupFileName(new Date('2026-09-08T22:00:00.000Z'))).toMatch(
      /^simple-games-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  it('exports an empty backup from a fresh install rather than failing', async () => {
    const backup = await createBackup(META, createMemoryKV());
    expect(backup.data).toEqual({});
  });

  /**
   * docs/ADS_POLICY.md: the entitlement is the store's answer, not the
   * player's data. A backup file can be copied, so an entitlement inside one
   * would be a purchase that copies.
   */
  it('never carries the ad-removal entitlement, even when one is stored', async () => {
    const kv = playedDevice({
      [STORAGE_KEYS.iap]: JSON.stringify({
        schemaVersion: 1,
        adRemovalPurchased: true,
        purchasedAt: 1_757_000_000_000,
      }),
    });
    const file = serializeBackup(await createBackup(META, kv));
    expect(file).not.toContain(STORAGE_KEYS.iap);
    expect(file).not.toContain('adRemovalPurchased');
  });

  it('leaves out a record the owning game can no longer read', async () => {
    const kv = playedDevice({ [key.sudokuProgress]: JSON.stringify({ schemaVersion: 99 }) });
    const backup = await createBackup(META, kv);
    expect(backup.data).not.toHaveProperty(key.sudokuProgress);
    // …and the rest of the device still travels.
    expect(backup.data).toHaveProperty(key.sudokuGame);
  });

  it('leaves out a key holding something that is not JSON', async () => {
    const kv = playedDevice({ [key.minesFlags]: 'not json at all' });
    const backup = await createBackup(META, kv);
    expect(backup.data).not.toHaveProperty(key.minesFlags);
  });
});

describe('round trip', () => {
  it('reproduces the first device exactly on a second one', async () => {
    const source = playedDevice();
    const file = serializeBackup(await createBackup(META, source));

    const target = createMemoryKV();
    const read = await readBackup(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(await applyBackup(read.prepared, target)).toBe('restored');

    expect(await dump(target, backupKeys())).toEqual(await dump(source, backupKeys()));
  });

  it('keeps a suspended board playable, field for field', async () => {
    const file = serializeBackup(await createBackup(META, playedDevice()));
    const read = await readBackup(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const target = createMemoryKV();
    await applyBackup(read.prepared, target);
    expect(JSON.parse((await loadRaw(key.sudokuGame, target)) ?? 'null')).toEqual(SUDOKU_SUSPENDED);
  });

  it('reads the backup back through the file the player picked', async () => {
    const file = serializeBackup(await createBackup(META, playedDevice()));
    const read = await readBackupFile({ size: file.length, text: () => Promise.resolve(file) });
    expect(read.ok).toBe(true);
  });

  /**
   * A backup taken before an update, restored after one. The owning game's
   * own migration is what runs — the backup layer has no idea a Sudoku
   * progress record ever had a version 1.
   */
  it('migrates an older record on the way in, exactly as the game would', async () => {
    const file = text({ data: { [key.sudokuProgress]: SUDOKU_PROGRESS_V1 } });
    const read = await readBackup(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const target = createMemoryKV();
    await applyBackup(read.prepared, target);
    const restored = JSON.parse((await loadRaw(key.sudokuProgress, target)) ?? 'null');
    expect(restored.schemaVersion).toBe(2);
    // The daily calendar survives the 999 → 100 level change; the levels do not.
    expect(restored.dailyTimes).toEqual({ '2026-07-27': 300, '2026-07-28': 280 });
    expect(restored.highestUnlocked).toBe(1);
  });
});

describe('restore replaces, and never merges', () => {
  it('removes a record the backup does not carry', async () => {
    const file = text({ data: { [STORAGE_KEYS.settings]: SETTINGS } });
    const target = playedDevice();
    const read = await readBackup(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    expect(await applyBackup(read.prepared, target)).toBe('restored');
    // Progress made after the backup was taken does not survive a restore
    // meant to undo it.
    expect(await loadRaw(key.sudokuGame, target)).toBeNull();
    expect(await loadRaw(key.sudokuProgress, target)).toBeNull();
    expect(await loadRaw(STORAGE_KEYS.settings, target)).toBe(JSON.stringify(SETTINGS));
  });

  it('does not touch records backup does not own', async () => {
    const iap = JSON.stringify({
      schemaVersion: 1,
      adRemovalPurchased: true,
      purchasedAt: 1_757_000_000_000,
    });
    const review = JSON.stringify({
      schemaVersion: 1,
      gamesCompleted: 9,
      promptsShown: 1,
      nextPromptAt: 20,
      resolved: true,
    });
    const target = playedDevice({ [STORAGE_KEYS.iap]: iap, [STORAGE_KEYS.review]: review });

    const read = await readBackup(text({ data: { [STORAGE_KEYS.settings]: SETTINGS } }));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    await applyBackup(read.prepared, target);

    // Somebody restoring their progress onto a new phone keeps the purchase
    // that phone's store granted them, and does not inherit one from a file.
    expect(await loadRaw(STORAGE_KEYS.iap, target)).toBe(iap);
    expect(await loadRaw(STORAGE_KEYS.review, target)).toBe(review);
  });
});

describe('a file that is refused', () => {
  const cases: readonly [string, string, 'unreadable' | 'newer' | 'damaged'][] = [
    ['is not JSON', 'this is not a backup', 'unreadable'],
    ['is JSON but not an object', '[1, 2, 3]', 'unreadable'],
    ['has no formatVersion', JSON.stringify({ data: {} }), 'unreadable'],
    ['has a formatVersion that is not a number', text({ formatVersion: '1' }), 'unreadable'],
    ['has a formatVersion of zero', text({ formatVersion: 0 }), 'unreadable'],
    ['has a fractional formatVersion', text({ formatVersion: 1.5 }), 'unreadable'],
    ['has no createdAt', JSON.stringify({ formatVersion: 1, data: {} }), 'unreadable'],
    ['has a createdAt that is not a date', text({ createdAt: 'someday' }), 'unreadable'],
    ['has a data that is an array', text({ data: [] }), 'unreadable'],
    [
      'has no data at all',
      JSON.stringify({ formatVersion: 1, createdAt: '2026-09-08' }),
      'unreadable',
    ],
  ];

  for (const [what, file, problem] of cases) {
    it(`${what} → ${problem}`, async () => {
      expect(await readBackup(file)).toEqual({ ok: false, problem });
    });
  }

  it('is larger than any real backup → unreadable, without being parsed', async () => {
    const huge = `{"padding":"${'a'.repeat(BACKUP_MAX_BYTES)}"}`;
    expect(await readBackup(huge)).toEqual({ ok: false, problem: 'unreadable' });
  });

  it('is larger than any real backup → unreadable, without being read off disk', async () => {
    let read = false;
    const result = await readBackupFile({
      size: BACKUP_MAX_BYTES + 1,
      text: () => {
        read = true;
        return Promise.resolve('');
      },
    });
    expect(result).toEqual({ ok: false, problem: 'unreadable' });
    expect(read).toBe(false);
  });

  /**
   * The rule the issue is explicit about: an older app must not quietly drop
   * the parts of a newer backup it does not understand and call that a
   * successful restore.
   */
  it('was written by a newer container version → newer', async () => {
    expect(await readBackup(text({ formatVersion: 2 }))).toEqual({ ok: false, problem: 'newer' });
  });

  it('names a record this build does not own → newer', async () => {
    const file = text({ data: { 'zz.gameFromTheFuture': { schemaVersion: 1 } } });
    expect(await readBackup(file)).toEqual({ ok: false, problem: 'newer' });
  });

  it('names a record the owning game refuses → damaged', async () => {
    const file = text({ data: { [key.sudokuGame]: { ...SUDOKU_SUSPENDED, mode: 'daily' } } });
    expect(await readBackup(file)).toEqual({ ok: false, problem: 'damaged' });
  });

  it('carries one bad record among good ones → the whole restore is refused', async () => {
    const file = text({
      data: {
        [STORAGE_KEYS.settings]: SETTINGS,
        [key.sudokuProgress]: SUDOKU_PROGRESS_V2,
        [key.sudokuGame]: { schemaVersion: 1, mode: 'level' },
      },
    });
    expect(await readBackup(file)).toEqual({ ok: false, problem: 'damaged' });
  });

  it('smuggles a dangerous object key → damaged, and nothing is polluted', async () => {
    const file = `{"formatVersion":1,"createdAt":"2026-09-08T09:30:00.000Z","appVersion":"1","platform":"web","data":{"__proto__":{"polluted":true}}}`;
    expect(await readBackup(file)).toEqual({ ok: false, problem: 'damaged' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('writes nothing to the device when it is refused', async () => {
    const target = playedDevice();
    const before = await dump(target, backupKeys());
    expect((await readBackup('{"formatVersion":1,"data":{"sd.saveGame":{}}}')).ok).toBe(false);
    expect(await dump(target, backupKeys())).toEqual(before);
  });
});

describe('a restore that cannot be written', () => {
  /** A store that accepts everything except one key, silently — like the real one. */
  function refusing(kv: KVStore, refusedKey: string): KVStore {
    return {
      get: (k) => kv.get(k),
      set: (k, value) => (k === refusedKey ? Promise.resolve() : kv.set(k, value)),
      remove: (k) => (k === refusedKey ? Promise.resolve() : kv.remove(k)),
    };
  }

  it('reports failure and puts every record back as it was', async () => {
    const target = playedDevice();
    const before = await dump(target, backupKeys());

    const file = text({
      data: { [STORAGE_KEYS.settings]: { ...SETTINGS, theme: 'light' } },
    });
    const read = await readBackup(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    // The settings write is the one the store will not take, and the backup
    // also asks for every other record to be removed — so a restore that gave
    // up halfway would leave the device with neither its old data nor the
    // file's.
    const outcome = await applyBackup(read.prepared, refusing(target, STORAGE_KEYS.settings));
    expect(outcome).toBe('failed');
    expect(await dump(target, backupKeys())).toEqual(before);
  });

  it('reports failure when a removal is the part that will not take', async () => {
    const target = playedDevice();
    const before = await dump(target, backupKeys());

    const read = await readBackup(text({ data: { [STORAGE_KEYS.settings]: SETTINGS } }));
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const outcome = await applyBackup(read.prepared, refusing(target, key.sudokuGame));
    expect(outcome).toBe('failed');
    expect(await dump(target, backupKeys())).toEqual(before);
  });
});

describe('the file is the same one on every platform', () => {
  it('restores an iPhone backup onto an Android device and back', async () => {
    const iphone = playedDevice();
    const fromIphone = serializeBackup(await createBackup({ ...META, platform: 'ios' }, iphone));

    const android = createMemoryKV();
    const readOnAndroid = await readBackup(fromIphone);
    expect(readOnAndroid.ok).toBe(true);
    if (!readOnAndroid.ok) return;
    expect(await applyBackup(readOnAndroid.prepared, android)).toBe('restored');

    // …and the file that device writes goes back the other way unchanged.
    const fromAndroid = serializeBackup(
      await createBackup({ ...META, platform: 'android' }, android),
    );
    const web = createMemoryKV();
    const readOnWeb = await readBackup(fromAndroid);
    expect(readOnWeb.ok).toBe(true);
    if (!readOnWeb.ok) return;
    expect(await applyBackup(readOnWeb.prepared, web)).toBe('restored');

    expect(await dump(web, backupKeys())).toEqual(await dump(iphone, backupKeys()));
  });

  it('does not let the platform field decide anything', async () => {
    const file = text({ platform: 'a-platform-that-does-not-exist', data: {} });
    expect((await readBackup(file)).ok).toBe(true);
  });
});

describe('every game is inside the backup', () => {
  /**
   * Not a spot check: a round trip through EVERY key the registry declares,
   * with a value each game's own schema accepts. If a game were reachable by
   * the key list but not by a validator, this is where it shows up.
   */
  it('round-trips a record for every key of every registered game', async () => {
    const defaults = new Map<string, unknown>();
    for (const game of GAMES) {
      const module = await game.loadStorageSchemas();
      for (const value of Object.values(module)) {
        if (
          typeof value === 'object' &&
          value !== null &&
          'key' in value &&
          'defaultValue' in value &&
          typeof (value as { defaultValue: unknown }).defaultValue === 'function'
        ) {
          const schema = value as { key: string; defaultValue: () => unknown };
          if (game.storageKeys.includes(schema.key))
            defaults.set(schema.key, schema.defaultValue());
        }
      }
    }

    // A saved-game slot's default is "no saved game" (null), which is not a
    // record to carry — every other key has a real default to round-trip.
    const carried = [...defaults].filter(([, value]) => value !== null);
    expect(carried.length).toBeGreaterThan(90);

    const source = createMemoryKV(
      Object.fromEntries(carried.map(([k, value]) => [k, JSON.stringify(value)])),
    );
    const file = serializeBackup(await createBackup(META, source));
    const read = await readBackup(file);
    expect(read.ok, read.ok ? '' : `refused: ${read.problem}`).toBe(true);
    if (!read.ok) return;

    const target = createMemoryKV();
    expect(await applyBackup(read.prepared, target)).toBe('restored');
    expect(await dump(target, backupKeys())).toEqual(await dump(source, backupKeys()));
  });
});
