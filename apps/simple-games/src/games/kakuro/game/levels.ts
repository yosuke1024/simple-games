/**
 * Level definitions — implements docs/KAKURO_RULES.md §9.
 *
 * All 100 levels come from the level number alone: a size, a layout density,
 * and a seed. No content pipeline, no download, and the same level is the same
 * puzzle for every player.
 *
 * Difficulty is carried by two dials. The board grows across the three bands,
 * and inside each band the layout is chopped less finely, so two neighbouring
 * levels never jump. **The direction is "more white cells" (§9).** Taking clue
 * cells away makes the runs longer, which moves the sums away from the ends of
 * the partition table where a length and a sum name one digit set, and moves
 * the crossing run further away too — so the two techniques that carry a
 * Kakuro (§7 ① and ②) both say less. Fewer clue cells is the harder board.
 *
 * At a size change the white share steps back down, exactly as Nonogram §6's
 * fill rate does: the same share of a larger board is already the harder
 * puzzle, because every run is longer and one deduction has further to travel.
 * Carrying the share straight through would make the first level of a band a
 * wall (§9).
 *
 * The dial is interpolated rather than dealt out as tiers the way Sudoku's
 * `tiersForBand` deals them. That is not a style choice: Sudoku's dial is a
 * *set* — which techniques a board may demand — and a set cannot be
 * interpolated, so dealing fixed counts is what makes its table true by
 * construction instead of true on average. Here every level allows the same
 * six techniques (§7) and the dial is one integer on a continuum, so there is
 * nothing to deal. Interpolating is what keeps neighbouring levels one cell
 * apart instead of jumping between named tiers.
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
  return `kakuro-level-${clampLevel(level)}`;
}

/**
 * Cells the dial ranges over: everything but the two rails (§1). The top row
 * and the left column are always clue cells, so an n×n board has (n−1)² cells
 * that a layout gets to choose the kind of.
 */
export const interiorCount = (size: Size): number => (size - 1) * (size - 1);

interface Band {
  readonly from: number;
  readonly to: number;
  readonly size: Size;
  /** Interior clue cells at the first level of the band — the easy end. */
  readonly blocksFrom: number;
  /** …and at the last. Fewer clue cells, longer runs, the harder board. */
  readonly blocksTo: number;
}

/**
 * The table of §9, verbatim.
 *
 * **The tight ends are measured, not guessed, and they are medians.** A Kakuro
 * has nothing to dig, so "how hard can this band get" is the question of how
 * few clue cells a layout can carry and still be settled by the techniques
 * alone. Asked that over 32 seeds a point, one derived seed each, the
 * generator lands at 8 clue cells of 25 on a 6×6, 24 of 49 on an 8×8 and 44 of
 * 81 on a 10×10 — the fewest at which at least half the seeds still reach a
 * board (66%, 50% and 53%; one notch further down each is 41%, 25% and 28%).
 *
 * Each band ends at that median rather than at the deepest seed seen, for
 * Futoshiki §9's reason: the target is what a seed has to reach before it
 * ships, so aiming at the deepest means most seeds miss, which costs derived
 * seeds (§8) and eventually ships a board easier than its number promises.
 * Aiming at the median means about half the seeds land first try — measured
 * over the whole list, the worst level needs six derived seeds of the 24
 * available and nothing falls back at all.
 *
 * The easy ends are set so the white share steps down at each size change
 * (§9) and so the dial moves by several cells across a band rather than
 * sitting still: 13 white cells to 17 at 6×6, 19 to 25 at 8×8, 25 to 37 at
 * 10×10. Level 1 is thirteen cells behind eight clues, which is a board a
 * first-time player finishes on the combination table alone.
 *
 * `guarantee.test.ts` walks all 100 levels and fails if any of them cannot
 * reach its number, so these six figures are checked, not hoped at.
 */
const BANDS: readonly Band[] = [
  { from: 1, to: 20, size: 6, blocksFrom: 12, blocksTo: 8 },
  { from: 21, to: 65, size: 8, blocksFrom: 30, blocksTo: 24 },
  { from: 66, to: MAX_LEVEL, size: 10, blocksFrom: 56, blocksTo: 44 },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.to) return band;
  return BANDS[BANDS.length - 1]!;
}

export function sizeForLevel(level: number): Size {
  return bandFor(clampLevel(level)).size;
}

/** Interior clue cells this level asks for — the dial of §9. */
export function blocksForLevel(level: number): number {
  const target = clampLevel(level);
  const band = bandFor(target);
  const span = band.to - band.from;
  if (span === 0) return band.blocksFrom;
  const progress = (target - band.from) / span;
  return Math.round(band.blocksFrom + (band.blocksTo - band.blocksFrom) * progress);
}

/** Interior cells this level leaves for the player to write in (§9). */
export const whiteForLevel = (level: number): number =>
  interiorCount(sizeForLevel(level)) - blocksForLevel(level);

/** The share of the interior the player writes in — the column of §9's table. */
export const whiteRatioForLevel = (level: number): number =>
  whiteForLevel(level) / interiorCount(sizeForLevel(level));

/** Everything generation needs from a level number. */
export function specForLevel(level: number): PuzzleSpec {
  return { blocks: blocksForLevel(level) };
}

/**
 * Free Play's three tiers (§9「フリープレイ」). A tier is a representative
 * level's size and density with a free seed — nothing new to tune, and
 * nothing the level list has not already measured: level 10 sits in the 6×6
 * band, 50 in the 8×8 band, 95 in the 10×10 band, each past the middle of its
 * band. The names are the picker's, not the game's — this game has no
 * difficulty type (§7) — and a free board is exactly as hard as the level it
 * borrows from.
 */
export type FreeTier = 'easy' | 'medium' | 'hard';
export const FREE_TIERS: readonly FreeTier[] = ['easy', 'medium', 'hard'];
export const FREE_TIER_LEVEL: Readonly<Record<FreeTier, number>> = {
  easy: 10,
  medium: 50,
  hard: 95,
};

export const isFreeTier = (value: unknown): value is FreeTier =>
  FREE_TIERS.includes(value as FreeTier);
