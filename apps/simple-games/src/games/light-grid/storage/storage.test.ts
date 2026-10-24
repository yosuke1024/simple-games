import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { createSession, move, undo, solution } from '../game';
import { loadSavedGame, saveGame, clearSavedGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, restore, statsSchema, toPersisted } from './schemas';
describe('LightGrid isolated persistence', () => {
  it('roundtrips moves, clock and undo history then removes the slot', async () => {
    const kv = createMemoryKV();
    let session = createSession(3, 42);
    session = move(session, solution(session.board, session.size)![0]!)!;
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
    while (finished.status === 'playing') {
      const session = finished;
      finished = move(finished, solution(session.board, session.size)![0]!)!;
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

it('validates a long reversible history in linear work and caps hostile input', () => {
  const session = createSession(5, 42);
  // This opening is not one toggle away from solved, so every 0,0 pair is legal.
  const history = Array<number>(20_000).fill(0);
  const record = { ...toPersisted(session, 100), history };
  const start = performance.now();
  const restored = restore(record);
  expect(restored?.board).toEqual(session.board);
  expect(restored?.history).toHaveLength(20_000);
  expect(performance.now() - start).toBeLessThan(1500);
  expect(restore({ ...record, history: Array<number>(100_001).fill(0) })).toBeNull();
});
