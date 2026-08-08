/**
 * Level definitions — implements docs/TAKUZU_RULES.md §7.
 *
 * All 100 levels come from the level number alone: a size, a givens ratio, and
 * a seed. No content pipeline, no download, and the same level is the same
 * puzzle for every player.
 *
 * Difficulty is carried by two dials at once. The board grows across the three
 * bands, and inside each band the share of cells handed to the player falls
 * linearly, so two neighbouring levels never jump. At a size change the ratio
 * steps back up, exactly as Nonogram §6's fill rate does: the same ratio on a
 * larger board is already the harder puzzle, because every deduction has more
 * line to travel, so carrying the ratio straight through would make the first
 * level of a band a wall.
 *
 * The list is 100 long rather than 999 for the reason Nonogram §6 gives: a
 * curve spread over 999 levels moves by a fraction of a cell per level, and
 * hundreds of levels in a row become the same puzzle with a different seed.
 */
import type { Size } from './types';

export const MAX_LEVEL = 100;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `takuzu-level-${clampLevel(level)}`;
}

interface Band {
  readonly from: number;
  readonly to: number;
  readonly size: Size;
  readonly givensFrom: number;
  readonly givensTo: number;
}

/**
 * The table of §7, verbatim.
 *
 * The floors are set against a measurement, not a guess. Digging stops where
 * §5 stops, and where that is was worth knowing before writing a number down:
 * asked to dig as far as the three techniques allow, the generator lands at 6
 * to 8 givens on a 6×6, 12 to 15 on an 8×8 and 20 to 24 on a 10×10. Each band
 * ends about three cells above the worst of those, which is the margin that
 * keeps a level from being handed a board easier than its number promises
 * (§6's fallback) on an unlucky seed.
 *
 * Level 1 hands over half the board, which is a puzzle a first-time player
 * finishes on the pair rule alone — the same introduction Nonogram §6 opens
 * with. `guarantee.test.ts` walks all 100 levels and fails if any of them
 * cannot reach its number, so these six figures are checked, not hoped at.
 */
const BANDS: readonly Band[] = [
  { from: 1, to: 20, size: 6, givensFrom: 0.5, givensTo: 0.31 },
  { from: 21, to: 60, size: 8, givensFrom: 0.45, givensTo: 0.28 },
  { from: 61, to: MAX_LEVEL, size: 10, givensFrom: 0.4, givensTo: 0.27 },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.to) return band;
  return BANDS[BANDS.length - 1]!;
}

export function sizeForLevel(level: number): Size {
  return bandFor(clampLevel(level)).size;
}

/** Linear inside the band: the first level gets its ceiling, the last its floor. */
export function givensRatioForLevel(level: number): number {
  const target = clampLevel(level);
  const band = bandFor(target);
  const span = band.to - band.from;
  if (span === 0) return band.givensFrom;
  const progress = (target - band.from) / span;
  return band.givensFrom + (band.givensTo - band.givensFrom) * progress;
}
