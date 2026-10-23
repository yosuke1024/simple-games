import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { createSession, move, undo, solution, destinations } from '../game';
import { loadSavedGame, saveGame, clearSavedGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, restore, statsSchema, toPersisted } from './schemas';

describe('MazeEscape isolated persistence', () => {
  it('roundtrips moves, clock and undo history then removes the slot', async () => {
    const kv = createMemoryKV();
    let session = createSession(5, 42);
    session = move(session, destinations(session.board, session.size, session.position)[0]!)!;
    session = { ...session, elapsedSeconds: 123 };
    await saveGame(session, kv);
    const restored = await loadSavedGame(kv);
    expect(restored).toEqual(session);
    expect(undo(restored!)).toEqual(undo(session));
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
  it('rejects corruption, impossible history, completed and future records', () => {
    const session = createSession(5, 13);
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
    for (const action of solution(session)) finished = move(finished, action)!;
    expect(gameSchema.validate(toPersisted(finished, 100))).toBeNull();
    expect(restore(toPersisted(undo(finished)!, 100))?.cleared).toBe(true);
    expect(gameSchema.validate({ ...record, injected: true })).toEqual(record);
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 1 })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1, size: 'toString' })).toBeNull();
    expect(statsSchema.validate(statsSchema.defaultValue())).toEqual(statsSchema.defaultValue());
  });
  it('validates a long reversible history with bounded input work', () => {
    const session = createSession(5, 42);
    const next = destinations(session.board, session.size, session.position)[0]!;
    const back = 0;
    const history = Array.from({ length: 20_000 }, (_, i) => (i % 2 ? back : next));
    const record = { ...toPersisted(session, 100), history };
    const start = performance.now();
    const restored = restore(record);
    expect(restored?.board).toEqual(session.board);
    expect(restored?.history).toHaveLength(20_000);
    expect(performance.now() - start).toBeLessThan(1500);
    expect(restore({ ...record, history: Array<number>(100_001).fill(next) })).toBeNull();
  });
});
