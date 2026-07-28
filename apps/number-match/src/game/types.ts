export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Cell {
  readonly value: Digit;
  readonly cleared: boolean;
}

/**
 * A slot on the board. `null` is a hole in the board's shape: it is never
 * playable and is always transparent to connections, exactly like a cleared
 * cell. Holes are what make rows have different widths (docs §13).
 */
export type BoardCell = Cell | null;

/** Flat board in reading order (left→right, top→bottom), COLS slots per row. */
export type Board = readonly BoardCell[];

export type GameStatus = 'playing' | 'cleared' | 'gameOver';

export type GameMode = 'level' | 'daily';

/** A slot holding a number that has not been cleared yet. */
export function isLive(cell: BoardCell | undefined): cell is Cell {
  return cell !== null && cell !== undefined && !cell.cleared;
}

/** Whether a connection may pass through this slot (cleared or a hole). */
export function isPassable(cell: BoardCell | undefined): boolean {
  return cell === null || (cell !== undefined && cell.cleared);
}
