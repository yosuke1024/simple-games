import { describe, expect, it } from 'vitest';
import { FREE_TIER_LEVEL, generateFreeBoard, generateLevelBoard } from './levels';
import { findHint } from './hint';
import { clearBonusBase, createScore, INITIAL_SCORE } from './score';
import {
  canUndo,
  countHintUse,
  createDailySession,
  createFreeSession,
  createLevelSession,
  freeSeed,
  liveCellCount,
  matchPair,
  newSeedToken,
  performAddNumbers,
  restartSession,
  restoreSession,
  undo,
  type GameSession,
} from './session';
import { liveValues, makeBoard } from './test-helpers';
import { isLive } from './types';

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
    // A fresh game's scoring budget is the board's starting numbers (§12).
    expect(session.score).toEqual(createScore(liveCellCount(session.board)));
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
    expect(restarted.score).toEqual(createScore(liveCellCount(first.board)));
    expect(restarted.moveCount).toBe(0);
  });
});

describe('createFreeSession (§11 フリープレイ)', () => {
  it('builds a board at the tier asked for, with no level and no date', () => {
    const session = createFreeSession('hard');
    expect(session.mode).toBe('free');
    expect(session.freeTier).toBe('hard');
    expect(session.level).toBeNull();
    expect(session.dailyDate).toBeNull();
    expect(session.seed.startsWith('free-')).toBe(true);
    expect(session.status).toBe('playing');
    expect(session.board).toEqual(generateFreeBoard('hard', session.seed));
    expect(session.score).toEqual(createScore(liveCellCount(session.board)));
  });

  it('gives a new board each time, and the same board for the same seed', () => {
    const a = createFreeSession('easy', freeSeed(newSeedToken(1, () => 0.25)));
    const b = createFreeSession('easy', freeSeed(newSeedToken(2, () => 0.5)));
    expect(b.board).not.toEqual(a.board);
    expect(createFreeSession('easy', a.seed).board).toEqual(a.board);
  });

  it('restart rebuilds the identical free board at the same tier', () => {
    const session = createFreeSession('medium');
    const [i, j] = findHint(session.board)!;
    const restarted = restartSession(matchPair(session, i, j)!);
    expect(restarted.seed).toBe(session.seed);
    expect(restarted.freeTier).toBe('medium');
    expect(restarted.board).toEqual(session.board);
    expect(restarted.moveCount).toBe(0);
  });

  it('never collides with a level or a daily seed', () => {
    const token = newSeedToken(1, () => 0);
    expect(freeSeed(token)).not.toMatch(/^level-/);
    expect(freeSeed(token)).not.toMatch(/^daily-/);
  });

  it('scores the clear bonus as the level the tier stands in for (§12)', () => {
    // Two numbers left on a medium board: the clear bonus is level 50's.
    const s0: GameSession = {
      ...createFreeSession('medium'),
      board: makeBoard('19'),
      history: [],
      status: 'playing',
    };
    const s1 = matchPair(s0, 0, 1)!;
    expect(s1.status).toBe('cleared');
    expect(s1.score.clearBonus).toBe(clearBonusBase('level', FREE_TIER_LEVEL.medium));
    expect(s1.score.clearBonus).toBe(900);
  });
});

describe('matchPair', () => {
  it('clears a valid pair, records history, and scores it', () => {
    const s0 = sessionWith(makeBoard('1955'));
    const s1 = matchPair(s0, 0, 1);
    expect(s1).not.toBeNull();
    expect(isLive(s1!.board[0])).toBe(false);
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
      freeTier: null,
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
  const playOut = (start: GameSession) => {
    let session = start;
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
    return session;
  };

  it('a level board can be played to a terminal state using hints and add numbers', () => {
    const session = playOut(createLevelSession(1));
    expect(['cleared', 'gameOver']).toContain(session.status);
    expect(session.score.total).toBeGreaterThan(0);
  });

  it('a board carrying stones and wilds also reaches a terminal state', () => {
    // Level 30 is the first with both. Stones must not be able to strand the
    // game, and an unspent wild must not keep a finished board from clearing.
    const start = createLevelSession(30);
    expect(start.board.some((c) => c?.kind === 'stone')).toBe(true);
    expect(start.board.some((c) => c?.kind === 'wild')).toBe(true);
    const session = playOut(start);
    expect(['cleared', 'gameOver']).toContain(session.status);
    expect(session.score.total).toBeGreaterThan(0);
  });
});
