/**
 * The CPU's move (docs/REVERSI_RULES.md §5). Three strengths, one honest
 * bound: the search runs only when asked (the player's tap starts the turn),
 * counts every node it visits, and when the budget runs out it plays the best
 * move of the last depth it finished — never a spinner, never a stronger
 * answer than it had time to earn (docs/GAME_LIFECYCLE.md「CPU 探索」).
 *
 * The search makes and unmakes moves on one `Int8Array` instead of building a
 * new board per node, and takes its move lists in buffers allocated once per
 * turn. That is not premature: a phone from 2018 is a release requirement,
 * and the first version — a fresh 64-cell array and a fresh move array per
 * node — spent seconds on a single reply on a desktop. It still runs the
 * rules from engine.ts rather than a fast copy of them, which is the part
 * that must not be traded away.
 *
 * Everything here is deterministic per seed: ties are broken by a seeded
 * shuffle of the root moves, so the same game replayed gives the same reply —
 * which is what makes Undo a take-back rather than a reroll (§6).
 */
import {
  collectFlips,
  collectLegalMoves,
  countLegalMoves,
  hasAnyMove,
  legalMovesOf,
} from './engine';
import { createRng, shuffled } from './rng';
import {
  CELL_COUNT,
  countDiscs,
  opponentOf,
  type Board,
  type Difficulty,
  type Player,
} from './types';

/**
 * Hard stops reading here, however sharp the position (§5).
 *
 * The number is measured, not guessed: a full-budget reply takes ~180ms on a
 * development machine, which leaves a low-spec phone — the release floor —
 * comfortably inside the CPU's own 450ms pause. The pause exists to make the
 * turn visible; a search that outlived it would turn it into waiting, and
 * "the strongest opponent that fits in the pause" is the trade this title
 * chose over a stronger one that does not (issue #26 non-goal).
 */
export const HARD_NODE_LIMIT = 12_000;

/** Hard's lookahead; from this few empties it reads to the end instead. */
const HARD_MAX_DEPTH = 6;
const ENDGAME_EMPTIES = 10;

/**
 * The classic positional table: corners are everything, the cells that hand
 * a corner over are worth less than nothing, edges are good. Symmetric, so
 * it serves both colours as-is.
 */
// prettier-ignore
const WEIGHTS: readonly number[] = [
  120, -20,  20,   5,   5,  20, -20, 120,
  -20, -40,  -5,  -5,  -5,  -5, -40, -20,
   20,  -5,  15,   3,   3,  15,  -5,  20,
    5,  -5,   3,   3,   3,   3,  -5,   5,
    5,  -5,   3,   3,   3,   3,  -5,   5,
   20,  -5,  15,   3,   3,  15,  -5,  20,
  -20, -40,  -5,  -5,  -5,  -5, -40, -20,
  120, -20,  20,   5,   5,  20, -20, 120,
];

/** Weight of having the move: mobility is what the table cannot see. */
const MOBILITY_WEIGHT = 6;

/** A finished board is worth its disc difference, far past any weighing. */
const TERMINAL_SCALE = 10_000;

/** The table's verdict on the discs alone: 64 lookups, no rule-walking. */
function positionalOf(board: ArrayLike<number>, me: Player): number {
  const opponent = opponentOf(me);
  let positional = 0;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const piece = board[cell];
    if (piece === me) positional += WEIGHTS[cell]!;
    else if (piece === opponent) positional -= WEIGHTS[cell]!;
  }
  return positional;
}

/**
 * Positive when the position favours `me` (§5), counting both sides'
 * mobility. Used where the position is judged on its own — normal's whole
 * strength, and one call per root move rather than one per node.
 */
export function evaluate(board: ArrayLike<number>, me: Player): number {
  const mobility = countLegalMoves(board, me) - countLegalMoves(board, opponentOf(me));
  return positionalOf(board, me) + MOBILITY_WEIGHT * mobility;
}

function terminalValue(board: ArrayLike<number>, me: Player): number {
  let mine = 0;
  let theirs = 0;
  const opponent = opponentOf(me);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (board[cell] === me) mine += 1;
    else if (board[cell] === opponent) theirs += 1;
  }
  return (mine - theirs) * TERMINAL_SCALE;
}

/** Thrown when the node budget runs out; the deepening loop catches it (§5). */
const OUT_OF_NODES = Symbol('out of nodes');

/**
 * One turn's working set: the board being searched, a move list per ply, and
 * one flip stack the make/unmake pairs push onto. Allocated once per reply,
 * not per node.
 */
interface Search {
  readonly board: Int8Array;
  readonly moves: Int32Array[];
  readonly flips: Int32Array;
  readonly limit: number;
  nodes: number;
}

function createSearch(board: Board, plies: number): Search {
  const cells = new Int8Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) cells[cell] = board[cell]!;
  return {
    board: cells,
    moves: Array.from({ length: plies }, () => new Int32Array(CELL_COUNT)),
    // A capture can never turn more than a board's worth of discs per ply.
    flips: new Int32Array(CELL_COUNT * plies),
    limit: HARD_NODE_LIMIT,
    nodes: 0,
  };
}

/** Plays `cell` on the search board, returning how many discs it turned. */
function make(search: Search, player: Player, cell: number, ply: number): number {
  const base = ply * CELL_COUNT;
  const turned = collectFlips(search.board, player, cell, search.flips, base);
  search.board[cell] = player;
  for (let i = 0; i < turned; i++) search.board[search.flips[base + i]!] = player;
  return turned;
}

/** Puts back exactly what `make` changed. */
function unmake(search: Search, player: Player, cell: number, ply: number, turned: number): void {
  const opponent = opponentOf(player);
  const base = ply * CELL_COUNT;
  for (let i = 0; i < turned; i++) search.board[search.flips[base + i]!] = opponent;
  search.board[cell] = 0;
}

/**
 * Negamax with α–β over the real game tree, passes included: a side with no
 * move hands the turn back without deepening the read — a pass is not a ply
 * of thinking, and charging one would make the search blind exactly in the
 * cramped positions where passes happen.
 */
function search(
  state: Search,
  toMove: Player,
  me: Player,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
): number {
  state.nodes += 1;
  if (state.nodes > state.limit) throw OUT_OF_NODES;

  const buffer = state.moves[ply]!;
  const count = collectLegalMoves(state.board, toMove, buffer);
  if (count === 0) {
    if (!hasAnyMove(state.board, opponentOf(toMove))) return terminalValue(state.board, me);
    return search(state, opponentOf(toMove), me, depth, ply, alpha, beta);
  }
  if (depth === 0) {
    // The mobility term costs nothing here: `count` is the move list this
    // node just generated. Asking for both sides' mobility instead would
    // walk the rules over all 64 cells twice more, at every leaf — which is
    // where a search of this size spends its whole budget.
    const mobility = toMove === me ? count : -count;
    return positionalOf(state.board, me) + MOBILITY_WEIGHT * mobility;
  }

  // Corners first: the ordering only speeds the pruning, never the verdict.
  // Insertion sort over the buffer, because `Array.prototype.sort` would
  // mean an array per node again.
  for (let i = 1; i < count; i++) {
    const move = buffer[i]!;
    const weight = WEIGHTS[move]!;
    let j = i - 1;
    while (j >= 0 && WEIGHTS[buffer[j]!]! < weight) {
      buffer[j + 1] = buffer[j]!;
      j -= 1;
    }
    buffer[j + 1] = move;
  }

  const maximising = toMove === me;
  let best = maximising ? -Infinity : Infinity;
  for (let i = 0; i < count; i++) {
    const move = buffer[i]!;
    const turned = make(state, toMove, move, ply);
    const value = search(state, opponentOf(toMove), me, depth - 1, ply + 1, alpha, beta);
    unmake(state, toMove, move, ply, turned);

    if (maximising) {
      if (value > best) best = value;
      if (best > alpha) alpha = best;
    } else {
      if (value < best) best = value;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

/** The best root move at one fixed depth, or null when the budget ran out. */
function bestAtDepth(
  state: Search,
  me: Player,
  rootMoves: readonly number[],
  depth: number,
): number | null {
  let best: number | null = null;
  let bestValue = -Infinity;
  try {
    for (const move of rootMoves) {
      const turned = make(state, me, move, 0);
      const value = search(state, opponentOf(me), me, depth, 1, -Infinity, Infinity);
      unmake(state, me, move, 0, turned);
      if (value > bestValue) {
        bestValue = value;
        best = move;
      }
    }
  } catch (error) {
    if (error !== OUT_OF_NODES) throw error;
    return null;
  }
  return best;
}

export interface CpuMoveInput {
  readonly board: Board;
  readonly player: Player;
  readonly difficulty: Difficulty;
  readonly seed: string;
  /** The game's move counter — the draw's second half (§5). */
  readonly moveCount: number;
}

/**
 * The CPU's chosen cell, or null when it has no legal move (a pass, §4).
 *
 * easy picks blind from the legal moves; normal reads one ply with the
 * positional table; hard deepens 1..6 plies — to the end from ten empties —
 * inside the node budget, keeping the best finished answer (§5).
 */
export function chooseCpuMove(input: CpuMoveInput): number | null {
  const { board, player, difficulty, seed, moveCount } = input;
  const legal = legalMovesOf(board, player);
  if (legal.length === 0) return null;

  // The seeded shuffle decides every tie — including easy's whole "strategy".
  const rng = createRng(`${seed}:cpu:${moveCount}`);
  const rootMoves = shuffled(legal, rng);

  if (difficulty === 'easy') return rootMoves[0]!;

  if (difficulty === 'normal') {
    const state = createSearch(board, 2);
    let best = rootMoves[0]!;
    let bestValue = -Infinity;
    for (const move of rootMoves) {
      const turned = make(state, player, move, 0);
      const value = evaluate(state.board, player);
      unmake(state, player, move, 0, turned);
      if (value > bestValue) {
        bestValue = value;
        best = move;
      }
    }
    return best;
  }

  const empties = countDiscs(board).empty;
  const maxDepth = empties <= ENDGAME_EMPTIES ? empties : HARD_MAX_DEPTH;
  const state = createSearch(board, maxDepth + 2);
  // Depth 1 always completes within the budget, so hard is never weaker than
  // normal; each finished depth replaces the answer, an unfinished one is
  // discarded whole (§5).
  let chosen = rootMoves[0]!;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const best = bestAtDepth(state, player, rootMoves, depth);
    if (best === null) break;
    chosen = best;
  }
  return chosen;
}
