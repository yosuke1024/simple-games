/**
 * The CPU's move (docs/GOMOKU_RULES.md §4). Three strengths, one honest
 * bound: the search runs only when asked (the player's stone starts the
 * turn), counts every node it visits, and when the budget runs out it plays
 * the best move of the last depth it finished — never a spinner, never a
 * stronger answer than it had time to earn (docs/GAME_LIFECYCLE.md
 * 「CPU 探索」).
 *
 * Two hundred and twenty-five intersections are all legal, which is far too
 * wide a tree to read. Three things make it fit.
 *
 * Only intersections near a stone already down are considered at all — a
 * stone played out in the empty half of the board neither builds nor blocks
 * anything — and the search reads only the busiest few of those.
 *
 * And the position's score is kept as a running total rather than recomputed.
 * Placing a stone can only change the four lines through it, so make and
 * unmake subtract those four lines and add them back; the evaluation at a
 * leaf is then a subtraction. The first version of this scored the whole
 * board at every node and took five seconds a reply, which is the whole
 * reason this file is shaped the way it is.
 *
 * Everything here is deterministic per seed: ties are broken by a seeded
 * shuffle of the root moves, so the same game replayed gives the same reply —
 * which is what makes Undo a take-back rather than a reroll (§5).
 */
import { DIRECTIONS, inBounds } from './engine';
import { createRng, shuffled } from './rng';
import {
  BLACK,
  CELL_COUNT,
  CENTRE,
  EMPTY,
  SIZE,
  WHITE,
  WIN_LENGTH,
  cellAt,
  colOf,
  opponentOf,
  rowOf,
  type Board,
  type Difficulty,
  type Player,
} from './types';

/**
 * Hard stops reading here, however sharp the position (§4).
 *
 * The number is measured, not guessed, and it was calibrated against the CPU
 * opponents already shipped rather than against a stopwatch on one machine:
 * on the same container, Reversi's hard reply costs ~248ms and Connect Four's
 * ~301ms, where this one costs ~256ms at the budget below (cpu.bench.test.ts
 * re-measures it). Those two ship and fit inside the 450ms pause, so landing
 * level with the cheaper of them is the honest way to say this one fits too.
 *
 * The pause exists to make the turn visible; a search that outlived it would
 * turn it into waiting, and "the strongest opponent that fits in the pause"
 * is the trade this title chose over a stronger one that does not (issue #26
 * non-goal).
 */
export const HARD_NODE_LIMIT = 8_000;

/** Hard's lookahead; normal reads a single move and judges the position. */
const HARD_MAX_DEPTH = 6;

/** How many candidates a node reads at all. Beyond this they are noise. */
const HARD_BRANCH = 8;
/** How many the root reads: it is entered once, so it can afford more. */
const ROOT_BRANCH = 16;
/**
 * How far from an existing stone a move is worth considering. Two rings is
 * enough to build a line, jump a gap, or block one; a stone further out than
 * that does nothing this turn or next.
 */
const NEIGHBOURHOOD = 2;
/** Easy stays closer in, which is most of why it is easy. */
const EASY_NEIGHBOURHOOD = 1;

/**
 * What a run of stones is worth. The gap between an open and a closed run is
 * the whole game: four in a row with both ends free cannot be stopped, and
 * four with one end blocked is merely a move that must be answered.
 */
const FIVE = 1_000_000;
const OPEN_FOUR = 100_000;
const CLOSED_FOUR = 12_000;
const OPEN_THREE = 8_000;
const CLOSED_THREE = 600;
const OPEN_TWO = 300;
const CLOSED_TWO = 40;

/**
 * How much more a threat counts when it is against you. Slightly over one: a
 * CPU that valued both sides equally would rather build its own four than
 * stop yours, and losing on the next move is worse than not winning on it.
 */
const DEFENCE = 1.15;

/** Beyond any pattern; +depth so a faster win outranks a slower one. */
const WIN_VALUE = 10_000_000;

const scoreRun = (length: number, openEnds: number): number => {
  if (length >= WIN_LENGTH) return FIVE;
  if (length === 4) return openEnds === 2 ? OPEN_FOUR : openEnds === 1 ? CLOSED_FOUR : 0;
  if (length === 3) return openEnds === 2 ? OPEN_THREE : openEnds === 1 ? CLOSED_THREE : 0;
  if (length === 2) return openEnds === 2 ? OPEN_TWO : openEnds === 1 ? CLOSED_TWO : 0;
  return 0;
};

/**
 * Everything `player` has built on this board. Each maximal run is counted
 * once, from its first stone: walking back one step in the direction and
 * finding the same colour means this is the middle of a run already scored.
 *
 * This is the definition; the search keeps the same number incrementally
 * (`Search`), and a test holds the two to each other.
 */
export function scoreFor(board: ArrayLike<number>, player: Player): number {
  let total = 0;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (board[cell] !== player) continue;
    const row = rowOf(cell);
    const col = colOf(cell);
    for (const [dr, dc] of DIRECTIONS) {
      const backRow = row - dr;
      const backCol = col - dc;
      if (inBounds(backRow, backCol) && board[cellAt(backRow, backCol)] === player) continue;

      let length = 0;
      let r = row;
      let c = col;
      while (inBounds(r, c) && board[cellAt(r, c)] === player) {
        length += 1;
        r += dr;
        c += dc;
      }
      let openEnds = 0;
      if (inBounds(r, c) && board[cellAt(r, c)] === EMPTY) openEnds += 1;
      if (inBounds(backRow, backCol) && board[cellAt(backRow, backCol)] === EMPTY) openEnds += 1;
      total += scoreRun(length, openEnds);
    }
  }
  return total;
}

/** Positive when the position favours `me` (§4). */
export function evaluate(board: ArrayLike<number>, me: Player): number {
  return scoreFor(board, me) - DEFENCE * scoreFor(board, opponentOf(me));
}

/**
 * The intersections worth considering: empty, and within `reach` rings of a
 * stone already down (§4). On an empty board that is the centre alone.
 */
export function candidateMoves(board: ArrayLike<number>, reach = NEIGHBOURHOOD): number[] {
  const near = new Set<number>();
  let anyStone = false;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (board[cell] === EMPTY) continue;
    anyStone = true;
    const row = rowOf(cell);
    const col = colOf(cell);
    for (let dr = -reach; dr <= reach; dr++) {
      for (let dc = -reach; dc <= reach; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (!inBounds(r, c)) continue;
        const candidate = cellAt(r, c);
        if (board[candidate] === EMPTY) near.add(candidate);
      }
    }
  }
  if (!anyStone) return [CENTRE];
  return [...near].sort((a, b) => a - b);
}

// ---------- the search's board ----------

/**
 * The four directions again, flat. The search walks them at every node, and
 * destructuring a pair there allocates an iterator per direction per node —
 * which was most of the cost of a reply before this existed.
 */
const HOT_DR = new Int8Array(DIRECTIONS.map(([dr]) => dr));
const HOT_DC = new Int8Array(DIRECTIONS.map(([, dc]) => dc));

/**
 * Where each of the four lines through a cell begins, so a line can be walked
 * from one end. Built once: 225 cells × 4 directions of constants.
 */
const DIRECTION_COUNT = DIRECTIONS.length;

const LINE_STARTS = (() => {
  const starts = new Int16Array(CELL_COUNT * DIRECTION_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const row = rowOf(cell);
    const col = colOf(cell);
    for (let d = 0; d < DIRECTION_COUNT; d++) {
      const [dr, dc] = DIRECTIONS[d]!;
      let r = row;
      let c = col;
      while (inBounds(r - dr, c - dc)) {
        r -= dr;
        c -= dc;
      }
      starts[cell * DIRECTION_COUNT + d] = cellAt(r, c);
    }
  }
  return starts;
})();

/**
 * What one whole line is worth to `player`: its maximal runs, scored. Kept
 * for the test that holds the incremental total to the definition; the search
 * itself uses `adjustLine`, which does both colours in one walk.
 */
export function scoreLine(
  board: ArrayLike<number>,
  start: number,
  dr: number,
  dc: number,
  player: Player,
): number {
  let total = 0;
  let r = rowOf(start);
  let c = colOf(start);
  let run = 0;
  /** Whether the square before the current run was empty. */
  let openBefore = false;

  while (inBounds(r, c)) {
    const piece = board[cellAt(r, c)];
    if (piece === player) {
      run += 1;
    } else {
      if (run > 0) total += scoreRun(run, (openBefore ? 1 : 0) + (piece === EMPTY ? 1 : 0));
      run = 0;
      openBefore = piece === EMPTY;
    }
    r += dr;
    c += dc;
  }
  // A run that reaches the edge has a wall at that end.
  if (run > 0) total += scoreRun(run, openBefore ? 1 : 0);
  return total;
}

/**
 * One reply's working set: the board, the running score for each colour, and
 * how many stones sit within `NEIGHBOURHOOD` of each intersection. All three
 * are maintained by make/unmake, so a node costs four lines rather than a
 * board sweep.
 */
interface Search {
  readonly board: Int8Array;
  readonly near: Int8Array;
  /** One candidate list per level of recursion, allocated once per reply. */
  readonly candidates: Int32Array[];
  readonly limit: number;
  black: number;
  white: number;
  nodes: number;
}

function createSearch(board: Board): Search {
  const cells = new Int8Array(CELL_COUNT);
  const near = new Int8Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) cells[cell] = board[cell]!;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (cells[cell] === EMPTY) continue;
    bumpNeighbours(near, cell, 1);
  }
  return {
    board: cells,
    near,
    candidates: Array.from({ length: HARD_MAX_DEPTH + 2 }, () => new Int32Array(HARD_BRANCH)),
    limit: HARD_NODE_LIMIT,
    black: scoreFor(cells, BLACK),
    white: scoreFor(cells, WHITE),
    nodes: 0,
  };
}

function bumpNeighbours(near: Int8Array, cell: number, by: number): void {
  const row = rowOf(cell);
  const col = colOf(cell);
  const rowFrom = Math.max(0, row - NEIGHBOURHOOD);
  const rowTo = Math.min(SIZE - 1, row + NEIGHBOURHOOD);
  const colFrom = Math.max(0, col - NEIGHBOURHOOD);
  const colTo = Math.min(SIZE - 1, col + NEIGHBOURHOOD);
  for (let r = rowFrom; r <= rowTo; r++) {
    for (let c = colFrom; c <= colTo; c++) near[cellAt(r, c)]! += by;
  }
}

/**
 * Adds or removes one whole line from the running totals, for both colours in
 * a single walk. At most one colour has a live run at any point along a line —
 * an intersection holds one stone — so the two can share the traversal, which
 * is the difference between a search that answers in a moment and one that
 * does not.
 */
function adjustLine(state: Search, start: number, dr: number, dc: number, sign: number): void {
  let r = rowOf(start);
  let c = colOf(start);
  let run = 0;
  let runColor = EMPTY as number;
  let openBefore = false;
  let previous = -1;

  while (inBounds(r, c)) {
    const piece = state.board[cellAt(r, c)]!;
    if (piece !== EMPTY && piece === runColor) {
      run += 1;
    } else {
      if (run > 0) {
        const value = sign * scoreRun(run, (openBefore ? 1 : 0) + (piece === EMPTY ? 1 : 0));
        if (runColor === BLACK) state.black += value;
        else state.white += value;
      }
      if (piece === EMPTY) {
        run = 0;
        runColor = EMPTY;
      } else {
        run = 1;
        runColor = piece;
        openBefore = previous === EMPTY;
      }
    }
    previous = piece;
    r += dr;
    c += dc;
  }
  // A run that reaches the edge has a wall at that end.
  if (run > 0) {
    const value = sign * scoreRun(run, openBefore ? 1 : 0);
    if (runColor === BLACK) state.black += value;
    else state.white += value;
  }
}

/** Adds or removes the four lines through `cell` from the running totals. */
function adjustLines(state: Search, cell: number, sign: number): void {
  const base = cell * DIRECTION_COUNT;
  for (let d = 0; d < DIRECTION_COUNT; d++) {
    adjustLine(state, LINE_STARTS[base + d]!, HOT_DR[d]!, HOT_DC[d]!, sign);
  }
}

function make(state: Search, cell: number, player: Player): void {
  adjustLines(state, cell, -1);
  state.board[cell] = player;
  adjustLines(state, cell, 1);
  bumpNeighbours(state.near, cell, 1);
}

function unmake(state: Search, cell: number): void {
  adjustLines(state, cell, -1);
  state.board[cell] = EMPTY;
  adjustLines(state, cell, 1);
  bumpNeighbours(state.near, cell, -1);
}

/** The running evaluation, from the totals make/unmake keep (§4). */
function scoreOf(state: Search, me: Player): number {
  return me === BLACK ? state.black - DEFENCE * state.white : state.white - DEFENCE * state.black;
}

/** Whether the stone on `cell` completes a line of five or more (§3). */
function wins(board: ArrayLike<number>, cell: number): boolean {
  const player = board[cell];
  if (player === EMPTY) return false;
  const row = rowOf(cell);
  const col = colOf(cell);
  for (let d = 0; d < DIRECTION_COUNT; d++) {
    const dr = HOT_DR[d]!;
    const dc = HOT_DC[d]!;
    let run = 1;
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[cellAt(r, c)] === player) {
      run += 1;
      r += dr;
      c += dc;
    }
    r = row - dr;
    c = col - dc;
    while (inBounds(r, c) && board[cellAt(r, c)] === player) {
      run += 1;
      r -= dr;
      c -= dc;
    }
    if (run >= WIN_LENGTH) return true;
  }
  return false;
}

/**
 * The busiest empty intersections with a stone in reach, written into `out`
 * in descending order; returns how many. One pass with an insertion into a
 * list of at most `width`, because a node cannot afford to allocate an array
 * and sort it — that alone was most of the cost of a reply.
 */
function collectCandidates(state: Search, out: Int32Array, width: number): number {
  let count = 0;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (state.board[cell] !== EMPTY) continue;
    const weight = state.near[cell]!;
    if (weight === 0) continue;
    if (count < width) {
      let i = count;
      count += 1;
      while (i > 0 && state.near[out[i - 1]!]! < weight) {
        out[i] = out[i - 1]!;
        i -= 1;
      }
      out[i] = cell;
    } else if (state.near[out[width - 1]!]! < weight) {
      let i = width - 1;
      while (i > 0 && state.near[out[i - 1]!]! < weight) {
        out[i] = out[i - 1]!;
        i -= 1;
      }
      out[i] = cell;
    }
  }
  return count;
}

/**
 * Negamax with α–β. A move that completes five ends the line there and then:
 * nothing after a win is worth reading, and scoring it by depth is what makes
 * the CPU take the win in front of it rather than an equally winning one two
 * moves later.
 */
function search(
  state: Search,
  toMove: Player,
  me: Player,
  depth: number,
  level: number,
  alpha: number,
  beta: number,
): number {
  state.nodes += 1;
  if (state.nodes > state.limit) throw OUT_OF_NODES;
  if (depth === 0) return scoreOf(state, me);

  // Busyness order, and no more than that. Sorting the children by what they
  // score would prune better, but it costs a make and unmake each — which
  // more than doubles the price of every node — and the root already does it
  // where the pruning is worth most.
  const buffer = state.candidates[level]!;
  const count = collectCandidates(state, buffer, HARD_BRANCH);
  if (count === 0) return scoreOf(state, me);

  const maximising = toMove === me;
  let best = maximising ? -Infinity : Infinity;
  for (let i = 0; i < count; i++) {
    const cell = buffer[i]!;
    make(state, cell, toMove);
    const value = wins(state.board, cell)
      ? maximising
        ? WIN_VALUE + depth
        : -(WIN_VALUE + depth)
      : search(state, opponentOf(toMove), me, depth - 1, level + 1, alpha, beta);
    unmake(state, cell);

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

/** The best-looking `width` of `candidates` for `toMove`, best first. */
function orderByScore(
  state: Search,
  toMove: Player,
  candidates: readonly number[],
  width: number,
): number[] {
  const scored = candidates.map((cell) => {
    make(state, cell, toMove);
    const value = wins(state.board, cell) ? WIN_VALUE : scoreOf(state, toMove);
    unmake(state, cell);
    return { cell, value };
  });
  scored.sort((a, b) => b.value - a.value);
  return scored.slice(0, width).map((entry) => entry.cell);
}

/** Thrown when the node budget runs out; the deepening loop catches it (§4). */
const OUT_OF_NODES = Symbol('out of nodes');

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
    for (const cell of rootMoves) {
      make(state, cell, me);
      const value = wins(state.board, cell)
        ? WIN_VALUE + depth
        : search(state, opponentOf(me), me, depth - 1, 1, -Infinity, Infinity);
      unmake(state, cell);
      if (value > bestValue) {
        bestValue = value;
        best = cell;
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
  /** The game's move counter — the draw's second half (§4). */
  readonly moveCount: number;
}

/**
 * The CPU's chosen intersection, or null when the board is full (§3).
 *
 * easy picks blind from the intersections touching a stone; normal judges
 * every candidate one move deep, which is enough to take a win and to stop
 * one; hard deepens 1..6 over the busiest few at each node, inside the node
 * budget, keeping the best finished answer (§4).
 */
export function chooseCpuMove(input: CpuMoveInput): number | null {
  const { board, player, difficulty, seed, moveCount } = input;
  const rng = createRng(`${seed}:cpu:${moveCount}`);

  if (difficulty === 'easy') {
    const near = candidateMoves(board, EASY_NEIGHBOURHOOD);
    if (near.length === 0) return null;
    return shuffled(near, rng)[0]!;
  }

  const candidates = candidateMoves(board);
  if (candidates.length === 0) return null;
  // The seeded shuffle decides every tie; the sorts below are stable, so
  // equal scores keep the shuffled order rather than the board's.
  const shuffledCandidates = shuffled(candidates, rng);
  const state = createSearch(board);

  if (difficulty === 'normal') {
    let best = shuffledCandidates[0]!;
    let bestValue = -Infinity;
    for (const cell of shuffledCandidates) {
      make(state, cell, player);
      const value = wins(state.board, cell) ? WIN_VALUE : scoreOf(state, player);
      unmake(state, cell);
      if (value > bestValue) {
        bestValue = value;
        best = cell;
      }
    }
    return best;
  }

  const rootMoves = orderByScore(state, player, shuffledCandidates, ROOT_BRANCH);
  // Depth 1 always completes within the budget, so hard is never weaker than
  // normal; each finished depth replaces the answer, an unfinished one is
  // discarded whole (§4).
  let chosen = rootMoves[0]!;
  for (let depth = 1; depth <= HARD_MAX_DEPTH; depth++) {
    const best = bestAtDepth(state, player, rootMoves, depth);
    if (best === null) break;
    chosen = best;
  }
  return chosen;
}

/** Exported for the test that holds the incremental score to its definition. */
export const __test = { createSearch, make, unmake };
