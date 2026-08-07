/**
 * Golden test for released behaviour. These literals are what the shipped
 * version does: the same seed, the same moves, the same board. If this file
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
import { encodeBoard } from './serialize';
import { applyCpuTurn, applyPlayerStep, createSession, currentMoves } from './session';
import { PLAYER, initialBoard, type Difficulty } from './types';

const GOLDEN_SEED = 'checkers-golden';

/**
 * A fixed game: the player takes the nth of whatever the rules offer, the CPU
 * answers, and a forced sequence is played out by always taking the first
 * continuation. Nothing here is random — the point is that it stays the same.
 */
function playOut(difficulty: Difficulty, turns: number) {
  let session = createSession(difficulty, PLAYER, GOLDEN_SEED);
  const cpuTrace: string[] = [];
  for (let index = 0; index < turns && session.status === 'playing'; index++) {
    if (session.toMove === PLAYER) {
      let moves = currentMoves(session);
      if (moves.length === 0) break;
      let step = applyPlayerStep(session, moves[index % moves.length]!)!;
      session = step.session;
      while (!step.turnComplete) {
        moves = currentMoves(session);
        step = applyPlayerStep(session, moves[0]!)!;
        session = step.session;
      }
    } else {
      const outcome = applyCpuTurn(session);
      if (outcome === null) break;
      cpuTrace.push(outcome.steps.map((step) => `${step.from}-${step.to}`).join('/'));
      session = outcome.session;
    }
  }
  return { session, cpuTrace };
}

describe('the opening position (released — do not edit to make green)', () => {
  it('encodes exactly as it shipped', () => {
    expect(encodeBoard(initialBoard())).toBe(
      '0202020220202020020202020000000000000000101010100101010110101010',
    );
  });
});

describe('a fixed game (released — do not edit to make green)', () => {
  it('runs the same way on easy', () => {
    const { session, cpuTrace } = playOut('easy', 24);
    expect(encodeBoard(session.board)).toBe(
      '0200020200200020000000020000000000000201002000100101000100100010',
    );
    expect(session.moveCount).toBe(24);
    expect(session.status).toBe('playing');
    expect(cpuTrace).toEqual([
      '21-28',
      '28-42',
      '19-26',
      '12-26',
      '26-44',
      '17-26',
      '8-26',
      '26-35',
      '3-12',
      '12-19',
      '19-37',
      '35-42',
    ]);
  });

  it('runs the same way on normal', () => {
    const { session, cpuTrace } = playOut('normal', 24);
    expect(encodeBoard(session.board)).toBe(
      '0202020200000000000000020000000000000000002000000000010110100010',
    );
    expect(session.moveCount).toBe(24);
    expect(cpuTrace).toEqual([
      '19-26',
      '12-26',
      '21-28',
      '10-28',
      '28-42',
      '17-24',
      '8-26',
      '26-44',
      '14-21',
      '21-35',
      '35-42',
      '24-42',
    ]);
  });

  it('runs the same way on hard', () => {
    const { session, cpuTrace } = playOut('hard', 24);
    expect(encodeBoard(session.board)).toBe(
      '0202020200000000000000000020000000000201100000000000000110101000',
    );
    expect(session.moveCount).toBe(24);
    expect(cpuTrace).toEqual([
      '19-26',
      '10-28',
      '28-46',
      '17-26',
      '21-30',
      '14-28',
      '8-17',
      '17-24',
      '28-37',
      '23-37',
      '24-42',
      '12-26',
    ]);
  });

  it('reads differently at each strength — the difficulty is not decoration', () => {
    const boards = (['easy', 'normal', 'hard'] as const).map((difficulty) =>
      encodeBoard(playOut(difficulty, 24).session.board),
    );
    expect(new Set(boards).size).toBe(3);
  });
});
