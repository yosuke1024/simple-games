/**
 * The board rules of docs/GAME_2048_RULES.md §2, §3 and §7 — including the two
 * that separate 2048 from a sliding puzzle: a tile made by a merge is finished
 * for that move, and merges resolve from the leading edge backwards.
 */
import { describe, expect, it } from 'vitest';
import {
  emptyBoard,
  emptyCells,
  hasMoves,
  hasWon,
  isGameOver,
  maxTile,
  slide,
  spawnRng,
  spawnTile,
} from './engine';
import { CELLS, DIRECTIONS, SIZE, WIN_VALUE, type Board } from './types';

/** Four rows of four, written the way the player sees them. */
const boardOf = (...rows: readonly (readonly number[])[]): Board => rows.flat();

const rowsOf = (board: Board): number[][] =>
  Array.from({ length: SIZE }, (_, r) => board.slice(r * SIZE, (r + 1) * SIZE));

const tileCount = (board: Board): number => board.filter((value) => value !== 0).length;

describe('slide (§2.1)', () => {
  it('packs tiles against the direction they travel', () => {
    const board = boardOf([0, 2, 0, 4], [8, 0, 0, 0], [0, 0, 16, 0], [0, 0, 0, 0]);

    expect(rowsOf(slide(board, 'left').board)).toEqual([
      [2, 4, 0, 0],
      [8, 0, 0, 0],
      [16, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(rowsOf(slide(board, 'right').board)).toEqual([
      [0, 0, 2, 4],
      [0, 0, 0, 8],
      [0, 0, 0, 16],
      [0, 0, 0, 0],
    ]);
    expect(rowsOf(slide(board, 'up').board)).toEqual([
      [8, 2, 16, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(rowsOf(slide(board, 'down').board)).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [8, 2, 16, 4],
    ]);
  });

  it('combines a neighbouring pair and scores the tile it makes (§4)', () => {
    const result = slide(boardOf([2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'left');
    expect(rowsOf(result.board)[0]).toEqual([4, 0, 0, 0]);
    expect(result.gained).toBe(4);
    expect(result.moved).toBe(true);
  });

  it('does not merge a tile it just made (§2.2)', () => {
    // 4,4,8 must become 8,8 — never 16. The 8 born this move is finished.
    const result = slide(boardOf([4, 4, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'left');
    expect(rowsOf(result.board)[0]).toEqual([8, 8, 0, 0]);
    expect(result.gained).toBe(8);

    // And four equal tiles make two pairs, not one chain to 8.
    const four = slide(boardOf([2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'left');
    expect(rowsOf(four.board)[0]).toEqual([4, 4, 0, 0]);
    expect(four.gained).toBe(8);
  });

  it('resolves merges from the leading edge, so the odd tile out is the last (§2.3)', () => {
    const three = boardOf([2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    // Moving left, the two nearest the left wall combine.
    expect(rowsOf(slide(three, 'left').board)[0]).toEqual([4, 2, 0, 0]);
    // Moving right, the two nearest the right wall combine instead.
    expect(rowsOf(slide(three, 'right').board)[0]).toEqual([0, 0, 2, 4]);
  });

  it('reports a move that changes nothing as no move at all (§2.4)', () => {
    const board = boardOf([2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    const result = slide(board, 'left');
    expect(result.moved).toBe(false);
    expect(result.gained).toBe(0);
    expect(result.board).toEqual(board);

    expect(slide(emptyBoard(), 'up').moved).toBe(false);
  });

  it('never creates or loses a tile beyond the ones it combines', () => {
    const board = boardOf([2, 2, 4, 4], [8, 0, 8, 0], [0, 2, 0, 2], [16, 16, 16, 16]);
    for (const direction of DIRECTIONS) {
      const result = slide(board, direction);
      const before = board.reduce((sum, value) => sum + value, 0);
      const after = result.board.reduce((sum, value) => sum + value, 0);
      // Merging conserves value: two 8s become one 16.
      expect(after, direction).toBe(before);
    }
  });

  it('says where every tile went, with both halves of a merge sharing a square', () => {
    const result = slide(boardOf([2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'left');
    expect(result.movements).toEqual([
      { from: 0, to: 0, value: 2, merged: true },
      { from: 1, to: 0, value: 2, merged: true },
      { from: 2, to: 1, value: 4, merged: false },
    ]);

    // Every occupied square of the old board is accounted for exactly once.
    const board = boardOf([2, 2, 4, 4], [8, 0, 8, 0], [0, 2, 0, 2], [16, 16, 16, 16]);
    for (const direction of DIRECTIONS) {
      const movements = slide(board, direction).movements;
      expect(movements.length, direction).toBe(tileCount(board));
      expect(new Set(movements.map((m) => m.from)).size, direction).toBe(movements.length);
    }
  });
});

describe('spawning (§2, §7)', () => {
  it('places a 2 or a 4 on an empty square, and nothing when there is none', () => {
    const board = boardOf([2, 4, 8, 16], [32, 64, 128, 256], [512, 1024, 2, 4], [8, 16, 32, 0]);
    const spawn = spawnTile(board, spawnRng('seed', 0))!;
    expect(spawn.index).toBe(15);
    expect([2, 4]).toContain(spawn.value);
    expect(spawn.board[15]).toBe(spawn.value);

    const full = spawn.board;
    expect(emptyCells(full)).toEqual([]);
    expect(spawnTile(full, spawnRng('seed', 1))).toBeNull();
  });

  it('is a function of the seed and the draw number', () => {
    const board = emptyBoard();
    const first = spawnTile(board, spawnRng('2048-daily-2026-08-03', 0))!;
    const again = spawnTile(board, spawnRng('2048-daily-2026-08-03', 0))!;
    expect(again.index).toBe(first.index);
    expect(again.value).toBe(first.value);

    // A different draw number, or a different day, is a different tile stream.
    const streams = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
      const s = spawnTile(board, spawnRng('2048-daily-2026-08-03', n))!;
      return `${s.index}:${s.value}`;
    });
    expect(new Set(streams).size).toBeGreaterThan(1);

    const otherDay = spawnTile(board, spawnRng('2048-daily-2026-08-04', 0))!;
    expect(`${otherDay.index}:${otherDay.value}`).not.toBe(`${first.index}:${first.value}`);
  });

  it('leans heavily on 2, with 4 the occasional gift (90 / 10)', () => {
    const board = emptyBoard();
    let fours = 0;
    const draws = 2000;
    for (let n = 0; n < draws; n++) {
      if (spawnTile(board, spawnRng('distribution', n))!.value === 4) fours++;
    }
    const share = fours / draws;
    expect(share).toBeGreaterThan(0.06);
    expect(share).toBeLessThan(0.14);
  });
});

describe('the end of the game (§3)', () => {
  it('is over only when the board is full and nothing touches its equal', () => {
    const stuck = boardOf([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]);
    expect(emptyCells(stuck)).toEqual([]);
    expect(hasMoves(stuck)).toBe(false);
    expect(isGameOver(stuck)).toBe(true);
    for (const direction of DIRECTIONS) {
      expect(slide(stuck, direction).moved, direction).toBe(false);
    }
  });

  it('is not over while an empty square remains', () => {
    const nearly = boardOf([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]);
    expect(isGameOver(nearly)).toBe(false);
  });

  it('is not over while any two neighbours match, in either direction', () => {
    const sideways = boardOf([2, 2, 4, 8], [4, 8, 2, 4], [2, 4, 8, 2], [4, 2, 4, 8]);
    expect(isGameOver(sideways)).toBe(false);

    const vertical = boardOf([2, 4, 2, 4], [2, 2, 4, 2], [4, 4, 2, 4], [2, 2, 4, 2]);
    expect(isGameOver(vertical)).toBe(false);
  });

  it('sees a full board of one value as very much still playable', () => {
    const allTwos = new Array<number>(CELLS).fill(2);
    expect(isGameOver(allTwos)).toBe(false);
  });
});

describe('reaching 2048 (§3)', () => {
  it('is noticed the moment the tile exists, and does not stop the game', () => {
    const before = boardOf([1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    expect(hasWon(before)).toBe(false);

    const after = slide(before, 'left');
    expect(hasWon(after.board)).toBe(true);
    expect(maxTile(after.board)).toBe(WIN_VALUE);
    // Nothing about the board says "stop": there are still moves in it.
    expect(isGameOver(after.board)).toBe(false);
  });

  it('stays true past 2048', () => {
    expect(hasWon(boardOf([4096, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]))).toBe(true);
    expect(maxTile(emptyBoard())).toBe(0);
  });
});
