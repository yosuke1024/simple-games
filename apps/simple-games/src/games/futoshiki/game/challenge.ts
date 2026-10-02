/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/FUTOSHIKI_RULES.md §15): the givens and the signs, as the golden tests
 * write them (`givens|signs`), through this game's own xmur3. The signs are
 * part of what the player sees, so they are in the hash and not only the
 * givens. Not a guard against tampering — a check that two devices built the
 * same puzzle, so a generator that changed between versions cannot pair two
 * different boards under one Today challenge.
 */
import { hashSeed } from './rng';
import { encodeConstraints, encodeGrid } from './serialize';
import type { Constraint, Grid, Size } from './types';

/** `fs` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'fs1:';

export function boardDigest(givens: Grid, constraints: readonly Constraint[], size: Size): string {
  const text = `${encodeGrid(givens)}|${encodeConstraints(constraints, size)}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — level, daily or free: givens and signs never move. */
export function boardDigestOf(session: {
  readonly size: Size;
  readonly constraints: readonly Constraint[];
  readonly board: { readonly givens: Grid };
}): string {
  return boardDigest(session.board.givens, session.constraints, session.size);
}
