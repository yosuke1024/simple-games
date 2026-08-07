import { describe, expect, it } from 'vitest';
import { dealBoard } from './deal';
import {
  autoFinish,
  canAutoFinish,
  canPlaceOnCascade,
  canPlaceOnFoundation,
  cascadeTop,
  hasAnyMove,
  isWon,
  maxMoveSize,
  movableRunStart,
  moveCascadeRun,
  moveCascadeToCell,
  moveCascadeToFoundation,
  moveCellToCascade,
  moveCellToFoundation,
} from './engine';
import { CARD_COUNT, CASCADES, cardOf, isValidBoard, type Card, type FreeCellBoard } from './types';

const S = (rank: number): Card => cardOf(0, rank);
const H = (rank: number): Card => cardOf(1, rank);
const D = (rank: number): Card => cardOf(2, rank);
const C = (rank: number): Card => cardOf(3, rank);

/** A board with only the named zones filled; the rest empty. Not card-complete. */
function board(partial: Partial<FreeCellBoard> = {}): FreeCellBoard {
  return {
    cells: [null, null, null, null],
    foundations: [[], [], [], []],
    cascades: Array.from({ length: CASCADES }, () => []),
    ...partial,
  };
}

const cascadesOf = (...piles: Card[][]): Card[][] =>
  Array.from({ length: CASCADES }, (_, i) => piles[i] ?? []);

describe('dealBoard', () => {
  it('lays 52 face-up cards into eight columns of 7,7,7,7,6,6,6,6', () => {
    const dealt = dealBoard('fc-daily-2026-08-07');
    expect(dealt.cascades.map((pile) => pile.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(dealt.cells).toEqual([null, null, null, null]);
    expect(dealt.foundations).toEqual([[], [], [], []]);
    expect(dealt.cascades.flat()).toHaveLength(CARD_COUNT);
    expect(isValidBoard(dealt)).toBe(true);
  });

  it('is determined entirely by the seed', () => {
    expect(dealBoard('fc-free-x')).toEqual(dealBoard('fc-free-x'));
    expect(dealBoard('fc-free-x')).not.toEqual(dealBoard('fc-free-y'));
  });
});

describe('placement rules', () => {
  it('stacks descending in alternating colours, and takes anything into an empty column', () => {
    const b = board({ cascades: cascadesOf([S(8)], [], [H(8)]) });
    expect(canPlaceOnCascade(b, H(7), 0)).toBe(true);
    expect(canPlaceOnCascade(b, D(7), 0)).toBe(true);
    expect(canPlaceOnCascade(b, C(7), 0)).toBe(false); // same colour
    expect(canPlaceOnCascade(b, H(6), 0)).toBe(false); // wrong rank
    expect(canPlaceOnCascade(b, S(13), 1)).toBe(true); // empty column: any card
    expect(canPlaceOnCascade(b, D(3), 1)).toBe(true);
    expect(canPlaceOnCascade(b, S(7), 2)).toBe(true);
  });

  it('accepts only the next card of a foundation suit', () => {
    const b = board({ foundations: [[S(1), S(2)], [], [], []] });
    expect(canPlaceOnFoundation(b, S(3))).toBe(true);
    expect(canPlaceOnFoundation(b, S(4))).toBe(false);
    expect(canPlaceOnFoundation(b, H(1))).toBe(true);
    expect(canPlaceOnFoundation(b, H(2))).toBe(false);
  });
});

describe('single-card moves', () => {
  it('parks a top card in the first empty cell, and refuses when all four are full', () => {
    const b = board({ cascades: cascadesOf([S(5), H(9)]) });
    const parked = moveCascadeToCell(b, 0)!;
    expect(parked.cells).toEqual([H(9), null, null, null]);
    expect(parked.cascades[0]).toEqual([S(5)]);

    const full = board({
      cells: [S(1), S(2), S(3), S(4)],
      cascades: cascadesOf([H(9)]),
    });
    expect(moveCascadeToCell(full, 0)).toBeNull();
    expect(moveCascadeToCell(b, 1)).toBeNull(); // empty column has no top card
  });

  it('parks into the cell the player named, and refuses one already taken', () => {
    const b = board({
      cells: [S(1), null, null, null],
      cascades: cascadesOf([S(5), H(9)]),
    });
    expect(moveCascadeToCell(b, 0, 2)!.cells).toEqual([S(1), null, H(9), null]);
    expect(moveCascadeToCell(b, 0, 0)).toBeNull(); // occupied
    expect(moveCascadeToCell(b, 0, 4)).toBeNull(); // no such cell
    expect(moveCascadeToCell(b, 0, -1)).toBeNull();
    // Unnamed still takes the first empty one.
    expect(moveCascadeToCell(b, 0)!.cells).toEqual([S(1), H(9), null, null]);
  });

  it('sends cards to foundations from a column and from a cell', () => {
    const b = board({
      cells: [H(1), null, null, null],
      cascades: cascadesOf([D(4), S(1)]),
    });
    const fromCascade = moveCascadeToFoundation(b, 0)!;
    expect(fromCascade.foundations[0]).toEqual([S(1)]);
    expect(fromCascade.cascades[0]).toEqual([D(4)]);

    const fromCell = moveCellToFoundation(b, 0)!;
    expect(fromCell.foundations[1]).toEqual([H(1)]);
    expect(fromCell.cells[0]).toBeNull();

    expect(moveCascadeToFoundation(b, 1)).toBeNull();
    expect(moveCellToFoundation(b, 1)).toBeNull();
  });

  it('plays a cell card back onto a column only where it fits', () => {
    const b = board({
      cells: [H(7), null, null, null],
      cascades: cascadesOf([S(8)], [H(9)], []),
    });
    expect(moveCellToCascade(b, 0, 0)!.cascades[0]).toEqual([S(8), H(7)]);
    expect(moveCellToCascade(b, 0, 0)!.cells[0]).toBeNull();
    expect(moveCellToCascade(b, 0, 1)).toBeNull(); // red on red
    expect(moveCellToCascade(b, 0, 2)!.cascades[2]).toEqual([H(7)]); // empty column
    expect(moveCellToCascade(b, 1, 0)).toBeNull(); // empty cell
  });

  it('leaves the board it was given alone, whether the move lands or not', () => {
    const b = board({ cascades: cascadesOf([S(8)], [C(9)], [H(9)]) });
    expect(moveCascadeRun(b, 0, 0, 1)).toBeNull(); // black on black
    expect(moveCascadeRun(b, 0, 0, 2)!.cascades[2]).toEqual([H(9), S(8)]);
    expect(b.cascades[0]).toEqual([S(8)]);
    expect(b.cascades[1]).toEqual([C(9)]);
    expect(b.cascades[2]).toEqual([H(9)]);
  });
});

describe('movableRunStart', () => {
  it('finds the deepest card of the tail run', () => {
    // 4H sits on 5S sits on 6H: a run of three. The 9C below breaks it.
    const b = board({ cascades: cascadesOf([C(9), H(6), S(5), H(4)], [], [S(3)]) });
    expect(movableRunStart(b, 0)).toBe(1);
    expect(movableRunStart(b, 1)).toBe(0);
    expect(movableRunStart(b, 2)).toBe(0);
  });
});

describe('supermove capacity (§3)', () => {
  it('is (1 + free cells) x 2^(empty columns)', () => {
    expect(maxMoveSize(board({ cascades: cascadesOf([S(1)]) }), 0)).toBe(
      // four cells free, seven other columns empty — but `to` is column 0,
      // which is not empty, so all seven stage: 5 * 2^7.
      5 * 2 ** 7,
    );
    const oneCellUsed = board({
      cells: [S(1), null, null, null],
      cascades: Array.from({ length: CASCADES }, () => [H(9)]),
    });
    expect(maxMoveSize(oneCellUsed, 0)).toBe(4); // 3 cells free, no empty column
  });

  it('does not let the destination column stage its own move', () => {
    const b = board({
      cells: [S(1), S(2), null, null],
      cascades: cascadesOf([H(9)], [], [], [C(4)], [C(5)], [C(6)], [C(7)], [C(8)]),
    });
    // Two cells free, two empty columns (1 and 2).
    expect(maxMoveSize(b, 0)).toBe(3 * 2 ** 2); // onto a filled column: both stage
    expect(maxMoveSize(b, 1)).toBe(3 * 2 ** 1); // onto an empty one: only the other stages
  });

  it('moves a run of exactly the capacity and refuses one more', () => {
    // Column 0's tail is the three-card run 6H 5S 4H. The black 7S at column 1
    // takes all three; the red 6D at column 2 takes the last two.
    const cascades = cascadesOf(
      [C(9), H(6), S(5), H(4)],
      [S(7)],
      [D(6)],
      [D(10)],
      [C(10)],
      [H(10)],
      [S(10)],
      [D(11)],
    );
    const capacityTwo = board({ cells: [S(1), S(2), S(3), null], cascades });
    expect(maxMoveSize(capacityTwo, 1)).toBe(2);
    expect(moveCascadeRun(capacityTwo, 0, 2, 2)).not.toBeNull(); // two cards: fits
    expect(moveCascadeRun(capacityTwo, 0, 1, 1)).toBeNull(); // three: legal shape, over capacity

    const capacityThree = board({ cells: [S(1), S(2), null, null], cascades });
    expect(maxMoveSize(capacityThree, 1)).toBe(3);
    const moved = moveCascadeRun(capacityThree, 0, 1, 1)!;
    expect(moved.cascades[0]).toEqual([C(9)]);
    expect(moved.cascades[1]).toEqual([S(7), H(6), S(5), H(4)]);
  });

  it('refuses a tail that is not a run, and a run that does not fit the destination', () => {
    const b = board({ cascades: cascadesOf([C(9), H(6), S(4)], [S(7)], [H(7)]) });
    expect(moveCascadeRun(b, 0, 1, 1)).toBeNull(); // 6H,4S is not a run
    expect(moveCascadeRun(b, 0, 2, 2)).toBeNull(); // 4S does not sit on 7H
    expect(moveCascadeRun(b, 0, 0, 0)).toBeNull(); // same column
    expect(moveCascadeRun(b, 0, 9, 1)).toBeNull(); // index past the end
  });
});

describe('hasAnyMove (§2)', () => {
  it('is true while a cell is free and any column has a card', () => {
    const b = board({ cascades: cascadesOf([S(5)]) });
    expect(hasAnyMove(b)).toBe(true);
  });

  /**
   * Every cell full, every column occupied, and every exposed card black — so
   * each one wants a red card one rank higher, and none is on show. No ace is
   * exposed either, so the foundations take nothing.
   */
  const deadEnd = board({
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

  it('is false when every cell is full and nothing fits anywhere', () => {
    expect(maxMoveSize(deadEnd, 0)).toBe(1);
    expect(hasAnyMove(deadEnd)).toBe(false);
  });

  it('finds a foundation move even with every cell full and nothing stacking', () => {
    const withAce = board({
      ...deadEnd,
      cascades: deadEnd.cascades.map((pile, i) => (i === 1 ? [H(2), C(1)] : pile)),
    });
    expect(hasAnyMove(withAce)).toBe(true);
  });

  /**
   * Capacity above one always implies a free cell or an empty column, and each
   * of those is itself somewhere a single card can go. So a board that offers a
   * supermove always offers a one-card move too, and a board with no one-card
   * move is stuck however long its runs are. The run enumeration in
   * `hasAnyMove` can therefore never be the only thing that saves a board —
   * it is kept because it states the rule directly instead of relying on this.
   */
  it('cannot offer a multi-card move without also offering a single-card one', () => {
    // Column 0 ends in the run 5S 4H, and the 6D at column 1 would take it —
    // but with every cell full and no empty column, capacity is one card.
    const runBlocked = board({
      cells: [S(10), C(10), S(9), C(9)],
      cascades: cascadesOf(
        [D(11), S(5), H(4)],
        [D(6)],
        [H(3), S(11)],
        [H(5), S(12)],
        [D(2), C(11)],
        [D(3), C(12)],
        [D(4), S(13)],
        [D(5), C(13)],
      ),
    });
    expect(movableRunStart(runBlocked, 0)).toBe(1);
    expect(maxMoveSize(runBlocked, 1)).toBe(1);
    expect(moveCascadeRun(runBlocked, 0, 1, 1)).toBeNull();

    // Freeing a cell raises capacity to two and the run travels — but that same
    // free cell is already a legal destination for any top card.
    const freed = board({ ...runBlocked, cells: [S(10), C(10), S(9), null] });
    expect(maxMoveSize(freed, 1)).toBe(2);
    expect(moveCascadeRun(freed, 0, 1, 1)!.cascades[1]).toEqual([D(6), S(5), H(4)]);
    expect(moveCascadeToCell(freed, 0)).not.toBeNull();
  });

  it('never calls a freshly dealt board dead', () => {
    for (let i = 0; i < 25; i++) {
      expect(hasAnyMove(dealBoard(`fc-free-sample-${i}`))).toBe(true);
    }
  });
});

describe('auto-finish (§7)', () => {
  const decided = board({
    cells: [null, null, null, null],
    foundations: [
      Array.from({ length: 11 }, (_, i) => S(i + 1)),
      Array.from({ length: 11 }, (_, i) => H(i + 1)),
      Array.from({ length: 11 }, (_, i) => D(i + 1)),
      Array.from({ length: 11 }, (_, i) => C(i + 1)),
    ],
    cascades: cascadesOf([S(13), S(12)], [H(13), H(12)], [D(13), D(12)], [C(13), C(12)]),
  });

  it('recognises a decided board and plays it out, counting every card', () => {
    expect(canAutoFinish(decided)).toBe(true);
    const result = autoFinish(decided)!;
    expect(result.moved).toBe(8);
    expect(isWon(result.board)).toBe(true);
    expect(isValidBoard(result.board)).toBe(true);
  });

  it('refuses a board that still needs a decision', () => {
    // The 2S is buried under the 3S, so foundation moves alone stall.
    const undecided = board({
      foundations: [[S(1)], [], [], []],
      cascades: cascadesOf([S(3), S(2)].reverse(), [H(1)]),
    });
    expect(canAutoFinish(undecided)).toBe(false);
    expect(autoFinish(undecided)).toBeNull();
  });

  it('is not offered on a board that is already won', () => {
    const won = board({
      foundations: [
        Array.from({ length: 13 }, (_, i) => S(i + 1)),
        Array.from({ length: 13 }, (_, i) => H(i + 1)),
        Array.from({ length: 13 }, (_, i) => D(i + 1)),
        Array.from({ length: 13 }, (_, i) => C(i + 1)),
      ],
    });
    expect(isWon(won)).toBe(true);
    expect(canAutoFinish(won)).toBe(false);
    expect(autoFinish(won)).toBeNull();
  });

  it('empties the cells too', () => {
    const withCells = board({
      cells: [S(13), H(13), null, null],
      foundations: [
        Array.from({ length: 12 }, (_, i) => S(i + 1)),
        Array.from({ length: 12 }, (_, i) => H(i + 1)),
        Array.from({ length: 13 }, (_, i) => D(i + 1)),
        Array.from({ length: 13 }, (_, i) => C(i + 1)),
      ],
    });
    const result = autoFinish(withCells)!;
    expect(result.moved).toBe(2);
    expect(result.board.cells).toEqual([null, null, null, null]);
    expect(isWon(result.board)).toBe(true);
  });
});

describe('cascadeTop', () => {
  it('reads the end of a column, or null when it is empty', () => {
    const b = board({ cascades: cascadesOf([S(5), H(9)], []) });
    expect(cascadeTop(b, 0)).toBe(H(9));
    expect(cascadeTop(b, 1)).toBeNull();
    expect(cascadeTop(b, 99)).toBeNull();
  });
});
