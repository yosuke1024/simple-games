/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/BINARY_BALANCE_RULES.md): the givens and the `=` / `×` links, as
 * `serialize.ts` writes them. The links are visible clues, so they are hashed;
 * the solution is unique under them, so it need not be. Never the marks. Run
 * through this game's own xmur3. Not a guard against tampering — a check that
 * two devices built the same board, so a generator that changed between
 * versions cannot pair two different puzzles under one Today challenge.
 */
import { hashSeed } from './rng';
import { encodeBoard, encodeLinks } from './serialize';
import type { Link, Mark } from './types';

/** `bb` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'bb1:';

export function boardDigest(givens: readonly Mark[], links: readonly Link[]): string {
  const text = `${encodeBoard(givens)}|${encodeLinks(links)}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or not: the starting board never moves during play. */
export function boardDigestOf(session: {
  readonly givens: readonly Mark[];
  readonly links: readonly Link[];
}): string {
  return boardDigest(session.givens, session.links);
}
