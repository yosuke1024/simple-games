/**
 * Puzzle generation (docs/SLIDING_PUZZLE_RULES.md §5).
 *
 * Start from the finished board and walk backwards: repeat a random legal
 * slide, never the one that would immediately undo the last. Because only
 * legal slides are ever played, the board's parity stays on the solvable side
 * and "every puzzle can be finished" is readable straight off this function —
 * no permutation shuffle followed by a parity test, and no rejected boards.
 *
 * The walk uses single-tile slides. A shuffle depth is therefore a count of
 * tile steps, which is the same unit the player's move counter uses (§3), so
 * the number in the level table means something to a person reading it.
 *
 * Everything derives from the seed, so a level or a date yields the same puzzle
 * on every device with no content pipeline and no download.
 */
import { blankIndex, isSolved, neighborsOfBlank } from './engine';
import { createRng } from './rng';
import { solvedTiles, type Puzzle, type Size, type Tiles } from './types';

/**
 * A random walk can land back on the finished board; §5 says to keep going
 * when it does. The cap only exists so generation stays total — one extra
 * slide is almost always enough, and two never fails in practice.
 */
const MAX_EXTRA_SLIDES = 64;

/** Puzzles are shuffled at least this far, whatever a caller asks for. */
const MIN_DEPTH = 1;

export function generatePuzzle(seed: string, size: Size, depth: number): Puzzle {
  const rng = createRng(seed);
  const tiles = [...solvedTiles(size)];
  const target = Math.max(MIN_DEPTH, Math.floor(depth));

  /** The cell the blank just left: sliding that tile back would undo the move. */
  let undoIndex = -1;
  let slides = 0;

  const slideOnce = (): void => {
    const all = neighborsOfBlank(tiles, size);
    // Every cell of a 3x3 or larger board has at least two neighbours, so
    // dropping the undo move always leaves a choice; the fallback is here only
    // so the walk can never stall.
    const options = all.filter((index) => index !== undoIndex);
    const choices = options.length > 0 ? options : all;
    const from = choices[Math.floor(rng() * choices.length)] ?? choices[0]!;
    const blank = blankIndex(tiles);
    tiles[blank] = tiles[from]!;
    tiles[from] = 0;
    undoIndex = blank;
    slides++;
  };

  for (let i = 0; i < target; i++) slideOnce();
  // Never hand out the finished board as a puzzle (§5).
  for (let extra = 0; extra < MAX_EXTRA_SLIDES && isSolved(tiles, size); extra++) slideOnce();

  return { seed, size, tiles, depth: slides };
}

/** Row-major string form, for golden tests and fixtures. */
export function tilesToString(tiles: Tiles): string {
  return tiles.map((value) => value.toString(36)).join('');
}
