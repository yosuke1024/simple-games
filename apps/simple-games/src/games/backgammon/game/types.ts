/**
 * Core Backgammon types. See docs/BACKGAMMON_RULES.md — the single source of
 * truth for the rules these shapes serve.
 *
 * The board is kept in **the player's numbering**: points 1..24 with 1..6 the
 * player's home board (drawn bottom right), the player moving 24 → 1 and the
 * CPU 1 → 24 (§1). A point holds a signed count — positive for the player's
 * checkers, negative for the CPU's — so one board is legible in every
 * language at once (docs/I18N_POLICY.md).
 *
 * The engine never reasons in that numbering. It reasons in **distance to
 * off** (`Dist`): the bar is 25, the home board is 1..6, and a die of `d` takes
 * a checker from distance `D` to `D − d`, for either side. `distToPoint` and
 * `pointToDist` are the only two places the two systems meet, which is what
 * keeps the move generator free of "which way does this side go" branches.
 */

export const PLAYER = 1;
export const CPU = 2;
export type Side = typeof PLAYER | typeof CPU;

export const opponentOf = (side: Side): Side => (side === PLAYER ? CPU : PLAYER);

/** Fifteen checkers a side (§1). */
export const CHECKERS_PER_SIDE = 15;

/** Point numbers in the player's numbering. */
export const POINT_COUNT = 24;

/** Distance to off: 1..24 on the board, 25 on the bar, 0 off (§1). */
export type Dist = number;
export const BAR: Dist = 25;
export const OFF: Dist = 0;
/** The home board is the six nearest points (§2.2). */
export const HOME_SIZE = 6;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

export type GameStatus = 'playing' | 'won' | 'lost' | 'noResult';

/** How a decided match ended — a fact, never a multiplier (§3, §13). */
export type ResultKind = 'single' | 'gammon' | 'backgammon';

/**
 * The position. `points[1..24]` are signed checker counts in the player's
 * numbering (`points[0]` is unused and always 0); the bar and the borne-off
 * trays are kept per side.
 */
export interface Board {
  readonly points: readonly number[];
  readonly bar: readonly [player: number, cpu: number];
  readonly off: readonly [player: number, cpu: number];
}

/** One step of a turn: a checker at distance `from` moved by die `die` (§2.5). */
export interface Step {
  readonly from: Dist;
  readonly die: number;
}

/** A whole turn as the sequence of its steps; empty when the side passed (§2.4). */
export type Turn = readonly Step[];

export const sideIndex = (side: Side): 0 | 1 => (side === PLAYER ? 0 : 1);

/** The player's point a checker of `side` at distance `dist` stands on (1..24). */
export const distToPoint = (side: Side, dist: Dist): number =>
  side === PLAYER ? dist : POINT_COUNT + 1 - dist;

/** The distance to off of `side`'s checker standing on the player's point `point`. */
export const pointToDist = (side: Side, point: number): Dist =>
  side === PLAYER ? point : POINT_COUNT + 1 - point;

/** Checkers of `side` at distance `dist` (1..24 a point, 25 the bar), never negative. */
export function ownAt(board: Board, side: Side, dist: Dist): number {
  if (dist === BAR) return board.bar[sideIndex(side)];
  if (dist < 1 || dist > POINT_COUNT) return 0;
  const count = board.points[distToPoint(side, dist)] ?? 0;
  return side === PLAYER ? Math.max(0, count) : Math.max(0, -count);
}

/** The opponent's checkers on the point at `side`'s distance `dist` (1..24). */
export function opponentAt(board: Board, side: Side, dist: Dist): number {
  if (dist < 1 || dist > POINT_COUNT) return 0;
  const count = board.points[distToPoint(side, dist)] ?? 0;
  return side === PLAYER ? Math.max(0, -count) : Math.max(0, count);
}

/** Two or more of the opponent's checkers: the point cannot be landed on (§2.2). */
export const isBlocked = (board: Board, side: Side, dist: Dist): boolean =>
  opponentAt(board, side, dist) >= 2;

/** Exactly one of the opponent's checkers: landing there hits it (§2.2). */
export const isBlot = (board: Board, side: Side, dist: Dist): boolean =>
  opponentAt(board, side, dist) === 1;

/**
 * The opening position (§1): two on the 24-point, five on the 13-point,
 * three on the 8-point and five on the 6-point, mirrored for the CPU.
 */
export function initialBoard(): Board {
  const points: number[] = new Array<number>(POINT_COUNT + 1).fill(0);
  const place = (side: Side, dist: Dist, count: number) => {
    const index = distToPoint(side, dist);
    points[index] = (points[index] ?? 0) + (side === PLAYER ? count : -count);
  };
  for (const side of [PLAYER, CPU] as const) {
    place(side, 24, 2);
    place(side, 13, 5);
    place(side, 8, 3);
    place(side, 6, 5);
  }
  return { points, bar: [0, 0], off: [0, 0] };
}

/** Sum of distances of every checker of `side` still to bring home (§7). */
export function pipCount(board: Board, side: Side): number {
  let pips = board.bar[sideIndex(side)] * BAR;
  for (let dist = 1; dist <= POINT_COUNT; dist++) pips += ownAt(board, side, dist) * dist;
  return pips;
}

/** Whether every checker of `side` not yet borne off sits in the home board (§2.2). */
export function allHome(board: Board, side: Side): boolean {
  if (board.bar[sideIndex(side)] > 0) return false;
  for (let dist = HOME_SIZE + 1; dist <= POINT_COUNT; dist++) {
    if (ownAt(board, side, dist) > 0) return false;
  }
  return true;
}

/** The farthest distance any checker of `side` still has to travel, or 0 when all are off. */
export function farthestDist(board: Board, side: Side): Dist {
  if (board.bar[sideIndex(side)] > 0) return BAR;
  for (let dist = POINT_COUNT; dist >= 1; dist--) {
    if (ownAt(board, side, dist) > 0) return dist;
  }
  return OFF;
}

/**
 * A board that could have come from play: fifteen a side counting the bar
 * and the trays, no point holding both colours, and no side already finished
 * (a side at fifteen off ended the match when it got there).
 */
export function isValidBoard(board: Board): boolean {
  if (board.points.length !== POINT_COUNT + 1 || board.points[0] !== 0) return false;
  let player = board.bar[0] + board.off[0];
  let cpu = board.bar[1] + board.off[1];
  for (let point = 1; point <= POINT_COUNT; point++) {
    const count = board.points[point] ?? 0;
    if (!Number.isInteger(count)) return false;
    if (count > 0) player += count;
    else cpu -= count;
  }
  if (player !== CHECKERS_PER_SIDE || cpu !== CHECKERS_PER_SIDE) return false;
  return board.off[0] < CHECKERS_PER_SIDE && board.off[1] < CHECKERS_PER_SIDE;
}
