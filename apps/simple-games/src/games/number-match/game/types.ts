export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** A number the player clears by pairing it with a match (§2). */
export interface DigitCell {
  readonly kind: 'digit';
  readonly value: Digit;
  readonly cleared: boolean;
}

/** A wild that pairs with any live cell, digit or wild alike (§2). */
export interface WildCell {
  readonly kind: 'wild';
  readonly cleared: boolean;
}

/**
 * An obstacle. It has no `cleared` field on purpose: a stone is never matched
 * and never cleared, it only leaves the board with its row (§4). Omitting the
 * field turns "treated a stone as a clearable cell" into a type error.
 */
export interface StoneCell {
  readonly kind: 'stone';
}

export type Cell = DigitCell | WildCell | StoneCell;

/**
 * A slot on the board. `null` is a hole in the board's shape: it is never
 * playable and is always transparent to connections, exactly like a cleared
 * cell. Holes are what make rows have different widths (docs §13).
 *
 * Transparency is what separates the slot kinds: holes and cleared cells let a
 * connection pass, while live cells and stones block it (§3).
 */
export type BoardCell = Cell | null;

/** Flat board in reading order (left→right, top→bottom), COLS slots per row. */
export type Board = readonly BoardCell[];

export type GameStatus = 'playing' | 'cleared' | 'gameOver';

/** Level list, the daily, or a free board at a chosen tier (§11「フリープレイ」). */
export type GameMode = 'level' | 'daily' | 'free';

/** A slot the player can still pair off: an uncleared number or wild. */
export function isLive(cell: BoardCell | undefined): cell is DigitCell | WildCell {
  return cell !== null && cell !== undefined && cell.kind !== 'stone' && !cell.cleared;
}

/** A live number, excluding wilds — the cells Add Numbers copies (§5). */
export function isDigit(cell: BoardCell | undefined): cell is DigitCell {
  return cell !== null && cell !== undefined && cell.kind === 'digit' && !cell.cleared;
}

/** An obstacle: never matchable, and opaque to connections (§3, §4). */
export function isStone(cell: BoardCell | undefined): cell is StoneCell {
  return cell !== null && cell !== undefined && cell.kind === 'stone';
}

/**
 * Whether a connection may pass through this slot (cleared or a hole).
 *
 * Not the complement of `isLive`: a stone is neither live nor passable, which
 * is exactly what makes it an obstacle.
 */
export function isPassable(cell: BoardCell | undefined): boolean {
  return cell === null || (cell !== undefined && cell.kind !== 'stone' && cell.cleared);
}

/**
 * §6: whether any number is still on the board. Wilds and stones do not count
 * — the board is cleared once every *number* is gone, so a wild the player
 * never needed (Add Numbers does not copy wilds, §5) cannot strand the game.
 */
export function hasLiveDigits(board: Board): boolean {
  return board.some((cell) => isDigit(cell));
}
