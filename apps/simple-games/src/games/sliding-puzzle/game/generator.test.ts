/**
 * The invariants a shipped puzzle must hold (docs/SLIDING_PUZZLE_RULES.md §5,
 * §6): it can always be finished, it is never handed out already finished, the
 * same seed always rebuilds it, and its depth comes from the level table.
 *
 * "It can always be finished" is checked twice over, on purpose. Once by the
 * parity rule, which is independent maths that knows nothing about how the
 * board was built. And once by construction: for 3x3 every position reachable
 * from the finished board is enumerated outright, and at every size the walk is
 * shown to advance one legal slide at a time and never to double back. Either
 * check alone could agree with a bug in the other.
 */
import { describe, expect, it } from 'vitest';
import { dailySeed, DAILY_DEPTH, DAILY_SIZE } from './daily';
import { applyMove, blankIndex, isSolvable, isSolved, neighborsOfBlank } from './engine';
import { generatePuzzle, tilesToString } from './generator';
import { levelSeed, shuffleDepthForLevel, sizeForLevel } from './levels';
import { SIZES, solvedTiles, type Size, type Tiles } from './types';

const LEVELS = [1, 2, 30, 31, 120, 121, 400, 401, 700, 701, 999];
const DAILIES = ['2026-08-01', '2026-12-31'];

/** Every level puzzle plus a couple of dailies — what a player can reach. */
const shippedPuzzles = [
  ...LEVELS.map((level) =>
    generatePuzzle(levelSeed(level), sizeForLevel(level), shuffleDepthForLevel(level)),
  ),
  ...DAILIES.map((date) => generatePuzzle(dailySeed(date), DAILY_SIZE, DAILY_DEPTH)),
];

/**
 * Every 3x3 position reachable from the finished board, found by breadth-first
 * search over legal slides. Half of the 9! arrangements, computed once.
 */
const reachable3x3 = (() => {
  const seen = new Set<string>();
  const start = solvedTiles(3);
  const queue: Tiles[] = [start];
  seen.add(start.join(','));
  // An index rather than shift(): shifting a six-figure array repeatedly turns
  // this search quadratic.
  for (let head = 0; head < queue.length; head++) {
    const tiles = queue[head]!;
    for (const index of neighborsOfBlank(tiles, 3)) {
      const next = applyMove(tiles, 3, index)!.tiles;
      const key = next.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
})();

describe('generatePuzzle (§5)', () => {
  it('enumerates exactly half of the 3x3 arrangements as reachable', () => {
    // 9!/2 = 181440. A sanity check on the search itself, before it is used to
    // judge the generator.
    expect(reachable3x3.size).toBe(181_440);
  });

  it('hands out only boards that can be finished — by parity', () => {
    for (const puzzle of shippedPuzzles) {
      expect(isSolvable(puzzle.tiles, puzzle.size), puzzle.seed).toBe(true);
    }
  });

  it('hands out only boards that can be finished — by construction', () => {
    for (const puzzle of shippedPuzzles) {
      if (puzzle.size !== 3) continue;
      expect(reachable3x3.has(puzzle.tiles.join(',')), puzzle.seed).toBe(true);
    }
  });

  it('never returns the finished board', () => {
    for (const puzzle of shippedPuzzles) {
      expect(isSolved(puzzle.tiles, puzzle.size), puzzle.seed).toBe(false);
    }
  });

  it('is deterministic: the same seed rebuilds the same board', () => {
    for (const puzzle of shippedPuzzles) {
      const again = generatePuzzle(puzzle.seed, puzzle.size, puzzle.depth);
      expect(tilesToString(again.tiles), puzzle.seed).toBe(tilesToString(puzzle.tiles));
    }
  });

  it('gives different seeds different boards', () => {
    const perSize = new Map<Size, Set<string>>();
    for (const puzzle of shippedPuzzles) {
      const set = perSize.get(puzzle.size) ?? new Set<string>();
      set.add(tilesToString(puzzle.tiles));
      perSize.set(puzzle.size, set);
    }
    for (const size of SIZES) {
      const boards = shippedPuzzles.filter((puzzle) => puzzle.size === size).length;
      if (boards > 1) expect(perSize.get(size)!.size).toBe(boards);
    }
  });

  it('shuffles at least as deep as asked, and reports what it did', () => {
    for (const size of SIZES) {
      const puzzle = generatePuzzle(`depth-${size}`, size, 40);
      expect(puzzle.depth).toBeGreaterThanOrEqual(40);
      expect(puzzle.size).toBe(size);
      expect(puzzle.tiles).toHaveLength(size * size);
    }
    // A caller asking for nothing still gets a shuffled board, not the answer.
    const trivial = generatePuzzle('depth-zero', 3, 0);
    expect(isSolved(trivial.tiles, 3)).toBe(false);
  });
});

describe('the shuffle walk (§5)', () => {
  /**
   * Two runs of the same seed share a prefix, so the board at depth k+1 is the
   * board at depth k plus exactly one legal slide. Following that chain shows
   * the walk is made of legal moves and never immediately undoes one — the two
   * things §5 asks of it, checked at every size.
   */
  it.each(SIZES)('advances one legal slide at a time and never doubles back (size %i)', (size) => {
    let previousBlank = -1;
    for (let depth = 1; depth < 24; depth++) {
      const here = generatePuzzle(`walk-${size}`, size, depth);
      const next = generatePuzzle(`walk-${size}`, size, depth + 1);
      // Skip a step where the walk had to add extra slides to escape the
      // finished board: the two runs no longer share a prefix there, and the
      // chain of "where the blank came from" restarts.
      if (here.depth !== depth) {
        previousBlank = -1;
        continue;
      }

      const from = neighborsOfBlank(here.tiles, size).find(
        (index) => applyMove(here.tiles, size, index)!.tiles.join(',') === next.tiles.join(','),
      );
      expect(from, `depth ${depth} is not one slide from depth ${depth - 1}`).toBeDefined();
      // Undoing would mean sliding the tile straight back where it came from.
      expect(from).not.toBe(previousBlank);
      previousBlank = blankIndex(here.tiles);
    }
  });
});

describe('the level table (§6)', () => {
  it('steps the board up at the documented levels', () => {
    expect([1, 30, 31, 120].map(sizeForLevel)).toEqual([3, 3, 3, 3]);
    expect([121, 400, 401, 700].map(sizeForLevel)).toEqual([4, 4, 4, 4]);
    expect([701, 999].map(sizeForLevel)).toEqual([5, 5]);
  });

  it('hits each band’s floor and ceiling, and interpolates in between', () => {
    expect(shuffleDepthForLevel(1)).toBe(20);
    expect(shuffleDepthForLevel(30)).toBe(60);
    expect(shuffleDepthForLevel(31)).toBe(60);
    expect(shuffleDepthForLevel(120)).toBe(120);
    expect(shuffleDepthForLevel(121)).toBe(80);
    expect(shuffleDepthForLevel(400)).toBe(200);
    expect(shuffleDepthForLevel(401)).toBe(200);
    expect(shuffleDepthForLevel(700)).toBe(400);
    expect(shuffleDepthForLevel(701)).toBe(200);
    expect(shuffleDepthForLevel(999)).toBe(500);
    // Halfway up the first band is halfway between its ends.
    expect(shuffleDepthForLevel(15)).toBe(39);
    expect(shuffleDepthForLevel(16)).toBe(41);
  });

  it('never goes backwards inside a band', () => {
    for (const [from, to] of [
      [1, 30],
      [31, 120],
      [121, 400],
      [401, 700],
      [701, 999],
    ]) {
      for (let level = from! + 1; level <= to!; level++) {
        expect(
          shuffleDepthForLevel(level),
          `level ${level} is shallower than ${level - 1}`,
        ).toBeGreaterThanOrEqual(shuffleDepthForLevel(level - 1));
      }
    }
  });

  it('clamps levels outside 1..999 rather than failing', () => {
    expect(sizeForLevel(0)).toBe(sizeForLevel(1));
    expect(shuffleDepthForLevel(-10)).toBe(shuffleDepthForLevel(1));
    expect(shuffleDepthForLevel(5000)).toBe(shuffleDepthForLevel(999));
  });
});
