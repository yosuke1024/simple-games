import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { act, createSession, start } from '../game';
import { clearSavedGame, loadSavedGame, saveGame, toPersisted } from './gamePersistence';
import { flagsSchema, gameSchema, statsSchema } from './schemas';
describe('Falling Blocks persistence', () => {
  it('round-trips a live run into a paused exact board and independent store', async () => {
    const kv = createMemoryKV();
    let run = start(createSession(42));
    run = act(act(run, 'left'), 'hardDrop');
    run = { ...act(run, 'rotate'), elapsedSeconds: 19 };
    await saveGame(run, kv);
    expect(await loadSavedGame(kv)).toEqual({ ...run, status: 'paused' });
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
  it('rejects malformed, overlapping, impossible and ended snapshots', () => {
    const run = act(start(createSession(42)), 'hardDrop');
    const record = toPersisted(run, 123)!;
    expect(gameSchema.validate(record)).not.toBeNull();
    for (const value of [
      null,
      {},
      { ...record, schemaVersion: 9 },
      { ...record, board: [] },
      { ...record, pieceIndex: 100 },
      { ...record, status: 'over' },
      { ...record, active: { ...record.active, rotation: 99 } },
      { ...record, active: { ...record.active, kind: 'Q' } },
      { ...record, score: NaN },
      { ...record, elapsedSeconds: -1 },
    ])
      expect(gameSchema.validate(value)).toBeNull();
    const overlap = [...record.board];
    overlap[record.active.y * 10 + record.active.x] = 1;
    expect(gameSchema.validate({ ...record, board: overlap })).toBeNull();
  });
  it('does not overwrite a resumable game with an ended one', async () => {
    const kv = createMemoryKV(),
      run = createSession(3);
    await saveGame(run, kv);
    await saveGame({ ...run, status: 'over' }, kv);
    expect(await loadSavedGame(kv)).toEqual(run);
  });
  it('keeps schemas isolated and refuses invalid counters', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(statsSchema.validate({ ...statsSchema.defaultValue(), linesCleared: -1 })).toBeNull();
    expect(statsSchema.validate(statsSchema.defaultValue())).toEqual(statsSchema.defaultValue());
    expect([gameSchema.key, statsSchema.key, flagsSchema.key]).toEqual([
      'fb.saveGame',
      'fb.stats',
      'fb.flags',
    ]);
  });
});
