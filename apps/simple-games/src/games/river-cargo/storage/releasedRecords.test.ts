/**
 * Captured on 2026-11-07 from the published Web build at pixapps.ai
 * (pixapps-landing d424ea94, Simple Games 37289e8) in the app's browser pane.
 * Only this origin's rg.* Preferences records were read; nothing was modified.
 * UI: River Cargo: complete tutorial, load the goat, cross once, return Home.
 * No result was captured. Strings are verbatim except removal of the
 * CapacitorStorage. key prefix. Never regenerate this fixture from the current
 * serializer.
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
    const original = JSON.parse(records['rg.saveGame']);
    vi.spyOn(Date, 'now').mockReturnValue(original.savedAt);
    await saveGame(session!, kv);
    expect(await kv.get('rg.saveGame')).toBe(records['rg.saveGame']);
  });
});
