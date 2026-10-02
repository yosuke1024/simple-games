/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/CROWN_GRID_RULES.md): the region letters, row-major as `serialize.ts`
 * writes them (the string compatibility.test.ts pins). The board is unique
 * under its regions, so the answer need not be hashed; the size is implied by
 * the length. Run through this game's own xmur3. Not a guard against tampering
 * — a check that two devices built the same board, so a generator that changed
 * between versions cannot pair two different puzzles under one Today
 * challenge.
 */
import { hashSeed } from './rng';
import { encodeRegions } from './serialize';
import type { Regions } from './types';

/** `cg` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'cg1:';

export function boardDigest(regions: Regions): string {
  return BOARD_DIGEST_PREFIX + hashSeed(encodeRegions(regions)).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or not: the starting board never moves during play. */
export function boardDigestOf(session: { readonly regions: Regions }): string {
  return boardDigest(session.regions);
}
