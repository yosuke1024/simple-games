/**
 * Captured on 2026-11-04 from the published Web build: pixapps-landing
 * acbab6da (Simple Games 64b934c), copied unchanged to localhost:5199.
 * External requests were blocked with CSP. A separate helper rendered only
 * this test origin's Preferences records; game assets were never modified.
 * UI: complete tutorial, start a game, make a move (Sevens: CPU moves), return
 * Home. Backgammon: opening roll, CPU turn, Home. No result was captured.
 * Strings are verbatim except removal of the CapacitorStorage. key prefix.
 * Never regenerate this fixture from the current serializer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { loadSavedGame, saveGame } from './gamePersistence';
import { gameSchema, statsSchema, prefsSchema, flagsSchema } from './schemas';
import records from './releasedRecords.json';
afterEach(() => vi.restoreAllMocks());
describe('published Web records at app promotion', () => {
  it('reads every captured record without resetting it', async () => {
    const kv = createMemoryKV(records);
    for (const schema of [gameSchema, statsSchema, prefsSchema, flagsSchema]) {
      expect(await loadRecord(schema as typeof gameSchema, kv)).toEqual(
        JSON.parse(records[schema.key as keyof typeof records]),
      );
    }
  });
  it('restores the unfinished game and writes its record byte for byte', async () => {
    const kv = createMemoryKV(records);
    const session = await loadSavedGame(kv);
    expect(session).not.toBeNull();
    const original = JSON.parse(records['fs.saveGame']);
    vi.spyOn(Date, 'now').mockReturnValue(original.savedAt);
    await saveGame(session!, kv);
    expect(await kv.get('fs.saveGame')).toBe(records['fs.saveGame']);
  });
});
