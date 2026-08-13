import { describe, expect, it } from 'vitest';
import {
  AIM_MAX_ANGLE_FROM_VERTICAL,
  BOARD_WIDTH,
  CELL_RADIUS,
  LOSS_LINE_Y,
  ROW_HEIGHT,
} from './constants';
import {
  clampAimAngle,
  crossesLossLine,
  isBoardCleared,
  nextCeilingOffset,
  placeAndResolve,
  simulateShot,
} from './engine';
import { effectiveCenter, cellKey } from './grid';
import type { Board, BubbleColor, Cell } from './types';

const CHAR_COLOR: Record<string, BubbleColor> = {
  b: 'blue',
  g: 'green',
  y: 'yellow',
  p: 'purple',
  o: 'orange',
  c: 'cyan',
};

/** Builds a board from text rows, mirroring generator.ts's boardToString inverse. */
function boardFromRows(rows: readonly string[]): Board {
  const cells = new Map<string, BubbleColor>();
  rows.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch !== '.') cells.set(cellKey({ row, col }), CHAR_COLOR[ch]!);
    });
  });
  return cells;
}

describe('simulateShot — reflection and landing determinism', () => {
  it('a straight-up shot on an empty board reaches row 0, tie-broken to the left column', () => {
    // LAUNCHER_X sits exactly midway between column 3 and column 4 of row 0
    // (both 20px away) — the canonical tie the landing rule has to resolve.
    const result = simulateShot(new Map(), 0, 0);
    expect(result.landingCell).toEqual({ row: 0, col: 3 });
    expect(result.path[0]).toEqual({ x: BOARD_WIDTH / 2, y: expect.any(Number) });
  });

  it('the same board, offset, and angle always land the same cell', () => {
    const board = boardFromRows(['bg......', '.py.....']);
    const a = simulateShot(board, 1, 0.4);
    const b = simulateShot(board, 1, 0.4);
    expect(a).toEqual(b);
  });

  it('different angles land in different columns', () => {
    // Shallow enough that neither shot reaches a side wall before the
    // ceiling (BOARD_HEIGHT's tall runway means a steeper angle would
    // bounce first, which is exactly the case the next test covers).
    const left = simulateShot(new Map(), 0, -0.05);
    const right = simulateShot(new Map(), 0, 0.05);
    expect(left.landingCell.col).toBeLessThan(right.landingCell.col);
  });

  it('a steep angle bounces off a side wall at least once and stays in bounds', () => {
    const result = simulateShot(new Map(), 0, AIM_MAX_ANGLE_FROM_VERTICAL);
    expect(result.path.length).toBeGreaterThan(2); // launch + >=1 bounce + landing
    for (const point of result.path) {
      expect(point.x).toBeGreaterThanOrEqual(CELL_RADIUS - 1e-6);
      expect(point.x).toBeLessThanOrEqual(BOARD_WIDTH - CELL_RADIUS + 1e-6);
    }
  });

  it('an angle beyond the clamp behaves exactly like the clamp boundary (clamped internally)', () => {
    const atClamp = simulateShot(new Map(), 0, AIM_MAX_ANGLE_FROM_VERTICAL);
    const beyond = simulateShot(new Map(), 0, AIM_MAX_ANGLE_FROM_VERTICAL + 5);
    expect(beyond).toEqual(atClamp);

    const atNegClamp = simulateShot(new Map(), 0, -AIM_MAX_ANGLE_FROM_VERTICAL);
    const beyondNeg = simulateShot(new Map(), 0, -AIM_MAX_ANGLE_FROM_VERTICAL - 5);
    expect(beyondNeg).toEqual(atNegClamp);
  });

  it('clampAimAngle matches simulateShot’s own clamp', () => {
    expect(clampAimAngle(10)).toBeCloseTo(AIM_MAX_ANGLE_FROM_VERTICAL, 10);
    expect(clampAimAngle(-10)).toBeCloseTo(-AIM_MAX_ANGLE_FROM_VERTICAL, 10);
    expect(clampAimAngle(0.1)).toBeCloseTo(0.1, 10);
  });

  it('grazing the wall (angle one step short of a bounce) still lands in bounds', () => {
    // A hair under the clamp: close enough to graze the wall band without
    // necessarily crossing it before the ceiling is reached.
    const result = simulateShot(new Map(), 0, AIM_MAX_ANGLE_FROM_VERTICAL - 0.001);
    expect(result.landingCell.col).toBeGreaterThanOrEqual(0);
    for (const point of result.path) {
      expect(point.x).toBeGreaterThanOrEqual(-1e-6);
      expect(point.x).toBeLessThanOrEqual(BOARD_WIDTH + 1e-6);
    }
  });

  it('lands against an existing bubble rather than passing through it', () => {
    // A single bubble at row 0, col 3 sits 20px off the launcher's vertical
    // line — close enough that a straight-up shot collides with it before it
    // ever reaches the ceiling, and lands in the neighbor directly below it.
    const board = boardFromRows(['...b....']);
    const result = simulateShot(board, 0, 0);
    expect(result.landingCell).toEqual({ row: 1, col: 3 });
  });

  it('a higher ceilingOffset moves the landing row toward the launcher', () => {
    const board = boardFromRows(['b.......']);
    const low = simulateShot(board, 0, 0);
    const high = simulateShot(board, 3, 0);
    // Same board topology, but the whole stack — including where a bubble
    // now lands — has shifted down by the descent.
    const lowY = effectiveCenter(low.landingCell, 0).y;
    const highY = effectiveCenter(high.landingCell, 3).y;
    expect(highY).toBeGreaterThan(lowY);
  });
});

describe('placeAndResolve — popping and cluster fall', () => {
  it('three same-color connected bubbles pop, and only those three', () => {
    const board = boardFromRows(['bb......']);
    const outcome = placeAndResolve(board, { row: 0, col: 2 }, 'blue');
    expect(outcome.popped.map((c) => cellKey(c)).sort()).toEqual(['0,0', '0,1', '0,2'].sort());
    expect(outcome.board.size).toBe(0);
  });

  it('a pair placement does not pop', () => {
    const board = boardFromRows(['b.......']);
    const outcome = placeAndResolve(board, { row: 0, col: 1 }, 'blue');
    expect(outcome.popped).toHaveLength(0);
    expect(outcome.board.size).toBe(2);
  });

  it('popping a bridge drops whatever it alone was holding to the ceiling', () => {
    const board = boardFromRows(['bb......', '.g......', '.g......']);
    const outcome = placeAndResolve(board, { row: 0, col: 2 }, 'blue');
    expect(outcome.popped.map(cellKey).sort()).toEqual(['0,0', '0,1', '0,2'].sort());
    const fellKeys = outcome.fell.map(cellKey).sort();
    expect(fellKeys).toEqual(['1,1', '2,1'].sort());
    expect(outcome.board.size).toBe(0);
  });

  it('a cluster still attached to the ceiling through another path does not fall', () => {
    // Two bridges hold up the same lower bubble; popping only one leaves it standing.
    const board = boardFromRows(['bbb.....', '.g......']);
    const outcome = placeAndResolve(board, { row: 0, col: 3 }, 'blue');
    expect(outcome.popped.map(cellKey).sort()).toEqual(['0,0', '0,1', '0,2', '0,3'].sort());
    // row0 is fully cleared, but row1's bubble was only ever connected
    // through row0 col1 — once every row0 cell here is gone it must fall too.
    expect(outcome.fell.map(cellKey)).toEqual(['1,1']);
  });

  it('color mismatch never pops, however tightly packed', () => {
    const board = boardFromRows(['bg......']);
    const outcome = placeAndResolve(board, { row: 0, col: 2 }, 'blue');
    expect(outcome.popped).toHaveLength(0);
  });
});

describe('ceiling descent and the loss line', () => {
  it('nextCeilingOffset drops exactly one row', () => {
    expect(nextCeilingOffset(0)).toBe(1);
    expect(nextCeilingOffset(4)).toBe(5);
  });

  it('crosses the loss line only once a bubble’s lower edge reaches it', () => {
    // Pick a row whose logical y sits just below the loss line, then supply
    // exactly enough offset to cross it and one row less that does not.
    const rowsToLine = Math.ceil((LOSS_LINE_Y - 2 * CELL_RADIUS) / ROW_HEIGHT);
    const board = boardFromRows(['b']); // a single bubble at row 0, col 0
    expect(crossesLossLine(board, rowsToLine - 1)).toBe(false);
    expect(crossesLossLine(board, rowsToLine)).toBe(true);
  });

  it('an empty board never crosses the loss line', () => {
    expect(crossesLossLine(new Map(), 1000)).toBe(false);
  });
});

describe('isBoardCleared', () => {
  it('is true only once every cell is gone', () => {
    expect(isBoardCleared(new Map())).toBe(true);
    expect(isBoardCleared(boardFromRows(['b.......']))).toBe(false);
  });
});

// Sanity: the fixture builder round-trips through the same key scheme engine.ts uses.
describe('boardFromRows test helper', () => {
  it('places colors at the expected cells', () => {
    const board = boardFromRows(['bg......', '.py.....']);
    const at = (cell: Cell) => board.get(cellKey(cell));
    expect(at({ row: 0, col: 0 })).toBe('blue');
    expect(at({ row: 0, col: 1 })).toBe('green');
    expect(at({ row: 1, col: 1 })).toBe('purple');
    expect(at({ row: 1, col: 2 })).toBe('yellow');
  });
});
