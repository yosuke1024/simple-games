import { describe, expect, it } from 'vitest';
import { createSession } from '../game';
import { clearSavedGame, loadSavedGame, saveGame } from './gamePersistence';
import { createMemoryKV } from './kv';
import { clearAllLocalData, loadRecord, saveRecord } from './repo';
import {
  adStateSchema,
  flagsSchema,
  gameSchema,
  rcCacheSchema,
  settingsSchema,
  statsSchema,
  STORAGE_KEYS,
} from './schemas';

describe('loadRecord', () => {
  it('returns defaults when nothing is stored', async () => {
    const kv = createMemoryKV();
    const settings = await loadRecord(settingsSchema, kv);
    expect(settings).toEqual(settingsSchema.defaultValue());
  });

  it('returns defaults for corrupt JSON without crashing', async () => {
    const kv = createMemoryKV({ [STORAGE_KEYS.settings]: '{not json!!' });
    const settings = await loadRecord(settingsSchema, kv);
    expect(settings).toEqual(settingsSchema.defaultValue());
  });

  it('returns defaults for an unknown schemaVersion (every schema)', async () => {
    const schemas: import('./schemas').SchemaDef<unknown>[] = [
      settingsSchema,
      statsSchema,
      flagsSchema,
      adStateSchema,
      rcCacheSchema,
    ];
    for (const schema of schemas) {
      const kv = createMemoryKV({ [schema.key]: JSON.stringify({ schemaVersion: 99 }) });
      expect(await loadRecord(schema, kv)).toEqual(schema.defaultValue());
    }
    // The saved game falls back to null → no resume, never a crash.
    const kv = createMemoryKV({ [STORAGE_KEYS.game]: JSON.stringify({ schemaVersion: 99 }) });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
  });

  it('returns defaults for structurally invalid data', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.stats]: JSON.stringify({ schemaVersion: 1, classic: { played: 'many' } }),
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it('round-trips valid records', async () => {
    const kv = createMemoryKV();
    const settings = { ...settingsSchema.defaultValue(), theme: 'dark' as const, sound: false };
    await saveRecord(settingsSchema, settings, kv);
    expect(await loadRecord(settingsSchema, kv)).toEqual(settings);

    const stats = statsSchema.defaultValue();
    stats.classic.played = 3;
    stats.daily.streak = 2;
    stats.daily.lastCompletedDate = '2026-07-26';
    await saveRecord(statsSchema, stats, kv);
    expect(await loadRecord(statsSchema, kv)).toEqual(stats);

    const adState = { ...adStateSchema.defaultValue(), sessionCount: 5, lastInterstitialAt: 123 };
    await saveRecord(adStateSchema, adState, kv);
    expect(await loadRecord(adStateSchema, kv)).toEqual(adState);

    const rc = { ...rcCacheSchema.defaultValue(), values: { interstitial_enabled: false }, fetchedAt: 42 };
    await saveRecord(rcCacheSchema, rc, kv);
    expect(await loadRecord(rcCacheSchema, kv)).toEqual(rc);

    const flags = { ...flagsSchema.defaultValue(), tutorialCompleted: true };
    await saveRecord(flagsSchema, flags, kv);
    expect(await loadRecord(flagsSchema, kv)).toEqual(flags);
  });

  it('drops unknown-typed values from the rc cache instead of failing', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.rcCache]: JSON.stringify({
        schemaVersion: 1,
        values: { good: 1, alsoGood: true, bad: 'string', worse: { nested: 1 } },
        fetchedAt: null,
      }),
    });
    const rc = await loadRecord(rcCacheSchema, kv);
    expect(rc.values).toEqual({ good: 1, alsoGood: true });
  });
});

describe('saved game persistence', () => {
  it('round-trips a playing session (without undo history)', async () => {
    const kv = createMemoryKV();
    const session = createSession('classic', 'persist-seed');
    await saveGame(session, kv);
    const loaded = await loadSavedGame(kv);
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe('persist-seed');
    expect(loaded!.board).toEqual(session.board);
    expect(loaded!.history).toEqual([]);
    expect(loaded!.status).toBe('playing');
  });

  it('returns null for corrupt board data', async () => {
    const kv = createMemoryKV();
    const session = createSession('classic', 'persist-seed');
    await saveGame(session, kv);
    const raw = JSON.parse((await kv.get(STORAGE_KEYS.game))!) as Record<string, unknown>;
    raw.values = '99x99';
    raw.mask = '000';
    await kv.set(STORAGE_KEYS.game, JSON.stringify(raw));
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('requires dailyDate for daily games', async () => {
    const kv = createMemoryKV();
    const session = createSession('classic', 'persist-seed');
    await saveGame(session, kv);
    const raw = JSON.parse((await kv.get(STORAGE_KEYS.game))!) as Record<string, unknown>;
    raw.mode = 'daily';
    raw.dailyDate = null;
    await kv.set(STORAGE_KEYS.game, JSON.stringify(raw));
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('does not resume a game that is no longer playable (terminal board)', async () => {
    const kv = createMemoryKV();
    const session = createSession('classic', 'persist-seed');
    // All cells cleared → status would be 'cleared', not 'playing'.
    await saveGame({ ...session, board: session.board.map((c) => ({ ...c, cleared: true })) }, kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('rejects boards larger than the maximum board size', async () => {
    const kv = createMemoryKV();
    await saveGame(createSession('classic', 'persist-seed'), kv);
    const raw = JSON.parse((await kv.get(STORAGE_KEYS.game))!) as Record<string, unknown>;
    raw.values = '1'.repeat(271);
    raw.mask = '0'.repeat(271);
    await kv.set(STORAGE_KEYS.game, JSON.stringify(raw));
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('clearSavedGame removes the stored game', async () => {
    const kv = createMemoryKV();
    await saveGame(createSession('classic', 's'), kv);
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
    expect(await loadRecord(gameSchema, kv)).toBeNull();
  });
});

describe('clearAllLocalData', () => {
  it('wipes every stored record', async () => {
    const kv = createMemoryKV();
    await saveRecord(settingsSchema, settingsSchema.defaultValue(), kv);
    await saveGame(createSession('classic', 's'), kv);
    await clearAllLocalData(kv);
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(await kv.get(key)).toBeNull();
    }
  });
});
