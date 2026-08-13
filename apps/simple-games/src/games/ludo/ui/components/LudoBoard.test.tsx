/**
 * The board's geometry, checked as geometry.
 *
 * `cellOf` is the only place the one number that is a pawn's whole position
 * (game/types.ts) becomes a place on a grid, and every one of these properties
 * is invisible on screen until it is wrong: a ring that repeats a square draws
 * two different squares on top of each other, a home column that lands on the
 * ring puts a pawn somewhere it can be captured, and a path that jumps sends a
 * pawn across the board mid-walk. None of them would fail a render test.
 *
 * The one that ties the drawing to the rules is the last: for every seat, the
 * ring square at `progress = 52` — the one before its own entrance — has to
 * touch the first square of that seat's home column, because that is where a
 * pawn turns off (docs/LUDO_RULES.md §1).
 */
import { describe, expect, it } from 'vitest';
import {
  globalSquareOf,
  HOME_COLUMN_LENGTH,
  HOME_PROGRESS,
  PAWNS_PER_SEAT,
  RING_SIZE,
  SEATS,
  SEAT_START_STRIDE,
  type Seat,
} from '../../game';
import { cellOf, homeColumnCell, yardCell, GRID_SIZE, RING_CELLS, type Cell } from './LudoBoard';

const key = (cell: Cell): string => `${cell.row},${cell.col}`;

const onBoard = (cell: Cell): boolean =>
  cell.row >= 0 && cell.row < GRID_SIZE && cell.col >= 0 && cell.col < GRID_SIZE;

/** Touching, orthogonally or at a corner. */
const touches = (a: Cell, b: Cell): boolean =>
  Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) === 1;

const orthogonal = (a: Cell, b: Cell): boolean =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

const ringCells = () => [...RING_CELLS];
const homeCells = () =>
  SEATS.flatMap((seat) =>
    Array.from({ length: HOME_COLUMN_LENGTH }, (_, step) => homeColumnCell(seat, step)),
  );
const yardCells = () =>
  SEATS.flatMap((seat) =>
    Array.from({ length: PAWNS_PER_SEAT }, (_, slot) => yardCell(seat, slot)),
  );

describe('the ring', () => {
  it('is fifty-two distinct squares, all on the grid', () => {
    expect(RING_CELLS).toHaveLength(RING_SIZE);
    expect(new Set(ringCells().map(key)).size).toBe(RING_SIZE);
    expect(ringCells().every(onBoard)).toBe(true);
  });

  it('is a closed loop — every square touches the next', () => {
    for (let square = 0; square < RING_SIZE; square++) {
      const here = RING_CELLS[square]!;
      const next = RING_CELLS[(square + 1) % RING_SIZE]!;
      expect(touches(here, next), `square ${square} to ${(square + 1) % RING_SIZE}`).toBe(true);
    }
  });

  it('puts each seat’s entrance thirteen squares from the last', () => {
    // The rule is `13 * seat` (§1); this checks the drawing obeys it as well
    // as the arithmetic does, which is what makes the four quadrants rotations
    // of one another rather than four hand-placed lists.
    for (const seat of SEATS) {
      expect(globalSquareOf(seat, 1)).toBe(seat * SEAT_START_STRIDE);
      expect(cellOf(seat, 0, 1)).toEqual(RING_CELLS[seat * SEAT_START_STRIDE]);
    }
  });
});

describe('the home columns and the yards', () => {
  it('never share a square with the ring, or with each other', () => {
    const all = [...ringCells(), ...homeCells(), ...yardCells()].map(key);
    expect(new Set(all).size).toBe(all.length);
    expect([...homeCells(), ...yardCells()].every(onBoard)).toBe(true);
  });

  it('run inward as a straight line of six, ending beside the goal', () => {
    for (const seat of SEATS) {
      for (let step = 1; step < HOME_COLUMN_LENGTH; step++) {
        expect(orthogonal(homeColumnCell(seat, step - 1), homeColumnCell(seat, step))).toBe(true);
      }
      // The last square of the column is next door to the middle, which is
      // where every pawn that gets home stands.
      const goal = cellOf(seat, 0, HOME_PROGRESS);
      expect(goal).toEqual({ row: 7, col: 7 });
      expect(orthogonal(homeColumnCell(seat, HOME_COLUMN_LENGTH - 1), goal)).toBe(true);
    }
  });

  it('turns off the ring exactly where progress 52 leaves it', () => {
    for (const seat of SEATS) {
      const lastRing = cellOf(seat, 0, RING_SIZE);
      const firstHome = cellOf(seat, 0, RING_SIZE + 1);
      expect(lastRing).toEqual(RING_CELLS[(seat * SEAT_START_STRIDE + RING_SIZE - 1) % RING_SIZE]);
      expect(firstHome).toEqual(homeColumnCell(seat, 0));
      // The turn is a single step sideways, as it is on a real board.
      expect(orthogonal(lastRing, firstHome), `seat ${seat}`).toBe(true);
    }
  });

  it('gives every pawn in a yard a slot of its own', () => {
    for (const seat of SEATS) {
      const slots = Array.from({ length: PAWNS_PER_SEAT }, (_, pawn) => cellOf(seat, pawn, 0));
      expect(new Set(slots.map(key)).size).toBe(PAWNS_PER_SEAT);
    }
  });
});

describe('a pawn’s whole journey', () => {
  it('never leaves the grid and never doubles back on itself', () => {
    for (const seat of SEATS) {
      const walked: Cell[] = [];
      for (let progress = 1; progress <= HOME_PROGRESS; progress++) {
        const cell = cellOf(seat as Seat, 0, progress);
        expect(onBoard(cell), `seat ${seat} at ${progress}`).toBe(true);
        walked.push(cell);
      }
      // Fifty-two ring squares, six home column squares and the goal, each
      // visited once — the journey the one number describes (§1).
      expect(walked).toHaveLength(RING_SIZE + HOME_COLUMN_LENGTH + 1);
      expect(new Set(walked.map(key)).size).toBe(walked.length);
      for (let step = 1; step < walked.length; step++) {
        expect(touches(walked[step - 1]!, walked[step]!), `seat ${seat} step ${step}`).toBe(true);
      }
    }
  });
});
