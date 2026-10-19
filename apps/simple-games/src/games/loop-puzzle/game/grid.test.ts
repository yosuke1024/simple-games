/**
 * The lattice numbering of docs/LOOP_PUZZLE_RULES.md §1: every table agrees
 * with every other, on every board size the game ships and one that is not
 * square.
 */
import { describe, expect, it } from 'vitest';
import {
  dotIndex,
  edgeBetween,
  edgePosition,
  gridFor,
  horizontalEdge,
  isHorizontal,
  verticalEdge,
} from './grid';

const SIZES = [
  [4, 4],
  [5, 5],
  [6, 6],
  [3, 2],
] as const;

describe('lattice counts (§1)', () => {
  it('has W·H cells, (W+1)(H+1) dots and 2WH + W + H edges', () => {
    for (const [w, h] of SIZES) {
      const grid = gridFor(w, h);
      expect(grid.cellCount).toBe(w * h);
      expect(grid.dotCount).toBe((w + 1) * (h + 1));
      expect(grid.edgeCount).toBe(2 * w * h + w + h);
      expect(grid.firstVertical).toBe((h + 1) * w);
    }
    expect(gridFor(6, 6).edgeCount).toBe(84);
    expect(gridFor(4, 4).edgeCount).toBe(40);
  });

  it('is built once per size', () => {
    expect(gridFor(5, 5)).toBe(gridFor(5, 5));
    expect(gridFor(5, 5)).not.toBe(gridFor(4, 4));
  });
});

describe('numbering (§1)', () => {
  it('numbers horizontal edges first, then vertical ones, and reads them back', () => {
    for (const [w, h] of SIZES) {
      const grid = gridFor(w, h);
      const seen = new Set<number>();
      for (let r = 0; r <= h; r++) {
        for (let c = 0; c < w; c++) {
          const e = horizontalEdge(grid, r, c);
          expect(isHorizontal(grid, e)).toBe(true);
          expect(edgePosition(grid, e)).toEqual({ horizontal: true, row: r, col: c });
          expect([grid.edgeDots[2 * e], grid.edgeDots[2 * e + 1]]).toEqual([
            dotIndex(grid, r, c),
            dotIndex(grid, r, c + 1),
          ]);
          seen.add(e);
        }
      }
      for (let r = 0; r < h; r++) {
        for (let c = 0; c <= w; c++) {
          const e = verticalEdge(grid, r, c);
          expect(isHorizontal(grid, e)).toBe(false);
          expect(edgePosition(grid, e)).toEqual({ horizontal: false, row: r, col: c });
          expect([grid.edgeDots[2 * e], grid.edgeDots[2 * e + 1]]).toEqual([
            dotIndex(grid, r, c),
            dotIndex(grid, r + 1, c),
          ]);
          seen.add(e);
        }
      }
      expect(seen.size).toBe(grid.edgeCount);
      expect(Math.max(...seen)).toBe(grid.edgeCount - 1);
    }
  });

  it('gives each cell its top, right, bottom and left edge, each edge its two sides', () => {
    for (const [w, h] of SIZES) {
      const grid = gridFor(w, h);
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const cell = r * w + c;
          expect(Array.from(grid.cellEdges.slice(4 * cell, 4 * cell + 4))).toEqual([
            horizontalEdge(grid, r, c),
            verticalEdge(grid, r, c + 1),
            horizontalEdge(grid, r + 1, c),
            verticalEdge(grid, r, c),
          ]);
          for (let k = 0; k < 4; k++) {
            const e = grid.cellEdges[4 * cell + k]!;
            expect([grid.edgeCells[2 * e], grid.edgeCells[2 * e + 1]]).toContain(cell);
          }
        }
      }
      // A border edge has one side off the board; an inner edge has two cells.
      let border = 0;
      for (let e = 0; e < grid.edgeCount; e++) {
        const sides = [grid.edgeCells[2 * e]!, grid.edgeCells[2 * e + 1]!].filter((x) => x >= 0);
        expect(sides.length).toBeGreaterThanOrEqual(1);
        if (sides.length === 1) border++;
      }
      expect(border).toBe(2 * (w + h));
    }
  });

  it('gives each dot the edges that meet there, and finds the edge between two dots', () => {
    for (const [w, h] of SIZES) {
      const grid = gridFor(w, h);
      let total = 0;
      for (let d = 0; d < grid.dotCount; d++) {
        const edges = Array.from(grid.dotEdges.slice(4 * d, 4 * d + 4)).filter((e) => e >= 0);
        expect(edges.length).toBe(grid.dotDegree[d]);
        total += edges.length;
        for (const e of edges) {
          const other =
            grid.edgeDots[2 * e] === d ? grid.edgeDots[2 * e + 1]! : grid.edgeDots[2 * e]!;
          expect([grid.edgeDots[2 * e], grid.edgeDots[2 * e + 1]]).toContain(d);
          expect(edgeBetween(grid, d, other)).toBe(e);
        }
      }
      // Every edge has two ends.
      expect(total).toBe(2 * grid.edgeCount);
      expect(edgeBetween(grid, dotIndex(grid, 0, 0), dotIndex(grid, 1, 1))).toBe(-1);
    }
  });
});

describe('corners (§7, T2)', () => {
  it('pairs the two edges of a cell that meet at one dot', () => {
    const grid = gridFor(5, 5);
    for (let k = 0; k < 4 * grid.cellCount; k++) {
      const dot = grid.cornerDot[k]!;
      const a = grid.cornerEdges[2 * k]!;
      const b = grid.cornerEdges[2 * k + 1]!;
      const cellEdges = Array.from(grid.cellEdges.slice(4 * (k >> 2), 4 * (k >> 2) + 4));
      expect(cellEdges).toContain(a);
      expect(cellEdges).toContain(b);
      for (const e of [a, b]) {
        expect([grid.edgeDots[2 * e], grid.edgeDots[2 * e + 1]]).toContain(dot);
      }
      // One horizontal, one vertical: a corner, not a straight pair.
      expect(isHorizontal(grid, a)).not.toBe(isHorizontal(grid, b));
    }
  });

  it('knows the rest of the dot, and the diagonal corner it forms inside the board', () => {
    const grid = gridFor(4, 4);
    for (let k = 0; k < 4 * grid.cellCount; k++) {
      const dot = grid.cornerDot[k]!;
      const rest = [grid.cornerRest[2 * k]!, grid.cornerRest[2 * k + 1]!].filter((e) => e >= 0);
      expect(rest.length).toBe(grid.dotDegree[dot]! - 2);
      const restCorner = grid.cornerRestCorner[k]!;
      if (rest.length === 2) {
        expect(restCorner).toBeGreaterThanOrEqual(0);
        expect(grid.cornerDot[restCorner]).toBe(dot);
        expect(
          [grid.cornerEdges[2 * restCorner], grid.cornerEdges[2 * restCorner + 1]].sort(),
        ).toEqual(rest.sort());
        // The relation is symmetric.
        expect(grid.cornerRestCorner[restCorner]).toBe(k);
      } else {
        expect(restCorner).toBe(-1);
      }
    }
    // A board corner dot has one corner and nothing else; an inner dot has four.
    const topLeft = dotIndex(grid, 0, 0);
    expect(
      Array.from(grid.dotCorners.slice(4 * topLeft, 4 * topLeft + 4)).filter((k) => k >= 0),
    ).toHaveLength(1);
    const inner = dotIndex(grid, 2, 2);
    expect(
      Array.from(grid.dotCorners.slice(4 * inner, 4 * inner + 4)).filter((k) => k >= 0),
    ).toHaveLength(4);
  });
});
