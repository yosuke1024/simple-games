/**
 * Level definitions — implements docs/SUDOKU_RULES.md §9.
 *
 * All 100 levels come from the level number alone: a seed and a difficulty
 * band. No content pipeline, no download, and the same level is the same
 * puzzle for every player. Hint and Undo stay unlimited and free at every
 * level (brand promise).
 *
 * The list is 100 long rather than 999 because a level list nobody reaches is
 * not depth, it is padding: at 999 the mix moved so slowly that hundreds of
 * consecutive levels drew from the same distribution and the walk up the list
 * felt flat. A hundred levels is a climb a player can actually finish, and the
 * endless side of the game is the daily puzzle, which is unchanged.
 */
import { createRng, shuffled } from './rng';
import type { Difficulty } from './types';

export const MAX_LEVEL = 100;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `sudoku-level-${clampLevel(level)}`;
}

/**
 * The difficulty mix per band (§9). Weights are out of 100 and must add up.
 * The last band keeps a third of its levels at medium on purpose: an unbroken
 * run of hard reads as a chore, and the brand is a quiet game, not a grind.
 */
interface Band {
  readonly from: number;
  readonly upTo: number;
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
}

const BANDS: readonly Band[] = [
  { from: 1, upTo: 10, easy: 100, medium: 0, hard: 0 },
  { from: 11, upTo: 25, easy: 60, medium: 40, hard: 0 },
  { from: 26, upTo: 45, easy: 25, medium: 65, hard: 10 },
  { from: 46, upTo: 70, easy: 10, medium: 65, hard: 25 },
  { from: 71, upTo: 85, easy: 0, medium: 55, hard: 45 },
  { from: 86, upTo: MAX_LEVEL, easy: 0, medium: 35, hard: 65 },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.upTo) return band;
  return BANDS[BANDS.length - 1]!;
}

/**
 * The tiers of one band, dealt out to match its table exactly and then shuffled
 * so they do not arrive in blocks.
 *
 * The tier used to be an independent roll per level, which is the natural way
 * to write this and was fine across 999 levels: with hundreds of rolls per band
 * the average landed on the table. Across a band of fifteen it does not — the
 * last band came out 60% medium against a table that says 35%, inverting the
 * point of the band. Dealing a fixed count instead makes the table in §9 true
 * by construction rather than true on average, which is what a table in a rule
 * document is supposed to be.
 */
function tiersForBand(band: Band): Difficulty[] {
  const size = band.upTo - band.from + 1;
  const easy = Math.round((size * band.easy) / 100);
  const hard = Math.round((size * band.hard) / 100);
  const medium = size - easy - hard;
  const tiers: Difficulty[] = [
    ...new Array<Difficulty>(easy).fill('easy'),
    ...new Array<Difficulty>(medium).fill('medium'),
    ...new Array<Difficulty>(hard).fill('hard'),
  ];
  return shuffled(tiers, createRng(`sudoku-tier-band-${band.from}`));
}

/**
 * The difficulty of a level — deterministic, so a level is always the same
 * puzzle at the same tier, on every device and every build.
 */
export function difficultyForLevel(level: number): Difficulty {
  const target = clampLevel(level);
  const band = bandFor(target);
  return tiersForBand(band)[target - band.from] ?? 'medium';
}
