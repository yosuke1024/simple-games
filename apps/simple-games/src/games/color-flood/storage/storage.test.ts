import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { createSession, move, undo, availableColours } from '../game';
import { loadSavedGame, saveGame, clearSavedGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, restore, statsSchema, toPersisted } from './schemas';
describe('ColorFlood isolated persistence', () => {
  it('roundtrips moves, clock and undo history then removes the slot', async () => {
    const kv = createMemoryKV();
    let session = createSession(6, 42);
    session = move(session, availableColours(session.board, session.size)[0]!)!;
    if (session.status === 'over') session = undo(session)!;
    session = { ...session, elapsedSeconds: 123 };
    await saveGame(session, kv);
    const restored = await loadSavedGame(kv);
    expect(restored).toEqual(session);
    if (session.history.length) expect(undo(restored!)).toEqual(undo(session));
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
  it('rejects corruption, impossible history, completed and future records', () => {
    const session = createSession(6, 13);
    const record = toPersisted(session, 100);
    for (const bad of [
      null,
      [],
      {},
      { ...record, schemaVersion: 2 },
      { ...record, seed: -1 },
      { ...record, size: 99 },
      { ...record, savedAt: NaN },
      { ...record, cleared: 'yes' },
      { ...record, elapsedSeconds: -1 },
      { ...record, history: [999] },
      { ...record, history: [0.5] },
    ])
      expect(gameSchema.validate(bad)).toBeNull();
    let finished = session;
    while (finished.status === 'playing') {
      const session = finished;
      finished = move(finished, availableColours(session.board, session.size)[0]!)!;
    }
    expect(gameSchema.validate(toPersisted(finished, 100))).toBeNull();
    const resumed = undo(finished)!;
    expect(restore(toPersisted(resumed, 100))?.cleared).toBe(true);
    expect(gameSchema.validate({ ...record, injected: true })).toEqual(record);
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 1 })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1, size: 'toString' })).toBeNull();
    expect(statsSchema.validate(statsSchema.defaultValue())).toEqual(statsSchema.defaultValue());
  });
});
