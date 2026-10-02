/**
 * The board's identity for a Club House challenge (docs/architecture/club.md
 * §6-4, docs/SUDOKU_RULES.md §15): the givens, row-major as the golden tests
 * write them, through this game's own xmur3. Not a guard against tampering —
 * a check that two devices built the same grid from the same seed, so a
 * generator that changed between versions cannot pair two different puzzles
 * under one challenge.
 */
import type { Board } from './engine';
import { gridToString } from './generator';
import { hashSeed } from './rng';
import type { Grid } from './types';

/** `sd` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'sd1:';

export function boardDigest(givens: Grid): string {
  return BOARD_DIGEST_PREFIX + hashSeed(gridToString(givens)).toString(16).padStart(8, '0');
}

/** Any session's digest — level, daily, free or club: the givens never move. */
export function boardDigestOf(session: { readonly board: Board }): string {
  return boardDigest(session.board.givens);
}
