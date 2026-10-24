// @vitest-environment node
/**
 * Properties over random play (docs/MAKE_THE_TARGET_RULES.md §2, §5, §10):
 * on generated problems of every tier, a seeded random player taps tiles and
 * operators — legal merges and refused ones alike — and at every step:
 * every number on the board is a whole number of at least 1; the board is
 * the replay of the moves; a save reads back to the same board, moves and
 * status (or is not written, once the problem is solved); Undo walks back
 * through exactly the replays of the shorter move lists; and the board ends
 * after n−1 merges, solved exactly when the last number is the target.
 */
import { describe, expect, it } from 'vitest';
import { replay } from './engine';
import { generateProblem } from './generator';
import { restoreSession, toRecord } from './restore';
import { createRng } from './rng';
import { createSession, freeOrigin, freeSeed, tapOperator, tapTile, undo } from './session';
import { DIFFICULTIES, OPERATORS } from './types';

describe('random play (§2, §5, §10)', () => {
  it('keeps every promise at every step', { timeout: 60_000 }, () => {
    let steps = 0;
    let finished = 0;
    for (const difficulty of DIFFICULTIES) {
      for (let game = 0; game < 60; game++) {
        const seed = freeSeed(difficulty, `prop-${game}`);
        const { problem } = generateProblem(seed, difficulty);
        const rng = createRng(`player-${seed}`);
        let session = createSession(problem, freeOrigin(seed));
        const n = problem.numbers.length;
        for (let tap = 0; tap < 80 && session.status === 'playing'; tap++) {
          if (rng() < 0.6) session = tapTile(session, Math.floor(rng() * n));
          else session = tapOperator(session, OPERATORS[Math.floor(rng() * 4)]!);
          steps++;
          for (const value of session.slots) {
            if (value !== null) expect(Number.isInteger(value) && value >= 1).toBe(true);
          }
          expect(replay(problem.numbers, session.moves)!.slots).toEqual(session.slots);
          const record = toRecord(session, 0);
          if (session.status === 'solved') {
            expect(record).toBeNull();
          } else {
            const back = restoreSession(JSON.parse(JSON.stringify(record)))!;
            expect(back.slots).toEqual(session.slots);
            expect(back.moves).toEqual(session.moves);
            expect(back.status).toBe(session.status);
          }
        }
        if (session.status !== 'playing') {
          finished++;
          expect(session.moves).toHaveLength(n - 1);
          const last = session.slots.find((v) => v !== null);
          expect(session.status).toBe(last === problem.target ? 'solved' : 'missed');
        }
        if (session.status !== 'solved') {
          for (let k = session.moves.length - 1; k >= 0; k--) {
            session = undo(session)!;
            expect(session.slots).toEqual(
              replay(problem.numbers, session.moves.slice(0, k))!.slots,
            );
            expect(session.status).toBe('playing');
          }
          expect(undo(session)).toBeNull();
        }
      }
    }
    console.log(
      `[make-the-target] random play: 180 games, ${steps} taps, ${finished} reached the end`,
    );
    // Deterministic (seeded problems and player), and quoted in §15.
    expect({ steps, finished }).toEqual({ steps: 11_333, finished: 113 });
  });
});
