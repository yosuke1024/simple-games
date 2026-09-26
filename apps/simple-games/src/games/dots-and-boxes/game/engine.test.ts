/**
 * The board and one line on it (docs/DOTS_AND_BOXES_RULES.md §1–§3): the edge
 * indexing, a line drawn once, boxes closed by the fourth side — two at once
 * from an inner line — and what a board has to be to have come from play.
 */
import { describe, expect, it } from 'vitest';
import { claim, countBoxes, drawnEdgeCount, isConsistent, isFinished, openEdges } from './engine';
import {
  BOXES_FOR,
  boxAt,
  boxesOfEdge,
  CPU,
  edgeCount,
  edgePosition,
  edgesOfBox,
  emptyBoard,
  hEdge,
  horizontalCount,
  PLAYER,
  vEdge,
  type Board,
} from './types';

/** Draws the given edges in order for one side, ignoring turns. */
function drawAll(board: Board, side: typeof PLAYER | typeof CPU, edges: readonly number[]): Board {
  let next = board;
  for (const edge of edges) next = claim(next, side, edge)!.board;
  return next;
}

describe('indexing (§1)', () => {
  for (const n of Object.values(BOXES_FOR)) {
    it(`numbers every edge of a ${n}×${n} board once, and inverts`, () => {
      expect(edgeCount(n)).toBe(2 * n * (n + 1));
      const seen = new Set<number>();
      for (let row = 0; row <= n; row++) {
        for (let col = 0; col < n; col++) {
          const edge = hEdge(n, row, col);
          expect(edgePosition(n, edge)).toEqual({ orientation: 'h', row, col });
          seen.add(edge);
        }
      }
      for (let row = 0; row < n; row++) {
        for (let col = 0; col <= n; col++) {
          const edge = vEdge(n, row, col);
          expect(edgePosition(n, edge)).toEqual({ orientation: 'v', row, col });
          seen.add(edge);
        }
      }
      expect([...seen].sort((a, b) => a - b)).toEqual(
        Array.from({ length: edgeCount(n) }, (_, i) => i),
      );
      expect(horizontalCount(n)).toBe((n + 1) * n);
    });

    it(`agrees with itself about which edges bound which boxes (${n}×${n})`, () => {
      const borders = new Map<number, number[]>();
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const sides = edgesOfBox(n, row, col);
          expect(new Set(sides).size).toBe(4);
          for (const edge of sides) {
            borders.set(edge, [...(borders.get(edge) ?? []), boxAt(n, row, col)]);
          }
        }
      }
      for (let edge = 0; edge < edgeCount(n); edge++) {
        expect(boxesOfEdge(n, edge).sort((a, b) => a - b)).toEqual(borders.get(edge));
      }
    });
  }

  it('gives an outer edge one box and an inner edge two', () => {
    const n = 3;
    expect(boxesOfEdge(n, hEdge(n, 0, 1))).toEqual([boxAt(n, 0, 1)]);
    expect(boxesOfEdge(n, hEdge(n, 3, 2))).toEqual([boxAt(n, 2, 2)]);
    expect(boxesOfEdge(n, vEdge(n, 1, 0))).toEqual([boxAt(n, 1, 0)]);
    expect(boxesOfEdge(n, vEdge(n, 1, 1))).toEqual([boxAt(n, 1, 0), boxAt(n, 1, 1)]);
    expect(boxesOfEdge(n, hEdge(n, 1, 0))).toEqual([boxAt(n, 0, 0), boxAt(n, 1, 0)]);
  });
});

describe('drawing a line (§2)', () => {
  it('draws an open edge once, for the side that drew it', () => {
    const board = emptyBoard(3);
    const drawn = claim(board, PLAYER, 5)!;
    expect(drawn.board.edges[5]).toBe('1');
    expect(drawn.completed).toEqual([]);
    expect(drawn.keepsTurn).toBe(false);
    // Once only, whoever asks.
    expect(claim(drawn.board, CPU, 5)).toBeNull();
    expect(claim(drawn.board, PLAYER, 5)).toBeNull();
    expect(claim(board, CPU, 6)!.board.edges[6]).toBe('2');
  });

  it('refuses an edge that is not on the board', () => {
    const board = emptyBoard(3);
    expect(claim(board, PLAYER, -1)).toBeNull();
    expect(claim(board, PLAYER, edgeCount(3))).toBeNull();
    expect(claim(board, PLAYER, 1.5)).toBeNull();
  });

  it('gives the box to whoever draws its fourth side, and the move with it', () => {
    const n = 3;
    const [top, bottom, left, right] = edgesOfBox(n, 0, 0);
    const three = drawAll(emptyBoard(n), CPU, [top, bottom, left]);
    expect(three.boxes[0]).toBe('.');

    const closed = claim(three, PLAYER, right)!;
    expect(closed.completed).toEqual([boxAt(n, 0, 0)]);
    expect(closed.keepsTurn).toBe(true);
    expect(closed.board.boxes[0]).toBe('p');
    expect(countBoxes(closed.board)).toEqual({ player: 1, cpu: 0, open: 8 });
  });

  it('closes two boxes with one inner line', () => {
    const n = 3;
    // Boxes (1,0) and (1,1) share v(1,1); give each its other three sides.
    const shared = vEdge(n, 1, 1);
    const others = [...edgesOfBox(n, 1, 0), ...edgesOfBox(n, 1, 1)].filter((e) => e !== shared);
    const ready = drawAll(emptyBoard(n), PLAYER, others);
    expect(countBoxes(ready).open).toBe(9);

    const both = claim(ready, CPU, shared)!;
    expect(both.completed).toEqual([boxAt(n, 1, 0), boxAt(n, 1, 1)]);
    expect(both.board.boxes).toBe('...cc....');
    expect(both.keepsTurn).toBe(true);
  });
});

describe('the end of the board (§3)', () => {
  it('is finished when every line is drawn, and not a line before', () => {
    const n = 3;
    const all = Array.from({ length: edgeCount(n) }, (_, i) => i);
    const almost = drawAll(emptyBoard(n), PLAYER, all.slice(0, -1));
    expect(isFinished(almost)).toBe(false);
    expect(openEdges(almost)).toEqual([edgeCount(n) - 1]);
    const full = claim(almost, CPU, edgeCount(n) - 1)!.board;
    expect(isFinished(full)).toBe(true);
    expect(drawnEdgeCount(full)).toBe(edgeCount(n));
    const counts = countBoxes(full);
    expect(counts.player + counts.cpu).toBe(9);
    expect(counts.open).toBe(0);
  });
});

describe('boards that could not have come from play (§8)', () => {
  it('accepts a real position', () => {
    const board = drawAll(emptyBoard(3), PLAYER, edgesOfBox(3, 2, 2));
    expect(isConsistent(board)).toBe(true);
    expect(isConsistent(emptyBoard(4))).toBe(true);
  });

  it('rejects a closed box without an owner', () => {
    const board = drawAll(emptyBoard(3), PLAYER, edgesOfBox(3, 0, 0));
    expect(isConsistent({ ...board, boxes: '.........' })).toBe(false);
  });

  it('rejects an owner on a box still missing a side', () => {
    const board = drawAll(emptyBoard(3), PLAYER, edgesOfBox(3, 0, 0).slice(0, 3));
    expect(isConsistent({ ...board, boxes: 'c........' })).toBe(false);
  });

  it('rejects the wrong lengths and unknown characters', () => {
    const board = emptyBoard(3);
    expect(isConsistent({ ...board, edges: board.edges.slice(1) })).toBe(false);
    expect(isConsistent({ ...board, boxes: `${board.boxes}.` })).toBe(false);
    expect(isConsistent({ ...board, edges: `x${board.edges.slice(1)}` })).toBe(false);
    expect(isConsistent({ ...board, boxes: `x${board.boxes.slice(1)}` })).toBe(false);
    // A 3×3 board's strings under a 4×4 size do not add up either.
    expect(isConsistent({ ...board, n: 4 })).toBe(false);
  });
});
