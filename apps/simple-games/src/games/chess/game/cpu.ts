/**
 * The CPU's move (docs/CHESS_RULES.md §5). Three strengths, one honest bound:
 * the search runs only when asked (the player's move starts the CPU's turn),
 * counts every position it visits, and when the budget runs out it plays the
 * best move of the last depth it finished — never a spinner, and never a
 * stronger answer than it had the budget to earn (docs/GAME_LIFECYCLE.md
 * 「CPU 探索」). The reply says so: `capped` is true exactly when an
 * iteration was abandoned at the limit.
 *
 * There is one rule set (§2, §5). The search walks the same `engine.ts`
 * generator and the same `makeMove` / `unmakeMove` the game uses, deciding a
 * move's legality the same way the generator does — play it, see whether the
 * mover's king stands attacked — only lazily, one move at a time, so a cut-off
 * does not pay for the moves it never reads. Draws are endings inside the
 * search as they are on the board (§3, §5): the game's own position keys and
 * the fifty-move count go in, so the tree the CPU reads and the rules it plays
 * under agree.
 *
 * Everything here is deterministic per (position, history, seed, move count,
 * difficulty): the root moves are put in a seeded order before anything is
 * scored, values are integers, and a later move replaces the best only when it
 * is strictly better — so equal moves are decided by the seeded order, and a
 * game replayed gives the same reply. That is what makes Undo a take-back
 * rather than a reroll (§6).
 */
import {
  clonePosition,
  generatePseudoLegalMoves,
  hasLegalEnPassant,
  hasLegalMove,
  inCheck,
  isSquareAttacked,
  makeMove,
  repetitionKey,
  unmakeMove,
  type Position,
} from './engine';
import { createRng, shuffled } from './rng';
import { isInsufficientMaterial, type HistoryEntry } from './rules';
import {
  BISHOP,
  BLACK,
  BLACK_BIT,
  BOARD_SIZE,
  EMPTY,
  FIFTY_MOVE_PLIES,
  FLAG_CAPTURE,
  FLAG_EN_PASSANT,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  REPETITION_DRAW_COUNT,
  ROOK,
  WHITE,
  fileOf,
  isCapture,
  moveFlags,
  moveFrom,
  movePromotion,
  moveTo,
  rankOf,
  type Difficulty,
  type Move,
} from './types';

// ---------------------------------------------------------------- limits

/**
 * Normal and hard stop reading here, however sharp the position (§5.3).
 * Every position the search visits counts — the main search and the capture
 * search alike. The value is measured against the shipped hard opponents, not
 * guessed; §5.3 records how.
 */
export const HARD_NODE_LIMIT = 80_000;

/** Normal reads this many plies and no further, inside the same node limit (§5.1). */
export const NORMAL_MAX_DEPTH = 2;

/** Hard's deepest iteration; in practice the node limit stops it first (§5.1, §13). */
export const HARD_MAX_DEPTH = 6;

/** How many captures past the horizon the capture search follows (§5.2). */
export const QUIESCENCE_MAX_PLIES = 6;

/** Easy's seeded jitter: 0 to this many centipawns, uniform, added per move (§5.1). */
export const EASY_JITTER = 150;

/**
 * Beyond any material difference. A mate `p` plies from the root is worth
 * MATE_VALUE − p, so a faster mate outranks a slower one and a slower defeat
 * a faster one (§5.2).
 */
export const MATE_VALUE = 100_000;

/** What a draw is worth to either side (§5.2): level, whoever is ahead. */
const DRAW_VALUE = 0;

/** Deeper than any line the search can reach: main plies + capture plies + slack. */
const MAX_PLY = HARD_MAX_DEPTH + QUIESCENCE_MAX_PLIES + 8;

/** Any value at least this large is a forced mate, for one side or the other. */
const MATE_BOUND = MATE_VALUE - 2 * MAX_PLY;

// ---------------------------------------------------------------- evaluation

/** Material by kind, in centipawns (§5.2). Kings carry no material. */
export const PIECE_VALUES: readonly number[] = [0, 100, 320, 330, 500, 900, 0];

/**
 * Pawn advance by relative rank (the pawn's own side counts from 0). Ranks 0
 * and 7 never hold a pawn.
 */
const PAWN_ADVANCE: readonly number[] = [0, 0, 4, 8, 16, 32, 56, 0];
/** Extra for a d- or e-file pawn, by relative rank: off its home square and into the centre. */
const CENTRE_PAWN: readonly number[] = [0, -10, 4, 16, 12, 0, 0, 0];
/** A rook on the seventh rank (relative rank 6). */
const ROOK_SEVENTH = 20;
/** The king on its home rank before the endgame, by file: castled squares first. */
const KING_HOME: readonly number[] = [10, 20, 10, -5, -5, 0, 20, 10];
/** The king off its home rank before the endgame, per rank it has left. */
const KING_EXPOSED_PER_RANK = -20;

/** Phase weights (§5.2): 24 with every minor and major piece still on the board. */
const PHASE_WEIGHT: readonly number[] = [0, 0, 1, 1, 2, 4, 0];
const PHASE_MAX = 24;

/** The mop-up against a bare king (§5.2): push it to the edge, bring the king near. */
const MOP_UP_EDGE = 10;
const MOP_UP_NEAR = 4;

/** How close to the centre a file or rank is: 0 on the edge, 3 on d/e or 4/5. */
const centreness = (index: number): number => Math.min(index, 7 - index);

/**
 * PST[piece][square]: the positional part of a piece's value, from its own
 * side's point of view (§5.2). Built from the formulas in §5.2 rather than
 * typed in, so the document and the table cannot drift apart. Kings are not
 * here: their value depends on the phase.
 */
const PST: Int16Array[] = (() => {
  const tables: Int16Array[] = [];
  for (let piece = 0; piece < 16; piece++) tables.push(new Int16Array(BOARD_SIZE));
  for (const color of [WHITE, BLACK] as const) {
    const bit = color === BLACK ? BLACK_BIT : 0;
    for (let square = 0; square < BOARD_SIZE; square++) {
      const file = fileOf(square);
      const relRank = color === WHITE ? rankOf(square) : 7 - rankOf(square);
      const centre = centreness(file) + centreness(rankOf(square));
      tables[PAWN | bit]![square] =
        PAWN_ADVANCE[relRank]! + (file === 3 || file === 4 ? CENTRE_PAWN[relRank]! : 0);
      tables[KNIGHT | bit]![square] = 6 * centre - 18;
      tables[BISHOP | bit]![square] = 4 * centre - 12;
      tables[ROOK | bit]![square] = relRank === 6 ? ROOK_SEVENTH : 0;
      tables[QUEEN | bit]![square] = 2 * centre - 6;
    }
  }
  return tables;
})();

/** The king's middlegame and endgame values, by colour then square. */
const KING_MG: Int16Array[] = [new Int16Array(BOARD_SIZE), new Int16Array(BOARD_SIZE)];
const KING_EG: Int16Array[] = [new Int16Array(BOARD_SIZE), new Int16Array(BOARD_SIZE)];
for (const color of [WHITE, BLACK] as const) {
  for (let square = 0; square < BOARD_SIZE; square++) {
    const relRank = color === WHITE ? rankOf(square) : 7 - rankOf(square);
    KING_MG[color]![square] =
      relRank === 0 ? KING_HOME[fileOf(square)]! : KING_EXPOSED_PER_RANK * relRank;
    KING_EG[color]![square] = 8 * (centreness(fileOf(square)) + centreness(rankOf(square))) - 24;
  }
}

/** The positional value of `piece` on `square`, for tests and §5.2's examples. */
export function pieceSquareValue(piece: number, square: number): number {
  return PST[piece]![square]!;
}

/**
 * The static value of a position for the side to move, in centipawns (§5.2):
 * material and position for each side, the king's value blended between
 * middlegame and endgame by how much material is left, and the mop-up when
 * one side has nothing but its king. Integers only, so the value is the same
 * on every machine.
 */
export function evaluate(position: Position): number {
  const board = position.board;
  let white = 0;
  let black = 0;
  let phase = 0;
  let whiteMaterial = 0;
  let blackMaterial = 0;
  for (let square = 0; square < BOARD_SIZE; square++) {
    const piece = board[square]!;
    if (piece === EMPTY) continue;
    const kind = piece & 7;
    if (kind === KING) continue;
    const value = PIECE_VALUES[kind]! + PST[piece]![square]!;
    phase += PHASE_WEIGHT[kind]!;
    if (piece & BLACK_BIT) {
      black += value;
      blackMaterial += 1;
    } else {
      white += value;
      whiteMaterial += 1;
    }
  }
  if (phase > PHASE_MAX) phase = PHASE_MAX;
  const whiteKing = position.kings[WHITE]!;
  const blackKing = position.kings[BLACK]!;
  white += Math.trunc(
    (KING_MG[WHITE]![whiteKing]! * phase + KING_EG[WHITE]![whiteKing]! * (PHASE_MAX - phase)) /
      PHASE_MAX,
  );
  black += Math.trunc(
    (KING_MG[BLACK]![blackKing]! * phase + KING_EG[BLACK]![blackKing]! * (PHASE_MAX - phase)) /
      PHASE_MAX,
  );
  if (blackMaterial === 0 && whiteMaterial > 0) white += mopUp(blackKing, whiteKing);
  else if (whiteMaterial === 0 && blackMaterial > 0) black += mopUp(whiteKing, blackKing);
  const score = white - black;
  return position.side === WHITE ? score : -score;
}

/** Against a bare king: the further it is from the centre and the nearer the other king, the better. */
function mopUp(bareKing: number, king: number): number {
  const edge = 6 - centreness(fileOf(bareKing)) - centreness(rankOf(bareKing));
  const distance = Math.max(
    Math.abs(fileOf(bareKing) - fileOf(king)),
    Math.abs(rankOf(bareKing) - rankOf(king)),
  );
  return MOP_UP_EDGE * edge + MOP_UP_NEAR * (7 - distance);
}

// ---------------------------------------------------------------- search state

/** Thrown when the node budget runs out; the deepening loop catches it (§5.3). */
const OUT_OF_NODES = Symbol('out of nodes');

interface Search {
  /** The search's own copy; the caller's position is never touched. */
  readonly position: Position;
  readonly limit: number;
  nodes: number;
  /**
   * Position keys, the game's history first and the line being read after it:
   * keysHi/keysLo[top − 1] is the position at the current node.
   */
  readonly keysHi: Int32Array;
  readonly keysLo: Int32Array;
  keyTop: number;
  /** A move list per ply, reused. */
  readonly lists: Move[][];
  /** Ordering scores parallel to `lists`. */
  readonly scores: number[][];
  /** Two quiet moves per ply that last cut the search off there. */
  readonly killers: Int32Array;
}

function createSearch(position: Position, history: readonly HistoryEntry[], limit: number): Search {
  const size = history.length + MAX_PLY + 2;
  const keysHi = new Int32Array(size);
  const keysLo = new Int32Array(size);
  for (let i = 0; i < history.length; i++) {
    keysHi[i] = history[i]!.hashHi;
    keysLo[i] = history[i]!.hashLo;
  }
  return {
    position: clonePosition(position),
    limit,
    nodes: 0,
    keysHi,
    keysLo,
    keyTop: history.length,
    lists: Array.from({ length: MAX_PLY + 1 }, () => []),
    scores: Array.from({ length: MAX_PLY + 1 }, () => []),
    killers: new Int32Array((MAX_PLY + 1) * 2).fill(-1),
  };
}

/**
 * The key the repetition rule uses for the position now (§3.4): en passant
 * counts only when the capture is legal, exactly as the game's history keys
 * it, so a line the search reads can match a position the game has seen.
 */
function pushKey(state: Search): void {
  const position = state.position;
  let hi = position.hashHi;
  let lo = position.hashLo;
  if (position.epSquare >= 0) {
    const key = repetitionKey(position, hasLegalEnPassant(position));
    hi = key.hi;
    lo = key.lo;
  }
  state.keysHi[state.keyTop] = hi;
  state.keysLo[state.keyTop] = lo;
  state.keyTop += 1;
}

/**
 * Whether the position now is at least its third occurrence, counting the
 * game's history and the line read so far (§5.2) — the rule's count, by keys
 * alone (§3.4 lets the search skip the signature). Only positions since the
 * last pawn move or capture can match, and only every other one: the side to
 * move is part of the key.
 */
function isThirdOccurrence(state: Search): boolean {
  const window = state.position.halfmoveClock;
  if (window < 4) return false;
  const top = state.keyTop - 1;
  const hi = state.keysHi[top]!;
  const lo = state.keysLo[top]!;
  const stop = Math.max(0, top - window);
  let count = 1;
  for (let index = top - 2; index >= stop; index -= 2) {
    if (state.keysHi[index] === hi && state.keysLo[index] === lo) {
      count += 1;
      if (count >= REPETITION_DRAW_COUNT) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- ordering

const ORDER_CAPTURE = 100_000;
const ORDER_PROMOTION = 90_000;
const ORDER_KILLER = 80_000;

/**
 * Move ordering (§5.2): captures first, most valuable victim then least
 * valuable attacker (MVV-LVA), a promotion's piece breaking ties queen first;
 * then quiet promotions, queen first; then this ply's two killer moves; then
 * everything else in generation order. Only an order — it changes how much of
 * the tree is cut, never what a move is worth.
 */
function orderScore(state: Search, move: Move, ply: number): number {
  const board = state.position.board;
  const promotion = movePromotion(move);
  if (isCapture(move)) {
    const victim = moveFlags(move) & FLAG_EN_PASSANT ? PAWN : board[moveTo(move)]! & 7;
    const attacker = board[moveFrom(move)]! & 7;
    return ORDER_CAPTURE + victim * 100 + promotion * 10 - attacker;
  }
  if (promotion) return ORDER_PROMOTION + promotion;
  if (state.killers[ply * 2] === move) return ORDER_KILLER + 1;
  if (state.killers[ply * 2 + 1] === move) return ORDER_KILLER;
  return 0;
}

/**
 * Moves the best-ordered remaining move to `index` (selection, first maximum
 * wins — a stable order). Lazy, so a cut-off early in the list does not pay
 * for sorting the rest.
 */
function pickNext(moves: Move[], scores: number[], index: number): void {
  let best = index;
  for (let i = index + 1; i < moves.length; i++) if (scores[i]! > scores[best]!) best = i;
  if (best !== index) {
    const move = moves[best]!;
    const score = scores[best]!;
    for (let i = best; i > index; i--) {
      moves[i] = moves[i - 1]!;
      scores[i] = scores[i - 1]!;
    }
    moves[index] = move;
    scores[index] = score;
  }
}

function storeKiller(state: Search, move: Move, ply: number): void {
  if (state.killers[ply * 2] === move) return;
  state.killers[ply * 2 + 1] = state.killers[ply * 2]!;
  state.killers[ply * 2] = move;
}

// ---------------------------------------------------------------- search

function countNode(state: Search): void {
  // Checked before counting, so the counter never reads above the limit and
  // the bench can assert on it without an off-by-one to explain.
  if (state.nodes >= state.limit) throw OUT_OF_NODES;
  state.nodes += 1;
}

/**
 * The endings a position reached inside the search can be (§5.2), in the
 * rules' order where they can meet (§3): insufficient material (only after a
 * capture or a promotion, the only moves that change material), the third
 * occurrence, and the hundredth quiet ply — unless that ply mated. Returns
 * the value, or null when the game would go on. Mate and stalemate are found
 * by running out of legal moves, by the caller.
 */
function drawnOrMated(state: Search, ply: number): number | null {
  const position = state.position;
  if (position.halfmoveClock === 0) {
    return isInsufficientMaterial(position) ? DRAW_VALUE : null;
  }
  if (isThirdOccurrence(state)) return DRAW_VALUE;
  if (position.halfmoveClock >= FIFTY_MOVE_PLIES) {
    return inCheck(position) && !hasLegalMove(position) ? -(MATE_VALUE - ply) : DRAW_VALUE;
  }
  return null;
}

/**
 * Negamax with α–β over the real game tree (§5.2). `ply` counts from the
 * root; `depth` is what is left. At the horizon the capture search takes over.
 * Every call is one node.
 */
function search(state: Search, depth: number, ply: number, alpha: number, beta: number): number {
  if (depth <= 0) return quiesce(state, ply, alpha, beta, 0);
  countNode(state);
  const ending = drawnOrMated(state, ply);
  if (ending !== null) return ending;

  const position = state.position;
  const mover = position.side;
  const moves = state.lists[ply]!;
  const scores = state.scores[ply]!;
  moves.length = 0;
  generatePseudoLegalMoves(position, moves);
  scores.length = moves.length;
  for (let i = 0; i < moves.length; i++) scores[i] = orderScore(state, moves[i]!, ply);

  let legal = 0;
  let best = -Infinity;
  for (let i = 0; i < moves.length; i++) {
    pickNext(moves, scores, i);
    const move = moves[i]!;
    const undo = makeMove(position, move);
    if (isSquareAttacked(position, position.kings[mover]!, position.side)) {
      unmakeMove(position, move, undo);
      continue;
    }
    legal += 1;
    pushKey(state);
    const value = -search(state, depth - 1, ply + 1, -beta, -alpha);
    state.keyTop -= 1;
    unmakeMove(position, move, undo);
    if (value > best) {
      best = value;
      if (value > alpha) alpha = value;
      if (alpha >= beta) {
        if (!isCapture(move) && !movePromotion(move)) storeKiller(state, move, ply);
        break;
      }
    }
  }
  if (legal === 0) return inCheck(position) ? -(MATE_VALUE - ply) : DRAW_VALUE;
  return best;
}

/**
 * The capture search past the horizon (§5.2): captures only (capturing
 * promotions included), with the static value as the floor the side to move
 * may stand on — except in check, where standing still is not a move: there
 * every legal reply is read, and none means mate. `qply` counts the plies
 * since the horizon; at QUIESCENCE_MAX_PLIES the static value is returned.
 */
function quiesce(state: Search, ply: number, alpha: number, beta: number, qply: number): number {
  countNode(state);
  const ending = drawnOrMated(state, ply);
  if (ending !== null) return ending;

  const position = state.position;
  const checked = inCheck(position);
  if (qply >= QUIESCENCE_MAX_PLIES || ply >= MAX_PLY) return evaluate(position);

  let best = -Infinity;
  if (!checked) {
    const standPat = evaluate(position);
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;
    best = standPat;
  }

  const mover = position.side;
  const moves = state.lists[ply]!;
  const scores = state.scores[ply]!;
  moves.length = 0;
  generatePseudoLegalMoves(position, moves);
  if (!checked) {
    let kept = 0;
    for (let i = 0; i < moves.length; i++) {
      if (moveFlags(moves[i]!) & FLAG_CAPTURE) moves[kept++] = moves[i]!;
    }
    moves.length = kept;
  }
  scores.length = moves.length;
  for (let i = 0; i < moves.length; i++) scores[i] = orderScore(state, moves[i]!, ply);

  let legal = 0;
  for (let i = 0; i < moves.length; i++) {
    pickNext(moves, scores, i);
    const move = moves[i]!;
    const undo = makeMove(position, move);
    if (isSquareAttacked(position, position.kings[mover]!, position.side)) {
      unmakeMove(position, move, undo);
      continue;
    }
    legal += 1;
    pushKey(state);
    const value = -quiesce(state, ply + 1, -beta, -alpha, qply + 1);
    state.keyTop -= 1;
    unmakeMove(position, move, undo);
    if (value > best) {
      best = value;
      if (value > alpha) alpha = value;
      if (alpha >= beta) break;
    }
  }
  if (checked && legal === 0) return -(MATE_VALUE - ply);
  return best;
}

// ---------------------------------------------------------------- the root

/** One root move after the static pass (§5.1): what playing it leads to, at a glance. */
interface RootMove {
  readonly move: Move;
  /** The move mates at once. */
  readonly mates: boolean;
  /** From the CPU's side: 0 for a move that draws at once, else the static value after it. */
  readonly value: number;
}

/**
 * Plays each root move once and looks (§5.1): does it mate, does it end the
 * game in a draw (stalemate, insufficient material, third occurrence, the
 * hundredth quiet ply — the rules' own checks), and otherwise what the
 * position is worth statically. This is not counted as nodes — it is one
 * look per legal move (at most 218), the same for every difficulty.
 */
function rootPass(state: Search, order: readonly Move[]): RootMove[] {
  const position = state.position;
  const out: RootMove[] = [];
  for (const move of order) {
    const undo = makeMove(position, move);
    pushKey(state);
    let mates = false;
    let value: number;
    if (!hasLegalMove(position)) {
      mates = inCheck(position);
      value = mates ? MATE_VALUE - 1 : DRAW_VALUE;
    } else if (
      (position.halfmoveClock === 0 && isInsufficientMaterial(position)) ||
      isThirdOccurrence(state) ||
      position.halfmoveClock >= FIFTY_MOVE_PLIES
    ) {
      value = DRAW_VALUE;
    } else {
      value = -evaluate(position);
    }
    state.keyTop -= 1;
    unmakeMove(position, move, undo);
    out.push({ move, mates, value });
  }
  return out;
}

/**
 * One full iteration at `depth` over the root moves in `order` (§5.2). α is
 * raised at the root, and a move replaces the best only when strictly better,
 * so of equally good moves the one earlier in the order stays.
 */
function bestAtDepth(
  state: Search,
  order: readonly Move[],
  depth: number,
): { move: Move; value: number } {
  const position = state.position;
  let bestMove = order[0]!;
  let alpha = -Infinity;
  for (const move of order) {
    const undo = makeMove(position, move);
    pushKey(state);
    const value = -search(state, depth - 1, 1, -Infinity, -alpha);
    state.keyTop -= 1;
    unmakeMove(position, move, undo);
    if (value > alpha) {
      alpha = value;
      bestMove = move;
    }
  }
  return { move: bestMove, value: alpha };
}

export interface CpuMoveInput {
  /** The position the CPU moves in. Not changed — the search works on a copy. */
  readonly position: Position;
  /**
   * The game's positions so far with their repetition keys, the current one
   * last (`Game.history`, record.ts). Omitted, the position is read as if the
   * game had started there — a test fixture, never a real game.
   */
  readonly history?: readonly HistoryEntry[];
  readonly difficulty: Difficulty;
  /** The game's seed (§5.4). */
  readonly seed: string;
  /** Plies played so far: the second half of the seeded draw (§5.4). */
  readonly moveCount: number;
  /** Tests and measurement only: a different node budget. */
  readonly nodeLimit?: number;
  /** Tests only: a lower cap on the deepest iteration than the difficulty's own. */
  readonly maxDepth?: number;
}

export interface CpuDecision {
  readonly move: Move;
  /**
   * How it was found: a mate in one (every strength takes it), the only legal
   * move, easy's jittered look, or the search.
   */
  readonly kind: 'mate' | 'only' | 'easy' | 'search';
  /** Positions the search visited, summed over its iterations (§5.3). 0 unless `search`. */
  readonly nodes: number;
  /** The deepest iteration that finished; 0 when none did, or not `search`. */
  readonly completedDepth: number;
  /**
   * True when the node limit cut an iteration off — the move is the best of
   * the last depth that finished (or of the static look, when depth 1 did
   * not). False when the search ran to its own depth or found a forced mate.
   */
  readonly capped: boolean;
  /** The chosen move's value from the CPU's side, as the deciding step saw it (a draw is 0, never −0). */
  readonly value: number;
}

/**
 * What the last reply cost, in nodes. Exported so the bench can judge the
 * search by its work rather than a stopwatch (checkers/gomoku form).
 */
export const searchCost = { nodes: 0 };

/** A one-entry history for a position read without its game (tests). */
function standaloneHistory(position: Position): HistoryEntry[] {
  const key = repetitionKey(position, hasLegalEnPassant(position));
  return [{ hashHi: key.hi, hashLo: key.lo, signature: '' }];
}

/**
 * The CPU's decision for the side to move, with what it cost (§5). Null when
 * the side to move has no legal move — the game is over, and the session
 * never asks then.
 *
 * Steps, the same for every strength until the last: the legal moves are put
 * in a seeded order; a move that mates at once is played; a single legal move
 * is played; otherwise easy picks by a jittered one-ply look and normal and
 * hard search.
 */
export function decideCpuMove(input: CpuMoveInput): CpuDecision | null {
  const { position, difficulty, seed, moveCount } = input;
  const history = input.history ?? standaloneHistory(position);
  const limit = input.nodeLimit ?? HARD_NODE_LIMIT;
  const state = createSearch(position, history, limit);

  const legal: Move[] = [];
  {
    const pseudo = generatePseudoLegalMoves(state.position);
    const side = state.position.side;
    for (const move of pseudo) {
      const undo = makeMove(state.position, move);
      if (!isSquareAttacked(state.position, state.position.kings[side]!, state.position.side)) {
        legal.push(move);
      }
      unmakeMove(state.position, move, undo);
    }
  }
  searchCost.nodes = 0;
  if (legal.length === 0) return null;

  const rng = createRng(`${seed}:cpu:${moveCount}`);
  const order = shuffled(legal, rng);
  const root = rootPass(state, order);

  const mate = root.find((entry) => entry.mates);
  if (mate) {
    return {
      move: mate.move,
      kind: 'mate',
      nodes: 0,
      completedDepth: 0,
      capped: false,
      value: mate.value,
    };
  }
  if (root.length === 1) {
    const only = root[0]!;
    return {
      move: only.move,
      kind: 'only',
      nodes: 0,
      completedDepth: 0,
      capped: false,
      value: only.value + 0,
    };
  }

  if (difficulty === 'easy') {
    let best = root[0]!;
    let bestScore = -Infinity;
    for (const entry of root) {
      const score = entry.value + Math.floor(rng() * (EASY_JITTER + 1));
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    return {
      move: best.move,
      kind: 'easy',
      nodes: 0,
      completedDepth: 0,
      capped: false,
      value: best.value + 0,
    };
  }

  // The static look is depth 0: the answer if not even depth 1 finishes.
  // Its order (best static value first, the seeded order breaking ties) is
  // also the first iteration's root order.
  const sorted = root
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.value - a.entry.value || a.index - b.index)
    .map(({ entry }) => entry);
  let rootOrder = sorted.map((entry) => entry.move);
  let chosen = sorted[0]!.move;
  let chosenValue = sorted[0]!.value;
  let completedDepth = 0;
  let capped = false;

  const ownDepth = difficulty === 'normal' ? NORMAL_MAX_DEPTH : HARD_MAX_DEPTH;
  const maxDepth = Math.max(1, Math.min(ownDepth, input.maxDepth ?? ownDepth));
  for (let depth = 1; depth <= maxDepth; depth++) {
    let result: { move: Move; value: number };
    try {
      result = bestAtDepth(state, rootOrder, depth);
    } catch (error) {
      if (error !== OUT_OF_NODES) throw error;
      // The abandoned iteration is discarded whole (§5.3). The search board
      // is left mid-line; nothing reads it again.
      capped = true;
      break;
    }
    chosen = result.move;
    chosenValue = result.value;
    completedDepth = depth;
    // The best move so far is read first next time; the rest keep their order.
    rootOrder = [chosen, ...rootOrder.filter((move) => move !== chosen)];
    // A forced mate, either way, is as decided as it gets.
    if (Math.abs(result.value) >= MATE_BOUND) break;
  }
  searchCost.nodes = state.nodes;
  return {
    move: chosen,
    kind: 'search',
    nodes: state.nodes,
    completedDepth,
    capped,
    value: chosenValue + 0,
  };
}

/** The CPU's move, or null when there is none (see decideCpuMove). */
export function chooseCpuMove(input: CpuMoveInput): Move | null {
  return decideCpuMove(input)?.move ?? null;
}

/**
 * Tests only: the capture search's value of a position for the side to move,
 * read with a generous budget (§5.2), and how many nodes it took.
 */
export const __test = {
  quiescence(position: Position, nodeLimit = 1_000_000): { value: number; nodes: number } {
    const state = createSearch(position, standaloneHistory(position), nodeLimit);
    const value = quiesce(state, 0, -Infinity, Infinity, 0);
    return { value, nodes: state.nodes };
  },
};
