/**
 * Captured on 2026-11-04 from the published Web build: pixapps-landing
 * acbab6da (Simple Games 64b934c), copied unchanged to localhost:5199.
 * External requests were blocked with CSP. A separate helper rendered only
 * this test origin's Preferences records; game assets were never modified.
 * UI: complete tutorial, start a game, make a move (Sevens: CPU moves), return
 * Home. Backgammon: opening roll, CPU turn, Home. No result was captured.
 * Strings are verbatim except removal of the CapacitorStorage. key prefix.
 * The current reader intentionally clears transient move feedback (event)
 * to deal/current turn/empty cards on resume; all position fields stay identical.
 * Never regenerate this fixture from the current serializer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { loadSavedGame, saveGame } from './gamePersistence';
import { gameSchema, statsSchema, flagsSchema } from './schemas';
import records from './releasedRecords.json';
afterEach(() => vi.restoreAllMocks());
describe('published Web records at app promotion', () => {
  it('reads every captured record without resetting it', async () => {
    const kv = createMemoryKV(records);
    for (const schema of [gameSchema, statsSchema, flagsSchema]) {
      const expected = JSON.parse(records[schema.key as keyof typeof records]);
      if (schema.key === gameSchema.key)
        expected.session.event = { kind: 'deal', seat: expected.session.turn, cards: [] };
      expect(await loadRecord(schema as typeof gameSchema, kv)).toEqual(expected);
    }
  });
  it('restores the original position and clears only transient move feedback', async () => {
    const kv = createMemoryKV(records);
    const session = await loadSavedGame(kv);
    expect(session).not.toBeNull();
    const original = JSON.parse(records['om.saveGame']);
    vi.spyOn(Date, 'now').mockReturnValue(original.savedAt);
    original.session.event = { kind: 'deal', seat: original.session.turn, cards: [] };
    await saveGame(session!, kv);
    expect(await kv.get('om.saveGame')).toBe(JSON.stringify(original));
  });
});
