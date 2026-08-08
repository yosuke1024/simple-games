/**
 * Level definitions — implements docs/FUTOSHIKI_RULES.md §9.
 *
 * All 100 levels come from the level number alone: a size, a sign count, a
 * givens count, and a seed. No content pipeline, no download, and the same
 * level is the same puzzle for every player.
 *
 * Difficulty is carried by three dials. The board grows across the four bands,
 * and inside each band both counts fall linearly, so two neighbouring levels
 * never jump: fewer signs to read the board by, and fewer digits handed over.
 * At a size change both step back up, exactly as Nonogram §6's fill rate does
 * — the same share of a larger board is already the harder puzzle, because
 * every deduction has more line to travel, so carrying the numbers straight
 * through would make the first level of a band a wall.
 *
 * The counts are interpolated rather than dealt out as tiers the way Sudoku's
 * `tiersForBand` deals them. That is not a style choice: Sudoku's dial is a
 * *set* — which techniques a board may demand — and a set cannot be
 * interpolated, so dealing fixed counts is what makes its table true by
 * construction instead of true on average. Here every level allows the same
 * five techniques (§7) and the dials are two integers on a continuum, so there
 * is nothing to deal. Interpolating is what keeps neighbouring levels one sign
 * or one digit apart instead of jumping between named tiers.
 *
 * The list is 100 long rather than 999 for the reason Nonogram §6 gives: a
 * curve spread over 999 levels moves by a fraction of a cell per level, and
 * hundreds of levels in a row become the same puzzle with a different seed.
 */
import type { PuzzleSpec } from './generator';
import type { Size } from './types';

export const MAX_LEVEL = 100;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `futoshiki-level-${clampLevel(level)}`;
}

interface Band {
  readonly from: number;
  readonly to: number;
  readonly size: Size;
  readonly signsFrom: number;
  readonly signsTo: number;
  readonly givensFrom: number;
  readonly givensTo: number;
}

/**
 * The table of §9, verbatim.
 *
 * The tight ends are set against a measurement, not a guess. Digging stops
 * where §7 stops, and where that is depends on how many signs the board
 * carries, so both numbers had to be measured together: asked to dig as far as
 * the techniques allow, over twelve seeds per point, the generator lands at a
 * median of 2 givens on a 4×4 with 8 signs, 3 on a 5×5 with 13, 6 on a 6×6
 * with 21 and 10 on a 7×7 with 28. Each band ends exactly at its median rather
 * than at the deepest seed seen, because the target is what a seed has to
 * reach before it ships: aim at the deepest and most seeds miss, which costs
 * derived seeds (§8) and eventually ships a board easier than its number
 * promises. Aiming at the median means about half the seeds land first try,
 * and `guarantee.test.ts` holds the whole list to no fallbacks and a small
 * number of retries — so these sixteen figures are checked, not hoped at.
 *
 * Level 1 hands over six of sixteen digits with signs in half the gaps, which
 * is a puzzle a first-time player finishes on the signs alone.
 */
const BANDS: readonly Band[] = [
  { from: 1, to: 15, size: 4, signsFrom: 12, signsTo: 8, givensFrom: 6, givensTo: 2 },
  { from: 16, to: 45, size: 5, signsFrom: 18, signsTo: 13, givensFrom: 8, givensTo: 3 },
  { from: 46, to: 80, size: 6, signsFrom: 26, signsTo: 20, givensFrom: 11, givensTo: 6 },
  { from: 81, to: MAX_LEVEL, size: 7, signsFrom: 34, signsTo: 28, givensFrom: 14, givensTo: 10 },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.to) return band;
  return BANDS[BANDS.length - 1]!;
}

export function sizeForLevel(level: number): Size {
  return bandFor(clampLevel(level)).size;
}

/** Linear inside the band: the first level gets `from`, the last gets `to`. */
function interpolate(level: number, from: number, to: number, band: Band): number {
  const span = band.to - band.from;
  if (span === 0) return from;
  return Math.round(from + ((to - from) * (level - band.from)) / span);
}

/** How many signs this level's board carries (§9). */
export function signsForLevel(level: number): number {
  const target = clampLevel(level);
  const band = bandFor(target);
  return interpolate(target, band.signsFrom, band.signsTo, band);
}

/** How many digits this level hands over (§9). */
export function givensForLevel(level: number): number {
  const target = clampLevel(level);
  const band = bandFor(target);
  return interpolate(target, band.givensFrom, band.givensTo, band);
}

/** Everything generation needs from a level number. */
export function specForLevel(level: number): PuzzleSpec {
  return { constraints: signsForLevel(level), givens: givensForLevel(level) };
}
