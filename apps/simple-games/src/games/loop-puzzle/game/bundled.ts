/**
 * The bundled fallback boards of docs/LOOP_PUZZLE_RULES.md §8, step 6 —
 * shipped only when ATTEMPT_LIMIT derived seeds all miss their tier, which no
 * walked seed has ever done (`guarantee.test.ts` asserts zero fallbacks).
 *
 * Every board here was produced by this game's own generator from the seed
 * beside it — no board is hand-made or taken from anywhere else — and
 * `bundled.test.ts` re-proves each one: it regenerates the seed and expects
 * these exact clues, counts its loops with both the search and the
 * independent oracle (exactly one), and grades it to its tier. If the
 * generator changes, that test fails here first: regenerate the boards from
 * the same seeds rather than editing a clue by hand.
 *
 * Clues are one character per cell, row-major: `0`–`3`, or `.` for none.
 */
import type { Difficulty } from './types';

export interface BundledBoard {
  /** The seed `generatePuzzle` made this board from (its provenance). */
  readonly seed: string;
  readonly clues: string;
}

export const BUNDLED_BOARDS: Record<Difficulty, readonly BundledBoard[]> = {
  easy: [
    { seed: 'loop-puzzle-bundled-easy-1', clues: '1010.2.2..12.2..' },
    { seed: 'loop-puzzle-bundled-easy-2', clues: '1..20.3...1.0232' },
    { seed: 'loop-puzzle-bundled-easy-3', clues: '2.1.230.22.0...1' },
    { seed: 'loop-puzzle-bundled-easy-4', clues: '1.1.0.12...2.131' },
  ],
  medium: [
    { seed: 'loop-puzzle-bundled-medium-1', clues: '22....320......232.022.1.' },
    { seed: 'loop-puzzle-bundled-medium-2', clues: '022..1...113.3...223.3...' },
    { seed: 'loop-puzzle-bundled-medium-3', clues: '01....023.0.32.0.....13.2' },
    { seed: 'loop-puzzle-bundled-medium-4', clues: '01.00....0.202.0..02..1..' },
  ],
  hard: [
    { seed: 'loop-puzzle-bundled-hard-1', clues: '2...1.1.0..1..11.13....0..1....0....' },
    { seed: 'loop-puzzle-bundled-hard-2', clues: '3....2.1.23.0.3.....12.......10.1.2.' },
    { seed: 'loop-puzzle-bundled-hard-3', clues: '.0.....23..0..223....2.1.2..2..3...3' },
    { seed: 'loop-puzzle-bundled-hard-4', clues: '....1...02......02.0.3.31...02..1...' },
  ],
};
