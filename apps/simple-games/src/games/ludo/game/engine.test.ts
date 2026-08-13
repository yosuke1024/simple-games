/**
 * One match of Ludo, rule by rule: exact-count homing, which squares are
 * safe, what a landing on an enemy or a friend does, three sixes in a row,
 * automatic passes, the roll cap, and the board's own geometry.
 *
 * Fixtures are built directly rather than played into from `initialState`,
 * because the positions that matter — a pawn one square short of home, a
 * stack of three enemy pawns sharing a square, a seat two sixes deep — are
 * ones real play would take a long time to produce on its own. Every
 * fixture goes through `isValidMatchState` on the way in, so a test can
 * never assert about a shape the engine could not have produced.
 */
import { describe, expect, it } from 'vitest';
import { rollFor } from './dice';
import { applyMove, initialState, legalMovesFor, MAX_ROLLS, rollDie } from './engine';
import {
  bySeat,
  globalSquareOf,
  HOME_PROGRESS,
  isCapturableAt,
  isValidMatchState,
  RING_SIZE,
  SAFE_SQUARES,
  SEATS,
  YOU,
  type BySeat,
  type MatchResult,
  type MatchState,
  type Seat,
} from './types';

type Pawns = readonly [number, number, number, number];

/** A match state built straight from a description, not played into. */
function stateWith(overrides: {
  readonly turn?: Seat;
  readonly die?: number | null;
  readonly sixStreak?: number;
  readonly rollIndex?: number;
  readonly result?: MatchResult | null;
  readonly pawns?: Partial<Record<Seat, Pawns>>;
}): MatchState {
  const pawns: BySeat<Pawns> = bySeat((seat) => overrides.pawns?.[seat] ?? [0, 0, 0, 0]);
  const state: MatchState = {
    pawns,
    turn: overrides.turn ?? YOU,
    rollIndex: overrides.rollIndex ?? 0,
    sixStreak: overrides.sixStreak ?? 0,
    die: overrides.die ?? null,
    result: overrides.result ?? null,
  };
  if (!isValidMatchState(state)) throw new Error('fixture is not a valid MatchState');
  return state;
}

/** The progress at which `seat` sits on global ring square `square`. */
function progressLandingOn(seat: Seat, square: number): number {
  for (let progress = 1; progress <= RING_SIZE; progress++) {
    if (globalSquareOf(seat, progress) === square) return progress;
  }
  throw new Error(`unreachable: seat ${seat} never lands on square ${square}`);
}

/** A `{ from, die }` a pawn already on the board (or fresh from the yard) reaches `landing` with. */
function stepTo(landing: number): { from: number; die: number } {
  return landing === 1 ? { from: 0, die: 6 } : { from: landing - 1, die: 1 };
}

/** A seed and roll index this suite reuses to pin dice values down. */
const ENGINE_SEED = 'ludo-engine-test';
const ROLL_INDEX_OF_SIX = 2;
const ROLL_INDEX_OF_FIVE = 3;
if (
  rollFor(ENGINE_SEED, ROLL_INDEX_OF_SIX) !== 6 ||
  rollFor(ENGINE_SEED, ROLL_INDEX_OF_FIVE) !== 5
) {
  // Pinning these two indices, rather than searching for a six at test time,
  // keeps the fixtures below readable. If `rollFor` or its seed derivation
  // ever changes, this guard fails loudly instead of the tests below
  // quietly exercising the wrong die.
  throw new Error('ENGINE_SEED roll indices no longer match the dice they were picked for');
}

describe('leaving the yard', () => {
  it('needs a six; nothing else moves a yard pawn', () => {
    const state = stateWith({ pawns: { [YOU]: [0, 0, 0, 0] } });
    for (const die of [1, 2, 3, 4, 5]) {
      const moves = legalMovesFor(state, YOU, die).filter((move) => move.from === 0);
      expect(moves, `die ${die} should not free a yard pawn`).toEqual([]);
    }
  });

  it('a six sends a yard pawn to the first ring square', () => {
    const state = stateWith({ pawns: { [YOU]: [0, 3, 0, 0] } });
    const moves = legalMovesFor(state, YOU, 6);
    expect(moves).toContainEqual({ pawn: 0, from: 0, to: 1 });
    expect(moves).toContainEqual({ pawn: 2, from: 0, to: 1 });
  });
});

describe('homing needs an exact count', () => {
  it('a roll that would overshoot leaves the pawn where it is', () => {
    // Progress 55 needs exactly 4 to reach 59; a 5 overshoots by one.
    const state = stateWith({ pawns: { [YOU]: [55, 0, 0, 0] } });
    expect(legalMovesFor(state, YOU, 5)).toEqual([]);
  });

  it('the exact count reaches home', () => {
    const state = stateWith({ pawns: { [YOU]: [55, 0, 0, 0] } });
    expect(legalMovesFor(state, YOU, 4)).toEqual([{ pawn: 0, from: 55, to: HOME_PROGRESS }]);
  });
});

describe('the eight safe squares never capture', () => {
  for (const square of SAFE_SQUARES) {
    it(`square ${square}`, () => {
      const occupant: Seat = 1;
      const mover: Seat = 0;
      const occupantProgress = progressLandingOn(occupant, square);
      const landing = progressLandingOn(mover, square);
      const { from, die } = stepTo(landing);

      const before = stateWith({
        turn: mover,
        die,
        pawns: { [occupant]: [occupantProgress, 40, 41, 42], [mover]: [from, 0, 0, 0] },
      });
      const after = applyMove(before, { pawn: 0, from, to: landing });
      expect(after).not.toBeNull();
      expect(after!.pawns[occupant][0]).toBe(occupantProgress);
    });
  }
});

describe('landing on enemy pawns sends the whole square home', () => {
  it('two enemy pawns stacked on the same square', () => {
    // Global square 22 is not safe (SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47]).
    const square = 22;
    const enemy: Seat = 1;
    const enemyProgress = progressLandingOn(enemy, square);
    const landing = progressLandingOn(YOU, square);
    const { from, die } = stepTo(landing);

    const before = stateWith({
      turn: YOU,
      die,
      pawns: { [YOU]: [from, 0, 0, 0], [enemy]: [enemyProgress, enemyProgress, 5, 5] },
    });
    const after = applyMove(before, { pawn: 0, from, to: landing })!;
    expect(after.pawns[enemy]).toEqual([0, 0, 5, 5]);
  });

  it('three enemy pawns from two different seats stacked together', () => {
    const square = 22;
    const enemyA: Seat = 1;
    const enemyB: Seat = 3;
    const enemyAProgress = progressLandingOn(enemyA, square);
    const enemyBProgress = progressLandingOn(enemyB, square);
    const landing = progressLandingOn(YOU, square);
    const { from, die } = stepTo(landing);

    const before = stateWith({
      turn: YOU,
      die,
      pawns: {
        [YOU]: [from, 0, 0, 0],
        [enemyA]: [enemyAProgress, enemyAProgress, 9, 0],
        [enemyB]: [enemyBProgress, 17, 0, 0],
      },
    });
    const after = applyMove(before, { pawn: 0, from, to: landing })!;
    // Every pawn of theirs that was on the landing square goes home; the
    // ones that were not stay exactly where they were.
    expect(after.pawns[enemyA]).toEqual([0, 0, 9, 0]);
    expect(after.pawns[enemyB]).toEqual([0, 17, 0, 0]);
  });

  it('a capture does not earn another roll', () => {
    // die = 3, not 6, so a normal move passes turn on. If a capture granted
    // an extra roll by itself, the turn would stay with the mover instead.
    const square = 22;
    const enemy: Seat = 1;
    const enemyProgress = progressLandingOn(enemy, square);
    const landing = progressLandingOn(YOU, square);
    const from = landing - 3;

    const before = stateWith({
      turn: YOU,
      die: 3,
      pawns: { [YOU]: [from, 0, 0, 0], [enemy]: [enemyProgress, 0, 0, 0] },
    });
    const after = applyMove(before, { pawn: 0, from, to: landing })!;
    expect(after.pawns[enemy]).toEqual([0, 0, 0, 0]);
    expect(after.turn).toBe(1);
    expect(after.die).toBeNull();
  });
});

describe('a seat can share a square with itself', () => {
  it('landing on your own pawn does nothing beyond landing', () => {
    const before = stateWith({ turn: YOU, die: 2, pawns: { [YOU]: [8, 10, 0, 0] } });
    const after = applyMove(before, { pawn: 0, from: 8, to: 10 });
    expect(after).not.toBeNull();
    // Both of the mover's own pawns now sit on progress 10; overlap is
    // legal and has no effect beyond that — no blocking, no protecting.
    expect(after!.pawns[YOU]).toEqual([10, 10, 0, 0]);
  });
});

describe('three sixes in a row forfeit the turn', () => {
  it('the third six moves nobody and passes turn on', () => {
    const before = stateWith({ turn: YOU, sixStreak: 2, rollIndex: ROLL_INDEX_OF_SIX });
    const outcome = rollDie(before, ENGINE_SEED);
    expect(outcome.die).toBe(6);
    expect(outcome.kind).toBe('thirdSix');
    expect(outcome.moves).toEqual([]);
    expect(outcome.state.turn).toBe(1);
    expect(outcome.state.sixStreak).toBe(0);
    expect(outcome.state.die).toBeNull();
  });

  it('a second six in a row does not forfeit anything', () => {
    const before = stateWith({ turn: YOU, sixStreak: 1, rollIndex: ROLL_INDEX_OF_SIX });
    const outcome = rollDie(before, ENGINE_SEED);
    expect(outcome.kind).toBe('move');
    expect(outcome.state.turn).toBe(YOU);
    expect(outcome.state.sixStreak).toBe(2);
    expect(outcome.state.die).toBe(6);
  });
});

describe('a roll with no legal reply auto-passes', () => {
  // All four pawns one square short of overshooting on anything but a small
  // roll: 55/56/57/58 need exactly 4/3/2/1 to reach home.
  const stuck: Pawns = [55, 56, 57, 58];

  it('a non-six with no legal move passes turn and resets the streak', () => {
    const before = stateWith({
      turn: YOU,
      sixStreak: 0,
      rollIndex: ROLL_INDEX_OF_FIVE,
      pawns: { [YOU]: stuck },
    });
    const outcome = rollDie(before, ENGINE_SEED);
    expect(outcome.die).toBe(5);
    expect(outcome.kind).toBe('autoPass');
    expect(outcome.moves).toEqual([]);
    expect(outcome.state.turn).toBe(1);
    expect(outcome.state.sixStreak).toBe(0);
  });

  it('a six with no legal move still earns the same seat another roll', () => {
    const before = stateWith({
      turn: YOU,
      sixStreak: 0,
      rollIndex: ROLL_INDEX_OF_SIX,
      pawns: { [YOU]: stuck },
    });
    const outcome = rollDie(before, ENGINE_SEED);
    expect(outcome.die).toBe(6);
    expect(outcome.kind).toBe('autoPass');
    // The auto-pass spent the move a six would have unlocked, not the extra
    // roll the six grants by itself (§2.6) — the streak carries forward.
    expect(outcome.state.turn).toBe(YOU);
    expect(outcome.state.sixStreak).toBe(1);
  });
});

describe('the match ends the instant all four pawns are home', () => {
  it('finishing the fourth pawn wins immediately, and no further move is accepted', () => {
    const before = stateWith({
      turn: YOU,
      die: 4,
      pawns: { [YOU]: [HOME_PROGRESS, HOME_PROGRESS, HOME_PROGRESS, 55] },
    });
    const after = applyMove(before, { pawn: 3, from: 55, to: HOME_PROGRESS })!;
    expect(after.result).toEqual({ kind: 'win', winner: YOU });
    expect(after.pawns[YOU]).toEqual([HOME_PROGRESS, HOME_PROGRESS, HOME_PROGRESS, HOME_PROGRESS]);

    // The match is over; even a move that would otherwise be legal is refused.
    expect(applyMove(after, { pawn: 0, from: HOME_PROGRESS, to: HOME_PROGRESS })).toBeNull();
  });
});

describe('the roll cap', () => {
  it('reaching MAX_ROLLS ends the match in a no-contest', () => {
    let state = initialState();
    for (let rolled = 0; rolled < MAX_ROLLS; rolled++) {
      expect(state.result, `still playing after ${rolled} rolls`).toBeNull();
      state = rollDie(state, 'ludo-cap-test').state;
    }
    expect(state.rollIndex).toBe(MAX_ROLLS);
    expect(state.result).toEqual({ kind: 'noContest' });
  });
});

describe('legalMovesFor', () => {
  it('returns a separate move for each pawn, even sharing a progress', () => {
    const state = stateWith({ pawns: { [YOU]: [10, 10, 0, 0] } });
    const moves = legalMovesFor(state, YOU, 2);
    expect(moves).toEqual([
      { pawn: 0, from: 10, to: 12 },
      { pawn: 1, from: 10, to: 12 },
    ]);
  });
});

describe('isCapturableAt', () => {
  it('is false in the yard', () => {
    expect(isCapturableAt(YOU, 0)).toBe(false);
  });

  it('is false anywhere in a home column', () => {
    for (let progress = 53; progress <= 58; progress++) {
      expect(isCapturableAt(YOU, progress), `progress ${progress}`).toBe(false);
    }
  });

  it('is false once home', () => {
    expect(isCapturableAt(YOU, HOME_PROGRESS)).toBe(false);
  });

  it('is false on every safe square, for every seat that could stand there', () => {
    for (const seat of SEATS) {
      for (const square of SAFE_SQUARES) {
        const progress = progressLandingOn(seat, square);
        expect(isCapturableAt(seat, progress), `seat ${seat} square ${square}`).toBe(false);
      }
    }
  });

  it('is true on the rest of the ring', () => {
    for (const square of [1, 2, 5, 22, 30, 46]) {
      expect(SAFE_SQUARES, `fixture square ${square} must not itself be safe`).not.toContain(
        square,
      );
      const progress = progressLandingOn(YOU, square);
      expect(isCapturableAt(YOU, progress), `square ${square}`).toBe(true);
    }
  });
});

describe('ring geometry', () => {
  it('each seat enters the ring thirteen squares after the last', () => {
    const entrances = SEATS.map((seat) => globalSquareOf(seat, 1));
    expect(entrances).toEqual([0, 13, 26, 39]);
  });

  it('progress 52 is one square before the seat re-enters its own start', () => {
    for (const seat of SEATS) {
      const lastRingSquare = globalSquareOf(seat, RING_SIZE)!;
      const entrance = globalSquareOf(seat, 1)!;
      expect((lastRingSquare + 1) % RING_SIZE).toBe(entrance);
    }
  });
});
