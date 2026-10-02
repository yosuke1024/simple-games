/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/MAHJONG_SOLITAIRE_RULES.md §14): the layout and the face of every tile
 * by index — the list the golden tests already pin — through this game's own
 * xmur3. The layout id is in the string so a layout change cannot hide behind
 * identical faces. Not a guard against tampering — a check that two devices
 * generated the same board, so a generator that changed between versions
 * cannot pair two different boards under one Today challenge.
 */
import { hashSeed } from './rng';
import type { Layout } from './layouts';
import type { TileFace } from './types';

/** `mj` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'mj1:';

export function boardDigest(layoutId: string, faces: readonly TileFace[]): string {
  return (
    BOARD_DIGEST_PREFIX +
    hashSeed(`${layoutId}:${faces.join(',')}`)
      .toString(16)
      .padStart(8, '0')
  );
}

/**
 * Any session's digest. `faces` never changes during play — removals live in
 * `removed` — so nothing is regenerated.
 */
export function boardDigestOf(session: {
  readonly layout: Pick<Layout, 'id'>;
  readonly faces: readonly TileFace[];
}): string {
  return boardDigest(session.layout.id, session.faces);
}
