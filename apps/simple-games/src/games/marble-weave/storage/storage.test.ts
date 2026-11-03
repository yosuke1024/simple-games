import { describe, it, expect } from 'vitest';
import { createSession, act as play, findPath } from '../game';
import { restore, toPersisted, gameSchema, statsSchema } from './schemas';
describe('MarbleWeave persistence', () => {
  it('replays saved inputs and elapsed time exactly', () => {
    let session = createSession('normal', 123);
    const from = session.board.findIndex(Boolean);
    const to = session.board.findIndex(
      (n, i) => !n && findPath(session.board, from, i, session.size),
    );
    session = play(session, { from, to })!;
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
      { actions: Array(4097).fill(null) },
    ])
      expect(restore({ ...record, ...patch })).toBeNull();
    expect(gameSchema.validate({ ...record, savedAt: -1 })).toBeNull();
  });
});
it('keeps the published v1 board, preview and random state when upgrading a save', () => {
  const v1 = {
    schemaVersion: 1,
    mode: 'normal',
    seed: 123,
    actions: [{ from: 18, to: 0 }],
    elapsedSeconds: 23,
    savedAt: 100,
  };
  const s = restore(v1)!;
  expect(s).toMatchObject({
    rulesVersion: 1,
    puzzleId: null,
    size: 9,
    target: 5,
    rng: 1575801148,
    next: [2, 4, 6],
    score: 0,
    elapsedSeconds: 23,
  });
  expect(s.board).toEqual([
    5, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 5,
  ]);
  expect(restore(gameSchema.validate(v1))).toEqual(s);
});
it('preserves old score records without treating them as puzzle move records', () => {
  const v1 = { ...statsSchema.defaultValue(), schemaVersion: 1 };
  v1.boards.normal = { played: 3, completed: 2, best: 420 };
  expect(statsSchema.validate(v1)).toMatchObject({
    schemaVersion: 2,
    puzzles: {},
    boards: v1.boards,
  });
});
it('restores an exhausted puzzle so undo can recover the attempt', () => {
  let s = createSession('easy', 0, 'easy-1');
  const from = s.board.findIndex(Boolean),
    to = s.board.findIndex((n, i) => !n && findPath(s.board, from, i, s.size));
  s = play(s, { from, to })!;
  s = play(s, { from: to, to: from })!;
  expect(restore(toPersisted(s, 100))).toEqual(s);
});
