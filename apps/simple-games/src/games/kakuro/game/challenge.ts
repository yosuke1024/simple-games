/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/KAKURO_RULES.md §15): the layout and the answer, as the golden tests
 * write them (`layout|solution`), through this game's own xmur3. Every clue
 * the player sees is derived from those two (§11), and the layout alone is
 * not enough — two answers give different sums on one layout. Not a guard
 * against tampering — a check that two devices built the same puzzle, so a
 * generator that changed between versions cannot pair two different boards
 * under one Today challenge.
 */
import { hashSeed } from './rng';
import { encodeGrid, encodeLayout } from './serialize';
import type { Layout } from './types';

/** `kk` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'kk1:';

export function boardDigest(layout: Layout, solution: readonly number[]): string {
  const text = `${encodeLayout(layout)}|${encodeGrid(solution)}`;
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest — level, daily or free: layout and answer never move. */
export function boardDigestOf(session: {
  readonly layout: Layout;
  readonly solution: readonly number[];
}): string {
  return boardDigest(session.layout, session.solution);
}
