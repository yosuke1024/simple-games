/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/NUMBER_MATCH_RULES.md §17): the starting board — digits, holes, stones
 * and wilds — in the string form the golden tests write, through this game's
 * own xmur3. Not a guard against tampering — a check that two devices dealt
 * the same board, so a generator that changed between versions cannot pair two
 * different boards under one Today challenge.
 */
import { hashSeed } from './rng';
import { encodeBoard } from './serialize';
import { restartSession, type GameSession } from './session';
import type { Board } from './types';

/** `nm` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'nm1:';

export function boardDigest(initialBoard: Board): string {
  return (
    BOARD_DIGEST_PREFIX + hashSeed(encodeBoard(initialBoard).values).toString(16).padStart(8, '0')
  );
}

/**
 * Any session's digest. The live board changes as pairs clear and Add Numbers
 * appends rows, so the digest is taken from the board dealt again from the
 * session's own inputs (Restart's board): the same for a fresh deal, a
 * resumed one and a finished one.
 */
export function boardDigestOf(session: GameSession): string {
  return boardDigest(restartSession(session).board);
}
