/**
 * Level definitions — implements docs/QUICK_MATH_RULES.md §6.
 *
 * A level is a band (which operators, which shape of question) plus a pair of
 * operand ceilings that grow across the band. Everything comes from the level
 * number: no content pipeline, no download, and level 37 is the same ten
 * questions for every player.
 *
 * The band list is finer than the table in §6, and deliberately so. A single
 * linear ramp across "levels 21-40, multiplication" would have left the times
 * table behind by level 24, and the times-table stretch is the part of this
 * game a child is actually here for. Each kind therefore gets a flat opening
 * band at its floor, then a growing one — which is also what keeps a new
 * operator from arriving on top of bigger numbers (the rule the Sliding Puzzle
 * bands follow, docs/SLIDING_PUZZLE_RULES.md §6).
 */
import type { Operator, QuestionForm, Track } from './types';

export const MAX_LEVEL = 100;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `qmath-level-${clampLevel(level)}`;
}

/** How many questions one level asks (§2). */
export const QUESTIONS_PER_LEVEL = 10;

export interface Band {
  readonly from: number;
  readonly to: number;
  readonly track: Track;
  /** Shapes drawn from uniformly. */
  readonly forms: readonly QuestionForm[];
  /** Operators drawn from uniformly. */
  readonly ops: readonly Operator[];
  /** Ceiling of the left-hand term, at the band's first and last level. */
  readonly aFrom: number;
  readonly aTo: number;
  /** Ceiling of the right-hand term, at the band's first and last level. */
  readonly bFrom: number;
  readonly bTo: number;
}

/**
 * The §6 table, subdivided. Read the `track` column and it is exactly the five
 * rows the rules describe.
 */
const BANDS: readonly Band[] = [
  // 1-digit and 1-digit, then two digits meeting one.
  {
    from: 1,
    to: 10,
    track: 'addSub',
    forms: ['binary'],
    ops: ['+', '−'],
    aFrom: 9,
    aTo: 9,
    bFrom: 4,
    bTo: 9,
  },
  {
    from: 11,
    to: 20,
    track: 'addSub',
    forms: ['binary'],
    ops: ['+', '−'],
    aFrom: 12,
    aTo: 99,
    bFrom: 3,
    bTo: 9,
  },
  // The times table itself, held flat for ten levels (§6).
  {
    from: 21,
    to: 30,
    track: 'multiply',
    forms: ['binary'],
    ops: ['×'],
    aFrom: 9,
    aTo: 9,
    bFrom: 9,
    bTo: 9,
  },
  {
    from: 31,
    to: 40,
    track: 'multiply',
    forms: ['binary'],
    ops: ['×'],
    aFrom: 10,
    aTo: 30,
    bFrom: 3,
    bTo: 9,
  },
  // The times table backwards, then two digits over one.
  {
    from: 41,
    to: 50,
    track: 'divide',
    forms: ['binary'],
    ops: ['÷'],
    aFrom: 9,
    aTo: 9,
    bFrom: 9,
    bTo: 9,
  },
  {
    from: 51,
    to: 60,
    track: 'divide',
    forms: ['binary'],
    ops: ['÷'],
    aFrom: 10,
    aTo: 30,
    bFrom: 3,
    bTo: 9,
  },
  // Missing operand: the easy pair first, then all four signs.
  {
    from: 61,
    to: 70,
    track: 'missing',
    forms: ['missing'],
    ops: ['+', '−'],
    aFrom: 12,
    aTo: 60,
    bFrom: 5,
    bTo: 9,
  },
  {
    from: 71,
    to: 80,
    track: 'missing',
    forms: ['missing'],
    ops: ['+', '−', '×', '÷'],
    aFrom: 9,
    aTo: 30,
    bFrom: 5,
    bTo: 9,
  },
  // All four signs; then three-term chains join them at level 91 (§6).
  {
    from: 81,
    to: 90,
    track: 'mixed',
    forms: ['binary'],
    ops: ['+', '−', '×', '÷'],
    aFrom: 12,
    aTo: 40,
    bFrom: 5,
    bTo: 9,
  },
  {
    from: 91,
    to: MAX_LEVEL,
    track: 'mixed',
    forms: ['binary', 'chain'],
    ops: ['+', '−', '×', '÷'],
    aFrom: 20,
    aTo: 60,
    bFrom: 5,
    bTo: 9,
  },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.to) return band;
  return BANDS[BANDS.length - 1]!;
}

/** Linear inside the band: the first level gets the floor, the last the top. */
function lerp(band: Band, level: number, from: number, to: number): number {
  const span = band.to - band.from;
  if (span === 0) return from;
  return Math.round(from + (to - from) * ((level - band.from) / span));
}

export interface LevelSpec {
  readonly track: Track;
  readonly forms: readonly QuestionForm[];
  readonly ops: readonly Operator[];
  readonly maxA: number;
  readonly maxB: number;
}

/** Everything the generator needs to build one level's questions. */
export function specForLevel(level: number): LevelSpec {
  const target = clampLevel(level);
  const band = bandFor(target);
  return {
    track: band.track,
    forms: band.forms,
    ops: band.ops,
    maxA: lerp(band, target, band.aFrom, band.aTo),
    maxB: lerp(band, target, band.bFrom, band.bTo),
  };
}

/** Which statistics bucket a level belongs to (§10). */
export function trackForLevel(level: number): Track {
  return bandFor(clampLevel(level)).track;
}
