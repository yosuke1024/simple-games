/**
 * The board rules of docs/LOOP_PUZZLE_RULES.md §3–§5: the tap cycle, dot
 * degrees, the single closed loop, the numbers, the win, and the conflict
 * display — each read from the rules, never from an answer.
 */
import { describe, expect, it } from 'vitest';
import {
  cluesMet,
  cycleEdge,
  dotDegree,
  emptyMarks,
  findConflicts,
  isSingleLoop,
  isSolved,
  linePieces,
  linesAround,
  metClues,
  nextMark,
  setEdge,
} from './engine';
import { loopOfRegion } from './generator';
import { dotIndex, gridFor, horizontalEdge, verticalEdge } from './grid';
import { CROSS, LINE, UNKNOWN, type Clue, type Layout, type Mark } from './types';

const W = 4;
const H = 4;
const grid = gridFor(W, H);
const blank = (clues: Clue[] = new Array<Clue>(W * H).fill(null)): Layout => ({
  width: W,
  height: H,
  clues,
});

/** Marks with LINE on the given edges, UNKNOWN elsewhere. */
function withLines(edges: readonly number[], rest: Mark = UNKNOWN): Mark[] {
  const marks = new Array<Mark>(grid.edgeCount).fill(rest);
  for (const e of edges) marks[e] = LINE;
  return marks;
}

/** The four edges round one cell. */
const ring = (row: number, col: number): number[] =>
  Array.from(grid.cellEdges.slice(4 * (row * W + col), 4 * (row * W + col) + 4));

/** The loop round a rectangle of cells, from (r0, c0) to (r1, c1) inclusive. */
function rectangle(r0: number, c0: number, r1: number, c1: number): Mark[] {
  const inside = new Array<boolean>(W * H).fill(false);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) inside[r * W + c] = true;
  return loopOfRegion({ width: W, height: H }, inside);
}

const lineEdges = (marks: readonly Mark[]): number[] =>
  marks.flatMap((m, e) => (m === LINE ? [e] : []));

describe('the tap cycle (§4)', () => {
  it('walks UNKNOWN → LINE → CROSS → UNKNOWN', () => {
    expect(nextMark(UNKNOWN)).toBe(LINE);
    expect(nextMark(LINE)).toBe(CROSS);
    expect(nextMark(CROSS)).toBe(UNKNOWN);
    let marks: Mark[] = emptyMarks({ width: W, height: H });
    expect(marks).toHaveLength(40);
    marks = cycleEdge(marks, 5)!;
    expect(marks[5]).toBe(LINE);
    marks = cycleEdge(marks, 5)!;
    expect(marks[5]).toBe(CROSS);
    marks = cycleEdge(marks, 5)!;
    expect(marks[5]).toBe(UNKNOWN);
    expect(marks.every((m) => m === UNKNOWN)).toBe(true);
  });

  it('refuses an edge that does not exist, and a set that changes nothing', () => {
    const marks = emptyMarks({ width: W, height: H });
    expect(cycleEdge(marks, -1)).toBeNull();
    expect(cycleEdge(marks, 40)).toBeNull();
    expect(cycleEdge(marks, 1.5)).toBeNull();
    expect(setEdge(marks, 3, UNKNOWN)).toBeNull();
    expect(setEdge(marks, 3, CROSS)![3]).toBe(CROSS);
    expect(setEdge(marks, 99, LINE)).toBeNull();
    // Never mutates its input.
    expect(marks.every((m) => m === UNKNOWN)).toBe(true);
  });
});

describe('dot degree and pieces (§3)', () => {
  it('counts only LINE at a dot', () => {
    const marks = withLines(ring(0, 0));
    marks[horizontalEdge(grid, 0, 1)] = CROSS;
    expect(dotDegree(grid, marks, dotIndex(grid, 0, 0))).toBe(2);
    expect(dotDegree(grid, marks, dotIndex(grid, 0, 1))).toBe(2);
    expect(dotDegree(grid, marks, dotIndex(grid, 2, 2))).toBe(0);
    expect(linesAround(grid, marks, 0)).toBe(4);
    expect(linesAround(grid, marks, 1)).toBe(1);
  });

  it('splits lines into connected pieces and knows which are closed', () => {
    const square = ring(0, 0);
    const path = [horizontalEdge(grid, 4, 2), horizontalEdge(grid, 4, 3)];
    const pieces = linePieces(blank(), withLines([...square, ...path]));
    expect(pieces).toHaveLength(2);
    expect(pieces.find((p) => p.edges.length === 4)?.closed).toBe(true);
    expect(pieces.find((p) => p.edges.length === 2)?.closed).toBe(false);
    expect(linePieces(blank(), emptyMarks(blank()))).toEqual([]);
  });
});

describe('one closed loop (§3)', () => {
  it('accepts the boundary of a region with no holes', () => {
    expect(isSingleLoop(blank(), rectangle(0, 0, 0, 0))).toBe(true);
    expect(isSingleLoop(blank(), rectangle(0, 0, 3, 3))).toBe(true);
    expect(isSingleLoop(blank(), rectangle(1, 1, 2, 3))).toBe(true);
  });

  it('rejects no lines, an open path, a branch, two loops and a figure eight', () => {
    expect(isSingleLoop(blank(), emptyMarks(blank()))).toBe(false);
    // Open: the square with one side missing.
    expect(isSingleLoop(blank(), withLines(ring(1, 1).slice(0, 3)))).toBe(false);
    // Branch: a square with a tail — a dot of degree 3.
    const tail = withLines([...ring(1, 1), horizontalEdge(grid, 1, 0)]);
    expect(isSingleLoop(blank(), tail)).toBe(false);
    // Two separate loops.
    expect(isSingleLoop(blank(), withLines([...ring(0, 0), ...ring(3, 3)]))).toBe(false);
    // Two squares touching at one dot: every dot even, but degree 4 at the touch.
    const eight = withLines([...ring(0, 0), ...ring(1, 1)]);
    expect(dotDegree(grid, eight, dotIndex(grid, 1, 1))).toBe(4);
    expect(isSingleLoop(blank(), eight)).toBe(false);
  });

  it('ignores CROSS entirely: it is a note, not a part of the loop', () => {
    const loop = rectangle(1, 1, 2, 2);
    const crossed = loop.map((m) => (m === LINE ? LINE : CROSS));
    const open = loop.map((m) => (m === LINE ? LINE : UNKNOWN));
    expect(isSingleLoop(blank(), crossed)).toBe(true);
    expect(isSingleLoop(blank(), open)).toBe(true);
  });
});

describe('numbers and the win (§2, §3)', () => {
  // The loop round the 2×2 block in the middle of a 4×4.
  const loop = rectangle(1, 1, 2, 2);
  const clues: Clue[] = [0, 1, 1, 0, 1, 2, 2, 1, 1, 2, 2, 1, 0, 1, 1, 0];

  it('counts each number against its four edges', () => {
    expect(cluesMet(blank(clues), loop)).toBe(true);
    expect(metClues(blank(clues), loop).every(Boolean)).toBe(true);
    const wrong = [...clues];
    wrong[5] = 3;
    expect(cluesMet(blank(wrong), loop)).toBe(false);
    // A blank cell asks nothing.
    expect(cluesMet(blank(), loop)).toBe(true);
  });

  it('is won by one loop meeting every number, whatever the CROSS marks say', () => {
    expect(isSolved(blank(clues), loop)).toBe(true);
    expect(
      isSolved(
        blank(clues),
        loop.map((m) => (m === LINE ? LINE : UNKNOWN)),
      ),
    ).toBe(true);
    // A CROSS over a loop edge is not a LINE: the loop is open.
    const crossedOut = [...loop];
    crossedOut[horizontalEdge(grid, 1, 1)] = CROSS;
    expect(isSolved(blank(clues), crossedOut)).toBe(false);
  });

  it('is not won by a loop that misses a number, nor by an unfinished board', () => {
    expect(isSolved(blank(clues), rectangle(0, 0, 3, 3))).toBe(false);
    expect(isSolved(blank(clues), emptyMarks(blank()))).toBe(false);
    expect(isSolved(blank(clues), withLines(lineEdges(loop).slice(0, 7)))).toBe(false);
  });

  it('refuses a board of the wrong size rather than reading it', () => {
    expect(isSolved(blank(clues), loop.slice(0, 39))).toBe(false);
    expect(isSolved(blank(clues), [])).toBe(false);
  });
});

describe('conflicts (§5)', () => {
  it('flags a number with too many LINEs, or too few edges left', () => {
    const clues = new Array<Clue>(16).fill(null);
    clues[5] = 1;
    clues[6] = 3;
    const marks = emptyMarks(blank());
    const [top, right] = ring(1, 1);
    marks[top!] = LINE;
    marks[right!] = LINE; // two LINEs round a 1
    const [, r2, b2, l2] = ring(1, 2);
    marks[r2!] = CROSS;
    marks[b2!] = CROSS; // a 3 with two CROSSes: at most two edges left
    expect(l2).toBe(right);
    const conflicts = findConflicts(blank(clues), marks);
    expect(conflicts.cells[5]).toBe(true);
    expect(conflicts.cells[6]).toBe(true);
    expect(conflicts.any).toBe(true);
  });

  it('flags a branch and a dead end at a dot', () => {
    const branch = withLines([...ring(1, 1).slice(0, 2), horizontalEdge(grid, 1, 2)]);
    expect(findConflicts(blank(), branch).dots[dotIndex(grid, 1, 2)]).toBe(true);
    // One LINE into a board corner whose other edge is CROSS: no way on.
    const dead = emptyMarks(blank());
    dead[horizontalEdge(grid, 0, 0)] = LINE;
    dead[verticalEdge(grid, 0, 0)] = CROSS;
    const conflicts = findConflicts(blank(), dead);
    expect(conflicts.dots[dotIndex(grid, 0, 0)]).toBe(true);
    // The other end still has open edges: not a dead end.
    expect(conflicts.dots[dotIndex(grid, 0, 1)]).toBe(false);
  });

  it('flags a closed loop that is not the only piece', () => {
    const marks = withLines([...ring(0, 0), horizontalEdge(grid, 4, 3)]);
    const conflicts = findConflicts(blank(), marks);
    for (const e of ring(0, 0)) expect(conflicts.edges[e]).toBe(true);
    expect(conflicts.edges[horizontalEdge(grid, 4, 3)]).toBe(false);
    // Two closed loops: both flagged.
    const two = findConflicts(blank(), withLines([...ring(0, 0), ...ring(3, 3)]));
    expect([...ring(0, 0), ...ring(3, 3)].every((e) => two.edges[e])).toBe(true);
  });

  it('flags the numbers a lone closed loop misses, since it cannot grow', () => {
    const clues = new Array<Clue>(16).fill(null);
    clues[0] = 2; // the 1×1 loop at (1, 1) leaves cell 0 at zero LINEs
    clues[5] = 3; // the loop gives cell 5 four LINEs: over
    const marks = withLines(ring(1, 1));
    const conflicts = findConflicts(blank(clues), marks);
    expect(conflicts.cells[0]).toBe(true);
    expect(conflicts.cells[5]).toBe(true);
    // An open path with the same shortfall is not a conflict yet.
    expect(findConflicts(blank(clues), withLines(ring(1, 1).slice(0, 2))).cells[0]).toBe(false);
  });

  it('says nothing about legal marks that are simply not the answer', () => {
    const clues = new Array<Clue>(16).fill(null);
    clues[5] = 2;
    const marks = withLines([horizontalEdge(grid, 1, 1)]);
    marks[verticalEdge(grid, 1, 1)] = CROSS;
    const conflicts = findConflicts(blank(clues), marks);
    expect(conflicts.any).toBe(false);
    expect(metClues(blank(clues), marks)[5]).toBe(false);
  });

  it('shows a 0 as met from the first frame, until a LINE touches it (§5, by decision)', () => {
    const clues: Clue[] = new Array<Clue>(16).fill(null);
    clues[0] = 0;
    clues[5] = 0;
    clues[6] = 1;
    const empty = emptyMarks(blank(clues));
    // "Met" is "the count is right now": true for every 0 and nothing else on an empty board.
    expect(metClues(blank(clues), empty)).toEqual(clues.map((clue) => clue === 0));
    // CROSS marks change nothing about it.
    const crossed = [...empty];
    for (const edge of ring(1, 1)) crossed[edge] = CROSS;
    expect(metClues(blank(clues), crossed)[5]).toBe(true);
    // A LINE on the 0 ends it, and the conflict display takes over.
    const touched = withLines([horizontalEdge(grid, 1, 1)]);
    expect(metClues(blank(clues), touched)[5]).toBe(false);
    expect(findConflicts(blank(clues), touched).cells[5]).toBe(true);
  });
});
