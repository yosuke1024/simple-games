/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/SPIDER_SOLITAIRE_RULES.md §14): the dealt starting position — the
 * string the golden tests already pin — through this game's own xmur3. That
 * string leads with the suit count, so one, two and four suits are three
 * different digests, i.e. three Today challenges a day (moves are not
 * comparable across them). Not a guard against tampering — a check that two
 * devices dealt the same game, so a deal that changed between versions cannot
 * pair two different boards under one challenge.
 */
import { boardToString, dealBoard } from './deal';
import { hashSeed } from './rng';
import type { SuitCount } from './types';

/** `ss` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'ss1:';

export function boardDigest(seed: string, suitCount: SuitCount): string {
  return (
    BOARD_DIGEST_PREFIX +
    hashSeed(boardToString(dealBoard(seed, suitCount)))
      .toString(16)
      .padStart(8, '0')
  );
}

/**
 * Any session's digest. The deal is rebuilt from the seed: the session's own
 * board changes with every move, the deal never does.
 */
export function boardDigestOf(session: {
  readonly seed: string;
  readonly suitCount: SuitCount;
}): string {
  return boardDigest(session.seed, session.suitCount);
}
