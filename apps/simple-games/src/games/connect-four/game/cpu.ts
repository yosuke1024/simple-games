/**
 * The CPU's move (docs/CONNECT_FOUR_RULES.md §4). Three strengths that differ
 * only in how far they read, and one honest bound: the search runs only when
 * asked (the player's tap starts the turn), counts every node it visits, and
 * when the budget runs out it plays the best move of the last depth it
 * finished — never a spinner, never a stronger answer than it had time to
 * earn (docs/GAME_LIFECYCLE.md「CPU 探索」).
 *
 * Everything here is deterministic per seed: ties are broken by a seeded
 * shuffle under the centre-first ordering, so the same game replayed gives
 * the same reply — which is what makes Undo a take-back rather than a reroll
 * (§5).
 */
import { dropDisc, legalColumns, lineThrough } from './engine';
import { createRng, shuffled } from './rng';
import {
  cellAt,
  COLS,
  CPU,
  LINE_LENGTH,
  opponentOf,
  ROWS,
  type Board,
  type Difficulty,
  type Side,
} from './types';

/**
 * Hard stops reading here, however sharp the position (§4).
 *
 * The number is measured, not guessed: a full-budget reply takes ~160ms on a
 * development machine, which leaves a low-spec phone — the release floor —
 * comfortably inside the CPU's own 450ms pause. The pause exists to make the
 * turn visible; a search that outlived it would turn it into waiting, and
 * "the strongest opponent that fits in the pause" is the trade this title
 * chose over a stronger one that does not (issue #26 non-goal).
 */
export const HARD_NODE_LIMIT = 30_000;

const DEPTHS: Record<Difficulty, number> = { easy: 1, normal: 4, hard: 8 };

/** A win is worth more than any shape; sooner is worth more than later. */
const WIN_VALUE = 1_000_000;

/**
 * Every four-cell window on the board, precomputed once: 69 lines through
 * which a game can be won, and the whole of the evaluation (§4).
 */
const WINDOWS: readonly (readonly number[])[] = (() => {
  const windows: number[][] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const runs: (readonly [number, number])[] = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ];
      for (const [dr, dc] of runs) {
        const endRow = row + dr * (LINE_LENGTH - 1);
        const endCol = col + dc * (LINE_LENGTH - 1);
        if (endRow < 0 || endRow >= ROWS || endCol < 0 || endCol >= COLS) continue;
        const window: number[] = [];
        for (let i = 0; i < LINE_LENGTH; i++) window.push(cellAt(row + dr * i, col + dc * i));
        windows.push(window);
      }
    }
  }
  return windows;
})();

/** The centre column, where most lines cross. */
const CENTER_COL = Math.floor(COLS / 2);

/**
 * Positive when the position favours `me` (§4). Threats are weighed harder
 * against than for: missing the opponent's open three loses now, missing
 * one's own only postpones.
 */
export function evaluate(board: Board, me: Side): number {
  const opponent = opponentOf(me);
  let score = 0;

  for (const window of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const cell of window) {
      const piece = board[cell];
      if (piece === me) mine += 1;
      else if (piece === opponent) theirs += 1;
    }
    if (mine > 0 && theirs > 0) continue;
    if (mine === 3) score += 50;
    else if (mine === 2) score += 10;
    else if (theirs === 3) score -= 80;
    else if (theirs === 2) score -= 12;
  }

  for (let row = 0; row < ROWS; row++) {
    const piece = board[cellAt(row, CENTER_COL)];
    if (piece === me) score += 4;
    else if (piece === opponent) score -= 4;
  }
  return score;
}

/** Thrown when the node budget runs out; the deepening loop catches it (§4). */
const OUT_OF_NODES = Symbol('out of nodes');

interface SearchBudget {
  nodes: number;
  readonly limit: number;
}

/** Centre-out column order: the strongest pruning this board offers (§4). */
const CENTER_OUT: readonly number[] = [3, 2, 4, 1, 5, 0, 6];

function orderedColumns(board: Board): number[] {
  const legal = new Set(legalColumns(board));
  return CENTER_OUT.filter((col) => legal.has(col));
}

/**
 * Minimax with α–β from `me`'s perspective. A move that completes a line
 * ends the branch on the spot — with `depth` still in hand, so nearer wins
 * score higher and the CPU never dawdles on a mate it has seen.
 */
function search(
  board: Board,
  toMove: Side,
  me: Side,
  depth: number,
  alpha: number,
  beta: number,
  budget: SearchBudget,
): number {
  budget.nodes += 1;
  if (budget.nodes > budget.limit) throw OUT_OF_NODES;

  const columns = orderedColumns(board);
  if (columns.length === 0) return 0;
  if (depth === 0) return evaluate(board, me);

  const maximising = toMove === me;
  let best = maximising ? -Infinity : Infinity;
  for (const col of columns) {
    const dropped = dropDisc(board, toMove, col)!;
    let value: number;
    if (lineThrough(dropped.board, dropped.cell) !== null) {
      value = (maximising ? 1 : -1) * (WIN_VALUE + depth);
    } else {
      value = search(dropped.board, opponentOf(toMove), me, depth - 1, alpha, beta, budget);
    }
    if (maximising) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (alpha >= beta) break;
  }
  return best;
}

/** The best root column at one fixed depth, or null when the budget ran out. */
function bestAtDepth(
  board: Board,
  me: Side,
  rootColumns: readonly number[],
  depth: number,
  budget: SearchBudget,
): number | null {
  let best: number | null = null;
  let bestValue = -Infinity;
  try {
    for (const col of rootColumns) {
      const dropped = dropDisc(board, me, col)!;
      const value =
        lineThrough(dropped.board, dropped.cell) !== null
          ? WIN_VALUE + depth
          : search(dropped.board, opponentOf(me), me, depth - 1, -Infinity, Infinity, budget);
      if (value > bestValue) {
        bestValue = value;
        best = col;
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
  readonly difficulty: Difficulty;
  readonly seed: string;
  /** The game's move counter — the draw's second half (§4). */
  readonly moveCount: number;
}

/**
 * The CPU's chosen column. easy reads one ply — its own wins, nothing else;
 * normal reads four; hard deepens 2..8 inside the node budget, keeping the
 * best finished answer (§4). Never null on a legal board: a full board never
 * gets a turn.
 */
export function chooseCpuMove(input: CpuMoveInput): number {
  const { board, difficulty, seed, moveCount } = input;
  const legal = legalColumns(board);

  // Shuffle first, then pull back to centre-out: equal-value columns keep
  // their shuffled order (sort is stable), so ties vary per seed while the
  // pruning still gets its ordering.
  const rng = createRng(`${seed}:cpu:${moveCount}`);
  const rootColumns = shuffled(legal, rng).sort(
    (a, b) => Math.abs(a - CENTER_COL) - Math.abs(b - CENTER_COL),
  );

  const maxDepth = DEPTHS[difficulty];
  const budget: SearchBudget = { nodes: 0, limit: HARD_NODE_LIMIT };
  // Depth 1 always completes within the budget; each finished depth replaces
  // the answer, an unfinished one is discarded whole (§4).
  let chosen = rootColumns[0]!;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const best = bestAtDepth(board, CPU, rootColumns, depth, budget);
    if (best === null) break;
    chosen = best;
  }
  return chosen;
}
