import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createDifficultySession,
  fieldFromMines,
  reveal,
  statusOf,
  toggleFlag,
  type Board,
  type MinesweeperSession,
} from '../game';
import { shareBoardOf } from './shareBoard';

// A wall down the middle separates two zero regions. The left rim has 2,3,2;
// the right rim has the same counts but stays hidden after the loss below.
const FIELD = fieldFromMines(5, 3, [
  false,
  false,
  true,
  false,
  false,
  false,
  false,
  true,
  false,
  false,
  false,
  false,
  true,
  false,
  false,
]);

function sessionOf(board: Board): MinesweeperSession {
  return {
    ...createDifficultySession('easy', 'private-mine-seed'),
    board,
    firstIndex: 0,
    status: statusOf(board),
  };
}

describe('Minesweeper share board', () => {
  it('copies the visible loss: opened numbers, flags, mines and hidden safe cells', () => {
    let board = reveal(createBoard(FIELD), 0)!;
    board = toggleFlag(board, 7)!;
    board = toggleFlag(board, 3)!; // A wrong flag still shows as a flag.
    board = reveal(board, 2)!;
    const preview = shareBoardOf(sessionOf(board))!;

    expect(preview.gameId).toBe('minesweeper');
    expect([preview.columns, preview.rows]).toEqual([5, 3]);
    expect(preview.cells.map((cell) => cell.text ?? cell.piece ?? '')).toEqual([
      '',
      '2',
      'mine',
      'flag',
      '',
      '',
      '3',
      'flag',
      '',
      '',
      '',
      '2',
      'mine',
      '',
      '',
    ]);
    expect(preview.cells[2]?.fill).not.toBe(preview.cells[12]?.fill);
    expect(preview.cells[13]).toEqual(preview.cells[14]);
    expect(JSON.stringify(preview)).not.toContain('private-mine-seed');
  });

  it('shows the actual cleared board, including unflagged mines revealed by the game', () => {
    let board = toggleFlag(createBoard(FIELD), 7)!;
    board = reveal(board, 0)!;
    board = reveal(board, 4)!;
    expect(statusOf(board)).toBe('won');

    const preview = shareBoardOf(sessionOf(board))!;
    expect(preview.cells.map((cell) => cell.text ?? cell.piece ?? '')).toEqual([
      '',
      '2',
      'mine',
      '2',
      '',
      '',
      '3',
      'flag',
      '3',
      '',
      '',
      '2',
      'mine',
      '2',
      '',
    ]);
  });

  it('keeps a daily mine map out of exports even after the game ends', () => {
    const ended = sessionOf(reveal(createBoard(FIELD), 2)!);
    expect(shareBoardOf({ ...ended, mode: 'daily', dailyDate: '2026-11-07' })).toBeNull();
  });

  it('does not export a board while play is in progress', () => {
    expect(shareBoardOf(sessionOf(reveal(createBoard(FIELD), 0)!))).toBeNull();
  });
});
