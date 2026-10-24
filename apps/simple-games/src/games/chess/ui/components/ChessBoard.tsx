/**
 * The 8×8 board (docs/CHESS_RULES.md §1, §4, §9).
 *
 * Sixty-four fixed buttons. Tapping is two-stage: pick up one of your pieces,
 * then put it down on one of the squares that gets a mark — a small dot for a
 * quiet move, a ring round the edge for a capture (en passant included, whose
 * square is empty but whose move takes). Castling is the king's move two
 * squares over. That is the whole interaction: there is no drag (§4), and a
 * square is pressable only when it holds a piece that can move, is the piece
 * already held, or is a place the held piece may go. A pinned piece, or one
 * that cannot answer a check, is simply not pickable — nothing is refused, so
 * nothing has to scold.
 *
 * The board always has the player at the bottom: with Black it is drawn the
 * other way round (h1 top left). Only the drawing turns — the squares keep
 * their numbers (§1). Each square says its name, what stands on it and what
 * a tap would do (§9), and nothing translatable is drawn on the board.
 *
 * The movement is CSS only: the piece that just arrived is keyed by the ply
 * that put it there and slides in from where it came (for castling, the rook
 * too). Reduced Motion turns it off and the pieces are simply where they
 * landed (§9).
 */
import { memo, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  BISHOP,
  BLACK,
  BOARD_SIZE,
  EMPTY,
  FLAG_CASTLE,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  colorOf,
  fileOf,
  isLightSquare,
  kindOf,
  moveFlags,
  moveFrom,
  moveTo,
  rankOf,
  squareName,
  type Move,
  type Piece,
  type Target,
} from '../../game';
import type { LastMove } from '../../state/GameContext';
import { ChessPiece } from './ChessPiece';

/** Per square travelled, and a ceiling, so a long move does not drag (§9). */
const SLIDE_MS_PER_SQUARE = 60;
const SLIDE_MS_MAX = 240;

type KindName = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

function kindName(kind: number): KindName {
  switch (kind) {
    case PAWN:
      return 'pawn';
    case KNIGHT:
      return 'knight';
    case BISHOP:
      return 'bishop';
    case ROOK:
      return 'rook';
    case QUEEN:
      return 'queen';
    case KING:
    default:
      return 'king';
  }
}

/** The key that reads a piece out — colour and piece in one key (§10). */
export function pieceKey(piece: Piece): `chessPiece_${'white' | 'black'}_${KindName}` {
  return `chessPiece_${colorOf(piece) === BLACK ? 'black' : 'white'}_${kindName(kindOf(piece))}`;
}

/** Where a square is drawn: column and row from the player's top left. */
export function displayCell(square: number, flipped: boolean): { col: number; row: number } {
  return flipped
    ? { col: 7 - fileOf(square), row: rankOf(square) }
    : { col: fileOf(square), row: 7 - rankOf(square) };
}

/** The square drawn at display index `index` (row-major from the top left). */
export function squareAt(index: number, flipped: boolean): number {
  const row = Math.floor(index / 8);
  const col = index % 8;
  return flipped ? row * 8 + (7 - col) : (7 - row) * 8 + col;
}

/** The rook's own move inside a castling move (§2.7). */
function castlingRook(move: Move): { from: number; to: number } | null {
  if ((moveFlags(move) & FLAG_CASTLE) === 0) return null;
  const to = moveTo(move);
  const base = rankOf(to) * 8;
  return fileOf(to) === 6 ? { from: base + 7, to: base + 5 } : { from: base, to: base + 3 };
}

function slideStyle(from: number, to: number, flipped: boolean): CSSProperties {
  const a = displayCell(from, flipped);
  const b = displayCell(to, flipped);
  const squares = Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
  return {
    '--ch-move-x': `${(a.col - b.col) * 100}%`,
    '--ch-move-y': `${(a.row - b.row) * 100}%`,
    '--ch-move-ms': `${Math.min(SLIDE_MS_MAX, squares * SLIDE_MS_PER_SQUARE)}ms`,
  } as CSSProperties;
}

export interface ChessBoardProps {
  board: Int8Array;
  /** True when the player took Black: the board is drawn turned round (§1). */
  flipped: boolean;
  /** The square of the piece the player holds, or null (§4). */
  selected: number | null;
  /** Where the held piece may go — empty while nothing is held. */
  targets: readonly Target[];
  /** Which squares hold a piece the player can pick up now (§4). */
  selectable: readonly number[];
  /** The king's square when the side to move is in check, else -1 (§9). */
  checkSquare: number;
  /** False while it is not the player's turn: nothing is pressable. */
  playing: boolean;
  lastMove: LastMove | null;
  onSquare: (square: number) => void;
}

export const ChessBoard = memo(function ChessBoard({
  board,
  flipped,
  selected,
  targets,
  selectable,
  checkSquare,
  playing,
  lastMove,
  onSquare,
}: ChessBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();

  const targetAt = new Map(targets.map((target) => [target.to, target]));
  const selectableSet = new Set(selectable);
  const last = lastMove?.move ?? null;
  const lastFrom = last === null ? -1 : moveFrom(last);
  const lastTo = last === null ? -1 : moveTo(last);
  const rook = last === null ? null : castlingRook(last);

  return (
    <div
      className={`ch-board ${reducedMotion ? 'ch-board-still' : ''}`}
      role="group"
      aria-label={t('chessBoardLabel')}
    >
      {Array.from({ length: BOARD_SIZE }, (_, index) => {
        const square = squareAt(index, flipped);
        const piece = board[square]!;
        const name = squareName(square);
        const target = targetAt.get(square);
        const isSelected = selected === square;
        const pickable = selectableSet.has(square);
        const pieceName = piece === EMPTY ? '' : t(pieceKey(piece));

        const label = target
          ? target.capture
            ? piece === EMPTY
              ? t('chessSquareCaptureEnPassant', { square: name })
              : t('chessSquareCaptureHere', { square: name, piece: pieceName })
            : t('chessSquareMoveHere', { square: name })
          : piece === EMPTY
            ? t('chessSquareEmpty', { square: name })
            : isSelected
              ? t('chessSquareSelected', { square: name, piece: pieceName })
              : square === checkSquare
                ? t('chessSquareInCheck', { square: name, piece: pieceName })
                : t('chessSquarePiece', { square: name, piece: pieceName });

        const arrived = square === lastTo || (rook !== null && square === rook.to);
        const slideFrom = square === lastTo ? lastFrom : rook !== null ? rook.from : -1;

        return (
          <button
            key={square}
            type="button"
            className={`ch-square ${isLightSquare(square) ? 'ch-square-light' : 'ch-square-dark'}`}
            data-square={name}
            data-selected={isSelected ? '' : undefined}
            data-target={target ? (target.capture ? 'capture' : 'move') : undefined}
            data-last={square === lastFrom || square === lastTo ? '' : undefined}
            aria-label={label}
            aria-pressed={pickable || isSelected ? isSelected : undefined}
            disabled={!playing || (!target && !pickable && !isSelected)}
            onClick={() => onSquare(square)}
          >
            {piece !== EMPTY ? (
              <span
                // Keyed by the ply that put it here, so a piece animates on
                // arrival and never again.
                key={arrived && lastMove ? lastMove.plies : -1}
                className={`ch-piece-slot ${arrived ? 'ch-piece-move' : ''}`}
                style={arrived ? slideStyle(slideFrom, square, flipped) : undefined}
              >
                <ChessPiece kind={kindOf(piece)} white={colorOf(piece) !== BLACK} />
              </span>
            ) : null}
            {square === checkSquare ? <span className="ch-check-ring" aria-hidden="true" /> : null}
            {target ? (
              <span
                className={target.capture ? 'ch-mark-capture' : 'ch-mark-move'}
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
