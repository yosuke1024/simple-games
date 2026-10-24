/**
 * The fallback boards of docs/BRIDGES_RULES.md §6, step 6 — four per tier.
 *
 * Every board here was made by this game's own generator (`buildCandidate`)
 * from the seed recorded beside it, and is no one else's: no board was
 * copied from a book, a site or another product. `guarantee.test.ts`
 * re-makes each one from its seed and compares it character by character,
 * re-proves it unique with the counter and with an independent rules-only
 * search, and re-grades it into its tier — so a change to the generator
 * that would make these boards no longer its own fails there, and the fix
 * is to regenerate them (a decision, recorded in the commit message).
 *
 * The board is one string per row in the save's alphabet (`.` water,
 * `1`–`8` an island); the answer is one digit per edge in the graph's edge
 * order (serialize.ts). They are decoded on use, never at import.
 */
import { buildGraph } from './engine';
import { decodeBoard, decodeSolution } from './serialize';
import type { Grade } from './solver';
import { PRESETS, type Difficulty, type Layout } from './types';

export interface BundledBoard {
  /** The seed `buildCandidate` made this board from, on its first attempt. */
  readonly seed: string;
  /** One string per row: `.` water, `1`–`8` an island. */
  readonly board: readonly string[];
  /** Bridges per edge of the one answer, in the graph's edge order. */
  readonly solution: string;
  readonly grade: Grade;
  /** Times counting alone ran dry on the way to the answer (§7). */
  readonly stalls: number;
}

export const BUNDLED_BOARDS: Record<Difficulty, readonly BundledBoard[]> = {
  easy: [
    {
      seed: 'bridges-bundled-easy-2',
      board: ['.......', '1.1.3.4', '.......', '4.....6', '.......', '......2', '3..2...'],
      solution: '011222122',
      grade: 'basic',
      stalls: 0,
    },
    {
      seed: 'bridges-bundled-easy-3',
      board: ['......2', '.2.3.1.', '.......', '...2..4', '.2...2.', '......1', '..2..3.'],
      solution: '21111011112',
      grade: 'basic',
      stalls: 0,
    },
    {
      seed: 'bridges-bundled-easy-4',
      board: ['1..2..3', '.......', '2.....3', '.1.....', '.......', '.......', '.2....2'],
      solution: '01211111',
      grade: 'basic',
      stalls: 0,
    },
    {
      seed: 'bridges-bundled-easy-5',
      board: ['.3.2.1.', '.......', '.5...5.', '.......', '..3.2..', '.2.....', '1.3..3.'],
      solution: '21012222111',
      grade: 'basic',
      stalls: 0,
    },
  ],
  medium: [
    {
      seed: 'bridges-bundled-medium-3',
      board: [
        '.1.2...2.',
        '4.....2..',
        '.1.2...3.',
        '.....2...',
        '.........',
        '4..2.....',
        '.........',
        '.1.3.3...',
        '3......3.',
      ],
      solution: '1010122101012111112',
      grade: 'connect',
      stalls: 2,
    },
    {
      seed: 'bridges-bundled-medium-6',
      board: [
        '2......2.',
        '.2...2..1',
        '.........',
        '..1.1....',
        '.....1...',
        '..2.5..4.',
        '3........',
        '.2..2..1.',
        '3.2.....2',
      ],
      solution: '111110110111021121011',
      grade: 'connect',
      stalls: 1,
    },
    {
      seed: 'bridges-bundled-medium-7',
      board: [
        '.2..2..1.',
        '.........',
        '.1..3.2..',
        '2........',
        '.2..3....',
        '...1.....',
        '3........',
        '.2.2..1..',
        '2.2.4..3.',
      ],
      solution: '110110011121111110112',
      grade: 'connect',
      stalls: 1,
    },
    {
      seed: 'bridges-bundled-medium-9',
      board: [
        '.3..2.1.2',
        '.........',
        '.3......3',
        '..2..4.3.',
        '.........',
        '..1......',
        '.........',
        '.3...3..1',
        '.......1.',
      ],
      solution: '210111111121120',
      grade: 'connect',
      stalls: 1,
    },
  ],
  hard: [
    {
      seed: 'bridges-bundled-hard-2',
      board: [
        '3......2.1',
        '..1..3..2.',
        '..........',
        '.1.3.4.1.1',
        '..........',
        '3.3..2..3.',
        '..........',
        '2.3..4.1..',
        '......1.2.',
        '2.1..3.2.2',
      ],
      solution: '121001011112100011011101111012011011',
      grade: 'connect',
      stalls: 6,
    },
    {
      seed: 'bridges-bundled-hard-10',
      board: [
        '1..3.3.2.2',
        '.1........',
        '1.........',
        '.......1..',
        '.2.......1',
        '2..2......',
        '..........',
        '.3.5.1.3.1',
        '..........',
        '2..4...3.1',
      ],
      solution: '1011111011110100112020110111',
      grade: 'connect',
      stalls: 5,
    },
    {
      seed: 'bridges-bundled-hard-15',
      board: [
        '.1......2.',
        '2......1..',
        '.1.3..1...',
        '..........',
        '4..4...2..',
        '..........',
        '4.1..2.3..',
        '.1.4....3.',
        '2.1.......',
        '.2.3..1.2.',
      ],
      solution: '101110101101211111002101111201',
      grade: 'connect',
      stalls: 5,
    },
    {
      seed: 'bridges-bundled-hard-25',
      board: [
        '.2.3..2..1',
        '1.......1.',
        '.2..1.2..2',
        '2.........',
        '.3.4....3.',
        '.....2.1..',
        '..........',
        '.1....1.2.',
        '2..3.4...3',
        '..........',
      ],
      solution: '11110110110110011111111101112',
      grade: 'connect',
      stalls: 4,
    },
  ],
};

/**
 * A bundled board decoded into a layout and its answer. Throws on a board
 * that does not decode — which `guarantee.test.ts` rules out for every entry,
 * so it would mean this file was edited by hand.
 */
export function decodeBundled(
  difficulty: Difficulty,
  board: BundledBoard,
): { readonly layout: Layout; readonly solution: readonly number[] } {
  const { width, height } = PRESETS[difficulty];
  const layout = decodeBoard(board.board.join(''), width, height);
  const solution = layout === null ? null : decodeSolution(board.solution, buildGraph(layout));
  if (layout === null || solution === null) {
    throw new Error(`bridges: bundled board ${board.seed} does not decode`);
  }
  return { layout, solution };
}
