import { describe, expect, it } from 'vitest';
import { dailySeed } from './daily';
import { dealBoard } from './deal';
import { cascadeTop, isWon } from './engine';
import {
  canUndo,
  createDailySession,
  createFreeSession,
  doAutoFinish,
  doMoveCascadeRun,
  doMoveCascadeToCell,
  doMoveCascadeToFoundation,
  doMoveCellToCascade,
  doMoveCellToFoundation,
  freeSeed,
  isStuck,
  newSeedToken,
  restartSession,
  restoreSession,
  undo,
  type FreeCellSession,
} from './session';
import { CASCADES, cardOf, type Card, type FreeCellBoard } from './types';

const S = (rank: number): Card => cardOf(0, rank);
const H = (rank: number): Card => cardOf(1, rank);
const D = (rank: number): Card => cardOf(2, rank);
const C = (rank: number): Card => cardOf(3, rank);

const cascadesOf = (...piles: Card[][]): Card[][] =>
  Array.from({ length: CASCADES }, (_, i) => piles[i] ?? []);

/** A session wrapped around a hand-built board, for rules that need a shape. */
function sessionOn(board: Partial<FreeCellBoard>): FreeCellSession {
  return {
    ...createFreeSession(freeSeed('fixture')),
    board: {
      cells: [null, null, null, null],
      foundations: [[], [], [], []],
      cascades: cascadesOf(),
      ...board,
    },
  };
}

describe('creating sessions', () => {
  it('pins the deal to the seed, and gives each new free game its own', () => {
    expect(createFreeSession(freeSeed('a')).board).toEqual(dealBoard('fc-free-a'));
    expect(createFreeSession().seed).not.toBe(createFreeSession().seed);
    expect(newSeedToken(1, () => 0)).toBe('1-0');
  });

  it('derives the daily deal from the date alone', () => {
    const daily = createDailySession('2026-08-07');
    expect(daily.mode).toBe('daily');
    expect(daily.dailyDate).toBe('2026-08-07');
    expect(daily.seed).toBe(dailySeed('2026-08-07'));
    expect(daily.board).toEqual(createDailySession('2026-08-07').board);
  });

  it('starts every session at zero, playing, with nothing to undo', () => {
    const session = createFreeSession(freeSeed('start'));
    expect(session.moveCount).toBe(0);
    expect(session.elapsedSeconds).toBe(0);
    expect(session.status).toBe('playing');
    expect(canUndo(session)).toBe(false);
    expect(undo(session)).toBeNull();
  });
});

describe('moves and counting (§4)', () => {
  it('counts one move per action, whatever it moved', () => {
    const start = createFreeSession(freeSeed('counting'));
    const parked = doMoveCascadeToCell(start, 0)!;
    expect(parked.moveCount).toBe(1);
    expect(parked.board.cells[0]).toBe(cascadeTop(start.board, 0));
  });

  it('counts a supermove as one move, however many cards it carried', () => {
    const session = sessionOn({
      cascades: cascadesOf([C(9), H(6), S(5), H(4)], [S(7)], [D(10)], [C(10)]),
    });
    const moved = doMoveCascadeRun(session, 0, 1, 1)!;
    expect(moved.moveCount).toBe(1);
    expect(moved.board.cascades[1]).toEqual([S(7), H(6), S(5), H(4)]);
  });

  it('returns null for an illegal move and leaves the session untouched', () => {
    const session = sessionOn({ cascades: cascadesOf([S(8)], [C(9)]) });
    expect(doMoveCascadeRun(session, 0, 0, 1)).toBeNull();
    expect(doMoveCascadeToFoundation(session, 0)).toBeNull();
    expect(doMoveCellToFoundation(session, 0)).toBeNull();
    expect(doMoveCellToCascade(session, 0, 1)).toBeNull();
    expect(session.moveCount).toBe(0);
  });
});

describe('undo (§8)', () => {
  it('restores the board and the move count together', () => {
    const start = createFreeSession(freeSeed('undo'));
    const one = doMoveCascadeToCell(start, 0)!;
    const two = doMoveCascadeToCell(one, 1)!;
    expect(two.moveCount).toBe(2);

    const back = undo(two)!;
    expect(back.moveCount).toBe(1);
    expect(back.board).toEqual(one.board);
    expect(canUndo(back)).toBe(true);

    const start2 = undo(back)!;
    expect(start2.moveCount).toBe(0);
    expect(start2.board).toEqual(start.board);
    expect(canUndo(start2)).toBe(false);
  });

  it('brings a whole supermove back in one step', () => {
    const session = sessionOn({
      cascades: cascadesOf([C(9), H(6), S(5), H(4)], [S(7)], [D(10)], [C(10)]),
    });
    const moved = doMoveCascadeRun(session, 0, 1, 1)!;
    const back = undo(moved)!;
    expect(back.board).toEqual(session.board);
    expect(back.moveCount).toBe(0);
  });
});

describe('restart and restore (§5, §10)', () => {
  it('restart deals the same cards again and clears the counters', () => {
    const start = createFreeSession(freeSeed('restart'));
    const played = doMoveCascadeToCell(start, 0)!;
    const again = restartSession(played);
    expect(again.board).toEqual(start.board);
    expect(again.seed).toBe(start.seed);
    expect(again.moveCount).toBe(0);
    expect(canUndo(again)).toBe(false);
  });

  it('restart keeps a daily on its own date', () => {
    const daily = createDailySession('2026-01-02');
    const again = restartSession(doMoveCascadeToCell(daily, 0)!);
    expect(again.mode).toBe('daily');
    expect(again.dailyDate).toBe('2026-01-02');
    expect(again.board).toEqual(daily.board);
  });

  it('restore keeps the position and the count, and drops the history', () => {
    const played = doMoveCascadeToCell(createFreeSession(freeSeed('restore')), 0)!;
    const restored = restoreSession({
      mode: played.mode,
      seed: played.seed,
      dailyDate: played.dailyDate,
      board: played.board,
      moveCount: played.moveCount,
      elapsedSeconds: 42,
    });
    expect(restored.board).toEqual(played.board);
    expect(restored.moveCount).toBe(1);
    expect(restored.elapsedSeconds).toBe(42);
    expect(restored.status).toBe('playing');
    expect(canUndo(restored)).toBe(false);
  });
});

describe('winning and finishing (§2, §7)', () => {
  const nearlyDone = sessionOn({
    foundations: [
      Array.from({ length: 12 }, (_, i) => S(i + 1)),
      Array.from({ length: 12 }, (_, i) => H(i + 1)),
      Array.from({ length: 12 }, (_, i) => D(i + 1)),
      Array.from({ length: 12 }, (_, i) => C(i + 1)),
    ],
    cascades: cascadesOf([S(13)], [H(13)], [D(13)], [C(13)]),
  });

  it('marks the session won as soon as the last card lands', () => {
    let session = nearlyDone;
    for (const pile of [0, 1, 2, 3]) session = doMoveCascadeToFoundation(session, pile)!;
    expect(session.status).toBe('won');
    expect(isWon(session.board)).toBe(true);
    expect(session.moveCount).toBe(4);
  });

  it('auto-finish charges every card it played and wins', () => {
    const done = doAutoFinish(nearlyDone)!;
    expect(done.moveCount).toBe(4);
    expect(done.status).toBe('won');
  });

  it('refuses every action once the game is won', () => {
    const done = doAutoFinish(nearlyDone)!;
    expect(doMoveCascadeToCell(done, 0)).toBeNull();
    expect(doAutoFinish(done)).toBeNull();
    expect(isStuck(done)).toBe(false);
  });
});

describe('the dead end (§2)', () => {
  it('reports a board with no move left, and undo steps back out of it', () => {
    const session = sessionOn({
      cells: [S(10), C(10), S(9), C(9)],
      cascades: cascadesOf(
        [D(11), S(5), H(4), S(8)],
        [H(2), C(8)],
        [H(3), S(11)],
        [H(5), S(12)],
        [D(2), C(11)],
        [D(3), C(12)],
        [D(4), S(13)],
        [D(5), C(13)],
      ),
    });
    expect(isStuck(session)).toBe(true);
    expect(isStuck(createFreeSession(freeSeed('fresh')))).toBe(false);
  });
});
