/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/LOOP_PUZZLE_RULES.md §17): the board's size, its clues and its one
 * answer, written as the save and the golden boards write them (`encodeClues`,
 * `encodeMarks`), through this game's own xmur3. Not a guard against
 * tampering — a check that two devices built the same puzzle, so a generator
 * that changed between versions cannot pair two different boards under one
 * Today challenge.
 *
 * It is not the save's `cluesDigest` (§12), which shares the `lp1:` prefix but
 * hashes the clue string alone: this text also names the size and the answer,
 * so the two never coincide.
 */
import { hashSeed } from './rng';
import { encodeClues, encodeMarks } from './serialize';
import type { Clue, Mark } from './types';

/** `lp` (Loop Puzzle) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'lp1:';

/** The fields of a session the digest reads; none of them changes during play. */
export interface DigestBoard {
  readonly width: number;
  readonly height: number;
  readonly clues: readonly Clue[];
  readonly solution: readonly Mark[];
}

export function boardDigest(board: DigestBoard): string {
  const text = `${board.width}x${board.height}|${encodeClues(board.clues)}|${encodeMarks(board.solution)}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or free: the clues and the answer never move. */
export function boardDigestOf(session: DigestBoard): string {
  return boardDigest(session);
}
