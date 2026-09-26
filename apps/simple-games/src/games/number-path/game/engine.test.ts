/**
 * The board rules of docs/NUMBER_PATH_RULES.md §1–§4 on a board small enough
 * to read by eye: a 3×3 with 1 in a corner, 2 in the middle, 3 in the far
 * corner, and two walls that leave the road one way to go.
 *
 *   1 . .        road: 0 1 2 5 4 3 6 7 8
 *   ─ 2 .        walls: below cell 1, below cell 4
 *   . ─ 3
 */
import { describe, expect, it } from 'vitest';
import {
  applyTrace,
  buildBoard,
  canExtend,
  directionBetween,
  emptyPath,
  extend,
  firstDeviation,
  isLegalPrefix,
  isOpen,
  isSolution,
  neighbourOf,
  nextNumber,
  truncate,
  wallBetween,
  wallCells,
} from './engine';
import { DOWN, LEFT, RIGHT, UP } from './types';

const NUMBERS = [
  [0, 1],
  [4, 2],
  [8, 3],
] as const;
const WALLED = buildBoard({ width: 3, height: 3, numbers: NUMBERS, walls: ['h1', 'h4'] })!;
const OPEN = buildBoard({ width: 3, height: 3, numbers: NUMBERS, walls: [] })!;
const ROAD = [0, 1, 2, 5, 4, 3, 6, 7, 8];

describe('the grid (§1)', () => {
  it('names neighbours and refuses to wrap a row', () => {
    expect(neighbourOf(4, UP, 3, 3)).toBe(1);
    expect(neighbourOf(4, RIGHT, 3, 3)).toBe(5);
    expect(neighbourOf(4, DOWN, 3, 3)).toBe(7);
    expect(neighbourOf(4, LEFT, 3, 3)).toBe(3);
    expect(neighbourOf(0, UP, 3, 3)).toBe(-1);
    expect(neighbourOf(2, RIGHT, 3, 3)).toBe(-1);
    // 2 and 3 are consecutive indices on different rows: not neighbours.
    expect(directionBetween(2, 3, 3)).toBeNull();
    expect(directionBetween(3, 2, 3)).toBeNull();
    expect(directionBetween(4, 1, 3)).toBe(UP);
    expect(directionBetween(4, 5, 3)).toBe(RIGHT);
  });

  it('names walls by the edge they sit on, in either direction', () => {
    expect(wallBetween(1, 4, 3)).toBe('h1');
    expect(wallBetween(4, 1, 3)).toBe('h1');
    expect(wallBetween(4, 5, 3)).toBe('v4');
    expect(wallBetween(2, 3, 3)).toBeNull();
    expect(wallCells('h1', 3, 3)).toEqual([1, 4]);
    expect(wallCells('v4', 3, 3)).toEqual([4, 5]);
    // Edges that leave the grid, and ids that are not edges.
    expect(wallCells('h7', 3, 3)).toBeNull();
    expect(wallCells('v2', 3, 3)).toBeNull();
    expect(wallCells('v9', 3, 3)).toBeNull();
    expect(wallCells('x1', 3, 3)).toBeNull();
    expect(wallCells('h01', 3, 3)).toBeNull();
  });

  it('builds a board with its walls closed and its numbers indexed', () => {
    expect(WALLED.last).toBe(3);
    expect(WALLED.cellOf).toEqual([-1, 0, 4, 8]);
    expect(WALLED.walls).toEqual(['h1', 'h4']);
    expect(isOpen(WALLED, 1, 4)).toBe(false);
    expect(isOpen(WALLED, 4, 1)).toBe(false);
    expect(isOpen(WALLED, 4, 7)).toBe(false);
    expect(isOpen(WALLED, 4, 3)).toBe(true);
    expect(isOpen(WALLED, 0, 4)).toBe(false);
    expect(WALLED.adjacent[4]).toEqual([5, 3]);
    expect(OPEN.adjacent[4]).toEqual([1, 5, 7, 3]);
    expect(OPEN.open[0]).toBe(RIGHT | DOWN);
  });

  const bad: Array<[string, Parameters<typeof buildBoard>[0]]> = [
    ['a side of one', { width: 1, height: 3, numbers: NUMBERS, walls: [] }],
    ['a side past the largest board', { width: 8, height: 3, numbers: NUMBERS, walls: [] }],
    ['a fractional side', { width: 3.5, height: 3, numbers: NUMBERS, walls: [] }],
    ['a single number', { width: 3, height: 3, numbers: [[0, 1]], walls: [] }],
    [
      'a number used twice',
      {
        width: 3,
        height: 3,
        numbers: [
          [0, 1],
          [4, 1],
        ],
        walls: [],
      },
    ],
    [
      'two numbers on one cell',
      {
        width: 3,
        height: 3,
        numbers: [
          [0, 1],
          [0, 2],
        ],
        walls: [],
      },
    ],
    [
      'a gap in the numbering',
      {
        width: 3,
        height: 3,
        numbers: [
          [0, 1],
          [8, 3],
        ],
        walls: [],
      },
    ],
    [
      'a cell off the grid',
      {
        width: 3,
        height: 3,
        numbers: [
          [0, 1],
          [9, 2],
        ],
        walls: [],
      },
    ],
    ['a wall that names no edge', { width: 3, height: 3, numbers: NUMBERS, walls: ['v2'] }],
    ['a wall written twice', { width: 3, height: 3, numbers: NUMBERS, walls: ['h1', 'h1'] }],
    ['a wall with a stray id', { width: 3, height: 3, numbers: NUMBERS, walls: ['wall'] }],
  ];
  for (const [name, spec] of bad) {
    it(`refuses ${name}`, () => {
      expect(buildBoard(spec)).toBeNull();
    });
  }
});

describe('one step (§3)', () => {
  it('starts on 1 and steps to an open neighbour', () => {
    const path = emptyPath(WALLED);
    expect(path).toEqual([0]);
    expect(nextNumber(WALLED, path)).toBe(2);
    expect(canExtend(WALLED, path, 1)).toBe(true);
    expect(canExtend(WALLED, path, 3)).toBe(true);
    expect(canExtend(WALLED, path, 4)).toBe(false); // not a neighbour
    expect(canExtend(WALLED, path, 0)).toBe(false); // already on the path
  });

  it('does not cross a wall', () => {
    expect(canExtend(WALLED, [0, 1], 4)).toBe(false);
    expect(canExtend(OPEN, [0, 1], 4)).toBe(true);
  });

  it('enters a number only when it is due', () => {
    // From 1 straight down and across: 3 (cell 8) before 2 is refused.
    expect(canExtend(OPEN, [0, 3, 6, 7], 8)).toBe(false);
    expect(canExtend(OPEN, [0, 3, 6, 7], 4)).toBe(true);
    expect(nextNumber(OPEN, [0, 3, 6, 7, 4])).toBe(3);
    expect(canExtend(OPEN, [0, 1, 2, 5, 4, 3, 6, 7], 8)).toBe(true);
  });

  it('never extends past K', () => {
    // 3 reached early, with an unvisited open neighbour of it left over: still
    // refused, so this only passes while the K guard itself refuses it (and
    // not merely because that neighbour already sits earlier on the path).
    expect(canExtend(OPEN, [0, 1, 4, 5, 8], 7)).toBe(false);
    expect(canExtend(OPEN, [0, 3, 4, 7, 8], 5)).toBe(false);
  });
});

describe('a trace (§4)', () => {
  it('extends along legal cells and ignores the rest', () => {
    expect(applyTrace(WALLED, [0], [1, 2, 5])).toEqual([0, 1, 2, 5]);
    // A wall, a diagonal jump and a cell already taken change nothing.
    expect(applyTrace(WALLED, [0, 1], [4])).toEqual([0, 1]);
    expect(applyTrace(WALLED, [0, 1], [5])).toEqual([0, 1]);
    expect(applyTrace(WALLED, [0, 1], [0])).toEqual([0]);
  });

  it('cuts back to a cell already on the path, however far back', () => {
    expect(applyTrace(WALLED, ROAD.slice(0, 6), [4])).toEqual(ROAD.slice(0, 5));
    expect(applyTrace(WALLED, ROAD.slice(0, 6), [1])).toEqual([0, 1]);
    // Back one and on again in one stroke: the new branch replaces the old.
    expect(applyTrace(OPEN, [0, 1, 2], [1, 4])).toEqual([0, 1, 4]);
  });

  it('returns the very same path when nothing changed', () => {
    const path = [0, 1, 2];
    expect(applyTrace(WALLED, path, [2])).toBe(path);
    expect(applyTrace(WALLED, path, [4, 8])).toBe(path);
    expect(applyTrace(WALLED, path, [])).toBe(path);
  });

  it('truncates to a cell on the path and never below the start', () => {
    expect(truncate([0, 1, 2], 1)).toEqual([0, 1]);
    expect(truncate([0, 1, 2], 2)).toEqual([0, 1, 2]);
    expect(truncate([0, 1, 2], 0)).toEqual([0]);
    expect(truncate([0, 1, 2], 5)).toBeNull();
    expect(extend([0, 1], 2)).toEqual([0, 1, 2]);
  });
});

describe('a legal prefix and the win (§2, §3)', () => {
  it('accepts every prefix of the road, and the road itself as the solution', () => {
    for (let length = 1; length <= ROAD.length; length++) {
      expect(isLegalPrefix(WALLED, ROAD.slice(0, length)), `length ${length}`).toBe(true);
    }
    expect(isSolution(WALLED, ROAD)).toBe(true);
    expect(isSolution(OPEN, ROAD)).toBe(true);
    expect(firstDeviation(ROAD.slice(0, 4), ROAD)).toBe(-1);
    expect(firstDeviation([0, 3, 6], ROAD)).toBe(1);
  });

  const illegal: Array<[string, number[]]> = [
    ['an empty path', []],
    ['a path that does not start on 1', [1, 2]],
    ['a diagonal step', [0, 4]],
    ['a step through a wall', [0, 1, 4]],
    ['a repeated cell', [0, 1, 0]],
    ['a number out of turn', [0, 3, 6, 7, 8]],
    ['a cell past K', [0, 1, 2, 5, 8, 7]],
    ['a cell off the grid', [0, 1, 2, 5, 9]],
    ['a fractional cell', [0, 1.5]],
  ];
  for (const [name, path] of illegal) {
    it(`refuses ${name}`, () => {
      expect(isLegalPrefix(WALLED, path)).toBe(false);
      expect(isSolution(WALLED, path)).toBe(false);
    });
  }

  it('is not won short of the whole board, nor off K, nor past the board', () => {
    expect(isSolution(WALLED, ROAD.slice(0, 8))).toBe(false);
    // Nine legal cells that end on 3 but skipped 2 on the way: not a prefix.
    expect(isSolution(OPEN, [0, 3, 6, 7, 4, 1, 2, 5, 8])).toBe(true);
    expect(isSolution(OPEN, [0, 1, 2, 5, 8, 7, 6, 3, 4])).toBe(false);
    expect(isSolution(WALLED, [...ROAD, 8])).toBe(false);
  });
});
