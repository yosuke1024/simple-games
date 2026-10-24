/**
 * The boards and the rules (docs/PEG_SOLITAIRE_RULES.md §1–§3): which holes
 * exist, which lines a jump may follow on each board, what a jump does, and
 * when a game is over. Positions are written as pictures of the board
 * (picture.ts), so a failure reads as a position.
 */
import { describe, expect, it } from 'vitest';
import {
  ENGLISH,
  ENGLISH_CENTER,
  ENGLISH_DIRECTIONS,
  ENGLISH_HOLE_COUNT,
  TRIANGLE,
  TRIANGLE_DIRECTIONS,
  TRIANGLE_HOLE_COUNT,
  geometryOf,
  holeIndex,
  type BoardGeometry,
} from './boards';
import {
  applyJump,
  checkJump,
  hasLegalJump,
  initialPegs,
  jumpBetween,
  jumpsFrom,
  legalJumps,
  outcomeOf,
  pegCount,
  revertJump,
} from './engine';
import { pegsFromPicture, pictureOf } from './picture';
import { ENGLISH_PROBLEM } from './problems';
import type { BoardKind, Pegs, Problem } from './types';

const E = (row: number, col: number) => holeIndex(ENGLISH, row, col);
const T = (row: number, col: number) => holeIndex(TRIANGLE, row, col);
const english = (...rows: string[]) => pegsFromPicture(ENGLISH, rows);
const triangle = (...rows: string[]) => pegsFromPicture(TRIANGLE, rows);
const apexProblem: Problem = { kind: 'triangle', start: 0, target: 0 };

/** Where each jump of a peg lands, as (row, col), sorted — easy to read in a failure. */
function landings(geometry: BoardGeometry, pegs: Pegs, from: number): string[] {
  return jumpsFrom(geometry, pegs, from)
    .map(({ to }) => `${geometry.holes[to]!.row},${geometry.holes[to]!.col}`)
    .sort();
}

describe('the cross (§1)', () => {
  it('has 33 holes: a 7×7 grid without its four 2×2 corners', () => {
    expect(ENGLISH.holes).toHaveLength(ENGLISH_HOLE_COUNT);
    for (const [row, col] of [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [0, 5],
      [1, 6],
      [5, 0],
      [6, 6],
    ] as const) {
      expect(E(row, col), `(${row}, ${col})`).toBe(-1);
    }
    expect(E(0, 2)).toBe(0);
    expect(E(6, 4)).toBe(32);
  });

  it('has its middle hole at (3, 3)', () => {
    expect(ENGLISH.holes[ENGLISH_CENTER]).toEqual({ row: 3, col: 3 });
  });

  it('opens with 32 pegs and the middle empty', () => {
    const pegs = initialPegs(ENGLISH, ENGLISH_CENTER);
    expect(pegCount(pegs)).toBe(32);
    expect(pictureOf(ENGLISH, pegs)).toEqual([
      '  ooo  ',
      '  ooo  ',
      'ooooooo',
      'ooo.ooo',
      'ooooooo',
      '  ooo  ',
      '  ooo  ',
    ]);
  });

  it('opens with exactly four jumps, all into the middle', () => {
    const jumps = legalJumps(ENGLISH, initialPegs(ENGLISH, ENGLISH_CENTER));
    expect(jumps).toHaveLength(4);
    expect(jumps.every((jump) => jump.to === ENGLISH_CENTER)).toBe(true);
  });

  it('jumps only up, down, left and right', () => {
    expect(ENGLISH_DIRECTIONS).toHaveLength(4);
    for (const [dRow, dCol] of ENGLISH_DIRECTIONS) expect(Math.abs(dRow) + Math.abs(dCol)).toBe(1);
    // Every line in the table is two orthogonal steps with a hole between.
    expect(ENGLISH.jumps).toHaveLength(76);
    for (const { from, over, to } of ENGLISH.jumps) {
      const [a, b, c] = [ENGLISH.holes[from]!, ENGLISH.holes[over]!, ENGLISH.holes[to]!];
      const sameRow = a.row === b.row && b.row === c.row;
      const sameCol = a.col === b.col && b.col === c.col;
      expect(sameRow || sameCol).toBe(true);
      expect(Math.abs(c.row - a.row) + Math.abs(c.col - a.col)).toBe(2);
      expect(b.row * 2).toBe(a.row + c.row);
      expect(b.col * 2).toBe(a.col + c.col);
    }
  });
});

describe('the triangle (§1)', () => {
  it('has 15 holes in five rows, apex first', () => {
    expect(TRIANGLE.holes).toHaveLength(TRIANGLE_HOLE_COUNT);
    expect(TRIANGLE.holes[0]).toEqual({ row: 0, col: 0 });
    expect(TRIANGLE.holes[14]).toEqual({ row: 4, col: 4 });
    expect(T(1, 2)).toBe(-1);
    expect(T(5, 0)).toBe(-1);
    expect(T(0, -1)).toBe(-1);
  });

  it('jumps along its three lines: six directions, not the cross’s four', () => {
    expect(TRIANGLE_DIRECTIONS).toHaveLength(6);
    const listed = TRIANGLE_DIRECTIONS.map(([r, c]) => `${r},${c}`).sort();
    expect(listed).toEqual(['-1,-1', '-1,0', '0,-1', '0,1', '1,0', '1,1']);
    // The two the cross would call a diagonal, and that are not lines here.
    expect(listed).not.toContain('1,-1');
    expect(listed).not.toContain('-1,1');
    expect(TRIANGLE.jumps).toHaveLength(36);
  });

  it('opens with a peg in every hole but the start', () => {
    const pegs = initialPegs(TRIANGLE, 0);
    expect(pegCount(pegs)).toBe(14);
    expect(pictureOf(TRIANGLE, pegs)).toEqual([
      '    .    ',
      '   o o   ',
      '  o o o  ',
      ' o o o o ',
      'o o o o o',
    ]);
    // Two ways into the apex: down its two edges.
    expect(legalJumps(TRIANGLE, pegs).map((jump) => jump.to)).toEqual([0, 0]);
  });

  it('allows all six directions', () => {
    // From the apex: down-left and down-right, along the two edges.
    const apex = triangle('    o    ', '   o o   ', '  . o .  ', ' o o o o ', 'o o o o o');
    expect(landings(TRIANGLE, apex, T(0, 0))).toEqual(['2,0', '2,2']);
    // From the middle of the bottom row: left, right, and up both edges' way.
    const bottom = triangle('    o    ', '   o o   ', '  . o .  ', ' o o o o ', '. o o o .');
    expect(landings(TRIANGLE, bottom, T(4, 2))).toEqual(['2,0', '2,2', '4,0', '4,4']);
  });

  it('refuses three holes in a row on screen that are not one of its lines', () => {
    // (2,2) → (3,1) → (4,0) are evenly spaced on the drawn board, but the
    // holes are not neighbours: (1, −1) is not a direction of this lattice.
    const pegs = triangle('    o    ', '   o o   ', '  o o o  ', ' o o o o ', '. o o o o');
    expect(jumpBetween(TRIANGLE, T(2, 2), T(4, 0))).toBeNull();
    expect(checkJump(TRIANGLE, pegs, T(2, 2), T(4, 0))).toEqual({
      ok: false,
      reason: 'not-a-line',
    });
    // Straight down the screen, (0,0) → (2,1), is not a line either.
    const below = triangle('    o    ', '   o o   ', '  o . o  ', ' o o o o ', 'o o o o o');
    expect(checkJump(TRIANGLE, below, T(0, 0), T(2, 1))).toEqual({
      ok: false,
      reason: 'not-a-line',
    });
  });
});

describe('a jump (§2)', () => {
  it('moves the jumper two holes and removes the peg it jumped', () => {
    const start = initialPegs(ENGLISH, ENGLISH_CENTER);
    const next = applyJump(ENGLISH, start, E(1, 3), E(3, 3))!;
    expect(pictureOf(ENGLISH, next)).toEqual([
      '  ooo  ',
      '  o.o  ',
      'ooo.ooo',
      'ooooooo',
      'ooooooo',
      '  ooo  ',
      '  ooo  ',
    ]);
    expect(pegCount(next)).toBe(pegCount(start) - 1);
    // The starting position is not touched.
    expect(start[E(1, 3)]).toBe(true);
  });

  it('works the same way along the triangle’s lines', () => {
    const next = applyJump(TRIANGLE, initialPegs(TRIANGLE, 0), T(2, 2), T(0, 0))!;
    expect(pictureOf(TRIANGLE, next)).toEqual([
      '    o    ',
      '   o .   ',
      '  o o .  ',
      ' o o o o ',
      'o o o o o',
    ]);
  });

  it('refuses a diagonal on the cross', () => {
    const pegs = english(
      '  ooo  ',
      '  ooo  ',
      'ooooooo',
      'ooooooo',
      'oooo.oo',
      '  ooo  ',
      '  ooo  ',
    );
    // (2,2) over (3,3) into the empty (4,4): a straight line, but diagonal.
    expect(jumpBetween(ENGLISH, E(2, 2), E(4, 4))).toBeNull();
    expect(checkJump(ENGLISH, pegs, E(2, 2), E(4, 4))).toEqual({
      ok: false,
      reason: 'not-a-line',
    });
    expect(applyJump(ENGLISH, pegs, E(2, 2), E(4, 4))).toBeNull();
    // And it is never offered: only the orthogonal jumps into (4,4) are.
    expect(legalJumps(ENGLISH, pegs).map((jump) => jump.from)).toEqual(
      [E(2, 4), E(4, 2), E(4, 6), E(6, 4)].sort((a, b) => a - b),
    );
  });

  it('refuses one hole, three holes, or a knight’s step away', () => {
    const pegs = initialPegs(ENGLISH, ENGLISH_CENTER);
    expect(checkJump(ENGLISH, pegs, E(2, 3), E(3, 3))).toMatchObject({ reason: 'not-a-line' });
    expect(checkJump(ENGLISH, pegs, E(0, 3), E(3, 3))).toMatchObject({ reason: 'not-a-line' });
    expect(checkJump(ENGLISH, pegs, E(1, 2), E(3, 3))).toMatchObject({ reason: 'not-a-line' });
    expect(checkJump(ENGLISH, pegs, E(3, 3), E(3, 3))).toMatchObject({ reason: 'no-peg' });
  });

  it('never leaves the board', () => {
    // A peg on the edge with a neighbour inside: jumping outward has nowhere to land.
    const pegs = english(
      '  ...  ',
      '  ...  ',
      '.......',
      'oo.....',
      '.......',
      '  ...  ',
      '  ...  ',
    );
    expect(E(3, -1)).toBe(-1);
    expect(checkJump(ENGLISH, pegs, E(3, 1), E(3, -1))).toEqual({ ok: false, reason: 'no-hole' });
    expect(checkJump(ENGLISH, pegs, E(3, 1), 33)).toEqual({ ok: false, reason: 'no-hole' });
    expect(checkJump(ENGLISH, pegs, -1, E(3, 2))).toEqual({ ok: false, reason: 'no-hole' });
    expect(checkJump(ENGLISH, pegs, 1.5, E(3, 2))).toEqual({ ok: false, reason: 'no-hole' });
    // (3,0) can jump right into (3,2); (3,1) has nowhere to go.
    expect(landings(ENGLISH, pegs, E(3, 0))).toEqual(['3,2']);
    expect(landings(ENGLISH, pegs, E(3, 1))).toEqual([]);
    // Nor across a cut-away corner: (2,1) up would pass (1,1), which is not a hole.
    const corner = english(
      '  ...  ',
      '  ...  ',
      '.o.....',
      '.o.....',
      '.......',
      '  ...  ',
      '  ...  ',
    );
    expect(landings(ENGLISH, corner, E(3, 1))).toEqual([]);
    expect(landings(ENGLISH, corner, E(2, 1))).toEqual(['4,1']);
    // The triangle's edges are edges too.
    const edge = triangle('    .    ', '   . .   ', '  . . .  ', ' . . . . ', 'o o . . .');
    expect(landings(TRIANGLE, edge, T(4, 1))).toEqual([]);
    expect(landings(TRIANGLE, edge, T(4, 0))).toEqual(['4,2']);
  });

  it('needs a peg to jump over', () => {
    const pegs = english(
      '  ooo  ',
      '  o.o  ',
      'ooo.ooo',
      'ooooooo',
      'ooooooo',
      '  ooo  ',
      '  ooo  ',
    );
    expect(checkJump(ENGLISH, pegs, E(0, 3), E(2, 3))).toEqual({
      ok: false,
      reason: 'nothing-to-jump',
    });
  });

  it('needs an empty hole to land in', () => {
    const pegs = initialPegs(ENGLISH, ENGLISH_CENTER);
    expect(checkJump(ENGLISH, pegs, E(0, 3), E(2, 3))).toEqual({ ok: false, reason: 'occupied' });
  });

  it('needs a peg to move', () => {
    const pegs = initialPegs(ENGLISH, ENGLISH_CENTER);
    expect(checkJump(ENGLISH, pegs, ENGLISH_CENTER, E(1, 3))).toEqual({
      ok: false,
      reason: 'no-peg',
    });
  });

  it('is taken back exactly by its inverse', () => {
    for (const geometry of [ENGLISH, TRIANGLE]) {
      let pegs = initialPegs(geometry, geometry === ENGLISH ? ENGLISH_CENTER : 4);
      // Walk a few plies, checking every jump available at each.
      for (let ply = 0; ply < 6 && hasLegalJump(geometry, pegs); ply++) {
        for (const jump of legalJumps(geometry, pegs)) {
          const after = applyJump(geometry, pegs, jump.from, jump.to)!;
          expect(revertJump(after, jump)).toEqual(pegs);
        }
        const jumps = legalJumps(geometry, pegs);
        const pick = jumps[ply % jumps.length]!;
        pegs = applyJump(geometry, pegs, pick.from, pick.to)!;
      }
    }
  });

  it('reads the board kind from one place', () => {
    expect(geometryOf('english')).toBe(ENGLISH);
    expect(geometryOf('triangle')).toBe(TRIANGLE);
  });

  it('throws on a kind that is not a board, rather than reading it as the triangle', () => {
    for (const kind of ['square', 'English', 'toString', '', undefined]) {
      expect(() => geometryOf(kind as BoardKind), String(kind)).toThrow(TypeError);
    }
  });
});

describe('the end of the game (§3)', () => {
  it('is not over while any jump is left', () => {
    expect(outcomeOf(ENGLISH, ENGLISH_PROBLEM, initialPegs(ENGLISH, ENGLISH_CENTER))).toBeNull();
    const two = english(
      '  ...  ',
      '  ...  ',
      '.......',
      '..oo...',
      '.......',
      '  ...  ',
      '  ...  ',
    );
    expect(hasLegalJump(ENGLISH, two)).toBe(true);
    expect(outcomeOf(ENGLISH, ENGLISH_PROBLEM, two)).toBeNull();
  });

  it('is a perfect clear with one peg in the target', () => {
    const one = english(
      '  ...  ',
      '  ...  ',
      '.......',
      '...o...',
      '.......',
      '  ...  ',
      '  ...  ',
    );
    expect(outcomeOf(ENGLISH, ENGLISH_PROBLEM, one)).toEqual({ kind: 'perfect', remaining: 1 });
    const apex = triangle('    o    ', '   . .   ', '  . . .  ', ' . . . . ', '. . . . .');
    expect(outcomeOf(TRIANGLE, apexProblem, apex)).toEqual({ kind: 'perfect', remaining: 1 });
  });

  it('tells one peg anywhere else apart from the clear', () => {
    const off = english(
      '  ...  ',
      '  ...  ',
      '.......',
      'o......',
      '.......',
      '  ...  ',
      '  ...  ',
    );
    expect(outcomeOf(ENGLISH, ENGLISH_PROBLEM, off)).toEqual({ kind: 'single', remaining: 1 });
    const corner = triangle('    .    ', '   . .   ', '  . . .  ', ' . . . . ', 'o . . . .');
    expect(outcomeOf(TRIANGLE, apexProblem, corner)).toEqual({ kind: 'single', remaining: 1 });
  });

  it('is stuck with two or more pegs and no jump between them', () => {
    const apart = english(
      '  o..  ',
      '  ...  ',
      '.......',
      '...o...',
      '.......',
      '  ...  ',
      '  ..o  ',
    );
    expect(hasLegalJump(ENGLISH, apart)).toBe(false);
    expect(outcomeOf(ENGLISH, ENGLISH_PROBLEM, apart)).toEqual({ kind: 'stuck', remaining: 3 });
    const done = triangle('    .    ', '   . .   ', '  o . .  ', ' . . . . ', '. . o . o');
    expect(outcomeOf(TRIANGLE, apexProblem, done)).toEqual({ kind: 'stuck', remaining: 3 });
  });

  it('is stuck when neighbours have no room to land', () => {
    // Three in a row along the cross's top edge: each landing is taken or off the board.
    const row = english(
      '  ooo  ',
      '  ...  ',
      '.......',
      '.......',
      '.......',
      '  ...  ',
      '  ...  ',
    );
    expect(hasLegalJump(ENGLISH, row)).toBe(false);
    expect(outcomeOf(ENGLISH, ENGLISH_PROBLEM, row)).toEqual({ kind: 'stuck', remaining: 3 });
    // The triangle's second row: two neighbours on a line two holes long.
    const pair = triangle('    .    ', '   o o   ', '  . . .  ', ' . . . . ', '. . . . .');
    expect(hasLegalJump(TRIANGLE, pair)).toBe(false);
    expect(outcomeOf(TRIANGLE, apexProblem, pair)).toEqual({ kind: 'stuck', remaining: 2 });
  });
});
