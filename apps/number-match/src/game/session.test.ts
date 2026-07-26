import { describe, expect, it } from 'vitest';
import { generateInitialBoard } from './board';
import {
  canUndo,
  countHintUse,
  createSession,
  matchPair,
  performAddNumbers,
  restoreSession,
  tickSeconds,
  undo,
  type GameSession,
} from './session';
import { makeBoard } from './test-helpers';
import { findHint } from './hint';

/** Builds a playing session around a fixture board. */
function sessionWith(board: ReturnType<typeof makeBoard>): GameSession {
  return { ...createSession('classic', 'fixture'), board, history: [], status: 'playing' };
}

describe('createSession', () => {
  it('creates a deterministic board from the seed', () => {
    const session = createSession('classic', 'seed-x');
    expect(session.board).toEqual(generateInitialBoard('seed-x'));
    expect(session.status).toBe('playing');
    expect(session.moveCount).toBe(0);
    expect(canUndo(session)).toBe(false);
  });

  it('restarting with the same seed reproduces the same board', () => {
    expect(createSession('classic', 'again').board).toEqual(createSession('classic', 'again').board);
  });
});

describe('matchPair', () => {
  it('clears a valid pair and records history', () => {
    const s0 = sessionWith(makeBoard('1955'));
    const s1 = matchPair(s0, 0, 1);
    expect(s1).not.toBeNull();
    expect(s1!.board[0]!.cleared).toBe(true);
    expect(s1!.moveCount).toBe(1);
    expect(canUndo(s1!)).toBe(true);
  });

  it('returns null for an invalid pair without changing anything', () => {
    const s0 = sessionWith(makeBoard('1255'));
    expect(matchPair(s0, 0, 1)).toBeNull();
  });

  it('transitions to cleared when the last pair is removed', () => {
    const s0 = sessionWith(makeBoard('19'));
    const s1 = matchPair(s0, 0, 1);
    expect(s1!.status).toBe('cleared');
    expect(s1!.board.length).toBe(0);
  });
});

describe('undo', () => {
  it('restores the exact previous board', () => {
    const s0 = sessionWith(makeBoard('1955'));
    const s1 = matchPair(s0, 0, 1)!;
    const s2 = undo(s1);
    expect(s2).not.toBeNull();
    expect(s2!.board).toEqual(s0.board);
    expect(s2!.status).toBe('playing');
  });

  it('supports multiple undos back to the initial board', () => {
    const s0 = sessionWith(makeBoard('19285555.'));
    const s1 = matchPair(s0, 0, 1)!;
    const s2 = matchPair(s1, 2, 3)!;
    const s3 = undo(undo(s2)!)!;
    expect(s3.board).toEqual(s0.board);
    expect(canUndo(s3)).toBe(false);
    expect(undo(s3)).toBeNull();
  });

  it('reverts Add Numbers, restoring addCount but not moveCount', () => {
    const s0 = sessionWith(makeBoard('12'));
    const s1 = performAddNumbers(s0)!;
    expect(s1.board.length).toBe(4);
    expect(s1.addCount).toBe(1);
    const s2 = undo(s1)!;
    expect(s2.board).toEqual(s0.board);
    expect(s2.addCount).toBe(0);
    expect(s2.moveCount).toBe(s0.moveCount);
  });

  it('recovers from a cleared state via undo', () => {
    const s0 = sessionWith(makeBoard('19'));
    const s1 = matchPair(s0, 0, 1)!;
    expect(s1.status).toBe('cleared');
    expect(undo(s1)!.status).toBe('playing');
  });

  it('recovers from a game-over state via undo', () => {
    // Synthetic terminal state with a tagged history entry, as produced by a
    // match that dead-ends the board.
    const before = makeBoard('1912');
    const after = makeBoard('..12');
    const s1: GameSession = {
      ...sessionWith(after),
      status: 'gameOver',
      history: [{ board: before, action: 'match' }],
      moveCount: 1,
    };
    const s2 = undo(s1)!;
    expect(s2.board).toEqual(before);
    expect(s2.status).toBe('playing');
    expect(s2.moveCount).toBe(0);
  });
});

describe('performAddNumbers', () => {
  it('appends the remaining numbers and counts the use', () => {
    const s0 = sessionWith(makeBoard('1.2'));
    const s1 = performAddNumbers(s0);
    expect(s1).not.toBeNull();
    expect(s1!.board.length).toBe(5);
    expect(s1!.addCount).toBe(1);
  });

  it('returns null when the game is not playing', () => {
    const s0 = { ...sessionWith(makeBoard('19')), status: 'cleared' as const };
    expect(performAddNumbers(s0)).toBeNull();
  });
});

describe('tickSeconds / counters', () => {
  it('accumulates elapsed time only while playing', () => {
    const s0 = sessionWith(makeBoard('19'));
    expect(tickSeconds(s0, 3).elapsedSeconds).toBe(3);
    const done = { ...s0, status: 'cleared' as const };
    expect(tickSeconds(done, 3).elapsedSeconds).toBe(0);
  });

  it('counts hint usage', () => {
    const s0 = sessionWith(makeBoard('19'));
    expect(countHintUse(s0).hintCount).toBe(1);
  });
});

describe('restoreSession', () => {
  it('recomputes status and starts with empty history', () => {
    const restored = restoreSession({
      mode: 'daily',
      seed: 'daily-2026-07-26',
      dailyDate: '2026-07-26',
      board: makeBoard('19'),
      moveCount: 4,
      addCount: 1,
      hintCount: 2,
      elapsedSeconds: 120,
    });
    expect(restored.status).toBe('playing');
    expect(restored.history).toEqual([]);
    expect(restored.elapsedSeconds).toBe(120);
    expect(canUndo(restored)).toBe(false);
  });
});

describe('full game via hints', () => {
  it('a generated board can be played to a terminal state using hints and add numbers', () => {
    let session = createSession('classic', 'playthrough-seed');
    let guard = 0;
    while (session.status === 'playing' && guard < 5000) {
      guard++;
      const hint = findHint(session.board);
      if (hint) {
        session = matchPair(session, hint[0], hint[1]) ?? session;
      } else {
        const added = performAddNumbers(session);
        if (!added) break;
        session = added;
      }
    }
    expect(guard).toBeLessThan(5000);
    expect(['cleared', 'gameOver']).toContain(session.status);
  });
});
