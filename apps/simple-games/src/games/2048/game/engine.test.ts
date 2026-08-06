/**
 * The play rules of docs/GAME_2048_RULES.md §2, §3, §4 and §5: what a move
 * does to each line, what it must refuse, what it puts down afterwards, and
 * when the board has nothing left.
 *
 * Boards are written out by hand so each case says which position it is about.
 */
import { describe, expect, it } from 'vitest';
import { hasMoves, isOver, move, spawnTile, traceMove } from './engine';
import { emptyBoard, SPAWN_FOUR_CHANCE, type Board } from './types';

/** Four rows of four, the way the board reads. */
const board = (...rows: readonly number[][]): Board => ([] as number[]).concat(...rows);

const ZERO = [0, 0, 0, 0];

/**
 *  2  4  8 16
 *  4  8 16  2
 *  8 16  2  4
 * 16  2  4  8   — full, and no two neighbours match in any direction.
 */
const JAMMED = board([2, 4, 8, 16], [4, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 8]);

describe('resolving a line (§4)', () => {
  it('packs and joins towards the direction of the move', () => {
    const result = move(board([2, 2, 4, 0], ZERO, ZERO, ZERO), 'left');
    expect(result.board).toEqual(board([4, 4, 0, 0], ZERO, ZERO, ZERO));
    expect(result.gained).toBe(4);
    expect(result.moved).toBe(true);
  });

  it('does not join a tile it has just created (§4.3)', () => {
    // The classic: [2,2,4] is [4,4], never [8]. The 4 that arrives has already
    // been part of a join this move and is finished.
    expect(move(board([2, 2, 4, 0], ZERO, ZERO, ZERO), 'left').board).toEqual(
      board([4, 4, 0, 0], ZERO, ZERO, ZERO),
    );
    // Four of a kind make two pairs, not one 8.
    const four = move(board([2, 2, 2, 2], ZERO, ZERO, ZERO), 'left');
    expect(four.board).toEqual(board([4, 4, 0, 0], ZERO, ZERO, ZERO));
    expect(four.gained).toBe(8);
  });

  it('scores the sum of the values it created (§7)', () => {
    const result = move(board([2, 2, 4, 4], ZERO, ZERO, ZERO), 'left');
    expect(result.board).toEqual(board([4, 8, 0, 0], ZERO, ZERO, ZERO));
    expect(result.gained).toBe(12);
  });

  it('resolves from the far side when the move goes right', () => {
    const result = move(board([0, 4, 2, 2], ZERO, ZERO, ZERO), 'right');
    expect(result.board).toEqual(board([0, 0, 4, 4], ZERO, ZERO, ZERO));
    expect(result.gained).toBe(4);
  });

  it('does the same down a column, in both directions', () => {
    const column = board([2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], ZERO);
    expect(move(column, 'up').board).toEqual(board([4, 0, 0, 0], [4, 0, 0, 0], ZERO, ZERO));

    const bottom = board(ZERO, [4, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0]);
    expect(move(bottom, 'down').board).toEqual(board(ZERO, ZERO, [4, 0, 0, 0], [4, 0, 0, 0]));
  });

  it('leaves the original board untouched', () => {
    const before = [...JAMMED];
    move(JAMMED, 'left');
    expect(JAMMED).toEqual(before);
  });
});

describe('moves that do nothing (§3)', () => {
  it('reports moved: false and scores nothing', () => {
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      const result = move(JAMMED, direction);
      expect(result.moved, direction).toBe(false);
      expect(result.gained, direction).toBe(0);
      expect(result.board, direction).toEqual(JAMMED);
    }
  });

  it('refuses a direction everything is already packed against', () => {
    // One tile in the corner has nowhere to go left, but plenty to the right.
    const corner = board([2, 0, 0, 0], ZERO, ZERO, ZERO);
    expect(move(corner, 'left').moved).toBe(false);
    expect(move(corner, 'right').moved).toBe(true);
  });
});

describe('where the tiles went (§12)', () => {
  it('reports each tile’s destination and which cells a join created', () => {
    const trace = traceMove(board([2, 2, 4, 0], ZERO, ZERO, ZERO), 'left');
    // Both 2s land in cell 0; the 4 packs into cell 1 without joining.
    expect(trace.to[0]).toBe(0);
    expect(trace.to[1]).toBe(0);
    expect(trace.to[2]).toBe(1);
    // Empty cells have no tile to send anywhere.
    expect(trace.to[3]).toBe(-1);
    expect(trace.merged[0]).toBe(true);
    expect(trace.merged[1]).toBe(false);
  });
});

describe('the new tile (§5)', () => {
  it('only ever lands on an empty cell', () => {
    const nearlyFull = board([2, 4, 8, 16], [4, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 0]);
    for (let index = 0; index < 200; index++) {
      const next = spawnTile(nearlyFull, 'spawn', index);
      expect(next[15], `spawn ${index}`).not.toBe(0);
      expect(next.slice(0, 15)).toEqual(nearlyFull.slice(0, 15));
    }
  });

  it('is a 2 or a 4, and a 4 about a tenth of the time', () => {
    const SAMPLE = 4000;
    let fours = 0;
    for (let index = 0; index < SAMPLE; index++) {
      // One tile on an otherwise empty board: whatever is not 0 is the draw.
      const value = spawnTile(emptyBoard(), 'rate', index).find((cell) => cell !== 0)!;
      expect(value === 2 || value === 4, `spawn ${index} put down ${value}`).toBe(true);
      if (value === 4) fours += 1;
    }
    // A seeded sample, so this is a fact about the shipped draw rather than a
    // flaky statistic — but it is still a sample, so the band has room.
    const rate = fours / SAMPLE;
    expect(rate).toBeGreaterThan(SPAWN_FOUR_CHANCE - 0.03);
    expect(rate).toBeLessThan(SPAWN_FOUR_CHANCE + 0.03);
  });

  it('is decided by the seed and the count, not by chance', () => {
    const start = board([2, 0, 0, 0], ZERO, ZERO, ZERO);
    const trail = (seed: string) =>
      [0, 1, 2, 3, 4, 5].map((index) => spawnTile(start, seed, index).join(','));
    expect(trail('same')).toEqual(trail('same'));
    // Two games diverge because their seeds differ. Compared over a run of
    // draws rather than one: a single draw can coincide, a run cannot.
    expect(trail('same')).not.toEqual(trail('other'));
  });

  it('leaves a full board alone rather than inventing a cell', () => {
    expect(spawnTile(JAMMED, 'full', 0)).toEqual(JAMMED);
  });
});

describe('the end of a game (§2)', () => {
  it('is not over while a cell is empty', () => {
    const open = board([2, 4, 8, 16], [4, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 0]);
    expect(hasMoves(open)).toBe(true);
    expect(isOver(open)).toBe(false);
  });

  it('is not over while two neighbours match, in a row or a column', () => {
    const pairInRow = board([4, 4, 8, 16], [4, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 8]);
    expect(isOver(pairInRow)).toBe(false);

    const pairInColumn = board([2, 4, 8, 16], [2, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 8]);
    expect(isOver(pairInColumn)).toBe(false);
  });

  it('is over when the board is full and nothing matches', () => {
    expect(hasMoves(JAMMED)).toBe(false);
    expect(isOver(JAMMED)).toBe(true);
  });
});
