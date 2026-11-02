/**
 * The CPU's static evaluation (docs/BACKGAMMON_RULES.md §5.3): a position,
 * seen from one side, as a single number. Larger is better for that side.
 *
 * Its shape is fixed by the rule doc; its weights are provisional until the
 * Phase 2 self-play confirms easy < normal < hard. Nothing here is borrowed
 * from pubeval or GNU Backgammon (§13) — it is a hand-written sum of the
 * things a club player counts: the race, exposed blots and how likely they are
 * to be hit from where the opponent stands, points made and primes, checkers
 * on the bar, and progress bearing off.
 */
import { DISTINCT_ROLLS } from './dice';
import {
  BAR,
  HOME_SIZE,
  isBlocked,
  opponentAt,
  opponentOf,
  ownAt,
  pipCount,
  POINT_COUNT,
  sideIndex,
  type Board,
  type Dist,
  type Side,
} from './types';

/** Weights (§5.3). Provisional — see §16. */
export const WEIGHTS = {
  /** One pip of race lead. */
  pip: 1,
  /** A blot's expected loss: hit chance × (pips lost + this tempo). */
  hitTempo: 8,
  /** A point held with two or more checkers. */
  point: 3,
  /** Extra for a point in the own home board. */
  homePoint: 2,
  /** Extra for an anchor in the opponent's home board. */
  anchor: 3,
  /** Per point of the longest prime, squared. */
  prime: 1,
  /** Each own checker on the bar. */
  onBar: 12,
  /** Each opponent checker on the bar, scaled by own home points made. */
  opponentOnBar: 4,
  /** Each checker borne off beyond what the pips already say. */
  off: 2,
  /** Each checker past the fourth on one point. */
  stack: 1,
} as const;

/**
 * The chance (in 36ths) that the opponent of `side` can hit a blot of
 * `side`'s at distance `blot` on their next roll, counted over the 21 rolls
 * with the points `side` holds blocking the way (§5.3).
 *
 * An opponent checker at `side`'s distance `q` moves *up* `side`'s scale; its
 * bar is distance 0 and it enters at the die's face. The count is a direct
 * one — a single die, both dice through an open intermediate, or one die
 * repeated for doubles — and it is an estimate, not the truth: when the
 * opponent has several checkers on the bar it must enter them all before
 * hitting with anything else, which is not modelled beyond "a bar checker
 * hits only by entering or entering-then-continuing".
 */
export function hitChance36(board: Board, side: Side, blot: Dist): number {
  const opponent = opponentOf(side);
  const opponentBar = board.bar[sideIndex(opponent)];
  // Opponent checkers by their distance below the blot, on `side`'s scale.
  const shooters: { gap: number; fromBar: boolean }[] = [];
  if (opponentBar > 0) shooters.push({ gap: blot, fromBar: true });
  for (let q = 1; q < blot; q++) {
    if (opponentAt(board, side, q) > 0) shooters.push({ gap: blot - q, fromBar: false });
  }
  if (shooters.length === 0) return 0;
  // A point `side` holds blocks the opponent's path at that distance.
  const openAt = (dist: Dist): boolean => dist >= 1 && dist <= POINT_COUNT && ownAt(board, side, dist) < 2;
  let total = 0;
  for (const { roll, weight } of DISTINCT_ROLLS) {
    const [a, b] = roll;
    let hits = false;
    for (const { gap, fromBar } of shooters) {
      const start = blot - gap;
      if (a === b) {
        // Doubles: one to four hops of `a`, each landing open.
        let at = start;
        for (let hop = 1; hop <= 4 && !hits; hop++) {
          at += a;
          if (at === blot) hits = true;
          else if (at > blot || !openAt(at)) break;
        }
      } else {
        if (gap === a || gap === b) hits = true;
        else if (gap === a + b) {
          // Both dice, via either intermediate, which must be open — and a
          // bar checker's first hop is its entry point.
          if (openAt(start + a) || openAt(start + b)) hits = true;
        }
      }
      if (hits) break;
      // Entering alone cannot hit anything past the home board.
      if (fromBar && gap > 12) break;
    }
    if (hits) total += weight;
  }
  return total;
}

/** The longest run of consecutive points `side` holds (two or more checkers). */
export function longestPrime(board: Board, side: Side): number {
  let best = 0;
  let run = 0;
  for (let dist = 1; dist <= POINT_COUNT; dist++) {
    if (ownAt(board, side, dist) >= 2) {
      run += 1;
      if (run > best) best = run;
    } else run = 0;
  }
  return best;
}

/** One side's own half of the evaluation; the race is counted between the two. */
function sideScore(board: Board, side: Side): number {
  let score = 0;
  const me = sideIndex(side);
  let homePoints = 0;
  for (let dist = 1; dist <= POINT_COUNT; dist++) {
    const own = ownAt(board, side, dist);
    if (own === 0) continue;
    if (own === 1) {
      const chance = hitChance36(board, side, dist) / 36;
      score -= chance * (BAR - dist + WEIGHTS.hitTempo);
    } else {
      score += WEIGHTS.point;
      if (dist <= HOME_SIZE) {
        score += WEIGHTS.homePoint;
        homePoints += 1;
      } else if (dist > POINT_COUNT - HOME_SIZE) score += WEIGHTS.anchor;
      if (own > 4) score -= (own - 4) * WEIGHTS.stack;
    }
  }
  const prime = longestPrime(board, side);
  score += prime * prime * WEIGHTS.prime;
  score -= board.bar[me] * WEIGHTS.onBar;
  score += board.bar[sideIndex(opponentOf(side))] * WEIGHTS.opponentOnBar * (1 + homePoints);
  score += board.off[me] * WEIGHTS.off;
  // A bar checker entering into a closed board is worth less than one entering
  // into an open one: count the opponent's home points against it.
  if (board.bar[me] > 0) {
    let closed = 0;
    for (let dist = POINT_COUNT - HOME_SIZE + 1; dist <= POINT_COUNT; dist++) {
      if (isBlocked(board, side, dist)) closed += 1;
    }
    score -= closed * board.bar[me] * 2;
  }
  return score;
}

/** The position as `side` sees it: its own prospects minus the opponent's (§5.3). */
export function evaluate(board: Board, side: Side): number {
  const opponent = opponentOf(side);
  const race = (pipCount(board, opponent) - pipCount(board, side)) * WEIGHTS.pip;
  return race + sideScore(board, side) - sideScore(board, opponent);
}
