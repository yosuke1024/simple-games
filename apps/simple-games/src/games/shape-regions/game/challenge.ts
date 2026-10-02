/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/SHAPE_REGIONS_RULES.md): the size, the clues (cell, size, full shape
 * name) and the solution regions as `serialize.ts` writes them — the clues are
 * what the player sees, the solution is the one answer they admit. Never the
 * assignment. Run through this game's own xmur3. Not a guard against tampering
 * — a check that two devices built the same board, so a generator that changed
 * between versions cannot pair two different puzzles under one Today
 * challenge.
 */
import { hashSeed } from './rng';
import { encodeRegions } from './serialize';
import type { Clue } from './types';

/** `sr` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'sr1:';

/** One clue as `index:size,shape`, `*` for a side the clue does not say. */
function encodeClues(clues: readonly Clue[]): string {
  return clues.map((clue) => `${clue.index}:${clue.size ?? '*'}${clue.shape ?? '*'}`).join(',');
}

export function boardDigest(board: {
  readonly width: number;
  readonly height: number;
  readonly clues: readonly Clue[];
  readonly solution: readonly number[];
}): string {
  const text = `${board.width}x${board.height}|${encodeClues(board.clues)}|${encodeRegions(board.solution)}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or not: the starting board never moves during play. */
export function boardDigestOf(session: {
  readonly width: number;
  readonly height: number;
  readonly clues: readonly Clue[];
  readonly solution: readonly number[];
}): string {
  return boardDigest(session);
}
