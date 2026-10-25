import { describe, expect, it } from 'vitest';
import { legalMovesOf } from '@/games/reversi/game/engine';
import { legalMoves } from '@/games/checkers/game/engine';
import type { Board as CheckersBoard } from '@/games/checkers/game/types';
import type { GameAdapter, Seat } from '../gameTypes';
import { adapter as four, type ConnectFourView } from './connect-four';
import { adapter as gomoku, type GomokuView } from './gomoku';
import { adapter as reversi, type ReversiView } from './reversi';
import { adapter as checkers, type CheckersView } from './checkers';
const noRandom = () => {
  throw new Error('Public boards need no randomness');
};
function play(adapter: GameAdapter, state: unknown, action: unknown) {
  const next = adapter.apply(state, adapter.turn(state), action, noRandom);
  expect(next).not.toBeNull();
  for (const seat of [0, 1] as const)
    expect(adapter.isView(adapter.project(next, seat))).toBe(true);
  return next;
}

describe('public board adapters', () => {
  it.each([four, gomoku, reversi, checkers])(
    '$id starts with the host and independent public projections',
    (adapter) => {
      const state = adapter.create(noRandom);
      expect(adapter.turn(state)).toBe(0);
      expect(adapter.finished(state)).toBe(false);
      expect(adapter.result(state).winner).toBeNull();
      const host = adapter.project(state, 0),
        guest = adapter.project(state, 1);
      expect(guest).toEqual(host);
      expect(adapter.isView(host)).toBe(true);
      expect(adapter.isView(null)).toBe(false);
      expect(adapter.isView({ ...(host as object), board: [] })).toBe(false);
      expect(adapter.isView({ ...(host as object), board: Array(1000).fill(0) })).toBe(false);
      for (const bad of [
        null,
        [],
        {},
        { type: 'undo' },
        { type: 'place', cell: NaN },
        { type: 'place', cell: 0.5 },
        { type: 'drop', col: 7 },
        { type: 'step', from: 1, to: 64 },
      ])
        expect(adapter.apply(state, 0, bad, noRandom)).toBeNull();
    },
  );
  it.each([0, 1] as const)(
    'Connect Four resolves a seat %i win and refuses further/full-column/wrong-turn drops',
    (winner) => {
      let state = four.create(noRandom);
      expect(four.apply(state, 1, { type: 'drop', col: 0 }, noRandom)).toBeNull();
      for (const col of winner === 0 ? [0, 1, 0, 1, 0, 1, 0] : [2, 0, 2, 0, 3, 0, 3, 0])
        state = play(four, state, { type: 'drop', col });
      expect(four.finished(state)).toBe(true);
      expect(four.result(state).winner).toBe(winner);
      expect(four.apply(state, four.turn(state), { type: 'drop', col: 6 }, noRandom)).toBeNull();
      let full = four.create(noRandom);
      for (let i = 0; i < 6; i++) full = play(four, full, { type: 'drop', col: 0 });
      expect(four.apply(full, 0, { type: 'drop', col: 0 }, noRandom)).toBeNull();
      const bad = structuredClone(state) as ConnectFourView;
      bad.last = 35;
      expect(four.isView(bad)).toBe(false);
    },
  );
  it('Connect Four resolves a full board without a line as a draw', () => {
    const board = Array.from({ length: 42 }, (_, i) =>
      (Math.floor(i / 7) + Math.floor((i % 7) / 2)) % 2 === 0 ? (1 as const) : (2 as const),
    );
    const draw: ConnectFourView = { board, last: 2 };
    expect(four.isView(draw)).toBe(true);
    expect(four.result(draw)).toEqual({ scores: [0, 0], winner: 'draw' });
    expect(four.apply(draw, 0, { type: 'drop', col: 0 }, noRandom)).toBeNull();
  });
  it.each([0, 1] as const)(
    'Gomoku resolves five for seat %i, rejects occupied points and stops at the win',
    (winner) => {
      let state = gomoku.create(noRandom);
      expect(gomoku.apply(state, 1, { type: 'place', cell: 112 }, noRandom)).toBeNull();
      for (const cell of winner === 0
        ? [0, 15, 1, 16, 2, 17, 3, 18, 4]
        : [0, 15, 2, 16, 4, 17, 6, 18, 8, 19])
        state = play(gomoku, state, { type: 'place', cell });
      expect(gomoku.result(state).winner).toBe(winner);
      expect(
        gomoku.apply(state, gomoku.turn(state), { type: 'place', cell: 50 }, noRandom),
      ).toBeNull();
      const one = play(gomoku, gomoku.create(noRandom), { type: 'place', cell: 112 });
      expect(gomoku.apply(one, 1, { type: 'place', cell: 112 }, noRandom)).toBeNull();
    },
  );
  it('Gomoku accepts a six-stone bridge (freestyle) and a full-board draw', () => {
    let state = gomoku.create(noRandom);
    for (const cell of [0, 30, 1, 32, 2, 34, 4, 36, 5, 38, 3])
      state = play(gomoku, state, { type: 'place', cell });
    expect(gomoku.result(state).winner).toBe(0);
    const board = Array.from({ length: 225 }, (_, i) =>
      (Math.floor(i / 15) + Math.floor((i % 15) / 2)) % 2 === 0 ? (1 as const) : (2 as const),
    );
    const draw: GomokuView = { board, last: 222 };
    expect(gomoku.isView(draw)).toBe(true);
    expect(gomoku.result(draw)).toEqual({ scores: [0, 0], winner: 'draw' });
    expect(gomoku.apply(draw, 1, { type: 'place', cell: 10 }, noRandom)).toBeNull();
  });
  it('Reversi enforces flips, automatically passes, and reaches a count-based result', () => {
    let state = reversi.create(noRandom) as ReversiView;
    expect(reversi.apply(state, 0, { type: 'place', cell: 0 }, noRandom)).toBeNull();
    expect(reversi.apply(state, 1, { type: 'place', cell: 19 }, noRandom)).toBeNull();
    let passes = 0,
      moves = 0;
    while (!reversi.finished(state)) {
      state = play(reversi, state, {
        type: 'place',
        cell: legalMovesOf(state.board, state.toMove)[0],
      }) as ReversiView;
      moves++;
      if (state.lastMove?.passed) {
        passes++;
        expect(state.toMove).toBe(state.lastMove.by);
      }
      expect(moves).toBeLessThanOrEqual(60);
    }
    expect(passes).toBeGreaterThan(0);
    expect(reversi.result(state).winner).not.toBeNull();
    expect(
      reversi.apply(state, reversi.turn(state), { type: 'place', cell: 0 }, noRandom),
    ).toBeNull();
    expect(reversi.isView({ ...state, toMove: state.toMove === 1 ? 2 : 1 })).toBe(false);
    expect(reversi.isView({ ...state, lastMove: { ...state.lastMove, flipped: [0, 0] } })).toBe(
      false,
    );
  });
  it('Reversi permits eliminating the last opposing disc and gives the exact result', () => {
    const board = Array(64).fill(1);
    board[0] = 0;
    board[1] = 2;
    const state: ReversiView = {
      board,
      toMove: 1,
      lastMove: { by: 1, placed: 2, flipped: [3], passed: 2, moveCount: 59 },
    };
    expect(reversi.result(play(reversi, state, { type: 'place', cell: 0 }))).toEqual({
      scores: [64, 0],
      winner: 0,
    });
  });
  it.each([0, 1] as const)(
    'Checkers seat %i must capture and continue with the same piece',
    (seat) => {
      let state = fixtureCheckers({ 42: 1, 56: 1, 35: 2, 21: 2, 7: 2 }, seat);
      const cell = (i: number) => (seat === 0 ? i : 63 - i);
      expect(
        checkers.apply(
          state,
          (1 - seat) as Seat,
          { type: 'step', from: cell(42), to: cell(28) },
          noRandom,
        ),
      ).toBeNull();
      expect(
        checkers.apply(state, seat, { type: 'step', from: cell(56), to: cell(49) }, noRandom),
      ).toBeNull();
      state = play(checkers, state, { type: 'step', from: cell(42), to: cell(28) }) as CheckersView;
      expect(checkers.turn(state)).toBe(seat);
      expect(state.pendingJumpFrom).toBe(cell(28));
      expect(
        checkers.apply(state, seat, { type: 'step', from: cell(56), to: cell(49) }, noRandom),
      ).toBeNull();
      state = play(checkers, state, { type: 'step', from: cell(28), to: cell(14) }) as CheckersView;
      expect(checkers.turn(state)).toBe(1 - seat);
      expect(state.pendingJumpFrom).toBeNull();
      expect(state.quietPlies).toBe(0);
      expect(checkers.isView({ ...state, pendingJumpFrom: cell(14) })).toBe(false);
    },
  );
  it.each([0, 1] as const)(
    'Checkers seat %i crowns and ends the capture chain immediately',
    (seat) => {
      const state = fixtureCheckers({ 17: 1, 10: 2, 12: 2 }, seat),
        cell = (i: number) => (seat === 0 ? i : 63 - i);
      const next = play(checkers, state, {
        type: 'step',
        from: cell(17),
        to: cell(3),
      }) as CheckersView;
      expect(next.board[cell(3)]).toBe(seat === 0 ? 3 : 4);
      expect(next.lastMove?.crowned).toBe(true);
      expect(next.pendingJumpFrom).toBeNull();
      expect(checkers.turn(next)).toBe(1 - seat);
    },
  );
  it('Checkers ends on the last capture or 50 quiet king turns; ordinary men reset the draw count', () => {
    const win = play(checkers, fixtureCheckers({ 42: 1, 35: 2 }, 0), {
      type: 'step',
      from: 42,
      to: 28,
    });
    expect(checkers.result(win)).toEqual({ scores: [1, 0], winner: 0 });
    expect(checkers.apply(win, 1, { type: 'step', from: 7, to: 14 }, noRandom)).toBeNull();
    const kings = {
      ...fixtureCheckers({ 42: 3, 7: 4 }, 0),
      moveCount: 50,
      quietPlies: 49,
      lastMove: {
        by: 2 as const,
        move: { from: 14, to: 7, captured: -1 },
        crowned: false,
        stepId: 50,
      },
    };
    expect(checkers.result(play(checkers, kings, { type: 'step', from: 42, to: 33 }))).toEqual({
      scores: [0, 0],
      winner: 'draw',
    });
    const man = { ...kings, board: kings.board.map((p, i) => (i === 42 ? (1 as const) : p)) };
    const active = play(checkers, man, { type: 'step', from: 42, to: 33 }) as CheckersView;
    expect(active.quietPlies).toBe(0);
    expect(checkers.finished(active)).toBe(false);
  });
  it('Checkers completes a legal two-seat match with valid projections after every jump', () => {
    let state = checkers.create(noRandom) as CheckersView,
      steps = 0;
    while (!checkers.finished(state) && steps < 500) {
      const move = legalMoves(state.board, state.toMove, state.pendingJumpFrom)[0]!;
      state = play(checkers, state, { type: 'step', from: move.from, to: move.to }) as CheckersView;
      steps++;
    }
    expect(checkers.finished(state)).toBe(true);
  });
});
function fixtureCheckers(pieces: Record<number, number>, seat: Seat): CheckersView {
  const board = Array(64).fill(0);
  for (const [index, piece] of Object.entries(pieces))
    board[seat === 0 ? Number(index) : 63 - Number(index)] =
      seat === 0 || piece === 0 ? piece : piece === 1 ? 2 : piece === 2 ? 1 : piece === 3 ? 4 : 3;
  const moveCount = seat === 0 ? 10 : 11;
  const target = Object.keys(pieces)
    .map(Number)
    .find((cell) => pieces[cell] === 2 && cell >= 8)!;
  const from = [target - 9, target - 7].find(
    (cell) => cell >= 0 && Math.floor(cell / 8) === Math.floor(target / 8) - 1 && !pieces[cell],
  )!;
  const previous = {
    from: seat === 0 ? from : 63 - from,
    to: seat === 0 ? target : 63 - target,
    captured: -1,
  };
  return {
    board: board as CheckersBoard,
    toMove: seat === 0 ? 1 : 2,
    moveCount,
    quietPlies: 0,
    pendingJumpFrom: null,
    lastMove: { by: seat === 0 ? 2 : 1, move: previous, crowned: false, stepId: moveCount },
  };
}
