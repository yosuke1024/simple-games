import { describe, it, expect } from 'vitest';
import { createSession, act as play, findPath } from '../game';
import { restore, toPersisted, gameSchema } from './schemas';
describe('MarbleWeave persistence', () => {
  it('replays saved inputs and elapsed time exactly', () => {
    let session = createSession('normal', 123);
    const from = session.board.findIndex(Boolean);
    const to = session.board.findIndex((n, i) => !n && findPath(session.board, from, i, 9));
    session = play(session, { from, to })!;
    session = { ...session, elapsedSeconds: 23 };
    const record = toPersisted(session, 100);
    expect(restore(record)).toEqual(session);
    expect(gameSchema.validate(record)).toEqual(record);
  });
  it('fails closed on wrong versions, modes, inputs and overlong records', () => {
    const record = toPersisted(createSession('easy', 1), 10);
    for (const patch of [
      { schemaVersion: 2 },
      { mode: 'unknown' },
      { seed: -1 },
      { elapsedSeconds: Infinity },
      { actions: [null] },
      { actions: Array(4097).fill(null) },
    ])
      expect(restore({ ...record, ...patch })).toBeNull();
    expect(gameSchema.validate({ ...record, savedAt: -1 })).toBeNull();
  });
});
