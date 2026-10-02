/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/TAKUZU_RULES.md §15): the givens, row-major as the golden tests write
 * them, through this game's own xmur3. The solution is unique (§5), so the
 * givens name the board. Not a guard against tampering — a check that two
 * devices built the same grid, so a generator that changed between versions
 * cannot pair two different puzzles under one Today challenge.
 */
import { hashSeed } from './rng';
import { encodeBoard } from './serialize';
import type { Mark } from './types';

/** `tk` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'tk1:';

export function boardDigest(givens: readonly Mark[]): string {
  return BOARD_DIGEST_PREFIX + hashSeed(encodeBoard(givens)).toString(16).padStart(8, '0');
}

/** Any session's digest — level, daily or free: the givens never move. */
export function boardDigestOf(session: { readonly givens: readonly Mark[] }): string {
  return boardDigest(session.givens);
}
