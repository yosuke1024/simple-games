/**
 * The figure's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/TANGRAM_RULES.md §14). The starting board is the figure: its outline,
 * and — for Medium — the two fixed pieces the catalog's solution puts in
 * place (§3). So the digest hashes the figure's segment of the catalog
 * fingerprint compatibility.test.ts pins (`id:outline:solution`, written the
 * same way) and the fixed pieces' ids after it, run through this game's own
 * xmur3. The pieces the player moves never enter it: it is the same value
 * from the first drop to the finished figure. Not a guard against tampering
 * — a check that two devices dealt the same figure, so a catalog edited
 * between versions cannot pair two different silhouettes under one Today
 * challenge.
 */
import type { Figure } from './catalog';
import { PIECE_IDS } from './pieces';
import { hashSeed } from './rng';

/** `tn` (the save keys' prefix, §8) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'tn1:';

/** The figure as one string: the fingerprint's segment for it, then the fixed pieces. */
function figureText(figure: Figure): string {
  const outline = figure.outline.map((p) => p.join(',')).join(';');
  const solution = PIECE_IDS.map((id) => {
    const pose = figure.solution[id];
    return `${pose.r}${pose.f}${pose.at.join(',')}`;
  }).join(';');
  return `${figure.id}:${outline}:${solution}:${figure.fixed.join(',')}`;
}

export function boardDigest(figure: Figure): string {
  return BOARD_DIGEST_PREFIX + hashSeed(figureText(figure)).toString(16).padStart(8, '0');
}

/** Any session's digest — daily or not: the figure never moves during play. */
export function boardDigestOf(session: { readonly figure: Figure }): string {
  return boardDigest(session.figure);
}
