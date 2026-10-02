/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/SCHULTE_TABLE_RULES.md Club section): the size, the tapping order and
 * the numbers row-major, as the compatibility golden writes them, through this
 * game's own xmur3. Not a guard against tampering — a check that two devices
 * built the same board, so a generator that changed between versions cannot
 * pair two different boards under one Today challenge.
 */
import { hashSeed } from './rng';
import type { Order, Size, Values } from './types';

/** `st` (Schulte Table) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'st1:';

export interface DigestBoard {
  readonly size: Size;
  readonly order: Order;
  readonly values: Values;
}

export function boardDigest(board: DigestBoard): string {
  const text = `${board.size}|${board.order}|${board.values.join(',')}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or level: the numbers never move during a round. */
export function boardDigestOf(session: DigestBoard): string {
  return boardDigest(session);
}
