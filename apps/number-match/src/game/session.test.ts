import { describe, expect, it } from 'vitest';
import { generateLevelBoard } from './levels';
import { findHint } from './hint';
import { INITIAL_SCORE } from './score';
import {
  canUndo,
  countHintUse,
  createDailySession,
  createLevelSession,
  matchPair,
  performAddNumbers,
  restartSession,
  restoreSession,
  undo,
  type GameSession,
} from './session';
import { liveValues, makeBoard } from './test-helpers';

/** Builds a playing level session around a fixture board. */
function sessionWith(board: ReturnType<typeof makeBoard>): GameSession {
  return { ...createLevelSession(1), board, history: [], status: 'playing' };
}

describe('createLevelSession / createDailySession', () => {
  it('creates the deterministic board for a level', () => {
    const session = createLevelSession(7);
    expect(session.board).toEqual(generateLevelBoard(7));
    expect(session.mode).toBe('level');
    expect(session.level).toBe(7);
    expect(session.seed).toBe('level-7');
    expect(session.status).toBe('playing');
    expect(session.score).toEqual(INITIAL_SCORE);
    expect(canUndo(session)).toBe(false);
  });

  it('creates the daily session from the date', () => {
    const session = createDailySession('2026-07-27');
    expect(session.mode).toBe('daily');
    expect(session.level).toBeNull();
    expect(session.dailyDate).toBe('2026-07-27');
    expect(session.seed).toBe('daily-2026-07-27');
  });

  it('restartSession reproduces the same board and resets score', () => {
    const first = createLevelSession(3);
    const played = matchPair(first, findHint(first.board)![0], findHint(first.board)![1])!;
    const restarted = restartSession(played);
    expect(restarted.board).toEqual(first.board);
    expect(restarted.score).toEqual(INITIAL_SCORE);
    expect(restarted.moveCount).toBe(0);
  });
});

describe('matchPair', () => {
  it('clears a valid pair, records history, and scores it', () => {
    const s0 = sessionWith(makeBoard('1955'));
    const s1 = matchPair(s0, 0, 1);
    expect(s1).not.toBeNull();
    expect(s1!.board[0]!.cleared).toBe(true);
    expect(s1!.moveCount).toBe(1);
    expect(s1!.score.total).toBe(10); // adjacent match, no rows removed
    expect(canUndo(s1!)).toBe(true);
  });

  it('awards the distance bonus for the shortest valid path', () => {
    // Extra live 5 keeps the board uncleared so no clear bonus interferes.
    const s0 = sessionWith(makeBoard('1..95'));
    const s1 = matchPair(s0, 0, 3)!;
    expect(s1.status).toBe('playing');
    expect(s1.score.total).toBe(10 + 3 * 2);
  });

  it('awards the row bonus when a full row disappears', () => {
    const s0 = sessionWith(makeBoard('11.......', '234567892'));
    const s1 = matchPair(s0, 0, 1)!;
    expect(s1.board.length).toBe(9);
    expect(s1.score.rowPoints).toBe(9 * 6);
  });

  it('returns null for an invalid pair without changing anything', () => {
    const s0 = sessionWith(makeBoard('1255'));
    expect(matchPair(s0, 0, 1)).toBeNull();
  });

  it('applies clear and no-hint bonuses when the last pair is removed', () => {
    const s0 = sessionWith(makeBoard('19'));
    const s1 = matchPair(s0, 0, 1)!;
    expect(s1.status).toBe('cleared');
    // match 10 + last row (2 cells) 12 + clear 165 (level 1, 0 adds) = 187 → +18 no-hint
    expect(s1.score.rowPoints).toBe(2 * 6);
    expect(s1.score.clearBonus).toBe(165);
    expect(s1.score.noHintBonus).toBe(18);
    expect(s1.score.total).toBe(10 + 12 + 165 + 18);
  });

  it('skips the no-hint bonus when a hint was used', () => {
    const s0 = countHintUse(sessionWith(makeBoard('19')));
    const s1 = matchPair(s0, 0, 1)!;
    expect(s1.score.noHintBonus).toBe(0);
  });
});

describe('undo', () => {
  it('restores the exact previous board and score (no score farming)', () => {
    const s0 = sessionWith(makeBoard('1955'));
    const s1 = matchPair(s0, 0, 1)!;
    expect(s1.score.total).toBe(10);
    const s2 = undo(s1)!;
    expect(s2.board).toEqual(s0.board);
    expect(s2.score).toEqual(s0.score);
    expect(s2.status).toBe('playing');
    // Redoing the same match earns the same points again — no accumulation.
    const s3 = matchPair(s2, 0, 1)!;
    expect(s3.score.total).toBe(10);
  });

  it('supports multiple undos back to the initial board', () => {
    const s0 = sessionWith(makeBoard('19285555.'));
    const s1 = matchPair(s0, 0, 1)!;
    const s2 = matchPair(s1, 2, 3)!;
    const s3 = undo(undo(s2)!)!;
    expect(s3.board).toEqual(s0.board);
    expect(s3.score).toEqual(s0.score);
    expect(canUndo(s3)).toBe(false);
    expect(undo(s3)).toBeNull();
  });

  it('reverts Add Numbers, restoring addCount, streak, but not moveCount', () => {
    const s0 = sessionWith(makeBoard('12'));
    const s1 = performAddNumbers(s0)!;
    expect(liveValues(s1.board)).toEqual([1, 2, 1, 2]);
    expect(s1.addCount).toBe(1);
    const s2 = undo(s1)!;
    expect(s2.board).toEqual(s0.board);
    expect(s2.addCount).toBe(0);
    expect(s2.moveCount).toBe(s0.moveCount);
    expect(s2.score.streakTenths).toBe(s0.score.streakTenths);
  });

  it('recovers from a cleared state via undo (bonus reverted)', () => {
    const s0 = sessionWith(makeBoard('19'));
    const s1 = matchPair(s0, 0, 1)!;
    expect(s1.status).toBe('cleared');
    const s2 = undo(s1)!;
    expect(s2.status).toBe('playing');
    expect(s2.score.clearBonus).toBe(0);
  });

  it('recovers from a game-over state via undo', () => {
    const before = makeBoard('1912');
    const after = makeBoard('..12');
    const s1: GameSession = {
      ...sessionWith(after),
      status: 'gameOver',
      history: [{ board: before, action: 'match', score: INITIAL_SCORE }],
      moveCount: 1,
    };
    const s2 = undo(s1)!;
    expect(s2.board).toEqual(before);
    expect(s2.status).toBe('playing');
    expect(s2.moveCount).toBe(0);
  });
});

describe('performAddNumbers', () => {
  it('appends the remaining numbers, counts the use, and resets the streak', () => {
    const hot = matchPair(sessionWith(makeBoard('19551.2')), 0, 1)!;
    expect(hot.score.streakTenths).toBe(11);
    const s1 = performAddNumbers(hot);
    expect(s1).not.toBeNull();
    expect(s1!.addCount).toBe(1);
    expect(s1!.score.streakTenths).toBe(10);
    expect(s1!.score.total).toBe(hot.score.total);
  });

  it('returns null when the game is not playing', () => {
    const s0 = { ...sessionWith(makeBoard('19')), status: 'cleared' as const };
    expect(performAddNumbers(s0)).toBeNull();
  });
});

describe('counters', () => {
  it('counts hint usage', () => {
    const s0 = sessionWith(makeBoard('19'));
    expect(countHintUse(s0).hintCount).toBe(1);
  });
});

describe('restoreSession', () => {
  it('recomputes status and starts with empty history, keeping the score', () => {
    const score = { ...INITIAL_SCORE, total: 42, matchPoints: 42, streakTenths: 13 };
    const restored = restoreSession({
      mode: 'level',
      seed: 'level-5',
      dailyDate: null,
      level: 5,
      board: makeBoard('19'),
      score,
      moveCount: 4,
      addCount: 1,
      hintCount: 2,
      elapsedSeconds: 120,
    });
    expect(restored.status).toBe('playing');
    expect(restored.history).toEqual([]);
    expect(restored.score).toEqual(score);
    expect(restored.elapsedSeconds).toBe(120);
    expect(canUndo(restored)).toBe(false);
  });
});

describe('full game via hints', () => {
  it('a level board can be played to a terminal state using hints and add numbers', () => {
    let session = createLevelSession(1);
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
    expect(session.score.total).toBeGreaterThan(0);
  });
});
