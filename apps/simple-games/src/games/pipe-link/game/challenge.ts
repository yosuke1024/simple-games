/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/PIPE_LINK_RULES.md §16): the tiles' types, the source, the one answer
 * and the scrambled starting orientations — the four strings the golden
 * boards pin (compatibility.test.ts), in the save's own encoding — through
 * this game's own xmur3. Never the current orientations: they move as the
 * board is played, and two devices on the same daily would split into two
 * Today challenges. Not a guard against tampering — a check that two devices
 * built the same puzzle, so a generator that changed between versions cannot
 * pair two different boards under one Today challenge.
 */
import { hashSeed } from './rng';
import { encodeOrientations, encodeTypes } from './serialize';
import type { TileType } from './tiles';

/** `pn` (Pipe Link, the save keys' prefix) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'pn1:';

/** The fields of a session the digest reads; none of them changes during play. */
export interface DigestBoard {
  readonly board: { readonly types: readonly TileType[]; readonly source: number };
  readonly solution: readonly number[];
  readonly initial: readonly number[];
}

export function boardDigest(board: DigestBoard): string {
  const text = `${encodeTypes(board.board.types)}|${board.board.source}|${encodeOrientations(board.solution)}|${encodeOrientations(board.initial)}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or free: the tiles, the answer and the start never move. */
export function boardDigestOf(session: DigestBoard): string {
  return boardDigest(session);
}
