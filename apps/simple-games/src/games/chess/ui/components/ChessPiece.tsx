/**
 * The six pieces, drawn here as inline SVG (docs/CHESS_RULES.md §9): no
 * Unicode chess symbols — those are left to the device's fonts, and ♟ turns
 * into an emoji on iOS — and no outside piece set. Every outline below was
 * drawn for this game on a 40×40 grid.
 *
 * Colour is physical, not a role (§1): the white pieces are light, the black
 * ones dark, whoever plays them. The two colours are the game's own content
 * colours (`--ch-piece-*` in ui/chess.css, recorded in §9 and checked at 3:1
 * against both squares in ui/contrast.test.ts); each piece is a light or dark
 * fill inside an edge of the other, so its shape reads on either square.
 *
 * Decorative: the square's button carries the name a screen reader hears.
 */
import { memo } from 'react';
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK } from '../../game';

/** The pedestal every piece stands on. */
const BASE =
  'M11 35 H29 a1.5 1.5 0 0 0 1.5 -1.5 V32.5 a1.5 1.5 0 0 0 -1.5 -1.5 H11 a1.5 1.5 0 0 0 -1.5 1.5 V33.5 a1.5 1.5 0 0 0 1.5 1.5 Z';

function Shape({ kind }: { kind: number }) {
  switch (kind) {
    case PAWN:
      return (
        <>
          <path d="M14.5 31 C15 24 16.5 21 18 19.5 H22 C23.5 21 25 24 25.5 31 Z" />
          <path d="M15.5 17.5 H24.5 a1.5 1.5 0 0 1 0 3 H15.5 a1.5 1.5 0 0 1 0 -3 Z" />
          <circle cx="20" cy="12.5" r="5" />
        </>
      );
    case KNIGHT:
      return (
        <>
          <path d="M13 31 C13 25.5 16.5 22.5 18.5 19.5 C15.5 21 12 21.5 10 19.5 C8.8 18 9.5 16.2 12.5 13.8 C15 11.8 16.5 9 18.5 7.2 L19.5 4 L22 6.8 C28.5 8.6 30.5 16 29.5 31 Z" />
          <path className="ch-detail" d="M23 10.5 C25.8 15 26 22 25 28" />
          <circle className="ch-eye" cx="17" cy="11.8" r="1.2" />
        </>
      );
    case BISHOP:
      return (
        <>
          <path d="M14 31 C12.5 24.5 15 19 20 13 C25 19 27.5 24.5 26 31 Z" />
          <circle cx="20" cy="9.8" r="2.6" />
          <path className="ch-detail" d="M22.6 17.6 L18.6 22.6 M15.2 27.6 H24.8" />
        </>
      );
    case ROOK:
      return (
        <>
          <path d="M14.5 31 L15.5 16 H24.5 L25.5 31 Z" />
          <path d="M12 16 V8 H16 V11 H18 V8 H22 V11 H24 V8 H28 V16 Z" />
        </>
      );
    case QUEEN:
      return (
        <>
          <path d="M13 31 L9.5 15 L14.5 22 L15.5 12 L18.5 21 L20 10 L21.5 21 L24.5 12 L25.5 22 L30.5 15 L27 31 Z" />
          <circle cx="9.5" cy="13.4" r="1.8" />
          <circle cx="15.5" cy="10.4" r="1.8" />
          <circle cx="20" cy="8.2" r="1.8" />
          <circle cx="24.5" cy="10.4" r="1.8" />
          <circle cx="30.5" cy="13.4" r="1.8" />
          <path className="ch-detail" d="M14.4 27.6 H25.6" />
        </>
      );
    case KING:
    default:
      return (
        <>
          <path d="M13 31 C10.5 24 13.5 16.5 20 20.5 C26.5 16.5 29.5 24 27 31 Z" />
          <path d="M18.6 4 H21.4 V7.6 H25 V10.4 H21.4 V17.5 H18.6 V10.4 H15 V7.6 H18.6 Z" />
          <path className="ch-detail" d="M14.4 27.6 H25.6" />
        </>
      );
  }
}

export interface ChessPieceProps {
  /** PAWN … KING (game/types.ts). */
  kind: number;
  white: boolean;
  className?: string;
}

export const ChessPiece = memo(function ChessPiece({ kind, white, className }: ChessPieceProps) {
  return (
    <svg
      className={['ch-piece', white ? 'ch-piece-white' : 'ch-piece-black', className ?? '']
        .filter(Boolean)
        .join(' ')}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      data-kind={kind}
    >
      <Shape kind={kind} />
      <path d={BASE} />
    </svg>
  );
});

/** The six kinds in the order Quick Rules and the picker show them. */
export const PIECE_KINDS = [KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN] as const;
