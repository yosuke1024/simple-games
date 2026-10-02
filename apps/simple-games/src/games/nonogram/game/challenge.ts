/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/NONOGRAM_RULES.md §14): the solution, row-major as the golden tests
 * write it, through this game's own xmur3. The clues derive from the solution
 * and the puzzle admits only that one (§4), so the solution names the board.
 * Not a guard against tampering — a check that two devices built the same
 * puzzle, so a generator that changed between versions cannot pair two
 * different boards under one Today challenge.
 */
import { hashSeed } from './rng';
import { encodeCells } from './serialize';
import type { Cell } from './types';

/** `ng` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'ng1:';

export function boardDigest(solution: readonly Cell[]): string {
  return BOARD_DIGEST_PREFIX + hashSeed(encodeCells(solution)).toString(16).padStart(8, '0');
}

/** Any session's digest — level, daily or free: the solution never moves. */
export function boardDigestOf(session: { readonly solution: readonly Cell[] }): string {
  return boardDigest(session.solution);
}
