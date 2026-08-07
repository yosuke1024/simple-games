import { describe, expect, it } from 'vitest';
import { dailySeed } from './daily';
import { dealBoard } from './deal';
import { dealsLeft } from './engine';
import {
  canUndo,
  createDailySession,
  createFreeSession,
  doDeal,
  doMoveRun,
  freeSeed,
  isStuck,
  newSeedToken,
  recordHint,
  restartSession,
  restoreSession,
  undo,
} from './session';
import { COLUMNS, RANKS, type Card, type Pile, type SuitCount } from './types';

const card = (copy: number, rank: number): Card => copy * RANKS + (rank - 1);

describe('creating sessions', () => {
  it('pins the deal to the seed and the difficulty to the session', () => {
    const session = createFreeSession(2, freeSeed('a'));
    expect(session.board).toEqual(dealBoard('ss-free-a', 2));
    expect(session.suitCount).toBe(2);
    expect(createFreeSession(1).seed).not.toBe(createFreeSession(1).seed);
    expect(newSeedToken(1, () => 0)).toBe('1-0');
  });

  it('derives the daily from the date, and inherits the current difficulty', () => {
    const easy = createDailySession('2026-08-07', 1);
    const hard = createDailySession('2026-08-07', 4);
    expect(easy.seed).toBe(dailySeed('2026-08-07'));
    expect(hard.seed).toBe(easy.seed);
    expect(easy.suitCount).toBe(1);
    expect(hard.suitCount).toBe(4);
    // Same date, same cards in the same places — only the suits differ.
    expect(hard.board.tableau).toEqual(easy.board.tableau);
  });

  it('starts at zero, playing, with nothing to undo', () => {
    const session = createFreeSession(4, freeSeed('start'));
    expect(session.moveCount).toBe(0);
    expect(session.hintCount).toBe(0);
    expect(session.status).toBe('playing');
    expect(canUndo(session)).toBe(false);
    expect(undo(session)).toBeNull();
    expect(dealsLeft(session.board)).toBe(5);
  });
});

describe('moves and counting (§4)', () => {
  it('counts a dealt row as one move', () => {
    const dealt = doDeal(createFreeSession(1, freeSeed('deal')))!;
    expect(dealt.moveCount).toBe(1);
    expect(dealsLeft(dealt.board)).toBe(4);
  });

  it('returns null for an illegal move and leaves the session untouched', () => {
    const session = createFreeSession(4, freeSeed('illegal'));
    expect(doMoveRun(session, 0, 0, 0)).toBeNull(); // same column
    expect(doMoveRun(session, 0, 9, 1)).toBeNull(); // index past the end
    expect(session.moveCount).toBe(0);
  });

  it('books a hint without touching the board', () => {
    const session = createFreeSession(1, freeSeed('hint'));
    const asked = recordHint(session);
    expect(asked.hintCount).toBe(1);
    expect(asked.board).toEqual(session.board);
    expect(asked.moveCount).toBe(0);
  });
});

describe('undo (§8)', () => {
  it('takes back a dealt row whole — ten cards, one step', () => {
    const start = createFreeSession(1, freeSeed('undo-deal'));
    const dealt = doDeal(start)!;
    const back = undo(dealt)!;
    expect(back.board).toEqual(start.board);
    expect(back.moveCount).toBe(0);
    expect(canUndo(back)).toBe(false);
  });

  /**
   * A move can drag a finished run off the table with it. Undo puts the board
   * back as it was, so the run comes back too — the history holds whole
   * boards, not descriptions of moves.
   */
  it('brings a completed run back with the move that finished it', () => {
    const kingToTwo = Array.from({ length: 12 }, (_, i) => card(0, RANKS - i));
    const session = {
      ...createFreeSession(4, freeSeed('harvest')),
      board: {
        suitCount: 4 as SuitCount,
        stock: [],
        completed: [],
        tableau: Array.from({ length: COLUMNS }, (_, i): Pile => {
          if (i === 0) return { down: [], up: kingToTwo };
          if (i === 1) return { down: [], up: [card(0, 1)] };
          return { down: [], up: [] };
        }),
      },
    };
    const finished = doMoveRun(session, 1, 0, 0)!;
    expect(finished.board.completed).toHaveLength(1);
    expect(finished.moveCount).toBe(1);

    const back = undo(finished)!;
    expect(back.board.completed).toHaveLength(0);
    expect(back.board.tableau[0]!.up).toEqual(kingToTwo);
    expect(back.board.tableau[1]!.up).toEqual([card(0, 1)]);
    expect(back.moveCount).toBe(0);
  });
});

describe('restart and restore (§5, §10)', () => {
  it('restart deals the same cards at the same difficulty', () => {
    const start = createFreeSession(2, freeSeed('restart'));
    const again = restartSession(doDeal(start)!);
    expect(again.board).toEqual(start.board);
    expect(again.suitCount).toBe(2);
    expect(again.moveCount).toBe(0);
    expect(canUndo(again)).toBe(false);
  });

  it('restart keeps a daily on its own date and difficulty', () => {
    const daily = createDailySession('2026-01-02', 4);
    const again = restartSession(doDeal(daily)!);
    expect(again.mode).toBe('daily');
    expect(again.dailyDate).toBe('2026-01-02');
    expect(again.suitCount).toBe(4);
  });

  it('restore keeps the position and the counts, and drops the history', () => {
    const played = doDeal(createFreeSession(1, freeSeed('restore')))!;
    const restored = restoreSession({
      mode: played.mode,
      seed: played.seed,
      suitCount: played.suitCount,
      dailyDate: played.dailyDate,
      board: played.board,
      moveCount: played.moveCount,
      hintCount: 3,
      elapsedSeconds: 42,
    });
    expect(restored.board).toEqual(played.board);
    expect(restored.moveCount).toBe(1);
    expect(restored.hintCount).toBe(3);
    expect(restored.elapsedSeconds).toBe(42);
    expect(restored.status).toBe('playing');
    expect(canUndo(restored)).toBe(false);
  });
});

describe('the dead end (§2)', () => {
  it('is not reported on a fresh deal', () => {
    expect(isStuck(createFreeSession(4, freeSeed('fresh')))).toBe(false);
  });

  it('is reported when the stock is spent and nothing fits', () => {
    const session = {
      ...createFreeSession(4, freeSeed('dead')),
      board: {
        suitCount: 4 as SuitCount,
        stock: [],
        completed: [],
        tableau: Array.from({ length: COLUMNS }, (_, i): Pile => ({
          down: [],
          up: [card(i % 8, RANKS)],
        })),
      },
    };
    expect(isStuck(session)).toBe(true);
  });
});
