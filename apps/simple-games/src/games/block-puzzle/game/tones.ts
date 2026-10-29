/**
 * The paint a placed piece leaves on the board (docs/BLOCK_PUZZLE_RULES.md §6,
 * §12). Presentation only: no rule reads a tone — canPlace, clearLines and
 * hasAnyMove see the boolean board — and the draw does not look at it either,
 * so painting cannot help or hinder a deal (§6).
 *
 * Tone digits are in players' saves (§10): '1'–'9' in the board string. Never
 * renumber one or reuse it for a different colour. A tone this build does not
 * paint (6–9, from a newer build) still decodes, and the stylesheet draws it in
 * the accent (ui/block-puzzle.css).
 */
import type { Piece } from './pieces';
import { indexAt, type Board, type Tones } from './types';

/**
 * A filled square saved before tones existed (a v1 record, §10): the accent it
 * was drawn in. No piece is dealt it, so a resumed board's old squares read as
 * what they were and give way to the families as lines clear.
 */
export const LEGACY_TONE = 1;

/**
 * Piece id → tone, by the catalogue's own four families (pieces.ts): squares,
 * bars, the corners of a 2×2, the corners of a 3×3. The family drawn most often
 * (the bars, about 38% of the squares placed) wears the quietest pigment.
 * Editing this repaints only what is placed afterwards.
 */
const TONE_BY_PIECE: readonly number[] = [
  5, // 0   1×1               square  — bengara
  3, // 1   1×2               bar     — celadon
  3, // 2   2×1               bar
  3, // 3   1×3               bar
  3, // 4   3×1               bar
  3, // 5   1×4               bar
  3, // 6   4×1               bar
  3, // 7   1×5               bar
  3, // 8   5×1               bar
  5, // 9   2×2               square
  5, // 10  3×3               square
  4, // 11  corner of a 2×2   small corner — ochre
  4, // 12  corner of a 2×2   small corner
  4, // 13  corner of a 2×2   small corner
  4, // 14  corner of a 2×2   small corner
  2, // 15  corner of a 3×3   large corner — indigo
  2, // 16  corner of a 3×3   large corner
  2, // 17  corner of a 3×3   large corner
  2, // 18  corner of a 3×3   large corner
];

/** How many ids the table covers — tones.test.ts holds it to PIECES.length. */
export const TONE_TABLE_LENGTH = TONE_BY_PIECE.length;

/** The tone a piece paints. An id the table does not know wears the accent. */
export const toneOfPiece = (id: number): number => TONE_BY_PIECE[id] ?? LEGACY_TONE;

/**
 * Paints the squares a placement covers. Called after the placement is known
 * to be legal, before the lines clear — a cleared line keeps its paint under
 * the now-empty cells, which is what its fade is drawn in (§12).
 */
export function paintTones(tones: Tones, piece: Piece, row: number, col: number): Tones {
  const next = [...tones];
  const tone = toneOfPiece(piece.id);
  for (const offset of piece.cells) next[indexAt(row + offset.row, col + offset.col)] = tone;
  return next;
}

/** The tones of a board that was saved without them: every filled square the accent. */
export const legacyTones = (board: Board): Tones =>
  board.map((filled) => (filled ? LEGACY_TONE : 0));
