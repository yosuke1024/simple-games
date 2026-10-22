/**
 * The initial board (docs/GEM_SWAP_RULES.md §4.1).
 *
 * Built, not filtered: cells are drawn row-major, each uniformly from the
 * kinds that would not complete a run with the two cells to its left or the
 * two above. A run through a new cell can only be made with those two pairs,
 * so a board built this way has no run by construction — the tests still
 * check it, but nothing here needs to. At most two kinds are excluded and
 * there are at least five, so a cell always has three or more candidates.
 *
 * What construction cannot promise is a valid swap. That is checked, and a
 * board without one is redrawn, at most INITIAL_ATTEMPT_LIMIT times; past
 * that the colour count's bundled board — made by this same generator and
 * verified by generator.test.ts — is used. The seed still owns the refill
 * tapes either way (§4.2).
 */
import { hasValidSwap } from './board';
import { createRng } from './rng';
import {
  BOARD_SIZE,
  CELL_COUNT,
  INITIAL_ATTEMPT_LIMIT,
  indexAt,
  type Board,
  type ColorCount,
} from './types';

/** Attempt `a`'s rng key; `init` keeps it apart from the column tapes (§4.1). */
export const initialAttemptKey = (seed: string, attempt: number): string =>
  `${seed}:init:${attempt}`;

/** One constructive draw: a board with no run, valid swap or not. */
export function buildBoard(rng: () => number, colors: ColorCount): Board {
  const board = new Array<number>(CELL_COUNT).fill(0);
  const candidates: number[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const left =
        col >= 2 && board[indexAt(row, col - 1)] === board[indexAt(row, col - 2)]
          ? board[indexAt(row, col - 1)]
          : -1;
      const above =
        row >= 2 && board[indexAt(row - 1, col)] === board[indexAt(row - 2, col)]
          ? board[indexAt(row - 1, col)]
          : -1;
      candidates.length = 0;
      for (let kind = 0; kind < colors; kind++) {
        if (kind !== left && kind !== above) candidates.push(kind);
      }
      board[indexAt(row, col)] = candidates[Math.floor(rng() * candidates.length)]!;
    }
  }
  return board;
}

/** The seeds the bundled boards were drawn from (attempt 0 of each). */
export const BUNDLED_SEEDS: Readonly<Record<ColorCount, string>> = {
  5: 'gem-swap-bundled-5',
  6: 'gem-swap-bundled-6',
};

/**
 * One fallback board per colour count, as 64 digits row by row. Each is
 * exactly `buildBoard(createRng(initialAttemptKey(BUNDLED_SEEDS[k], 0)), k)`;
 * generator.test.ts re-derives it and checks it has no run and at least one
 * valid swap. Changing the rng or the construction fails that test — and
 * then these strings must be regenerated, not edited by hand.
 */
export const BUNDLED_BOARDS: Readonly<Record<ColorCount, string>> = {
  5: '2411424222121043134112331443323124330110101230220310412110233113',
  6: '0231404530311442510425145511251404240455244052551342214043253203',
};

export const parseBoardDigits = (digits: string): Board => digits.split('').map((ch) => Number(ch));

export interface InitialBoard {
  readonly board: Board;
  /** Draws made: 1 when the first board had a valid swap; LIMIT when it fell back. */
  readonly attempts: number;
  /** True when every draw lacked a valid swap and the bundled board was used. */
  readonly fallback: boolean;
}

/**
 * The round's starting board. `attemptLimit` exists for the tests that drive
 * the fallback path; play always uses INITIAL_ATTEMPT_LIMIT.
 */
export function generateInitialBoard(
  seed: string,
  colors: ColorCount,
  attemptLimit: number = INITIAL_ATTEMPT_LIMIT,
): InitialBoard {
  return drawInitialBoard(seed, colors, attemptLimit, hasValidSwap);
}

/**
 * The draw loop with its acceptance test passed in. Play only ever passes
 * `hasValidSwap`; the tests pass a stricter one to drive the redraw branch,
 * which no seed the sweep has found ever needs (§14).
 */
export function drawInitialBoard(
  seed: string,
  colors: ColorCount,
  attemptLimit: number,
  accepts: (board: Board) => boolean,
): InitialBoard {
  for (let attempt = 0; attempt < attemptLimit; attempt++) {
    const board = buildBoard(createRng(initialAttemptKey(seed, attempt)), colors);
    if (accepts(board)) return { board, attempts: attempt + 1, fallback: false };
  }
  return {
    board: parseBoardDigits(BUNDLED_BOARDS[colors]),
    attempts: attemptLimit,
    fallback: true,
  };
}
