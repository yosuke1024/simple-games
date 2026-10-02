/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/SLIDING_PUZZLE_RULES.md §14): the starting tiles and the board size, in
 * the string form the golden tests write, through this game's own xmur3. Not a
 * guard against tampering — a check that two devices shuffled the same puzzle,
 * so a generator that changed between versions cannot pair two different
 * boards under one Today challenge.
 */
import { tilesToString } from './generator';
import { hashSeed } from './rng';
import { restartSession, type SlidingPuzzleSession } from './session';
import type { Size, Tiles } from './types';

/** `sg` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'sg1:';

export function boardDigest(size: Size, initialTiles: Tiles): string {
  return (
    BOARD_DIGEST_PREFIX +
    hashSeed(`${size}:${tilesToString(initialTiles)}`)
      .toString(16)
      .padStart(8, '0')
  );
}

/**
 * Any session's digest. The tiles move with every slide, so the digest is
 * taken from the board dealt again from the session's own inputs (Restart's
 * board): the same for a fresh deal, a resumed one and a finished one.
 */
export function boardDigestOf(session: SlidingPuzzleSession): string {
  const start = restartSession(session);
  return boardDigest(start.size, start.tiles);
}
