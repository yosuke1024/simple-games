import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { createSession, move, undo, encodeMove } from '../game';
import { loadSavedGame, saveGame, clearSavedGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, restore, statsSchema, toPersisted } from './schemas';
function actions(size: number, from = 0, to = 2, via = 1): number[] {
  return size === 0
    ? []
    : [
        ...actions(size - 1, from, via, to),
        encodeMove(from, to),
        ...actions(size - 1, via, to, from),
      ];
}
describe('HanoiTowers isolated persistence', () => {
  it('roundtrips moves, clock and undo history then removes the slot', async () => {
    const kv = createMemoryKV();
    let session = createSession(3, 42);
    session = move(session, encodeMove(0, 1))!;
    session = { ...session, elapsedSeconds: 123 };
    await saveGame(session, kv);
    const restored = await loadSavedGame(kv);
    expect(restored).toEqual(session);
    expect(undo(restored!)).toEqual(undo(session));
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
  it('rejects corruption, impossible history, completed and future records', () => {
    const session = createSession(3, 13);
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
    for (const action of actions(session.size)) finished = move(finished, action)!;
    expect(gameSchema.validate(toPersisted(finished, 100))).toBeNull();
    expect(restore(toPersisted(undo(finished)!, 100))?.cleared).toBe(true);
    expect(gameSchema.validate({ ...record, injected: true })).toEqual(record);
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 1 })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1, size: 'toString' })).toBeNull();
    expect(statsSchema.validate(statsSchema.defaultValue())).toEqual(statsSchema.defaultValue());
  });
  it('roundtrips more than 100,000 legal moves and preserves Undo', async () => {
    const kv = createMemoryKV();
    const opening = createSession(3, 42);
    const next = encodeMove(0, 1);
    const back = encodeMove(1, 0);
    // Every pair returns to the opening. Build the fixture linearly, then take
    // the normal move that previously made a valid saved game unrestorable.
    const history = Array.from({ length: 100_000 }, (_, i) => (i % 2 ? back : next));
    const session = move({ ...opening, history, elapsedSeconds: 123 }, next)!;
    expect(session.history).toHaveLength(100_001);
    await saveGame(session, kv);
    const restored = await loadSavedGame(kv);
    expect(restored).toEqual(session);
    const undone = undo(restored!)!;
    expect(undone).toEqual({ ...opening, history, elapsedSeconds: 123 });
    await saveGame(undone, kv);
    expect(await loadSavedGame(kv)).toEqual(undone);
  });
  it('rejects an illegal action after 100,000 legal moves', async () => {
    const kv = createMemoryKV();
    const next = encodeMove(0, 1);
    const back = encodeMove(1, 0);
    const history = Array.from({ length: 100_000 }, (_, i) => (i % 2 ? back : next));
    // Peg 1 is empty after the complete pairs, so this final action is illegal.
    history.push(back);
    await kv.set(
      gameSchema.key,
      JSON.stringify({ ...toPersisted(createSession(3, 42), 100), history }),
    );
    expect(await loadSavedGame(kv)).toBeNull();
  });
});
