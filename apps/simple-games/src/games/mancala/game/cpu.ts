/**
 * The CPU's move (docs/MANCALA_RULES.md §4). Three strengths that differ only
 * in how far they read, and one honest bound: the search runs only when asked
 * (the player's tap starts the turn), counts every node it visits, and when
 * the budget runs out it plays the best move of the last depth it finished —
 * never a spinner, never a stronger answer than it had time to earn
 * (docs/GAME_LIFECYCLE.md「CPU 探索」).
 *
 * Negamax, with one Kalah-shaped twist: a move that ends in the mover's own
 * store is followed by the same side moving again (§2.1), so that child is
 * read from the same perspective — no sign flip, same window — and it still
 * costs a ply of depth, which is what keeps a chain of extra turns from
 * reading forever.
 *
 * Everything here is deterministic per seed: the root order is a seeded
 * shuffle and ties keep the first of it, so the same game replayed gives the
 * same reply — which is what makes Undo a take-back rather than a reroll (§5).
 */
import { isGameOver, legalPits, sow, sweepRemaining } from './engine';
import { createRng, shuffled } from './rng';
import {
  CPU,
  firstPitOf,
  opponentOf,
  PITS_PER_SIDE,
  seedsOnSide,
  storeOf,
  type Difficulty,
  type Pits,
  type Side,
} from './types';

/**
 * Hard stops reading here, however sharp the position (§4).
 *
 * The same number, and the same reasoning, as Connect Four's: the CPU's turn
 * is one 450ms beat and the search runs inside it, so the budget is sized to
 * leave a low-spec phone — the release floor — comfortably inside that beat.
 * "The strongest opponent that fits in the pause" is the trade this title
 * chose over a stronger one that does not (issue #26 non-goal). A Kalah node
 * is cheaper than a Connect Four one (fourteen counts, no line scan), so the
 * shared figure errs on the quick side.
 */
export const HARD_NODE_LIMIT = 30_000;

/**
 * What the last reply actually cost, in nodes visited. Exported so the test
 * can judge the search by its work rather than by a stopwatch: wall-clock on
 * a shared CI runner measures the runner, and this repository already
 * decided performance gates watch deterministic work instead
 * (docs/RELEASE_CHECKLIST.md, docs/SUDOKU_RULES.md §7).
 *
 * Written once per move, so it is only meaningful immediately after one.
 */
export const searchCost = { nodes: 0 };

const DEPTHS: Record<Difficulty, number> = { easy: 1, normal: 4, hard: 8 };

/**
 * A finished game outweighs any position still in play (§4): the largest
 * heuristic value is 48 × 4 + 48, well under one seed of final margin.
 */
const FINAL_SEED_VALUE = 1_000;

/** Store seeds are banked; seeds on a side are only likely to be (§4). */
const STORE_WEIGHT = 4;

/** Positive when the position favours `me` (§4). */
export function evaluate(pits: Pits, me: Side): number {
  const them = opponentOf(me);
  return (
    (pits[storeOf(me)]! - pits[storeOf(them)]!) * STORE_WEIGHT +
    (seedsOnSide(pits, me) - seedsOnSide(pits, them))
  );
}

/** A finished board's value for `me`: the final margin after the sweep (§3, §4). */
function finalValue(pits: Pits, me: Side): number {
  const swept = sweepRemaining(pits);
  return (swept[storeOf(me)]! - swept[storeOf(opponentOf(me))]!) * FINAL_SEED_VALUE;
}

/** Thrown when the node budget runs out; the deepening loop catches it (§4). */
const OUT_OF_NODES = Symbol('out of nodes');

interface SearchBudget {
  nodes: number;
  readonly limit: number;
}

/**
 * Inner-node order, for pruning only: moves that land in the mover's own
 * store first (they are usually best, and they are cheap to spot), then the
 * rest nearest the store first. Changes how much is read, never what is
 * chosen — the root keeps its seeded order (§4).
 */
function orderedPits(pits: Pits, side: Side): number[] {
  const first = firstPitOf(side);
  const extra: number[] = [];
  const rest: number[] = [];
  for (let i = first + PITS_PER_SIDE - 1; i >= first; i--) {
    const seeds = pits[i]!;
    if (seeds === 0) continue;
    // Distance to the own store; a lap of 13 lands back on the same spot.
    if (seeds % 13 === first + PITS_PER_SIDE - i) extra.push(i);
    else rest.push(i);
  }
  return extra.concat(rest);
}

/**
 * Negamax with α–β: the value of `pits` for `toMove`, who is about to move.
 * A finished board is scored before the depth is, so a game that ends inside
 * the horizon is always seen as ended.
 */
function negamax(
  pits: Pits,
  toMove: Side,
  depth: number,
  alpha: number,
  beta: number,
  budget: SearchBudget,
): number {
  // Checked before counting, so the counter never reads higher than the
  // limit and the test can assert on it without an off-by-one to explain.
  if (budget.nodes >= budget.limit) throw OUT_OF_NODES;
  budget.nodes += 1;

  if (isGameOver(pits)) return finalValue(pits, toMove);
  if (depth === 0) return evaluate(pits, toMove);

  let best = -Infinity;
  for (const pit of orderedPits(pits, toMove)) {
    const move = sow(pits, toMove, pit)!;
    const value = move.extraTurn
      ? negamax(move.pits, toMove, depth - 1, alpha, beta, budget)
      : -negamax(move.pits, opponentOf(toMove), depth - 1, -beta, -alpha, budget);
    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** The best root pit at one fixed depth, or null when the budget ran out. */
function bestAtDepth(
  pits: Pits,
  me: Side,
  rootPits: readonly number[],
  depth: number,
  budget: SearchBudget,
): number | null {
  let best: number | null = null;
  let bestValue = -Infinity;
  try {
    for (const pit of rootPits) {
      const move = sow(pits, me, pit)!;
      // The window starts at the best found so far: a later pit only
      // replaces it by being strictly better, so the first of equals — in
      // the seeded order — is the one played (§4).
      const value = move.extraTurn
        ? negamax(move.pits, me, depth - 1, bestValue, Infinity, budget)
        : -negamax(move.pits, opponentOf(me), depth - 1, -Infinity, -bestValue, budget);
      if (best === null || value > bestValue) {
        bestValue = value;
        best = pit;
      }
    }
  } catch (error) {
    if (error !== OUT_OF_NODES) throw error;
    return null;
  }
  return best;
}

export interface CpuMoveInput {
  readonly pits: Pits;
  readonly difficulty: Difficulty;
  readonly seed: string;
  /** The game's move counter — the draw's second half (§4). */
  readonly moveCount: number;
}

/**
 * The CPU's chosen pit. easy reads one ply; normal reads four; hard deepens
 * 1..8 inside the node budget, keeping the best finished answer (§4). Never
 * fails on a legal position: a side with no seeds never gets a turn (§3).
 */
export function chooseCpuMove(input: CpuMoveInput): number {
  const { pits, difficulty, seed, moveCount } = input;
  const rng = createRng(`${seed}:cpu:${moveCount}`);
  const rootPits = shuffled(legalPits(pits, CPU), rng);

  const maxDepth = DEPTHS[difficulty];
  const budget: SearchBudget = { nodes: 0, limit: HARD_NODE_LIMIT };
  // Depth 1 always completes within the budget (six sows at most); each
  // finished depth replaces the answer, an unfinished one is discarded whole.
  let chosen = rootPits[0]!;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const best = bestAtDepth(pits, CPU, rootPits, depth, budget);
    if (best === null) break;
    chosen = best;
  }
  searchCost.nodes = budget.nodes;
  return chosen;
}
