/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/SOLITAIRE_RULES.md §14): the dealt starting position — the string the
 * golden tests already pin — plus the draw setting, through this game's own
 * xmur3. Draw 1 and draw 3 are the same cards but not the same game (moves are
 * not comparable), so each is its own Today challenge. Not a guard against
 * tampering — a check that two devices dealt the same game, so a deal that
 * changed between versions cannot pair two different boards under one
 * challenge.
 */
import { boardToString, dealBoard } from './deal';
import { hashSeed } from './rng';

/** `sl` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'sl1:';

export function boardDigest(seed: string, drawThree: boolean): string {
  const start = boardToString(dealBoard(seed)) + '|' + (drawThree ? 'draw-3' : 'draw-1');
  return BOARD_DIGEST_PREFIX + hashSeed(start).toString(16).padStart(8, '0');
}

/**
 * Any session's digest. The deal is rebuilt from the seed: the session's own
 * board changes with every move, the deal never does.
 */
export function boardDigestOf(session: {
  readonly seed: string;
  readonly drawThree: boolean;
}): string {
  return boardDigest(session.seed, session.drawThree);
}
