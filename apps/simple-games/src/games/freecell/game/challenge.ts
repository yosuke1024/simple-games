/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/FREECELL_RULES.md §14): the dealt starting position — the string the
 * golden tests already pin — through this game's own xmur3. Not a guard
 * against tampering — a check that two devices dealt the same game, so a deal
 * that changed between versions cannot pair two different boards under one
 * Today challenge.
 */
import { boardToString, dealBoard } from './deal';
import { hashSeed } from './rng';

/** `fc` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'fc1:';

export function boardDigest(seed: string): string {
  return (
    BOARD_DIGEST_PREFIX +
    hashSeed(boardToString(dealBoard(seed)))
      .toString(16)
      .padStart(8, '0')
  );
}

/**
 * Any session's digest. The deal is rebuilt from the seed: the session's own
 * board changes with every move, the deal never does.
 */
export function boardDigestOf(session: { readonly seed: string }): string {
  return boardDigest(session.seed);
}
