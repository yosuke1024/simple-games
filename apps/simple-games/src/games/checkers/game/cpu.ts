/**
 * The CPU's turn (docs/CHECKERS_RULES.md §4). Three strengths, one honest
 * bound: the search runs only when asked (the player's move starts the turn),
 * counts every node it visits, and when the budget runs out it plays the best
 * turn of the last depth it finished — never a spinner, never a stronger
 * answer than it had time to earn (docs/GAME_LIFECYCLE.md「CPU 探索」).
 *
 * A capture sequence is one turn, not several plies. Inside the search a
 * continuation recurses without spending depth or handing the turn over —
 * charging a ply for it would make the search blind exactly where the game is
 * sharpest, the same reasoning Reversi applies to passes. The root works in
 * whole turns instead (`enumerateTurns`), because a turn is what the CPU
 * finally plays and what the screen animates jump by jump.
 *
 * Everything here is deterministic per seed: ties are broken by a seeded
 * shuffle of the root turns, so the same game replayed gives the same reply —
 * which is what makes Undo a take-back rather than a reroll (§5).
 */
import {
  collectMoves,
  enumerateTurns,
  hasJumpFrom,
  isCapture,
  MAX_MOVES,
  moveCaptured,
  moveFrom,
  moveTo,
  NO_CAPTURE,
  packMove,
  type Turn,
} from './engine';
import { createRng, shuffled } from './rng';
import {
  CELL_COUNT,
  COLS,
  DRAW_QUIET_PLIES,
  EMPTY,
  PLAYER,
  ROWS,
  colOf,
  isKing,
  kingOf,
  opponentOf,
  promotionRowOf,
  rowOf,
  sideOf,
  type Board,
  type Difficulty,
  type Piece,
  type Side,
} from './types';

/**
 * Hard stops reading here, however sharp the position (§4).
 *
 * The number is measured, not guessed, and it was calibrated against the two
 * CPU opponents already shipped rather than against a stopwatch on one
 * machine: on the same container, Reversi's hard reply costs ~248ms and
 * Connect Four's ~301ms, where this one costs ~136ms at the budget below
 * (cpu.bench.test.ts re-measures it). So this is the cheapest of the three
 * hard opponents in the collection, which is the honest way to say it fits
 * the 450ms pause — the two that already ship do.
 *
 * The pause exists to make the turn visible; a search that outlived it would
 * turn it into waiting, and "the strongest opponent that fits in the pause"
 * is the trade this title chose over a stronger one that does not (issue #26
 * non-goal).
 */
export const HARD_NODE_LIMIT = 26_000;

/**
 * What the last reply actually cost, in nodes visited. Exported so the
 * benchmark can judge the search by its work rather than by a stopwatch:
 * wall-clock on a shared CI runner measures the runner, and this repository
 * already decided performance gates watch deterministic work instead
 * (docs/RELEASE_CHECKLIST.md, the generation-cost tests).
 *
 * Written once per reply, so it is only meaningful immediately after one.
 */
export const searchCost = { nodes: 0 };

/** Hard's lookahead in turns; normal reads a fixed, much shorter way. */
const HARD_MAX_DEPTH = 8;
const NORMAL_DEPTH = 3;

/**
 * How far past the horizon a forced capture may still be followed. Captures
 * strictly reduce material so the extension always ends, but a cap keeps one
 * pathological position from spending the whole budget in one line.
 */
const QUIESCENCE_PLIES = 6;

const MAN_VALUE = 100;
const KING_VALUE = 165;
/** Per row a man has advanced: crossing the board is worth about a third of a man. */
const ADVANCE_VALUE = 4;
/** A man still home guards two crowning squares behind it. */
const BACK_RANK_VALUE = 8;
/** A piece on the outer files cannot be jumped from that side. */
const EDGE_VALUE = 3;
/** Beyond any material difference; +depth so a faster win outranks a slower one. */
const WIN_VALUE = 1_000_000;

/**
 * What a draw is worth (§3). Level, whoever is ahead on the board — which is
 * the point: a side that is winning on material has to be able to see that
 * shuffling its king into the fiftieth quiet turn throws that away.
 */
const DRAW_VALUE = 0;

/**
 * Whether this step is a king's quiet move — the only kind that advances the
 * draw counter (§3). Read from the board *before* the step is made.
 */
function isQuietKing(board: ArrayLike<number>, move: number): boolean {
  if (isCapture(move)) return false;
  return isKing(board[moveFrom(move)] as Piece);
}

/** How far a man of `side` has come, in rows. */
const advanceOf = (side: Side, row: number): number => (side === PLAYER ? ROWS - 1 - row : row);

/** The rank a side starts on, whose men guard it against a crowning. */
const homeRowOf = (side: Side): number => (side === PLAYER ? ROWS - 1 : 0);

/**
 * Positive when the position favours `me` (§4): material first, then the two
 * things material cannot see — how far the men have come, and whether the
 * back rank is still guarded.
 */
export function evaluate(board: ArrayLike<number>, me: Side): number {
  let score = 0;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const piece = board[cell] as Piece;
    if (piece === EMPTY) continue;
    const side = sideOf(piece)!;
    let value = isKing(piece) ? KING_VALUE : MAN_VALUE;
    if (!isKing(piece)) {
      const row = rowOf(cell);
      value += advanceOf(side, row) * ADVANCE_VALUE;
      if (row === homeRowOf(side)) value += BACK_RANK_VALUE;
    }
    const col = colOf(cell);
    if (col === 0 || col === COLS - 1) value += EDGE_VALUE;
    score += side === me ? value : -value;
  }
  return score;
}

/** Thrown when the node budget runs out; the deepening loop catches it (§4). */
const OUT_OF_NODES = Symbol('out of nodes');

/**
 * One turn's working set: the board being searched, a move list per level of
 * recursion, and the stack `make`/`unmake` push their undo records onto.
 * Allocated once per reply, not per node.
 *
 * Levels are counted per recursive call rather than per ply, because a
 * capture sequence recurses without deepening: two steps of one turn are two
 * levels but one ply, and each needs its own move list.
 */
interface Search {
  readonly board: Int8Array;
  readonly moves: Int32Array[];
  /** Pairs of (moved piece, captured piece), innermost last. */
  readonly undo: Int8Array;
  readonly limit: number;
  undoTop: number;
  nodes: number;
}

/**
 * Deep enough for any line this search can reach. A ply may recurse several
 * levels when a capture sequence goes on, but every extra level takes a piece
 * off the board, so the whole tree is bounded by plies + the 24 pieces —
 * well inside this.
 */
const SEARCH_LEVELS = 64;

function createSearch(board: Board): Search {
  const cells = new Int8Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) cells[cell] = board[cell]!;
  return {
    board: cells,
    moves: Array.from({ length: SEARCH_LEVELS }, () => new Int32Array(MAX_MOVES)),
    // Root turns are made before the search starts, so the stack holds those
    // as well as every level below them.
    undo: new Int8Array((SEARCH_LEVELS + 24) * 2),
    limit: HARD_NODE_LIMIT,
    undoTop: 0,
    nodes: 0,
  };
}

/** Plays one step on the search board. Returns true when it crowned a man. */
function make(state: Search, move: number): boolean {
  const from = moveFrom(move);
  const to = moveTo(move);
  const captured = moveCaptured(move);
  const piece = state.board[from] as Piece;

  state.undo[state.undoTop++] = piece;
  state.undo[state.undoTop++] = captured === NO_CAPTURE ? EMPTY : state.board[captured]!;

  state.board[from] = EMPTY;
  if (captured !== NO_CAPTURE) state.board[captured] = EMPTY;

  const side = sideOf(piece)!;
  const promoted = !isKing(piece) && rowOf(to) === promotionRowOf(side);
  state.board[to] = promoted ? kingOf(side) : piece;
  return promoted;
}

/** Puts back exactly what `make` changed. */
function unmake(state: Search, move: number): void {
  const capturedPiece = state.undo[--state.undoTop]!;
  const piece = state.undo[--state.undoTop]!;
  const captured = moveCaptured(move);
  state.board[moveTo(move)] = EMPTY;
  state.board[moveFrom(move)] = piece;
  if (captured !== NO_CAPTURE) state.board[captured] = capturedPiece;
}

/**
 * Negamax with α–β over the real game tree, capture sequences included: a
 * step that leaves the same piece able to jump again recurses on the same
 * side, at the same depth (§2, §4).
 *
 * `continueFrom` is the cell a sequence must go on from, or NO_CAPTURE at the
 * start of a turn. A side with nothing to play has lost wherever that happens
 * — being shut in ends the game exactly as being wiped out does (§3).
 *
 * `quietPlies` is carried because the draw is a real ending and the search has
 * to be able to see it (§3). Without it the tree the CPU reads and the rules
 * it is playing under disagree: at 49 quiet turns a king move draws the game
 * on the board while the search reads on as if the position continued, and it
 * would happily walk into a draw it is winning — or miss one it wants.
 */
function search(
  state: Search,
  toMove: Side,
  me: Side,
  depth: number,
  level: number,
  continueFrom: number,
  quietPlies: number,
  alpha: number,
  beta: number,
): number {
  // Checked before counting, so the budget means exactly what it says: the
  // counter never reads higher than the limit, and the benchmark can assert
  // on it without an off-by-one to explain.
  if (state.nodes >= state.limit) throw OUT_OF_NODES;
  state.nodes += 1;

  const buffer = state.moves[level]!;
  const count = collectMoves(state.board, toMove, continueFrom, buffer);
  if (count === 0) {
    const value = WIN_VALUE + depth;
    return toMove === me ? -value : value;
  }

  const forced = isCapture(buffer[0]!);
  // Past the horizon the position is only worth reading on while captures are
  // forced: a quiet position there is as settled as it is going to look.
  if (depth <= 0 && (!forced || depth <= -QUIESCENCE_PLIES)) {
    return evaluate(state.board, me);
  }

  const maximising = toMove === me;
  let best = maximising ? -Infinity : Infinity;
  for (let i = 0; i < count; i++) {
    const move = buffer[i]!;
    // Read before the move is made: whether this step resets the draw counter
    // depends on what was standing on the square it came from.
    const quiet = isQuietKing(state.board, move);
    const promoted = make(state, move);
    // A crowning ends the turn even mid-sequence (§2), so it hands over.
    const goesOn = !promoted && isCapture(move) && hasJumpFrom(state.board, moveTo(move), toMove);
    let value: number;
    if (goesOn) {
      // Mid-sequence: the counter belongs to the turn, and this turn is not
      // over. It is also a capture, so it will reset when the turn ends.
      value = search(state, toMove, me, depth, level + 1, moveTo(move), quietPlies, alpha, beta);
    } else {
      const nextQuiet = quiet ? quietPlies + 1 : 0;
      value =
        nextQuiet >= DRAW_QUIET_PLIES
          ? DRAW_VALUE
          : search(
              state,
              opponentOf(toMove),
              me,
              depth - 1,
              level + 1,
              NO_CAPTURE,
              nextQuiet,
              alpha,
              beta,
            );
    }
    unmake(state, move);

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

/** The best root turn at one fixed depth, or null when the budget ran out. */
function bestAtDepth(
  state: Search,
  me: Side,
  turns: readonly Turn[],
  depth: number,
  quietPlies: number,
): Turn | null {
  let best: Turn | null = null;
  let bestValue = -Infinity;
  for (const turn of turns) {
    const packed = turn.steps.map((step) => packMove(step.from, step.to, step.captured));
    // Only the last step decides the turn's effect on the counter: a sequence
    // is captures throughout, and a capture resets it.
    const last = turn.steps[turn.steps.length - 1]!;
    const quiet = isQuietKing(state.board, packMove(last.from, last.to, last.captured));
    for (const step of packed) make(state, step);
    const nextQuiet = quiet ? quietPlies + 1 : 0;
    let value: number;
    try {
      value =
        nextQuiet >= DRAW_QUIET_PLIES
          ? DRAW_VALUE
          : search(
              state,
              opponentOf(me),
              me,
              depth - 1,
              1,
              NO_CAPTURE,
              nextQuiet,
              -Infinity,
              Infinity,
            );
    } catch (error) {
      if (error !== OUT_OF_NODES) throw error;
      // The board has to go back even when the budget ran out: the caller
      // keeps this Search for the next, shallower answer it already holds.
      for (let i = packed.length - 1; i >= 0; i--) unmake(state, packed[i]!);
      return null;
    }
    for (let i = packed.length - 1; i >= 0; i--) unmake(state, packed[i]!);
    if (value > bestValue) {
      bestValue = value;
      best = turn;
    }
  }
  return best;
}

export interface CpuTurnInput {
  readonly board: Board;
  readonly side: Side;
  readonly difficulty: Difficulty;
  readonly seed: string;
  /** The game's move counter — the draw's second half (§4). */
  readonly moveCount: number;
  /**
   * The cell a half-played sequence must go on from, when the position was
   * restored in the middle of one (§8). Null starts a fresh turn.
   */
  readonly continueFrom?: number | null;
  /**
   * Turns since the last capture or man move (§3). The search needs it to see
   * the draw coming; omitting it reads the game as if it could not end that
   * way, which at 49 is simply wrong.
   */
  readonly quietPlies?: number;
}

/**
 * The CPU's chosen turn as the steps it is made of, or null when it has no
 * legal move at all — which is a loss, not a pass (§3).
 *
 * easy picks blind from the legal turns (the capture obligation still binds
 * it, so it is a beginner, not a cheat); normal reads three turns ahead; hard
 * deepens 1..8 inside the node budget, keeping the best finished answer (§4).
 */
export function chooseCpuTurn(input: CpuTurnInput): Turn | null {
  const { board, side, difficulty, seed, moveCount, continueFrom = null, quietPlies = 0 } = input;
  const turns = enumerateTurns(board, side, continueFrom);
  if (turns.length === 0) return null;

  // The seeded shuffle decides every tie — including easy's whole "strategy".
  const rng = createRng(`${seed}:cpu:${moveCount}`);
  const rootTurns = shuffled(turns, rng);
  if (difficulty === 'easy' || rootTurns.length === 1) {
    searchCost.nodes = 0;
    return rootTurns[0]!;
  }

  const state = createSearch(board);

  if (difficulty === 'normal') {
    const best = bestAtDepth(state, side, rootTurns, NORMAL_DEPTH, quietPlies);
    searchCost.nodes = state.nodes;
    return best ?? rootTurns[0]!;
  }

  // Depth 1 always completes within the budget, so hard is never weaker than
  // a shallow read; each finished depth replaces the answer, an unfinished
  // one is discarded whole (§4).
  let chosen = rootTurns[0]!;
  for (let depth = 1; depth <= HARD_MAX_DEPTH; depth++) {
    const best = bestAtDepth(state, side, rootTurns, depth, quietPlies);
    if (best === null) break;
    chosen = best;
  }
  searchCost.nodes = state.nodes;
  return chosen;
}
