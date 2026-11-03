import { describe, it, expect } from 'vitest';
import { createSession, act as play, solve } from '../game';
import { restore, toPersisted, gameSchema, statsSchema } from './schemas';
describe('RiverCargo persistence', () => {
  it('replays saved inputs and elapsed time exactly', () => {
    let session = createSession('normal', 123);
    session = play(session, solve(session.mode)![0]!)!;
    session = { ...session, elapsedSeconds: 23 };
    const record = toPersisted(session, 100);
    expect(restore(record)).toEqual(session);
    expect(gameSchema.validate(record)).toEqual(record);
  });
  it('fails closed on wrong versions, modes, inputs and overlong records', () => {
    const record = toPersisted(createSession('easy', 1), 10);
    for (const patch of [
      { schemaVersion: 3 },
      { mode: 'unknown' },
      { puzzleId: 'missing' },
      { puzzleId: 'hard-4' },
      { seed: -1 },
      { elapsedSeconds: Infinity },
      { actions: [null] },
      { actions: Array(513).fill(null) },
    ])
      expect(restore({ ...record, ...patch })).toBeNull();
    expect(gameSchema.validate({ ...record, savedAt: -1 })).toBeNull();
  });
});
it('keeps the three published v1 problems and migrates their best crossings', () => {
  for (const mode of ['easy', 'normal', 'hard'] as const) {
    const first = mode === 'hard' ? 18 : 2;
    const v1 = {
      schemaVersion: 1,
      mode,
      seed: 123,
      actions: [first],
      elapsedSeconds: 23,
      savedAt: 100,
    };
    const s = restore(v1)!;
    expect(s).toMatchObject({
      puzzleId: mode + '-1',
      mask: first,
      boat: 1,
      elapsedSeconds: 23,
      par: mode === 'normal' ? 9 : 7,
    });
    expect(restore(gameSchema.validate(v1))).toEqual(s);
    const stats = { ...statsSchema.defaultValue(), schemaVersion: 1 };
    stats.boards[mode] = { played: 3, completed: 2, best: s.par };
    expect(statsSchema.validate(stats)?.puzzles[mode + '-1']).toEqual(stats.boards[mode]);
  }
});
it('replays each new problem by identity, rather than reverting to its original difficulty', async () => {
  const { CATALOG } = await import('../game');
  for (const p of CATALOG) {
    const s = play(createSession(p.mode, 0, p.id), solve(p)![0]!)!;
    expect(restore(toPersisted(s, 100))).toEqual(s);
  }
});
