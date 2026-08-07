/**
 * Golden test for released behaviour. These literals are what the shipped
 * version does: the same seed, the same stones, the same board. If this file
 * is red, either a migration plan exists and the literals change in the same
 * commit, or a change has quietly altered somebody's saved match.
 *
 * **Fix the implementation, not the test.** Two things rest on the numbers
 * below. A saved game holds a board string, so a change to the encoding
 * strands it (§8). And the CPU is drawn from the seed and the move count, so
 * a change to the search or the evaluation makes a resumed match answer
 * differently from the one that was saved — which is the promise Undo rests
 * on (§4, §5).
 */
import { describe, expect, it } from 'vitest';
import { legalMoves } from './engine';
import { encodeBoard } from './serialize';
import { applyCpuMove, applyPlayerMove, createSession } from './session';
import { BLACK, cellAt, emptyBoard, type Difficulty } from './types';

const SEED = 'gomoku-golden';

/**
 * A fixed game: the player walks a set list of intersections outward from the
 * centre, falling back to the first empty one when the CPU has taken the
 * intersection wanted. Nothing here is random — the point is that it stays
 * the same.
 */
const PLAYER_PLAN = [
  cellAt(7, 7),
  cellAt(6, 6),
  cellAt(8, 8),
  cellAt(6, 8),
  cellAt(8, 6),
  cellAt(5, 7),
  cellAt(9, 7),
  cellAt(7, 5),
  cellAt(7, 9),
  cellAt(5, 5),
  cellAt(9, 9),
  cellAt(4, 7),
];

function playOut(difficulty: Difficulty, turns: number) {
  let session = createSession(difficulty, BLACK, SEED);
  const cpuTrace: number[] = [];
  for (let index = 0; index < turns && session.status === 'playing'; index++) {
    const wanted = PLAYER_PLAN[index % PLAYER_PLAN.length]!;
    const cell = session.board[wanted] === 0 ? wanted : legalMoves(session.board)[0]!;
    const played = applyPlayerMove(session, cell);
    if (played === null) break;
    session = played.session;
    if (session.status !== 'playing') break;
    const answered = applyCpuMove(session);
    if (answered === null) break;
    cpuTrace.push(answered.placed);
    session = answered.session;
  }
  return { session, cpuTrace };
}

describe('the empty board (released — do not edit to make green)', () => {
  it('encodes as 225 zeroes', () => {
    expect(encodeBoard(emptyBoard())).toBe('0'.repeat(225));
  });
});

describe('a fixed game (released — do not edit to make green)', () => {
  it('runs the same way on easy', () => {
    const { session, cpuTrace } = playOut('easy', 12);
    expect(session.moveCount).toBe(24);
    expect(session.status).toBe('playing');
    expect(cpuTrace).toEqual([97, 110, 111, 126, 83, 84, 129, 2, 144, 81, 157, 85]);
  });

  it('runs the same way on normal', () => {
    const { session, cpuTrace } = playOut('normal', 12);
    expect(session.moveCount).toBe(10);
    expect(session.status).toBe('lost');
    expect(cpuTrace).toEqual([140, 125, 80, 110, 95]);
  });

  it('runs the same way on hard', () => {
    const { session, cpuTrace } = playOut('hard', 12);
    expect(session.moveCount).toBe(10);
    expect(session.status).toBe('lost');
    expect(cpuTrace).toEqual([126, 128, 127, 129, 130]);
    // The five it built, on row 8 — five consecutive intersections.
    expect(session.winningLine).toEqual([126, 127, 128, 129, 130]);
  });

  it('reads harder as the difficulty rises', () => {
    // Easy never finishes this game; the two that read do, and quickly.
    expect(playOut('easy', 12).session.status).toBe('playing');
    expect(playOut('normal', 12).session.status).toBe('lost');
    expect(playOut('hard', 12).session.status).toBe('lost');
  });
});
