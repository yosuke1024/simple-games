/**
 * Forsyth–Edwards Notation, for tests and the published perft positions
 * (docs/CHESS_RULES.md §12). A game never starts from FEN and the save format
 * does not use it (§1, §7.1): games start from the standard position and are
 * stored as their move list.
 *
 * The parser checks shape (eight ranks of eight, known letters, one king a
 * side, sensible fields) and nothing deeper; a test position is trusted to be
 * reachable.
 */
import { computeHash, emptyPosition, type Position } from './engine';
import {
  BISHOP,
  BLACK,
  BLACK_BIT,
  CASTLE_BLACK_KING,
  CASTLE_BLACK_QUEEN,
  CASTLE_WHITE_KING,
  CASTLE_WHITE_QUEEN,
  EMPTY,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  kindOf,
  parseSquare,
  squareName,
} from './types';

const LETTERS: Record<string, number> = {
  p: PAWN,
  n: KNIGHT,
  b: BISHOP,
  r: ROOK,
  q: QUEEN,
  k: KING,
};
const KIND_LETTERS = ' pnbrqk';

export function parseFen(fen: string): Position | null {
  const fields = fen.trim().split(/\s+/);
  if (fields.length < 4 || fields.length > 6) return null;
  const [placement, sideText, castlingText, epText, clockText = '0', moveText = '1'] = fields as [
    string,
    string,
    string,
    string,
    string?,
    string?,
  ];
  const position = emptyPosition();

  const ranks = placement.split('/');
  if (ranks.length !== 8) return null;
  for (let row = 0; row < 8; row++) {
    const rank = 7 - row;
    let file = 0;
    for (const character of ranks[row]!) {
      if (character >= '1' && character <= '8') {
        file += Number(character);
        continue;
      }
      const kind = LETTERS[character.toLowerCase()];
      if (kind === undefined || file > 7) return null;
      const black = character === character.toLowerCase();
      position.board[rank * 8 + file] = black ? kind | BLACK_BIT : kind;
      if (kind === KING) {
        const color = black ? BLACK : WHITE;
        if (position.kings[color] !== -1) return null;
        position.kings[color] = rank * 8 + file;
      }
      file += 1;
    }
    if (file !== 8) return null;
  }
  if (position.kings[WHITE] === -1 || position.kings[BLACK] === -1) return null;

  if (sideText !== 'w' && sideText !== 'b') return null;
  position.side = sideText === 'w' ? WHITE : BLACK;

  if (castlingText !== '-') {
    for (const character of castlingText) {
      if (character === 'K') position.castling |= CASTLE_WHITE_KING;
      else if (character === 'Q') position.castling |= CASTLE_WHITE_QUEEN;
      else if (character === 'k') position.castling |= CASTLE_BLACK_KING;
      else if (character === 'q') position.castling |= CASTLE_BLACK_QUEEN;
      else return null;
    }
  }

  if (epText !== '-') {
    const square = parseSquare(epText);
    if (square < 0) return null;
    position.epSquare = square;
  }

  const clock = Number(clockText);
  const moveNumber = Number(moveText);
  if (!Number.isInteger(clock) || clock < 0 || !Number.isInteger(moveNumber) || moveNumber < 1) {
    return null;
  }
  position.halfmoveClock = clock;
  position.ply = (moveNumber - 1) * 2 + (position.side === BLACK ? 1 : 0);

  const { hi, lo } = computeHash(position);
  position.hashHi = hi;
  position.hashLo = lo;
  return position;
}

export function toFen(position: Position): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let gap = 0;
    for (let file = 0; file < 8; file++) {
      const piece = position.board[rank * 8 + file]!;
      if (piece === EMPTY) {
        gap += 1;
        continue;
      }
      if (gap) row += String(gap);
      gap = 0;
      const letter = KIND_LETTERS[kindOf(piece)]!;
      row += piece & BLACK_BIT ? letter : letter.toUpperCase();
    }
    if (gap) row += String(gap);
    rows.push(row);
  }
  let castling = '';
  if (position.castling & CASTLE_WHITE_KING) castling += 'K';
  if (position.castling & CASTLE_WHITE_QUEEN) castling += 'Q';
  if (position.castling & CASTLE_BLACK_KING) castling += 'k';
  if (position.castling & CASTLE_BLACK_QUEEN) castling += 'q';
  const ep = position.epSquare >= 0 ? squareName(position.epSquare) : '-';
  const moveNumber = Math.floor(position.ply / 2) + 1;
  return [
    rows.join('/'),
    position.side === WHITE ? 'w' : 'b',
    castling || '-',
    ep,
    String(position.halfmoveClock),
    String(moveNumber),
  ].join(' ');
}
