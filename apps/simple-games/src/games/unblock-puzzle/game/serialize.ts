/**
 * Compact, corruption-tolerant serialization for local persistence and the
 * bundled boards (docs/UNBLOCK_PUZZLE_RULES.md §12).
 *
 * A board is 36 characters, row-major: `.` is an empty cell and a lowercase
 * letter names the block covering it — `a` is the target, then `b`, `c`, … in
 * canonical order (generator.ts `canonicalBoard`). A block's orientation and
 * length are read off its cells, so the string is the whole board.
 *
 * A move list is two characters per move: the block's letter and the offset
 * it ends on. A saved game holds the starting board and its moves, never the
 * board in between — the board on screen is the one the moves replay to,
 * through the same rules every move in play went through.
 *
 * Decoding fails closed: a board that breaks a rule of §1, a letter order
 * the generator never writes, or a move list that holds an illegal slide,
 * two moves of the same block in a row (play merges those, §4), or a move
 * after the exit was reached, did not come from this game, and the caller
 * drops it rather than handing the player a board nobody dealt.
 */
import { isLegalSlide, isSolved, isValidBoard } from './engine';
import {
  BOARD_SIZE,
  CELL_COUNT,
  MAX_BLOCKS,
  blockCells,
  colOf,
  rowOf,
  type Block,
  type BlockLength,
  type Board,
  type Slide,
} from './types';

const EMPTY_CHARACTER = '.';
const FIRST_LETTER = 'a'.charCodeAt(0);

export const blockLetter = (block: number): string => String.fromCharCode(FIRST_LETTER + block);

/** The 36-character form of a board (§12). */
export function encodeBoard(board: Board): string {
  const cells = new Array<string>(CELL_COUNT).fill(EMPTY_CHARACTER);
  board.blocks.forEach((block, index) => {
    for (const cell of blockCells(block, board.positions[index]!)) cells[cell] = blockLetter(index);
  });
  return cells.join('');
}

/**
 * Reads a board back. Null unless every letter is one straight run of two or
 * three cells, the letters run `a`, `b`, … without a gap, the blocks are in
 * canonical order (each one's first cell after the one before), and the
 * result keeps every rule of §1.
 */
export function decodeBoard(text: unknown): Board | null {
  if (typeof text !== 'string' || text.length !== CELL_COUNT) return null;
  const cellsOf: number[][] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const character = text[cell]!;
    if (character === EMPTY_CHARACTER) continue;
    const index = character.charCodeAt(0) - FIRST_LETTER;
    if (index < 0 || index >= MAX_BLOCKS) return null;
    (cellsOf[index] ??= []).push(cell);
  }
  if (cellsOf.length === 0) return null;
  const blocks: Block[] = [];
  const positions: number[] = [];
  for (let index = 0; index < cellsOf.length; index++) {
    const cells = cellsOf[index];
    if (cells === undefined) return null;
    const read = readBlock(cells);
    if (read === null) return null;
    blocks.push(read.block);
    positions.push(read.position);
  }
  // Canonical order: past the target, each block starts after the one before.
  for (let index = 2; index < cellsOf.length; index++) {
    if (cellsOf[index]![0]! < cellsOf[index - 1]![0]!) return null;
  }
  const board: Board = { blocks, positions };
  return isValidBoard(board) ? board : null;
}

/** One block from its cells (ascending), or null when they are not a straight run of 2–3. */
function readBlock(cells: readonly number[]): { block: Block; position: number } | null {
  if (cells.length !== 2 && cells.length !== 3) return null;
  const length = cells.length as BlockLength;
  const first = cells[0]!;
  const horizontal = cells.every((cell, k) => cell === first + k && rowOf(cell) === rowOf(first));
  if (horizontal) {
    return { block: { orientation: 'h', length, lane: rowOf(first) }, position: colOf(first) };
  }
  const vertical = cells.every((cell, k) => cell === first + k * BOARD_SIZE);
  if (vertical) {
    return { block: { orientation: 'v', length, lane: colOf(first) }, position: rowOf(first) };
  }
  return null;
}

/** A move as play records it: which block, from where, to where (§4). */
export interface Move extends Slide {
  readonly from: number;
}

/** Two characters per move: the block's letter and the offset it ends on (§12). */
export function encodeMoves(moves: readonly Slide[]): string {
  return moves.map((move) => `${blockLetter(move.block)}${move.to}`).join('');
}

export interface Replayed {
  readonly moves: Move[];
  /** The board the moves end on. */
  readonly board: Board;
}

/**
 * Replays a persisted move list from its starting board. Null when the text
 * is not pairs of a block letter and an offset digit, when any slide is
 * illegal there, when two moves in a row move the same block — play merges
 * those into one move (§4), so no record of play holds them — or when a move
 * follows the target reaching the exit. `limit` caps the list (§12).
 */
export function replayMoves(text: unknown, start: Board, limit: number): Replayed | null {
  if (typeof text !== 'string' || text.length % 2 !== 0 || text.length / 2 > limit) return null;
  let board = start;
  const moves: Move[] = [];
  for (let at = 0; at < text.length; at += 2) {
    if (isSolved(board)) return null;
    const block = text.charCodeAt(at) - FIRST_LETTER;
    const digit = text.charCodeAt(at + 1) - '0'.charCodeAt(0);
    if (block < 0 || block >= board.blocks.length || digit < 0 || digit > 9) return null;
    if (moves.length > 0 && moves[moves.length - 1]!.block === block) return null;
    const move = { block, to: digit };
    if (!isLegalSlide(board, move)) return null;
    const from = board.positions[block]!;
    const positions = [...board.positions];
    positions[block] = digit;
    board = { blocks: board.blocks, positions };
    moves.push({ block, from, to: digit });
  }
  return { moves, board };
}
