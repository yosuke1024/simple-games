/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/BOX_REGIONS_RULES.md Club section): the board's size, its clues
 * (`index:size kind`, `*` for an absent number) and its one answer as the save
 * writes it, through this game's own xmur3. Not a guard against tampering — a
 * check that two devices built the same puzzle, so a generator that changed
 * between versions cannot pair two different boards under one Today challenge.
 */
import { hashSeed } from './rng';
import { encodeRegions } from './serialize';
import type { Clue } from './types';

/** `br` (Box Regions) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'br1:';

/** The fields of a session the digest reads; none of them changes during play. */
export interface DigestBoard {
  readonly width: number;
  readonly height: number;
  readonly clues: readonly Clue[];
  readonly solution: readonly number[];
}

/** `index:size kind` per clue, comma-joined — the canonical clue text. */
export const clueSignature = (clues: readonly Clue[]): string =>
  clues.map((clue) => `${clue.index}:${clue.size ?? '*'}${clue.kind}`).join(',');

export function boardDigest(board: DigestBoard): string {
  const text = `${board.width}x${board.height}|${clueSignature(board.clues)}|${encodeRegions(board.solution)}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or free: the layout and the answer never move. */
export function boardDigestOf(session: DigestBoard): string {
  return boardDigest(session);
}
