/**
 * What the opponents are, and — the part this title exists to make checkable
 * — what they can see.
 *
 * The first describe block is the contract: nothing about the roll to come,
 * or about the parts of `MatchState` that only exist to make replay work
 * (`rollIndex`, `sixStreak`, `result`), reaches `LudoView`. Changing any of
 * those on the state a view is built from must not move the view at all.
 *
 * The rest is the ordinary opponent's-behaviour set: the priority order
 * normal's weight table promises, the exact numbers hard's risk estimate is
 * supposed to produce (and the wrong, simpler formula it must not produce),
 * and that every strength answers with a legal move whenever one exists.
 */
import { describe, expect, it } from 'vitest';
import {
  buildLudoView,
  capturedPawnCountAt,
  captureRiskAt,
  chooseCpuMove,
  type LudoView,
} from './cpu';
import {
  bySeat,
  DIFFICULTIES,
  globalSquareOf,
  HOME_PROGRESS,
  isValidMatchState,
  RING_SIZE,
  YOU,
  type BySeat,
  type Difficulty,
  type MatchState,
  type Move,
  type Seat,
} from './types';

type Pawns = readonly [number, number, number, number];

/** Every seat's pawns in the yard except the ones named. */
function pawnsWith(overrides: Partial<Record<Seat, Pawns>>): BySeat<Pawns> {
  return bySeat((seat) => overrides[seat] ?? [0, 0, 0, 0]);
}

/** A match state built straight from a description, not played into (mirrors engine.test.ts). */
function stateWith(overrides: {
  readonly turn?: Seat;
  readonly die?: number | null;
  readonly sixStreak?: number;
  readonly rollIndex?: number;
  readonly result?: MatchState['result'];
  readonly pawns?: Partial<Record<Seat, Pawns>>;
}): MatchState {
  const state: MatchState = {
    pawns: pawnsWith(overrides.pawns ?? {}),
    turn: overrides.turn ?? YOU,
    rollIndex: overrides.rollIndex ?? 0,
    sixStreak: overrides.sixStreak ?? 0,
    die: overrides.die ?? null,
    result: overrides.result ?? null,
  };
  if (!isValidMatchState(state)) throw new Error('fixture is not a valid MatchState');
  return state;
}

/** A view built straight from its parts, for testing one decision at a time. */
function viewOf(options: {
  readonly seat?: Seat;
  readonly difficulty?: Difficulty;
  readonly die?: number;
  readonly pawns?: Partial<Record<Seat, Pawns>>;
  readonly moves: readonly Move[];
}): LudoView {
  return {
    seat: options.seat ?? YOU,
    difficulty: options.difficulty ?? 'normal',
    die: options.die ?? 1,
    pawns: pawnsWith(options.pawns ?? {}),
    moves: options.moves,
  };
}

/** The progress at which `seat` sits on global ring square `square` (mirrors engine.test.ts). */
function progressLandingOn(seat: Seat, square: number): number {
  for (let progress = 1; progress <= RING_SIZE; progress++) {
    if (globalSquareOf(seat, progress) === square) return progress;
  }
  throw new Error(`unreachable: seat ${seat} never lands on square ${square}`);
}

/** The progress at which `seat` would sit `distance` ring squares behind `targetSquare`. */
function pawnBehind(seat: Seat, targetSquare: number, distance: number): number {
  const square = (((targetSquare - distance) % RING_SIZE) + RING_SIZE) % RING_SIZE;
  return progressLandingOn(seat, square);
}

const enemy: Seat = 1;

describe('what a CPU seat is allowed to see', () => {
  const state = stateWith({
    turn: 2,
    die: 4,
    rollIndex: 40,
    sixStreak: 1,
    pawns: { 0: [10, 20, 0, 0], 1: [5, 5, 0, 0], 2: [15, 0, 0, 0], 3: [30, 0, 0, 0] },
  });
  const view = buildLudoView(state, 'hard')!;

  it('is exactly these fields', () => {
    // Written out so that adding a field to LudoView is a decision somebody
    // takes in this test, not a line that slips through in another one.
    expect(Object.keys(view).sort()).toEqual(
      ['die', 'difficulty', 'moves', 'pawns', 'seat'].sort(),
    );
    // Nothing about how the match got here, or what happens after this
    // roll, reaches the view.
    expect(Object.keys(view)).not.toContain('rollIndex');
    expect(Object.keys(view)).not.toContain('sixStreak');
    expect(Object.keys(view)).not.toContain('result');
    expect(Object.keys(view)).not.toContain('seed');
  });

  it('does not move when rollIndex, sixStreak, or a still-playing result are changed', () => {
    const changed: MatchState = { ...state, rollIndex: state.rollIndex + 999, sixStreak: 2 };
    expect(isValidMatchState(changed)).toBe(true);
    expect(buildLudoView(changed, 'hard')).toEqual(view);
  });

  it('is null when no roll is waiting on a move', () => {
    expect(buildLudoView({ ...state, die: null }, 'hard')).toBeNull();
  });

  it('copies rather than shares, so a view cannot be walked back to the state', () => {
    expect(view.pawns).not.toBe(state.pawns);
    expect(view.pawns[0]).not.toBe(state.pawns[0]);
  });

  it("carries this seat's legal replies to the die, computed by the engine", () => {
    expect(view.seat).toBe(2);
    expect(view.die).toBe(4);
    // Seat 2's only pawn is at progress 15; +4 = 19.
    expect(view.moves).toEqual([{ pawn: 0, from: 15, to: 19 }]);
  });
});

describe('chooseCpuMove is deterministic', () => {
  it('the same view and tie-break always choose the same move', () => {
    const moves: Move[] = [
      { pawn: 0, from: 10, to: 15 },
      { pawn: 1, from: 20, to: 24 },
    ];
    for (const difficulty of DIFFICULTIES) {
      const view = viewOf({ difficulty, pawns: { [YOU]: [10, 20, 0, 0] }, moves });
      const first = chooseCpuMove(view, 0.37);
      expect(chooseCpuMove(view, 0.37)).toEqual(first);
      expect(chooseCpuMove(view, 0.37)).toEqual(first);
    }
  });
});

describe('every difficulty always answers, and never outside the legal set', () => {
  const moves: Move[] = [
    { pawn: 0, from: 4, to: 9 },
    { pawn: 1, from: 30, to: 33 },
  ];
  const base = viewOf({ pawns: { [YOU]: [4, 30, 0, 0] }, moves });

  it('never invents a move outside the legal set, at any tie-break', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let step = 0; step <= 10; step++) {
        const tieBreak = step / 10;
        const chosen = chooseCpuMove({ ...base, difficulty }, tieBreak);
        expect(chosen).not.toBeNull();
        expect(moves).toContainEqual(chosen);
      }
    }
  });

  it('returns null only when there is nothing legal to play', () => {
    const empty = viewOf({ moves: [] });
    for (const difficulty of DIFFICULTIES) {
      expect(chooseCpuMove({ ...empty, difficulty }, 0.5)).toBeNull();
    }
  });
});

describe('easy', () => {
  it('picks uniformly among the legal moves with the tie-break float', () => {
    const moves: Move[] = [
      { pawn: 0, from: 4, to: 9 },
      { pawn: 1, from: 30, to: 33 },
      { pawn: 2, from: 40, to: 45 },
    ];
    const view = viewOf({ difficulty: 'easy', pawns: { [YOU]: [4, 30, 40, 0] }, moves });
    expect(chooseCpuMove(view, 0)).toEqual(moves[0]);
    expect(chooseCpuMove(view, 0.5)).toEqual(moves[1]);
    expect(chooseCpuMove(view, 0.99)).toEqual(moves[2]);
  });
});

describe("normal's priority order", () => {
  it('captures over reaching home', () => {
    const square = 22; // not a safe square
    const captureTo = progressLandingOn(YOU, square);
    const enemyAt = progressLandingOn(enemy, square);
    const captureMove: Move = { pawn: 0, from: captureTo - 3, to: captureTo };
    const homeMove: Move = { pawn: 1, from: 55, to: HOME_PROGRESS };
    const view = viewOf({
      pawns: { [YOU]: [captureMove.from, 55, 0, 0], [enemy]: [enemyAt, 0, 0, 0] },
      moves: [homeMove, captureMove],
    });
    expect(chooseCpuMove(view, 0)).toEqual(captureMove);
    expect(chooseCpuMove(view, 0.99)).toEqual(captureMove);
  });

  it('a two-pawn capture outranks a one-pawn capture', () => {
    const singleSquare = 22;
    const doubleSquare = 30;
    const singleTo = progressLandingOn(YOU, singleSquare);
    const doubleTo = progressLandingOn(YOU, doubleSquare);
    const singleCapture: Move = { pawn: 0, from: singleTo - 2, to: singleTo };
    const doubleCapture: Move = { pawn: 1, from: doubleTo - 2, to: doubleTo };
    const view = viewOf({
      pawns: {
        [YOU]: [singleCapture.from, doubleCapture.from, 0, 0],
        1: [progressLandingOn(1, singleSquare), progressLandingOn(1, doubleSquare), 0, 0],
        3: [progressLandingOn(3, doubleSquare), 0, 0, 0],
      },
      moves: [singleCapture, doubleCapture],
    });
    expect(chooseCpuMove(view, 0)).toEqual(doubleCapture);
  });

  it('reaching home over leaving the yard', () => {
    const homeMove: Move = { pawn: 0, from: 55, to: HOME_PROGRESS };
    const exitMove: Move = { pawn: 1, from: 0, to: 1 };
    const view = viewOf({ pawns: { [YOU]: [55, 0, 0, 0] }, moves: [exitMove, homeMove] });
    expect(chooseCpuMove(view, 0)).toEqual(homeMove);
  });

  it('leaving the yard over entering a safe square', () => {
    const exitMove: Move = { pawn: 0, from: 0, to: 1 };
    const safeTo = progressLandingOn(YOU, 21); // a star square, safe
    const safeMove: Move = { pawn: 1, from: safeTo - 1, to: safeTo };
    const view = viewOf({
      pawns: { [YOU]: [0, safeTo - 1, 0, 0] },
      moves: [safeMove, exitMove],
    });
    expect(chooseCpuMove(view, 0)).toEqual(exitMove);
  });

  it('entering a safe square over a plain advance', () => {
    const safeTo = progressLandingOn(YOU, 21);
    const safeMove: Move = { pawn: 0, from: safeTo - 1, to: safeTo };
    const plainMove: Move = { pawn: 1, from: 10, to: 15 };
    const view = viewOf({
      pawns: { [YOU]: [safeTo - 1, 10, 0, 0] },
      moves: [plainMove, safeMove],
    });
    expect(chooseCpuMove(view, 0)).toEqual(safeMove);
  });

  it('between two plain advances, prefers the pawn that ends up further along', () => {
    const near: Move = { pawn: 0, from: 5, to: 8 };
    const far: Move = { pawn: 1, from: 20, to: 23 };
    const view = viewOf({ pawns: { [YOU]: [5, 20, 0, 0] }, moves: [near, far] });
    expect(chooseCpuMove(view, 0)).toEqual(far);
  });

  it('ties are broken by the tie-break float', () => {
    // Two different pawns sharing progress 10 (legal — engine.test.ts covers
    // this being allowed) offer the exact same plain-advance score.
    const moveA: Move = { pawn: 0, from: 10, to: 15 };
    const moveB: Move = { pawn: 1, from: 10, to: 15 };
    const view = viewOf({ pawns: { [YOU]: [10, 10, 0, 0] }, moves: [moveA, moveB] });
    expect(chooseCpuMove(view, 0)).toEqual(moveA);
    expect(chooseCpuMove(view, 0.99)).toEqual(moveB);
  });
});

describe('capturedPawnCountAt', () => {
  it('counts every enemy pawn sharing the landing square, across seats', () => {
    const square = 22;
    const to = progressLandingOn(YOU, square);
    const pawns = pawnsWith({
      1: [progressLandingOn(1, square), progressLandingOn(1, square), 5, 5],
      3: [progressLandingOn(3, square), 0, 0, 0],
    });
    expect(capturedPawnCountAt(YOU, to, pawns)).toBe(3);
  });

  it('is zero on a safe square', () => {
    const to = progressLandingOn(YOU, 21);
    const pawns = pawnsWith({ 1: [progressLandingOn(1, 21), 0, 0, 0] });
    expect(capturedPawnCountAt(YOU, to, pawns)).toBe(0);
  });
});

describe("hard's capture-risk estimate", () => {
  it('is zero when the square cannot be captured on at all: a safe square', () => {
    const safeTo = progressLandingOn(YOU, 21);
    const pawns = pawnsWith({
      1: [pawnBehind(1, 21, 1), pawnBehind(1, 21, 2), pawnBehind(1, 21, 3), pawnBehind(1, 21, 4)],
      2: [pawnBehind(2, 21, 5), 0, 0, 0],
      3: [pawnBehind(3, 21, 6), 0, 0, 0],
    });
    expect(captureRiskAt(YOU, safeTo, pawns)).toBe(0);
  });

  it("is zero anywhere in this seat's own home column, regardless of enemy positions", () => {
    const pawns = pawnsWith({ 1: [10, 11, 12, 13], 2: [5, 6, 7, 8], 3: [1, 2, 3, 4] });
    for (let progress = 53; progress <= 58; progress++) {
      expect(captureRiskAt(YOU, progress, pawns), `progress ${progress}`).toBe(0);
    }
  });

  it('is zero once home', () => {
    const pawns = pawnsWith({ 1: [10, 11, 12, 13] });
    expect(captureRiskAt(YOU, HOME_PROGRESS, pawns)).toBe(0);
  });

  it('two pawns on the same seat at the same distance count once, not twice', () => {
    const to = progressLandingOn(YOU, 30);
    const near = pawnBehind(1, 30, 1);
    const onePawn = pawnsWith({ 1: [near, 0, 0, 0] });
    const twoPawns = pawnsWith({ 1: [near, near, 0, 0] });
    expect(captureRiskAt(YOU, to, onePawn)).toBeCloseTo(1 - 5 / 6, 10);
    // The wrong formula — enemy pawn count divided by six — would put this
    // at 2/6 instead of 1/6: the same distinct die still opens the door,
    // whether one pawn sits on it or two.
    expect(captureRiskAt(YOU, to, twoPawns)).toBeCloseTo(captureRiskAt(YOU, to, onePawn), 10);
  });

  it('two seats with one pawn each, one square behind, combine to 1 − (5/6)² = 11/36', () => {
    const to = progressLandingOn(YOU, 30);
    const pawns = pawnsWith({
      1: [pawnBehind(1, 30, 1), 0, 0, 0],
      3: [pawnBehind(3, 30, 1), 0, 0, 0],
    });
    // The wrong formula — (1 threatening pawn + 1 threatening pawn) / 6 —
    // would give 2/6 = 12/36 here instead.
    expect(captureRiskAt(YOU, to, pawns)).toBeCloseTo(11 / 36, 10);
  });

  it('an enemy pawn that would turn off into its own home column first is not a threat', () => {
    // Seat 1's own ring exit is progress 52. From progress 48, a roll of 6
    // would carry it to progress 54 — past the exit and into its home
    // column — so it can never actually land on this square, even though
    // the raw ring distance to it is 6.
    const targetSquare = 14;
    const to = progressLandingOn(YOU, targetSquare);
    const pawns = pawnsWith({ 1: [48, 0, 0, 0] });
    expect(captureRiskAt(YOU, to, pawns)).toBe(0);
  });

  it('control: the same pawn a little closer, still on the ring, is a real threat', () => {
    // Same seat-1 pawn at progress 48, but a target only 4 squares of ring
    // distance away — 48 + 4 = 52, still exactly on the ring.
    const targetSquare = 12;
    const to = progressLandingOn(YOU, targetSquare);
    const pawns = pawnsWith({ 1: [48, 0, 0, 0] });
    expect(captureRiskAt(YOU, to, pawns)).toBeCloseTo(1 - 5 / 6, 10);
  });

  it('a pawn still in the yard, or already in a home column, threatens nothing', () => {
    const to = progressLandingOn(YOU, 30);
    const pawns = pawnsWith({ 1: [0, 53, 58, 0] });
    expect(captureRiskAt(YOU, to, pawns)).toBe(0);
  });

  it('stays within [0, 1] even when every other seat threatens heavily', () => {
    const to = progressLandingOn(YOU, 30);
    const pawns = pawnsWith({
      1: [pawnBehind(1, 30, 1), pawnBehind(1, 30, 2), pawnBehind(1, 30, 3), pawnBehind(1, 30, 4)],
      2: [pawnBehind(2, 30, 1), pawnBehind(2, 30, 2), pawnBehind(2, 30, 3), pawnBehind(2, 30, 4)],
      3: [pawnBehind(3, 30, 1), pawnBehind(3, 30, 2), pawnBehind(3, 30, 3), pawnBehind(3, 30, 4)],
    });
    const risk = captureRiskAt(YOU, to, pawns);
    expect(risk).toBeGreaterThanOrEqual(0);
    expect(risk).toBeLessThanOrEqual(1);
  });
});

describe('hard actually weighs the risk estimate; normal does not', () => {
  it('hard prefers the safer of two plain advances; normal prefers the further one', () => {
    const safeMove: Move = { pawn: 0, from: 8, to: 11 }; // lands on square 10: no enemy in range
    const riskyMove: Move = { pawn: 1, from: 14, to: 17 }; // lands on square 16: one enemy square away
    const threat = pawnBehind(enemy, 16, 2);
    const view = viewOf({
      pawns: { [YOU]: [8, 14, 0, 0], [enemy]: [threat, 0, 0, 0] },
      moves: [safeMove, riskyMove],
    });
    expect(chooseCpuMove({ ...view, difficulty: 'normal' }, 0)).toEqual(riskyMove);
    expect(chooseCpuMove({ ...view, difficulty: 'hard' }, 0)).toEqual(safeMove);
  });
});
