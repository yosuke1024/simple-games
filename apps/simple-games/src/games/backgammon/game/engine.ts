/**
 * The rules of a turn (docs/BACKGAMMON_RULES.md §2) as pure functions over a
 * board, a side and the dice still on the table.
 *
 * Everything the screen and the CPU may do goes through `allowedSteps`: the
 * steps that begin some sequence using the most dice possible — and, among
 * those, the most pips (§2.3). That one function is why the two can never
 * disagree about what is legal, and why "you must use both dice" and "you
 * must use the larger die when only one can be used" are never written as
 * special cases: both fall out of maximising (count, sum) over the turn.
 *
 * `bestUsage` is the heart of it — a memoised search over (board, dice left)
 * that answers "how many dice, and how many pips, can still be played from
 * here". It is memoised on the position rather than on the order the dice
 * were played in, so doubles, whose four identical dice would otherwise make
 * every permutation of the same moves a fresh branch, stay cheap.
 */
import {
  allHome,
  BAR,
  CHECKERS_PER_SIDE,
  farthestDist,
  HOME_SIZE,
  isBlocked,
  isBlot,
  opponentOf,
  ownAt,
  POINT_COUNT,
  sideIndex,
  type Board,
  type Dist,
  type ResultKind,
  type Side,
  type Step,
  type Turn,
} from './types';

/** Whether a checker of `side` at distance `from` may move by `die` right now (§2.2). */
export function canStep(board: Board, side: Side, from: Dist, die: number): boolean {
  if (die < 1 || die > 6) return false;
  if (ownAt(board, side, from) === 0) return false;
  // A checker on the bar freezes every other one until it has entered.
  if (board.bar[sideIndex(side)] > 0 && from !== BAR) return false;
  const to = from - die;
  if (to >= 1) return !isBlocked(board, side, to);
  // Bearing off: only with every checker home, and only the exact point or —
  // when the die overshoots — the farthest checker still on the board.
  if (!allHome(board, side)) return false;
  return to === 0 || farthestDist(board, side) === from;
}

export interface StepEffect {
  readonly board: Board;
  readonly to: Dist;
  readonly hit: boolean;
  readonly borneOff: boolean;
}

/** The board after `side` plays `step`, or null when the step is not playable. */
export function applyStep(board: Board, side: Side, step: Step): StepEffect | null {
  if (!canStep(board, side, step.from, step.die)) return null;
  const points = [...board.points];
  const bar: [number, number] = [board.bar[0], board.bar[1]];
  const off: [number, number] = [board.off[0], board.off[1]];
  const me = sideIndex(side);
  const them = sideIndex(opponentOf(side));
  const sign = side === 1 ? 1 : -1;
  const pointOf = (dist: Dist): number => (side === 1 ? dist : POINT_COUNT + 1 - dist);

  if (step.from === BAR) bar[me] -= 1;
  else {
    const origin = pointOf(step.from);
    points[origin] = (points[origin] ?? 0) - sign;
  }

  const to = Math.max(0, step.from - step.die);
  if (to === 0) {
    off[me] += 1;
    return { board: { points, bar, off }, to, hit: false, borneOff: true };
  }
  const hit = isBlot(board, side, to);
  const target = pointOf(to);
  if (hit) {
    points[target] = 0;
    bar[them] += 1;
  }
  points[target] = (points[target] ?? 0) + sign;
  return { board: { points, bar, off }, to, hit, borneOff: false };
}

/** A key for memoisation: the whole position, nothing about how it was reached. */
export const boardKey = (board: Board): string =>
  `${board.points.join(',')}|${board.bar[0]},${board.bar[1]}|${board.off[0]},${board.off[1]}`;

export interface Usage {
  /** Dice that can still be played from here. */
  readonly count: number;
  /** Pips those dice move, so that the larger die wins a tie (§2.3). */
  readonly sum: number;
}

const NO_USAGE: Usage = { count: 0, sum: 0 };

const betterUsage = (a: Usage, b: Usage): Usage =>
  b.count > a.count || (b.count === a.count && b.sum > a.sum) ? b : a;

/** The distinct dice among those left, each tried once. */
function distinctDice(dice: readonly number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const die of dice) {
    if (!seen.has(die)) {
      seen.add(die);
      out.push(die);
    }
  }
  return out;
}

function withoutOne(dice: readonly number[], die: number): number[] {
  const index = dice.indexOf(die);
  return [...dice.slice(0, index), ...dice.slice(index + 1)];
}

/** Every (from, die) `side` could play next, with no obligation applied yet. */
function rawSteps(board: Board, side: Side, dice: readonly number[]): Step[] {
  const out: Step[] = [];
  const onBar = board.bar[sideIndex(side)] > 0;
  for (const die of distinctDice(dice)) {
    if (onBar) {
      if (canStep(board, side, BAR, die)) out.push({ from: BAR, die });
      continue;
    }
    for (let from = POINT_COUNT; from >= 1; from--) {
      if (ownAt(board, side, from) > 0 && canStep(board, side, from, die)) {
        out.push({ from, die });
      }
    }
  }
  return out;
}

/**
 * How much of `dice` can still be played from `board` by `side`: the most
 * dice, and among equal counts the most pips (§2.3). Memoised per position
 * and dice left; `memo` is shared across one turn's questions.
 */
export function bestUsage(
  board: Board,
  side: Side,
  dice: readonly number[],
  memo: Map<string, Usage> = new Map(),
): Usage {
  if (dice.length === 0) return NO_USAGE;
  const sorted = [...dice].sort((a, b) => b - a);
  const key = `${boardKey(board)}#${sorted.join('')}`;
  const cached = memo.get(key);
  if (cached) return cached;
  let best = NO_USAGE;
  for (const step of rawSteps(board, side, sorted)) {
    const effect = applyStep(board, side, step);
    if (effect === null) continue;
    const rest = bestUsage(effect.board, side, withoutOne(sorted, step.die), memo);
    best = betterUsage(best, { count: rest.count + 1, sum: rest.sum + step.die });
  }
  memo.set(key, best);
  return best;
}

/**
 * The steps `side` may play next (§2.3, §2.5): those that begin some sequence
 * achieving `target` — by default the best usage from here, which is what the
 * screen asks at the start of a turn. Partway through a turn the caller
 * passes the target it still owes (the turn's best minus what was played), so
 * that a player who began well cannot be stranded on a step that forfeits a
 * die they could still have used.
 */
export function allowedSteps(
  board: Board,
  side: Side,
  dice: readonly number[],
  target: Usage = bestUsage(board, side, dice),
  memo: Map<string, Usage> = new Map(),
): Step[] {
  if (target.count === 0) return [];
  const out: Step[] = [];
  for (const step of rawSteps(board, side, dice)) {
    const effect = applyStep(board, side, step);
    if (effect === null) continue;
    const rest = bestUsage(effect.board, side, withoutOne(dice, step.die), memo);
    if (rest.count === target.count - 1 && rest.sum === target.sum - step.die) out.push(step);
  }
  return out;
}

export interface TurnOutcome {
  readonly steps: Turn;
  readonly board: Board;
}

/**
 * Every complete turn `side` could play with `dice`, one per distinct
 * resulting position (§5.1). Two orders of the same moves are the same
 * outcome here: the CPU chooses a position, and the screen replays its
 * steps in the one order kept.
 */
export function maximalTurns(board: Board, side: Side, dice: readonly number[]): TurnOutcome[] {
  const memo = new Map<string, Usage>();
  const target = bestUsage(board, side, dice, memo);
  // Nothing can be played: that is a pass (§2.4), not a turn of zero steps.
  if (target.count === 0) return [];
  const outcomes: TurnOutcome[] = [];
  const seen = new Set<string>();
  const walk = (current: Board, left: readonly number[], owed: Usage, steps: Step[]) => {
    const next = allowedSteps(current, side, left, owed, memo);
    if (next.length === 0) {
      const key = boardKey(current);
      if (!seen.has(key)) {
        seen.add(key);
        outcomes.push({ steps: [...steps], board: current });
      }
      return;
    }
    for (const step of next) {
      const effect = applyStep(current, side, step);
      if (effect === null) continue;
      steps.push(step);
      walk(effect.board, withoutOne(left, step.die), { count: owed.count - 1, sum: owed.sum - step.die }, steps);
      steps.pop();
    }
  };
  walk(board, dice, target, []);
  return outcomes;
}

/** The pips `side` has left, counting the bar as 25 each. */
export { pipCount } from './types';

/** Whether `side` has borne off all fifteen (§3). */
export const hasWon = (board: Board, side: Side): boolean =>
  board.off[sideIndex(side)] === CHECKERS_PER_SIDE;

/**
 * How `winner` won (§3): a gammon when the loser bore nothing off, a
 * backgammon when, on top of that, a checker of theirs is still on the bar or
 * in the winner's home board — which, in the loser's own distances, is the
 * farthest quadrant.
 */
export function resultKindOf(board: Board, winner: Side): ResultKind {
  const loser = opponentOf(winner);
  if (board.off[sideIndex(loser)] > 0) return 'single';
  if (board.bar[sideIndex(loser)] > 0) return 'backgammon';
  for (let dist = POINT_COUNT - HOME_SIZE + 1; dist <= POINT_COUNT; dist++) {
    if (ownAt(board, loser, dist) > 0) return 'backgammon';
  }
  return 'gammon';
}
