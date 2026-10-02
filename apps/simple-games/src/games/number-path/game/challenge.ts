/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/NUMBER_PATH_RULES.md): the size, the numbers row-major (0 = unnumbered)
 * and the sorted wall ids — what the player sees. The answer path is unique
 * under them, so it need not be hashed. Run through this game's own xmur3. Not
 * a guard against tampering — a check that two devices built the same board,
 * so a generator that changed between versions cannot pair two different
 * puzzles under one Today challenge.
 */
import { hashSeed } from './rng';
import type { Board } from './types';

/** `np` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'np1:';

export function boardDigest(board: Board): string {
  const text = `${board.width}x${board.height}|${board.numbers.join(',')}|${board.walls.join(',')}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or not: the starting board never moves during play. */
export function boardDigestOf(session: { readonly board: Board }): string {
  return boardDigest(session.board);
}
