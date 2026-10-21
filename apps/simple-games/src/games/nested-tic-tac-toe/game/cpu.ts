/**
 * The CPU's move (docs/NESTED_TIC_TAC_TOE_RULES.md §4). Three strengths and
 * one honest bound: the search runs only when asked (the player's move — or a
 * resume on the CPU's turn — starts it), counts every node it visits, and
 * when the budget runs out it plays the best move of the last depth it
 * finished — never a spinner, never a stronger answer than it had the work to
 * earn (docs/GAME_LIFECYCLE.md「CPU 探索」).
 *
 * Every strength first takes a move that wins the match outright, if there is
 * one, and plays the only legal move when there is just one (§4.1). Then easy scores each move by the position it leaves, from the
 * CPU's side, and draws one of the best three; normal and hard deepen an α–β
 * search inside the same node budget — normal to three plies, hard as far as
 * the budget lets it.
 *
 * Everything here is deterministic per seed: the only randomness is the first
 * value of `createRng(`${seed}:cpu:${moveCount}`)`, which picks among exactly
 * equal moves (and easy's best three). The same match replayed gives the same
 * reply, which is what makes Undo a take-back rather than a reroll (§5).
 */
import {
  isOver,
  legalMoves,
  makeMove,
  playableBoards,
  positionFromMoves,
  sendTarget,
  toMove,
  unmakeMove,
  wouldTake,
  type Position,
} from './engine';
import { createRng } from './rng';
import {
  BOARD_COUNT,
  boardOf,
  CELL_COUNT,
  cellOf,
  DRAWN,
  EMPTY,
  LINE_WEIGHT,
  LINES,
  ONGOING,
  OPEN,
  otherMark,
  placeOf,
  type Difficulty,
} from './types';

/**
 * Normal and hard stop reading here, however sharp the position (§4.1, §4.3).
 * Chosen by measurement against the four shipped hard opponents on one
 * machine, not by guess — the procedure and the table are in §4.3.
 */
export const HARD_NODE_LIMIT = 40_000;

/** Normal's deepest iteration (§4.1). Hard's is the number of empty cells. */
export const NORMAL_MAX_DEPTH = 3;

/** How many of its best-scored moves easy draws from (§4.1). */
export const EASY_TOP_CHOICES = 3;

/** A win is worth more than any shape; sooner is worth more than later (§4.2). */
export const WIN = 1_000_000;

/**
 * The evaluation's weights (§4.2). The shape is fixed by the rules document;
 * the values are the ones the self-play of §13 was measured with.
 */
export const WEIGHTS = {
  /** A big-board line holding one of a side's small boards, and nothing against it. */
  BIG_1: 40,
  /** … two of them. */
  BIG_2: 300,
  /** A taken small board, times the big-board lines through it. */
  BOARD_OWN: 25,
  /** A small-board line holding two of a side's marks and none of the other's, times w(b). */
  SMALL_2: 6,
  /** … one mark. */
  SMALL_1: 1,
  /** The side to move may play anywhere. */
  FREE_MOVE: 15,
  /** The side to move can take a small board with this move. */
  TAKE_NEXT: 20,
} as const;

/**
 * Positive when the position favours the side to move (§4.2) — negamax, so
 * one function serves both sides. Static: it reads the board and plays
 * nothing.
 */
export function evaluate(position: Position): number {
  const { cells, smalls } = position;
  const me = toMove(position);
  const them = otherMark(me);
  const { BIG_1, BIG_2, BOARD_OWN, SMALL_2, SMALL_1, FREE_MOVE, TAKE_NEXT } = WEIGHTS;
  let score = 0;

  // The big board: each small board one square of a 3×3, counted the way
  // Connect Four counts its windows (§4.2).
  for (const [a, b, c] of LINES) {
    let mine = 0;
    let theirs = 0;
    let dead = false;
    for (const small of [a, b, c]) {
      const state = smalls[small];
      if (state === DRAWN) dead = true;
      else if (state === me) mine += 1;
      else if (state === them) theirs += 1;
    }
    if (dead || (mine > 0 && theirs > 0)) continue;
    if (mine === 1) score += BIG_1;
    else if (mine === 2) score += BIG_2;
    else if (theirs === 1) score -= BIG_1;
    else if (theirs === 2) score -= BIG_2;
  }

  for (let board = 0; board < BOARD_COUNT; board++) {
    const state = smalls[board];
    const weight = LINE_WEIGHT[board]!;
    if (state === me) {
      score += BOARD_OWN * weight;
      continue;
    }
    if (state === them) {
      score -= BOARD_OWN * weight;
      continue;
    }
    if (state !== OPEN) continue;
    const base = cellOf(board, 0);
    for (const [a, b, c] of LINES) {
      let mine = 0;
      let theirs = 0;
      for (const place of [a, b, c]) {
        const mark = cells[base + place];
        if (mark === me) mine += 1;
        else if (mark === them) theirs += 1;
      }
      if (theirs === 0) {
        if (mine === 2) score += SMALL_2 * weight;
        else if (mine === 1) score += SMALL_1 * weight;
      } else if (mine === 0) {
        if (theirs === 2) score -= SMALL_2 * weight;
        else if (theirs === 1) score -= SMALL_1 * weight;
      }
    }
  }

  // Where the side to move was sent (§4.2): these two terms are why sending
  // the opponent to a free move, or into a board they can take, costs.
  if (position.result === ONGOING) {
    if (sendTarget(position) === null) score += FREE_MOVE;
    if (canTakeNext(position, me)) score += TAKE_NEXT;
  }
  return score;
}

/** True when some board `mark` may play in holds two of its marks and an empty cell in a line. */
function canTakeNext(position: Position, mark: number): boolean {
  const { cells } = position;
  for (const board of playableBoards(position)) {
    const base = cellOf(board, 0);
    for (const [a, b, c] of LINES) {
      let mine = 0;
      let empty = 0;
      for (const place of [a, b, c]) {
        const cell = cells[base + place];
        if (cell === mark) mine += 1;
        else if (cell === EMPTY) empty += 1;
      }
      if (mine === 2 && empty === 1) return true;
    }
  }
  return false;
}

/** Inside a group: centre, then corners, then edges (§4.1). Indexed by place. */
const PLACE_RANK: readonly number[] = [1, 5, 2, 6, 0, 7, 3, 8, 4];

/**
 * The search's move order (§4.1), deterministic: ① moves that take a small
 * board; ② the rest; ③ moves that take nothing and leave the opponent a free
 * move. ① wins over ③ — a move that takes its own target board is ①. Inside
 * a group, by place (centre, corners 0 2 6 8, edges 1 3 5 7), then by small
 * board.
 */
export function orderedMoves(position: Position): number[] {
  const mark = toMove(position);
  const keyed = legalMoves(position).map((cell) => {
    const board = boardOf(cell);
    const place = placeOf(cell);
    let group: number;
    if (wouldTake(position, cell, mark)) group = 0;
    else {
      const closesTarget =
        place === board ? position.filled[board]! + 1 === 9 : position.smalls[place] !== OPEN;
      group = closesTarget ? 2 : 1;
    }
    return { cell, key: group * 100 + PLACE_RANK[place]! * 10 + board };
  });
  keyed.sort((x, y) => x.key - y.key);
  return keyed.map((entry) => entry.cell);
}

/** Thrown when the node budget runs out; the deepening loop catches it (§4.1). */
const OUT_OF_NODES = Symbol('out of nodes');

interface SearchBudget {
  nodes: number;
  readonly limit: number;
}

/**
 * Negamax α–β from the side to move's point of view. One call is one node,
 * leaves included (§4.1). The limit is checked before counting — so the
 * counter never reads past it — and only when `bounded` (iterations of depth
 * 2 and up; depth 1 always completes).
 */
function search(
  position: Position,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  budget: SearchBudget,
  bounded: boolean,
): number {
  if (bounded && budget.nodes >= budget.limit) throw OUT_OF_NODES;
  budget.nodes += 1;

  // The match ending is read as an ending here too (§4.1): the side to move
  // can only have lost — the move before it completed the line.
  if (position.result !== ONGOING) return position.result === DRAWN ? 0 : -(WIN - ply);
  if (depth === 0) return evaluate(position);

  let best = -Infinity;
  for (const cell of orderedMoves(position)) {
    makeMove(position, cell);
    const value = -search(position, depth - 1, -beta, -alpha, ply + 1, budget, bounded);
    unmakeMove(position);
    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export interface CpuMoveInput {
  /** The match so far. Its length is the move count of the draw (§4.1). */
  readonly moves: readonly number[];
  readonly difficulty: Difficulty;
  readonly seed: string;
  /** Tests and measurement only: a different node budget. Normal and hard use HARD_NODE_LIMIT. */
  readonly nodeLimit?: number;
  /** Tests only: a lower cap on the deepest iteration than the difficulty's own (at least 1). */
  readonly maxDepth?: number;
}

export interface CpuDecision {
  readonly cell: number;
  /**
   * How the move was found: an outright win, the only legal move, easy's
   * draw, or the search.
   */
  readonly kind: 'win' | 'only' | 'easy' | 'search';
  /** Search nodes this reply cost, summed over every iteration (§4.1). 0 unless `search`. */
  readonly nodes: number;
  /** Deepest finished iteration — 0 unless `search`. */
  readonly completedDepth: number;
  /** The chosen move's value at that depth, from the CPU's side — null unless `search`. */
  readonly value: number | null;
  /** The candidates the draw chose among, ascending (easy: its best three, in score order). */
  readonly candidates: readonly number[];
  /** The first value of the draw's stream, which picked `cell` (§4.1). */
  readonly draw: number;
}

/**
 * The CPU's full decision for the side to move, with what it cost. Null when
 * the moves do not replay legally or the match is already over — the session
 * never asks then.
 */
export function decideCpuMove(input: CpuMoveInput): CpuDecision | null {
  const { moves, difficulty, seed } = input;
  // A fresh position of the search's own (positionFromMoves builds one). An
  // iteration abandoned at the limit leaves it mid-line; nothing reads it
  // after that except `legal`, taken before the search starts.
  const position = positionFromMoves(moves);
  if (position === null || isOver(position)) return null;
  const me = toMove(position);
  const legal = legalMoves(position);
  const draw = createRng(`${seed}:cpu:${moves.length}`)();
  const pick = (candidates: readonly number[]) => candidates[Math.floor(draw * candidates.length)]!;

  // Every strength: a move that completes a big-board line, if any (§4.1).
  // Asking costs no nodes — it is the engine's own check, at most 81 times.
  const winners: number[] = [];
  for (const cell of legal) {
    if (!wouldTake(position, cell, me)) continue;
    makeMove(position, cell);
    if (position.result === me) winners.push(cell);
    unmakeMove(position);
  }
  if (winners.length > 0)
    return {
      cell: pick(winners),
      kind: 'win',
      nodes: 0,
      completedDepth: 0,
      value: null,
      candidates: winners,
      draw,
    };

  // Every strength: one legal move is no choice — nothing to score or read (§4.1).
  if (legal.length === 1)
    return {
      cell: legal[0]!,
      kind: 'only',
      nodes: 0,
      completedDepth: 0,
      value: null,
      candidates: legal,
      draw,
    };

  if (difficulty === 'easy') {
    // One ply, no search (§4.1): the position each move leaves is the
    // opponent's to move, so its value is negated into the CPU's.
    const scored = legal.map((cell) => {
      makeMove(position, cell);
      const score = position.result === DRAWN ? 0 : -evaluate(position);
      unmakeMove(position);
      return { cell, score };
    });
    scored.sort((x, y) => y.score - x.score || x.cell - y.cell);
    const top = scored.slice(0, EASY_TOP_CHOICES).map((entry) => entry.cell);
    return {
      cell: pick(top),
      kind: 'easy',
      nodes: 0,
      completedDepth: 0,
      value: null,
      candidates: top,
      draw,
    };
  }

  let empties = 0;
  for (let cell = 0; cell < CELL_COUNT; cell++) if (position.cells[cell] === EMPTY) empties += 1;
  const ownDepth = difficulty === 'normal' ? Math.min(NORMAL_MAX_DEPTH, empties) : empties;
  // Depth 1 always runs (§4.1), so a test's cap below 1 is read as 1.
  const maxDepth = Math.max(1, Math.min(ownDepth, input.maxDepth ?? ownDepth));
  const budget: SearchBudget = { nodes: 0, limit: input.nodeLimit ?? HARD_NODE_LIMIT };

  // Iterative deepening (§4.1). Each root move is searched on its own with
  // the full window, so every root value is exact and "exactly as good" is
  // well defined; root order therefore changes neither values nor cost. An
  // iteration that hits the limit is thrown away whole.
  let values: number[] = [];
  let completedDepth = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const bounded = depth >= 2;
    const iteration: number[] = [];
    try {
      for (const cell of legal) {
        makeMove(position, cell);
        iteration.push(-search(position, depth - 1, -Infinity, Infinity, 1, budget, bounded));
        unmakeMove(position);
      }
    } catch (error) {
      if (error !== OUT_OF_NODES) throw error;
      break;
    }
    values = iteration;
    completedDepth = depth;
    // A finished depth that proves a win needs no deeper look.
    if (Math.max(...values) >= WIN - CELL_COUNT) break;
  }

  const best = Math.max(...values);
  const candidates = legal.filter((_, index) => values[index] === best);
  return {
    cell: pick(candidates),
    kind: 'search',
    nodes: budget.nodes,
    completedDepth,
    value: best,
    candidates,
    draw,
  };
}

/** The CPU's chosen cell, or null when there is nothing to choose (see decideCpuMove). */
export function chooseCpuMove(input: CpuMoveInput): number | null {
  return decideCpuMove(input)?.cell ?? null;
}
