/**
 * The paint a placed piece leaves (docs/BLOCK_PUZZLE_RULES.md §6, §10, §12).
 *
 * Three promises are held here. The colour follows the catalogue's own four
 * families, never the piece's luck or the board's state. The paint is carried
 * through placement and undo exactly as the board is, and outlives a clear
 * only under the empty cells, for the fade. And the saved board's wider
 * alphabet still reads every board a v1 build wrote as the board it was.
 */
import { describe, expect, it } from 'vitest';
import { PIECES, pieceById, type Piece } from './pieces';
import { decodeBoard, decodeCells, encodeBoard, encodeCells } from './serialize';
import { createSession, placePiece, restoreSession, undo } from './session';
import { LEGACY_TONE, legacyTones, paintTones, TONE_TABLE_LENGTH, toneOfPiece } from './tones';
import { CELL_COUNT, emptyBoard, emptyTones, indexAt, type Board, type Tray } from './types';

const SEED = 'block-tones-test';

/** Catalogue entries the tests lean on. */
const SINGLE = 0;
const BAR_1X2 = 1;
const CORNER_2X2 = 11;
const CORNER_3X3 = 15;

/** The family a shape belongs to, read from the shape itself rather than its id. */
function familyOf(piece: Piece): 'square' | 'bar' | 'small corner' | 'large corner' {
  const solid = piece.cells.length === piece.width * piece.height;
  if (solid) return piece.width === piece.height ? 'square' : 'bar';
  return piece.width === 2 ? 'small corner' : 'large corner';
}

/** A board from a picture: '#' filled, anything else empty. */
const boardFrom = (rows: readonly string[]): Board =>
  rows
    .join('')
    .split('')
    .map((character) => character === '#');

const gameOn = (board: Board, tray: Tray) =>
  restoreSession({
    seed: SEED,
    board,
    tray,
    score: 0,
    batchIndex: 0,
    linesCleared: 0,
    elapsedSeconds: 0,
  });

describe('the tone table (§6, §12)', () => {
  it('covers every shape in the catalogue, and no more', () => {
    expect(TONE_TABLE_LENGTH).toBe(PIECES.length);
    expect(TONE_TABLE_LENGTH).toBe(19);
  });

  it('gives each of the four families one tone of its own', () => {
    const byFamily = new Map<string, Set<number>>();
    for (const piece of PIECES) {
      const family = familyOf(piece);
      const tones = byFamily.get(family) ?? new Set<number>();
      tones.add(toneOfPiece(piece.id));
      byFamily.set(family, tones);
    }
    expect([...byFamily.keys()].sort()).toEqual(['bar', 'large corner', 'small corner', 'square']);
    for (const [family, tones] of byFamily) expect([...tones], family).toHaveLength(1);
    const used = [...byFamily.values()].map((tones) => [...tones][0]);
    expect(new Set(used).size).toBe(4);
  });

  it('paints squares bengara, bars celadon, small corners ochre, large corners indigo', () => {
    // The assignment §12 records: the family drawn most often (the bars)
    // wears the quietest pigment.
    expect(toneOfPiece(SINGLE)).toBe(5);
    expect(toneOfPiece(9)).toBe(5);
    expect(toneOfPiece(10)).toBe(5);
    for (let id = 1; id <= 8; id++) expect(toneOfPiece(id)).toBe(3);
    for (let id = 11; id <= 14; id++) expect(toneOfPiece(id)).toBe(4);
    for (let id = 15; id <= 18; id++) expect(toneOfPiece(id)).toBe(2);
  });

  it('deals no piece the accent, and uses every tone from 2 to 5', () => {
    const dealt = new Set(PIECES.map((piece) => toneOfPiece(piece.id)));
    expect(dealt.has(LEGACY_TONE)).toBe(false);
    expect([...dealt].sort()).toEqual([2, 3, 4, 5]);
  });

  it('draws an id it does not know in the accent', () => {
    expect(toneOfPiece(PIECES.length)).toBe(LEGACY_TONE);
    expect(toneOfPiece(-1)).toBe(LEGACY_TONE);
  });
});

describe('painting (§12)', () => {
  it('paints the squares a placement covers and nothing else, without touching its input', () => {
    const before = emptyTones();
    const corner = pieceById(CORNER_3X3)!;
    const after = paintTones(before, corner, 2, 3);
    expect(before.every((tone) => tone === 0)).toBe(true);
    const painted = corner.cells.map((cell) => indexAt(2 + cell.row, 3 + cell.col));
    for (let index = 0; index < CELL_COUNT; index++) {
      expect(after[index]).toBe(painted.includes(index) ? toneOfPiece(CORNER_3X3) : 0);
    }
  });

  it('reads a board saved without tones as all accent', () => {
    const board = [...emptyBoard()];
    board[0] = true;
    board[2] = true;
    const tones = legacyTones(board);
    expect(tones).toHaveLength(CELL_COUNT);
    expect(tones.slice(0, 3)).toEqual([LEGACY_TONE, 0, LEGACY_TONE]);
    expect(tones.slice(3).every((tone) => tone === 0)).toBe(true);
  });
});

describe('the session carries the paint (§7, §12)', () => {
  it('starts unpainted', () => {
    expect(createSession(SEED).tones).toEqual(emptyTones());
  });

  it('restores without tones as all accent, and with tones as given', () => {
    const board = [...emptyBoard()];
    board[indexAt(4, 4)] = true;
    expect(gameOn(board, [SINGLE, SINGLE, SINGLE]).tones[indexAt(4, 4)]).toBe(LEGACY_TONE);

    const tones = [...emptyTones()];
    tones[indexAt(4, 4)] = 4;
    const restored = restoreSession({
      seed: SEED,
      board,
      tones,
      tray: [SINGLE, SINGLE, SINGLE],
      score: 0,
      batchIndex: 0,
      linesCleared: 0,
      elapsedSeconds: 0,
    });
    expect(restored.tones[indexAt(4, 4)]).toBe(4);
  });

  it('falls back to the accent for a tones array of the wrong length', () => {
    const board = [...emptyBoard()];
    board[0] = true;
    const restored = restoreSession({
      seed: SEED,
      board,
      tones: [3],
      tray: [SINGLE, SINGLE, SINGLE],
      score: 0,
      batchIndex: 0,
      linesCleared: 0,
      elapsedSeconds: 0,
    });
    expect(restored.tones).toEqual(legacyTones(board));
  });

  it('paints a placement in its family’s tone', () => {
    const next = placePiece(gameOn(emptyBoard(), [CORNER_2X2, BAR_1X2, SINGLE]), 0, 0, 0)!;
    for (const cell of pieceById(CORNER_2X2)!.cells) {
      expect(next.tones[indexAt(cell.row, cell.col)]).toBe(toneOfPiece(CORNER_2X2));
    }
    expect(next.tones.filter((tone) => tone !== 0)).toHaveLength(3);
  });

  it('keeps a cleared line’s paint under the emptied cells, for its fade', () => {
    const board = boardFrom([
      '.#######',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    const next = placePiece(gameOn(board, [SINGLE, SINGLE, SINGLE]), 0, 0, 0)!;
    expect(next.linesCleared).toBe(1);
    expect(next.board.slice(0, 8).every((filled) => !filled)).toBe(true);
    // The piece that finished the line in its own tone, the rest as resumed.
    expect(next.tones.slice(0, 8)).toEqual([
      toneOfPiece(SINGLE),
      ...new Array<number>(7).fill(LEGACY_TONE),
    ]);
  });

  it('puts the paint back with undo, and paints the same again on replay', () => {
    const before = placePiece(gameOn(emptyBoard(), [SINGLE, BAR_1X2, CORNER_3X3]), 0, 7, 7)!;
    const after = placePiece(before, 2, 0, 0)!;
    const back = undo(after)!;
    expect(back.tones).toEqual(before.tones);
    expect(placePiece(back, 2, 0, 0)!.tones).toEqual(after.tones);
  });

  it('puts a cleared line’s paint back with undo, square for square', () => {
    // The placement that clears is the one that leaves paint under emptied
    // cells (above), so it is the one whose undo has the most to restore: the
    // line returns filled, in the colours it was laid down in, not repainted.
    const board = boardFrom([
      '.#######',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    const tones = [...emptyTones()];
    const row = [0, 2, 3, 4, 5, 2, 3, 4];
    row.forEach((tone, col) => {
      tones[indexAt(0, col)] = tone;
    });
    const before = restoreSession({
      seed: SEED,
      board,
      tones,
      tray: [SINGLE, SINGLE, SINGLE],
      score: 0,
      batchIndex: 0,
      linesCleared: 0,
      elapsedSeconds: 0,
    });
    const after = placePiece(before, 0, 0, 0)!;
    expect(after.linesCleared).toBe(1);
    expect(after.board.slice(0, 8).every((filled) => !filled)).toBe(true);

    const back = undo(after)!;
    expect(back.board).toEqual(before.board);
    expect(back.tones).toEqual(before.tones);
    expect(back.tones.slice(0, 8)).toEqual(row);
    expect(placePiece(back, 0, 0, 0)!.tones).toEqual(after.tones);
  });
});

describe('the saved board (§10)', () => {
  const LEGACY = '1011001011110111111111001110010000000000100000000000000000000000';

  it('reads every v1 board as itself, in the accent', () => {
    const cells = decodeCells(LEGACY)!;
    expect(cells).not.toBeNull();
    expect(cells.board).toEqual(decodeBoard(LEGACY));
    expect(cells.tones).toEqual(legacyTones(cells.board));
    // And writes it back unchanged: tone 1 is '1'.
    expect(encodeCells(cells.board, cells.tones)).toBe(LEGACY);
    expect(encodeCells(cells.board, cells.tones)).toBe(encodeBoard(cells.board));
  });

  it('round-trips a board painted in several tones', () => {
    let session = gameOn(emptyBoard(), [SINGLE, BAR_1X2, CORNER_2X2]);
    session = placePiece(session, 0, 0, 0)!;
    session = placePiece(session, 1, 2, 0)!;
    session = placePiece(session, 2, 4, 4)!;
    const text = encodeCells(session.board, session.tones);
    expect(new Set(text.replace(/0/g, '')).size).toBe(3);
    const cells = decodeCells(text)!;
    expect(cells.board).toEqual(session.board);
    session.board.forEach((filled, index) => {
      if (filled) expect(cells.tones[index]).toBe(session.tones[index]);
    });
  });

  it('writes an empty cell as 0 even with old paint under it', () => {
    const tones = [...emptyTones()];
    tones[5] = 3;
    expect(encodeCells(emptyBoard(), tones)).toBe('0'.repeat(CELL_COUNT));
  });

  it('writes a filled cell whose tone cannot be one digit as the accent', () => {
    const board = [...emptyBoard()];
    board[0] = true;
    board[1] = true;
    board[2] = true;
    const tones = [...emptyTones()];
    tones[0] = 0;
    tones[1] = 12;
    tones[2] = 2.5;
    expect(encodeCells(board, tones).slice(0, 3)).toBe('111');
  });

  it('accepts every digit — a newer build’s tone keeps its board — and refuses the rest', () => {
    const nine = `9${'0'.repeat(CELL_COUNT - 1)}`;
    expect(decodeCells(nine)!.tones[0]).toBe(9);
    expect(decodeCells(nine)!.board[0]).toBe(true);
    for (const bad of ['a', '-', ' ', '/', ':']) {
      expect(decodeCells(`${bad}${'0'.repeat(CELL_COUNT - 1)}`), bad).toBeNull();
    }
    expect(decodeCells('0'.repeat(CELL_COUNT - 1))).toBeNull();
    expect(decodeCells('0'.repeat(CELL_COUNT + 1))).toBeNull();
  });

  it('leaves the v1 decoder as strict as it was', () => {
    // A v1 record is read through decodeBoard (storage/schemas.ts); a tone
    // digit there is a record no v1 build wrote.
    expect(decodeBoard(`2${'0'.repeat(CELL_COUNT - 1)}`)).toBeNull();
  });
});
