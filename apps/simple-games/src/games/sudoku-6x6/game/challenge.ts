/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/SUDOKU_6X6_RULES.md Club section): the givens, row-major as the golden
 * tests write them, through this game's own xmur3. Not a guard against
 * tampering — a check that two devices built the same grid, so a generator that
 * changed between versions cannot pair two different puzzles under one Today
 * challenge.
 */
import type { Board } from './engine';
import { gridToString } from './generator';
import { hashSeed } from './rng';
import type { Grid } from './types';

/** `s6` (Sudoku 6×6) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 's61:';

export function boardDigest(givens: Grid): string {
  return BOARD_DIGEST_PREFIX + hashSeed(gridToString(givens)).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or free: the givens never move. */
export function boardDigestOf(session: { readonly board: Board }): string {
  return boardDigest(session.board.givens);
}
