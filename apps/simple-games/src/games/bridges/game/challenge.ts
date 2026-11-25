/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/BRIDGES_RULES.md §17): the board's size and its islands as the save
 * writes them — one character per cell (`encodeBoard`, §10) — through this
 * game's own xmur3. Not a guard against tampering — a check that two devices
 * built the same puzzle, so a generator that changed between versions cannot
 * pair two different boards under one Today challenge.
 *
 * The answer is not hashed: a board has exactly one (§6), so the islands
 * already name it. The digest is read from the session's own islands, never
 * rebuilt from its seed — a daily restored from a save made under an older
 * generator keeps its old board (§10), and so its old digest.
 */
import { hashSeed } from './rng';
import { encodeBoard } from './serialize';
import type { Layout } from './types';

/** `bg` (Bridges) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'bg1:';

/** The fields of a session the digest reads; none of them changes during play. */
export type DigestBoard = Layout;

export function boardDigest(board: DigestBoard): string {
  const text = `${board.width}x${board.height}|${encodeBoard(board)}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or free: the islands never move. */
export function boardDigestOf(session: DigestBoard): string {
  return boardDigest(session);
}
