/**
 * The rules of chess, once (docs/CHESS_RULES.md §2): a position, the moves
 * the laws allow in it, and making and unmaking them in place.
 *
 * There is one rule set and no fast copy for the search (§5). Legality is
 * decided the plain way — play the move, look whether the mover's king stands
 * attacked, take it back — instead of reasoning about pins and check kinds,
 * so a rare shape such as the en passant capture that opens the king's rank
 * cannot be miscounted by a special case nobody wrote (§2.8). Perft against
 * the published counts is the gate on all of it (§12).
 *
 * Positions are mutable and updated in place by `makeMove` / `unmakeMove`;
 * the board is never rebuilt per move (Reversi §5). The Zobrist key is two
 * 32-bit words because BigInt literals cannot be lowered to the es2018 build
 * target (§3.4), and it leaves en passant out: whether an en passant capture
 * is available is a property of the legal move list, which the caller adds
 * with `repetitionKey` (§3.4).
 */
import { createRng } from './rng';
import {
  BISHOP,
  BLACK,
  BLACK_BIT,
  BOARD_SIZE,
  CASTLE_ALL,
  CASTLE_BLACK_KING,
  CASTLE_BLACK_QUEEN,
  CASTLE_WHITE_KING,
  CASTLE_WHITE_QUEEN,
  EMPTY,
  FLAG_CAPTURE,
  FLAG_CASTLE,
  FLAG_DOUBLE_PUSH,
  FLAG_EN_PASSANT,
  KING,
  KNIGHT,
  PAWN,
  PROMOTION_KINDS,
  QUEEN,
  ROOK,
  WHITE,
  encodeMove,
  fileOf,
  kindOf,
  makePiece,
  moveFlags,
  moveFrom,
  movePromotion,
  moveTo,
  opponentOf,
  rankOf,
  type Color,
  type Move,
  type Piece,
} from './types';

export interface Position {
  /** 64 squares, a1 = 0 (types.ts). */
  readonly board: Int8Array;
  side: Color;
  /** CASTLE_* bits still held (§2.7). */
  castling: number;
  /** The square a pawn just passed over on a double step, or -1 (§2.5). */
  epSquare: number;
  /** Plies since the last pawn move or capture (§3.5). */
  halfmoveClock: number;
  /** Plies played since the position the game started from. */
  ply: number;
  /** Each side's king square, by colour. */
  readonly kings: Int8Array;
  /** Zobrist key without en passant (see the file comment). */
  hashHi: number;
  hashLo: number;
}

/** What `unmakeMove` needs and the board cannot tell it afterwards. */
export interface Undo {
  readonly captured: Piece;
  readonly castling: number;
  readonly epSquare: number;
  readonly halfmoveClock: number;
  readonly hashHi: number;
  readonly hashLo: number;
}

// ---------------------------------------------------------------- tables

const KNIGHT_DELTAS: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const KING_DELTAS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];
/** Rook directions first (0–3), then bishop directions (4–7). */
const RAY_DELTAS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

function stepTargets(deltas: readonly (readonly [number, number])[]): number[][] {
  const out: number[][] = [];
  for (let square = 0; square < BOARD_SIZE; square++) {
    const list: number[] = [];
    for (const [df, dr] of deltas) {
      const file = fileOf(square) + df;
      const rank = rankOf(square) + dr;
      if (file >= 0 && file < 8 && rank >= 0 && rank < 8) list.push(rank * 8 + file);
    }
    out.push(list);
  }
  return out;
}

const KNIGHT_TARGETS = stepTargets(KNIGHT_DELTAS);
const KING_TARGETS = stepTargets(KING_DELTAS);

/** RAYS[direction][square]: the squares outward from `square`, nearest first. */
const RAYS: number[][][] = RAY_DELTAS.map(([df, dr]) => {
  const perSquare: number[][] = [];
  for (let square = 0; square < BOARD_SIZE; square++) {
    const ray: number[] = [];
    let file = fileOf(square) + df;
    let rank = rankOf(square) + dr;
    while (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
      ray.push(rank * 8 + file);
      file += df;
      rank += dr;
    }
    perSquare.push(ray);
  }
  return perSquare;
});

/**
 * PAWN_ATTACKS[color][square]: the squares a pawn of `color` on `square`
 * attacks. A pawn of `by` attacks `target` exactly when `target`'s
 * PAWN_ATTACKS for the other colour holds the pawn's square.
 */
const PAWN_ATTACKS: number[][][] = [WHITE, BLACK].map((color) => {
  const forward = color === WHITE ? 1 : -1;
  const perSquare: number[][] = [];
  for (let square = 0; square < BOARD_SIZE; square++) {
    const list: number[] = [];
    const rank = rankOf(square) + forward;
    if (rank >= 0 && rank < 8) {
      if (fileOf(square) > 0) list.push(rank * 8 + fileOf(square) - 1);
      if (fileOf(square) < 7) list.push(rank * 8 + fileOf(square) + 1);
    }
    perSquare.push(list);
  }
  return perSquare;
});

/**
 * Rights lost when a move touches a square (§2.7): the king's home loses both
 * of its side's rights, a rook's corner its own one — whether the piece moves
 * away or is captured there. `castling &= MASK[from] & MASK[to]`.
 */
const CASTLE_MASK: Int8Array = (() => {
  const mask = new Int8Array(BOARD_SIZE).fill(CASTLE_ALL);
  mask[4] = CASTLE_ALL & ~(CASTLE_WHITE_KING | CASTLE_WHITE_QUEEN); // e1
  mask[0] = CASTLE_ALL & ~CASTLE_WHITE_QUEEN; // a1
  mask[7] = CASTLE_ALL & ~CASTLE_WHITE_KING; // h1
  mask[60] = CASTLE_ALL & ~(CASTLE_BLACK_KING | CASTLE_BLACK_QUEEN); // e8
  mask[56] = CASTLE_ALL & ~CASTLE_BLACK_QUEEN; // a8
  mask[63] = CASTLE_ALL & ~CASTLE_BLACK_KING; // h8
  return mask;
})();

// ---------------------------------------------------------------- Zobrist

/**
 * Fixed keys from a fixed seed, so a position's key is the same in every
 * session and every build. Two 32-bit words per key (no BigInt — §3.4).
 */
const ZOBRIST = (() => {
  const rng = createRng('chess:zobrist:v1');
  const word = () => Math.floor(rng() * 4294967296) | 0;
  const pieceHi = new Int32Array(16 * BOARD_SIZE);
  const pieceLo = new Int32Array(16 * BOARD_SIZE);
  for (let i = 0; i < pieceHi.length; i++) {
    pieceHi[i] = word();
    pieceLo[i] = word();
  }
  const castleHi = new Int32Array(16);
  const castleLo = new Int32Array(16);
  for (let i = 0; i < 16; i++) {
    castleHi[i] = word();
    castleLo[i] = word();
  }
  const epHi = new Int32Array(8);
  const epLo = new Int32Array(8);
  for (let i = 0; i < 8; i++) {
    epHi[i] = word();
    epLo[i] = word();
  }
  return { pieceHi, pieceLo, castleHi, castleLo, epHi, epLo, sideHi: word(), sideLo: word() };
})();

/** Recomputes the key from scratch; `makeMove` keeps it incrementally. */
export function computeHash(position: Position): { hi: number; lo: number } {
  let hi = 0;
  let lo = 0;
  for (let square = 0; square < BOARD_SIZE; square++) {
    const piece = position.board[square]!;
    if (piece === EMPTY) continue;
    hi ^= ZOBRIST.pieceHi[piece * BOARD_SIZE + square]!;
    lo ^= ZOBRIST.pieceLo[piece * BOARD_SIZE + square]!;
  }
  hi ^= ZOBRIST.castleHi[position.castling]!;
  lo ^= ZOBRIST.castleLo[position.castling]!;
  if (position.side === BLACK) {
    hi ^= ZOBRIST.sideHi;
    lo ^= ZOBRIST.sideLo;
  }
  return { hi, lo };
}

/**
 * The key a repetition is looked up by (§3.4): the position's key plus the
 * en passant file when — and only when — an en passant capture is legal.
 */
export function repetitionKey(
  position: Position,
  enPassantLegal: boolean,
): { hi: number; lo: number } {
  if (!enPassantLegal || position.epSquare < 0) return { hi: position.hashHi, lo: position.hashLo };
  const file = fileOf(position.epSquare);
  return {
    hi: position.hashHi ^ ZOBRIST.epHi[file]!,
    lo: position.hashLo ^ ZOBRIST.epLo[file]!,
  };
}

/**
 * The position itself as text, for confirming a key match (§3.4): every
 * square, the side to move, the castling rights and the en passant file when
 * the capture is legal. Two positions are "the same" for the repetition rule
 * exactly when their signatures are equal.
 */
export function positionSignature(position: Position, enPassantLegal: boolean): string {
  let text = '';
  for (let square = 0; square < BOARD_SIZE; square++) {
    text += String.fromCharCode(97 + position.board[square]!);
  }
  text += position.side === WHITE ? 'w' : 'b';
  text += position.castling.toString(16);
  text += enPassantLegal && position.epSquare >= 0 ? String(fileOf(position.epSquare)) : '-';
  return text;
}

// ---------------------------------------------------------------- positions

/** The empty shell `fen.ts` and `initialPosition` fill. */
export function emptyPosition(): Position {
  return {
    board: new Int8Array(BOARD_SIZE),
    side: WHITE,
    castling: 0,
    epSquare: -1,
    halfmoveClock: 0,
    ply: 0,
    kings: new Int8Array([-1, -1]),
    hashHi: 0,
    hashLo: 0,
  };
}

const BACK_RANK: readonly number[] = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];

/** The standard starting position — the only one a game starts from (§1). */
export function initialPosition(): Position {
  const position = emptyPosition();
  for (let file = 0; file < 8; file++) {
    position.board[file] = BACK_RANK[file]!;
    position.board[8 + file] = PAWN;
    position.board[48 + file] = PAWN | BLACK_BIT;
    position.board[56 + file] = BACK_RANK[file]! | BLACK_BIT;
  }
  position.castling = CASTLE_ALL;
  position.kings[WHITE] = 4;
  position.kings[BLACK] = 60;
  const { hi, lo } = computeHash(position);
  position.hashHi = hi;
  position.hashLo = lo;
  return position;
}

export function clonePosition(position: Position): Position {
  return {
    board: new Int8Array(position.board),
    side: position.side,
    castling: position.castling,
    epSquare: position.epSquare,
    halfmoveClock: position.halfmoveClock,
    ply: position.ply,
    kings: new Int8Array(position.kings),
    hashHi: position.hashHi,
    hashLo: position.hashLo,
  };
}

// ---------------------------------------------------------------- attacks

/** Whether any piece of `by` attacks `square` (pins do not matter here). */
export function isSquareAttacked(position: Position, square: number, by: Color): boolean {
  const board = position.board;
  const bit = by === BLACK ? BLACK_BIT : 0;

  const pawnFrom = PAWN_ATTACKS[by === WHITE ? BLACK : WHITE]![square]!;
  for (let i = 0; i < pawnFrom.length; i++) {
    if (board[pawnFrom[i]!] === (PAWN | bit)) return true;
  }
  const knights = KNIGHT_TARGETS[square]!;
  for (let i = 0; i < knights.length; i++) {
    if (board[knights[i]!] === (KNIGHT | bit)) return true;
  }
  const kings = KING_TARGETS[square]!;
  for (let i = 0; i < kings.length; i++) {
    if (board[kings[i]!] === (KING | bit)) return true;
  }
  for (let direction = 0; direction < 8; direction++) {
    const ray = RAYS[direction]![square]!;
    const straight = direction < 4;
    for (let i = 0; i < ray.length; i++) {
      const piece = board[ray[i]!]!;
      if (piece === EMPTY) continue;
      if ((piece & BLACK_BIT) === bit) {
        const kind = piece & 7;
        if (kind === QUEEN || kind === (straight ? ROOK : BISHOP)) return true;
      }
      break;
    }
  }
  return false;
}

/** Whether `color`'s king stands attacked. */
export function inCheck(position: Position, color: Color = position.side): boolean {
  return isSquareAttacked(position, position.kings[color]!, opponentOf(color));
}

// ---------------------------------------------------------------- generation

function pushPawnMove(out: Move[], from: number, to: number, flags: number, promotes: boolean) {
  if (promotes) {
    for (const kind of PROMOTION_KINDS) out.push(encodeMove(from, to, kind, flags));
  } else {
    out.push(encodeMove(from, to, 0, flags));
  }
}

/**
 * Every move the pieces' movement allows, before the check of whether it
 * leaves the mover's king attacked (§2.8). Castling is already filtered for
 * its own conditions here (rights, empty squares, not out of or through
 * check); its landing square is the ordinary legality check.
 */
export function generatePseudoLegalMoves(position: Position, out: Move[] = []): Move[] {
  const board = position.board;
  const side = position.side;
  const bit = side === BLACK ? BLACK_BIT : 0;
  const enemy = opponentOf(side);
  const forward = side === WHITE ? 8 : -8;
  const startRank = side === WHITE ? 1 : 6;
  const lastRank = side === WHITE ? 7 : 0;

  for (let from = 0; from < BOARD_SIZE; from++) {
    const piece = board[from]!;
    if (piece === EMPTY || (piece & BLACK_BIT) !== bit) continue;
    const kind = piece & 7;

    if (kind === PAWN) {
      const one = from + forward;
      if (board[one] === EMPTY) {
        pushPawnMove(out, from, one, 0, rankOf(one) === lastRank);
        const two = one + forward;
        if (rankOf(from) === startRank && board[two] === EMPTY) {
          out.push(encodeMove(from, two, 0, FLAG_DOUBLE_PUSH));
        }
      }
      const targets = PAWN_ATTACKS[side]![from]!;
      for (let i = 0; i < targets.length; i++) {
        const to = targets[i]!;
        const target = board[to]!;
        if (target !== EMPTY && (target & BLACK_BIT) !== bit) {
          pushPawnMove(out, from, to, FLAG_CAPTURE, rankOf(to) === lastRank);
        } else if (to === position.epSquare) {
          out.push(encodeMove(from, to, 0, FLAG_CAPTURE | FLAG_EN_PASSANT));
        }
      }
      continue;
    }

    if (kind === KNIGHT || kind === KING) {
      const targets = (kind === KNIGHT ? KNIGHT_TARGETS : KING_TARGETS)[from]!;
      for (let i = 0; i < targets.length; i++) {
        const to = targets[i]!;
        const target = board[to]!;
        if (target === EMPTY) out.push(encodeMove(from, to));
        else if ((target & BLACK_BIT) !== bit) out.push(encodeMove(from, to, 0, FLAG_CAPTURE));
      }
      if (kind === KING) generateCastling(position, from, enemy, out);
      continue;
    }

    const first = kind === BISHOP ? 4 : 0;
    const last = kind === ROOK ? 4 : 8;
    for (let direction = first; direction < last; direction++) {
      const ray = RAYS[direction]![from]!;
      for (let i = 0; i < ray.length; i++) {
        const to = ray[i]!;
        const target = board[to]!;
        if (target === EMPTY) {
          out.push(encodeMove(from, to));
          continue;
        }
        if ((target & BLACK_BIT) !== bit) out.push(encodeMove(from, to, 0, FLAG_CAPTURE));
        break;
      }
    }
  }
  return out;
}

/** The castling conditions of §2.7, except the landing square's safety. */
function generateCastling(position: Position, from: number, enemy: Color, out: Move[]) {
  const side = position.side;
  const home = side === WHITE ? 4 : 60;
  if (from !== home) return;
  const kingRight = side === WHITE ? CASTLE_WHITE_KING : CASTLE_BLACK_KING;
  const queenRight = side === WHITE ? CASTLE_WHITE_QUEEN : CASTLE_BLACK_QUEEN;
  if ((position.castling & (kingRight | queenRight)) === 0) return;
  const board = position.board;
  const rook = makePiece(side, ROOK);
  if (isSquareAttacked(position, home, enemy)) return; // not out of check

  if (
    position.castling & kingRight &&
    board[home + 3] === rook &&
    board[home + 1] === EMPTY &&
    board[home + 2] === EMPTY &&
    !isSquareAttacked(position, home + 1, enemy) // not through check
  ) {
    out.push(encodeMove(home, home + 2, 0, FLAG_CASTLE));
  }
  if (
    position.castling & queenRight &&
    board[home - 4] === rook &&
    board[home - 1] === EMPTY &&
    board[home - 2] === EMPTY &&
    board[home - 3] === EMPTY && // b-file: must be empty, may be attacked
    !isSquareAttacked(position, home - 1, enemy)
  ) {
    out.push(encodeMove(home, home - 2, 0, FLAG_CASTLE));
  }
}

/**
 * The legal moves (§2): the pseudo-legal ones that do not leave the mover's
 * king attacked. Promotions come as four moves each, queen first.
 */
export function generateLegalMoves(position: Position, out: Move[] = []): Move[] {
  const pseudo = generatePseudoLegalMoves(position);
  const side = position.side;
  for (let i = 0; i < pseudo.length; i++) {
    const move = pseudo[i]!;
    const undo = makeMove(position, move);
    if (!isSquareAttacked(position, position.kings[side]!, position.side)) out.push(move);
    unmakeMove(position, move, undo);
  }
  return out;
}

/** Whether the side to move has at least one legal move (stops at the first). */
export function hasLegalMove(position: Position): boolean {
  const pseudo = generatePseudoLegalMoves(position);
  const side = position.side;
  for (let i = 0; i < pseudo.length; i++) {
    const move = pseudo[i]!;
    const undo = makeMove(position, move);
    const legal = !isSquareAttacked(position, position.kings[side]!, position.side);
    unmakeMove(position, move, undo);
    if (legal) return true;
  }
  return false;
}

// ---------------------------------------------------------------- make / unmake

function xorPiece(position: Position, piece: Piece, square: number) {
  position.hashHi ^= ZOBRIST.pieceHi[piece * BOARD_SIZE + square]!;
  position.hashLo ^= ZOBRIST.pieceLo[piece * BOARD_SIZE + square]!;
}

/**
 * Plays `move` on `position` in place and returns what `unmakeMove` needs.
 * The move must have come from this position's generator; nothing here
 * re-checks legality.
 */
export function makeMove(position: Position, move: Move): Undo {
  const board = position.board;
  const from = moveFrom(move);
  const to = moveTo(move);
  const flags = moveFlags(move);
  const piece = board[from]!;
  const side = position.side;

  let captured: Piece = board[to]!;
  const undo: Undo = {
    captured: flags & FLAG_EN_PASSANT ? makePiece(opponentOf(side), PAWN) : captured,
    castling: position.castling,
    epSquare: position.epSquare,
    halfmoveClock: position.halfmoveClock,
    hashHi: position.hashHi,
    hashLo: position.hashLo,
  };

  xorPiece(position, piece, from);
  board[from] = EMPTY;

  if (flags & FLAG_EN_PASSANT) {
    const victim = side === WHITE ? to - 8 : to + 8;
    captured = board[victim]!;
    xorPiece(position, captured, victim);
    board[victim] = EMPTY;
  } else if (captured !== EMPTY) {
    xorPiece(position, captured, to);
  }

  const promotion = movePromotion(move);
  const placed = promotion ? makePiece(side, promotion as 2 | 3 | 4 | 5) : piece;
  board[to] = placed;
  xorPiece(position, placed, to);

  if (flags & FLAG_CASTLE) {
    const kingSide = to > from;
    const rookFrom = kingSide ? from + 3 : from - 4;
    const rookTo = kingSide ? from + 1 : from - 1;
    const rook = board[rookFrom]!;
    xorPiece(position, rook, rookFrom);
    board[rookFrom] = EMPTY;
    board[rookTo] = rook;
    xorPiece(position, rook, rookTo);
  }

  if (kindOf(piece) === KING) position.kings[side] = to;

  const castling = position.castling & CASTLE_MASK[from]! & CASTLE_MASK[to]!;
  if (castling !== position.castling) {
    position.hashHi ^= ZOBRIST.castleHi[position.castling]! ^ ZOBRIST.castleHi[castling]!;
    position.hashLo ^= ZOBRIST.castleLo[position.castling]! ^ ZOBRIST.castleLo[castling]!;
    position.castling = castling;
  }

  position.epSquare = flags & FLAG_DOUBLE_PUSH ? (from + to) >> 1 : -1;
  position.halfmoveClock =
    kindOf(piece) === PAWN || flags & FLAG_CAPTURE ? 0 : position.halfmoveClock + 1;
  position.side = opponentOf(side);
  position.hashHi ^= ZOBRIST.sideHi;
  position.hashLo ^= ZOBRIST.sideLo;
  position.ply += 1;
  return undo;
}

/** Takes back `move`, which must be the last move `makeMove` played. */
export function unmakeMove(position: Position, move: Move, undo: Undo): void {
  const board = position.board;
  const from = moveFrom(move);
  const to = moveTo(move);
  const flags = moveFlags(move);
  const side = opponentOf(position.side);
  const moved = movePromotion(move) ? makePiece(side, PAWN) : board[to]!;

  board[from] = moved;
  if (flags & FLAG_EN_PASSANT) {
    board[to] = EMPTY;
    board[side === WHITE ? to - 8 : to + 8] = undo.captured;
  } else {
    board[to] = undo.captured;
  }

  if (flags & FLAG_CASTLE) {
    const kingSide = to > from;
    const rookFrom = kingSide ? from + 3 : from - 4;
    const rookTo = kingSide ? from + 1 : from - 1;
    board[rookFrom] = board[rookTo]!;
    board[rookTo] = EMPTY;
  }

  if (kindOf(moved) === KING) position.kings[side] = from;

  position.side = side;
  position.castling = undo.castling;
  position.epSquare = undo.epSquare;
  position.halfmoveClock = undo.halfmoveClock;
  position.hashHi = undo.hashHi;
  position.hashLo = undo.hashLo;
  position.ply -= 1;
}

/** Whether the side to move could legally capture en passant right now (§3.4). */
export function hasLegalEnPassant(position: Position): boolean {
  if (position.epSquare < 0) return false;
  const pseudo = generatePseudoLegalMoves(position);
  const side = position.side;
  for (let i = 0; i < pseudo.length; i++) {
    const move = pseudo[i]!;
    if ((moveFlags(move) & FLAG_EN_PASSANT) === 0) continue;
    const undo = makeMove(position, move);
    const legal = !isSquareAttacked(position, position.kings[side]!, position.side);
    unmakeMove(position, move, undo);
    if (legal) return true;
  }
  return false;
}
