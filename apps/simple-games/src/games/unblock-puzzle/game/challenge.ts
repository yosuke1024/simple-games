/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/UNBLOCK_PUZZLE_RULES.md §18): the board as dealt, in the 36-character
 * form a save writes and the compatibility golden pins (§12, `encodeBoard`),
 * through this game's own xmur3. Not a guard against tampering — a check that
 * two devices dealt the same board, so a catalogue or generator that changed
 * between versions cannot pair two different boards under one Today challenge.
 *
 * Only the dealt board is read. The board on screen moves with every slide;
 * the dealt board (`start`, the one Reset returns to) never does, so the
 * digest is the same in play, after a restore and after the clear.
 */
import { hashSeed } from './rng';
import { encodeBoard } from './serialize';
import type { Board } from './types';

/** `ub` (Unblock Puzzle) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'ub1:';

/** The digest of a board as dealt. */
export function boardDigest(start: Board): string {
  return BOARD_DIGEST_PREFIX + hashSeed(encodeBoard(start)).toString(16).padStart(8, '0');
}

/** A session's digest — daily or Free Play: the dealt board, never the board in play. */
export function boardDigestOf(session: { readonly start: Board }): string {
  return boardDigest(session.start);
}
