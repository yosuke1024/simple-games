/**
 * A game as it is played: the position, the moves that led to it, and the
 * history the repetition rule reads (docs/CHESS_RULES.md §3, §6, §7).
 *
 * The move list is the whole record. Replaying it from the starting position
 * rebuilds everything else, which is why a save is just that list (§7.1) and
 * why a resumed game can still be taken back to its first move (§6).
 *
 * A `Game` is mutable: `playMove` and `undoMove` change it in place, so a
 * replay of thousands of plies costs one make per ply rather than a copy of
 * the whole history per ply. Callers that need a value to hand to React copy
 * what they show.
 */
import {
  generateLegalMoves,
  initialPosition,
  makeMove,
  positionSignature,
  repetitionKey,
  unmakeMove,
  type Position,
  type Undo,
} from './engine';
import { countRepetitions, outcomeAfterMove, type HistoryEntry } from './rules';
import {
  FLAG_EN_PASSANT,
  moveFlags,
  moveFrom,
  movePromotion,
  moveTo,
  type Move,
  type Outcome,
} from './types';

export interface Game {
  readonly position: Position;
  /** Every move played, in order. */
  readonly moves: Move[];
  /** One entry per move, for `undoMove`. */
  readonly undos: Undo[];
  /** One entry per position, the start included: history[0] is the opening position. */
  readonly history: HistoryEntry[];
  /** The legal moves now, or [] once the game is over. */
  legal: Move[];
  outcome: Outcome | null;
}

const hasEnPassant = (legal: readonly Move[]): boolean =>
  legal.some((move) => (moveFlags(move) & FLAG_EN_PASSANT) !== 0);

function historyEntry(position: Position, legal: readonly Move[]): HistoryEntry {
  const enPassant = hasEnPassant(legal);
  const { hi, lo } = repetitionKey(position, enPassant);
  return { hashHi: hi, hashLo: lo, signature: positionSignature(position, enPassant) };
}

/** A new game from the standard position (§1). */
export function createGame(): Game {
  const position = initialPosition();
  const legal = generateLegalMoves(position);
  return {
    position,
    moves: [],
    undos: [],
    history: [historyEntry(position, legal)],
    legal,
    outcome: null,
  };
}

/** The legal move from `from` to `to` (with `promotion` for a promotion), or null. */
export function findMove(game: Game, from: number, to: number, promotion = 0): Move | null {
  for (const move of game.legal) {
    if (moveFrom(move) === from && moveTo(move) === to && movePromotion(move) === promotion) {
      return move;
    }
  }
  return null;
}

/**
 * Plays `move` if it is legal now and the game is not over; returns whether
 * it was played. The outcome is judged on the position it leaves (§3).
 */
export function playMove(game: Game, move: Move): boolean {
  if (game.outcome !== null || !game.legal.includes(move)) return false;
  const undo = makeMove(game.position, move);
  game.moves.push(move);
  game.undos.push(undo);
  const legal = generateLegalMoves(game.position);
  game.history.push(historyEntry(game.position, legal));
  const repetitions = countRepetitions(game.history, game.position.halfmoveClock);
  game.outcome = outcomeAfterMove(game.position, legal.length > 0, repetitions);
  game.legal = game.outcome === null ? legal : [];
  return true;
}

/** Takes back the last move, ended game or not; returns false at the start. */
export function undoMove(game: Game): boolean {
  const move = game.moves.pop();
  const undo = game.undos.pop();
  if (move === undefined || undo === undefined) return false;
  unmakeMove(game.position, move, undo);
  game.history.pop();
  game.outcome = null;
  game.legal = generateLegalMoves(game.position);
  return true;
}
