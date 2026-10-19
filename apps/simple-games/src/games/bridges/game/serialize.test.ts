/**
 * The fail-closed save alphabet of docs/BRIDGES_RULES.md §10: a board
 * survives only as a legal layout, an answer only as a win on it, the
 * player's bridges only as something the board could hold.
 */
import { describe, expect, it } from 'vitest';
import { buildGraph } from './engine';
import {
  decodeBoard,
  decodeBoards,
  decodeBridges,
  decodeSolution,
  encodeBoard,
  encodeBridges,
} from './serialize';

/** Two 1s above two 2s; the answer is [0, 1, 1, 1] (solver.test.ts). */
const BOARD = '1.1' + '...' + '2.2';
/** The plus: its two edges cross at the middle. */
const PLUS = '..1..' + '.....' + '1...1' + '.....' + '..1..';

describe('boards', () => {
  it('reads a legal board back, and writes it the same way', () => {
    const layout = decodeBoard(BOARD, 3, 3);
    expect(layout).toEqual({
      width: 3,
      height: 3,
      islands: [
        { index: 0, value: 1 },
        { index: 2, value: 1 },
        { index: 6, value: 2 },
        { index: 8, value: 2 },
      ],
    });
    expect(encodeBoard(layout!)).toBe(BOARD);
  });

  it('drops a board of the wrong size, or with a character it does not know', () => {
    expect(decodeBoard(BOARD, 3, 4)).toBeNull();
    expect(decodeBoard(BOARD.slice(1), 3, 3)).toBeNull();
    expect(decodeBoard('1.1...2.9', 3, 3)).toBeNull();
    expect(decodeBoard('1.1...2.0', 3, 3)).toBeNull();
    expect(decodeBoard('1.1...2.a', 3, 3)).toBeNull();
    expect(decodeBoard('1.1...2.\u{1F600}', 3, 3)).toBeNull();
    expect(decodeBoard(42, 3, 3)).toBeNull();
    expect(decodeBoard(BOARD, 3.5, 3)).toBeNull();
  });

  it('drops a board the rules cannot be read against', () => {
    // Side by side; a lone island; an island asking for more than it can carry.
    expect(decodeBoard('11.' + '...' + '..1', 3, 3)).toBeNull();
    expect(decodeBoard('1..' + '...' + '...', 3, 3)).toBeNull();
    expect(decodeBoard('3.2' + '...' + '...', 3, 3)).toBeNull();
  });
});

describe('answers and the player’s bridges', () => {
  const graph = buildGraph(decodeBoard(BOARD, 3, 3)!);

  it('reads an answer back only if it wins', () => {
    expect(decodeSolution('0111', graph)).toEqual([0, 1, 1, 1]);
    expect(encodeBridges([0, 1, 1, 1])).toBe('0111');
    // Numbers met, but two groups.
    expect(decodeSolution('1002', graph)).toBeNull();
    // A number missed.
    expect(decodeSolution('0110', graph)).toBeNull();
    expect(decodeSolution('011', graph)).toBeNull();
    expect(decodeSolution('0113', graph)).toBeNull();
    expect(decodeSolution(111, graph)).toBeNull();
  });

  it('reads the player’s bridges back if the board could hold them — over a number included', () => {
    expect(decodeBridges('0000', graph)).toEqual([0, 0, 0, 0]);
    expect(decodeBridges('2220', graph)).toEqual([2, 2, 2, 0]);
    expect(decodeBridges('0003', graph)).toBeNull();
    expect(decodeBridges('000', graph)).toBeNull();
    expect(decodeBridges('00-0', graph)).toBeNull();
    expect(decodeBridges(null, graph)).toBeNull();
  });

  it('drops bridges that cross', () => {
    const plus = buildGraph(decodeBoard(PLUS, 5, 5)!);
    expect(decodeBridges('10', plus)).toEqual([1, 0]);
    expect(decodeBridges('11', plus)).toBeNull();
  });

  it('decodes all three parts at once, or none of them', () => {
    expect(decodeBoards({ board: BOARD, solution: '0111', bridges: '0100' }, 3, 3)).toMatchObject({
      solution: [0, 1, 1, 1],
      bridges: [0, 1, 0, 0],
    });
    expect(decodeBoards({ board: BOARD, solution: '0111', bridges: '01' }, 3, 3)).toBeNull();
    expect(decodeBoards({ board: BOARD, solution: '1111', bridges: '0000' }, 3, 3)).toBeNull();
    expect(
      decodeBoards({ board: '11.......', solution: '0111', bridges: '0000' }, 3, 3),
    ).toBeNull();
  });
});
