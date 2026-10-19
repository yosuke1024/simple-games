/**
 * One move of the snake, resolved (docs/SNAKE_RULES.md §3). Pure functions
 * over a plain list of cells — no time, no randomness, no input handling: the
 * session (session.ts) decides the direction and draws the next food, and this
 * file says only what the board does with that direction.
 *
 * The one ordering that matters is written out once, here: the new head is
 * found first, and when it is not food the tail leaves before the head is
 * checked against the body. That is what makes the cell the tail is vacating
 * a legal place to move into, and the bug this game is most often shipped
 * with is getting that order the other way round.
 */
import { BOARD_SIZE, CELL_COUNT, colOf, isCell, rowOf, type Direction } from './types';

/** The cell one step away in `direction`, or null when that step leaves the board (§1). */
export function neighbour(cell: number, direction: Direction): number | null {
  const row = rowOf(cell);
  const col = colOf(cell);
  switch (direction) {
    case 'up':
      return row > 0 ? cell - BOARD_SIZE : null;
    case 'down':
      return row < BOARD_SIZE - 1 ? cell + BOARD_SIZE : null;
    case 'left':
      return col > 0 ? cell - 1 : null;
    case 'right':
      return col < BOARD_SIZE - 1 ? cell + 1 : null;
  }
}

/** The direction that takes `from` to `to` in one step, or null when they are not neighbours. */
export function directionBetween(from: number, to: number): Direction | null {
  if (!isCell(from) || !isCell(to)) return null;
  const dr = rowOf(to) - rowOf(from);
  const dc = colOf(to) - colOf(from);
  if (dr === -1 && dc === 0) return 'up';
  if (dr === 1 && dc === 0) return 'down';
  if (dr === 0 && dc === -1) return 'left';
  if (dr === 0 && dc === 1) return 'right';
  return null;
}

export type MoveResult =
  /** The head would leave the board; nothing moves (§3 step 2). */
  | { readonly kind: 'wall' }
  /** The head would enter the body that is still there after the tail moved (§3 step 4). */
  | { readonly kind: 'self'; readonly cell: number }
  /** An ordinary step: head added, tail gone, same length. */
  | { readonly kind: 'move'; readonly body: readonly number[] }
  /** The head took the food: head added, tail kept, one longer (§3 step 3). */
  | { readonly kind: 'eat'; readonly body: readonly number[] };

/**
 * Moves the snake one cell (§3). `body` is head first and at least two long;
 * `food` is a cell, or -1 when there is none (only once the board is full,
 * which ends the run before another move is asked for).
 */
export function moveSnake(body: readonly number[], direction: Direction, food: number): MoveResult {
  const head = body[0];
  if (head === undefined) return { kind: 'wall' };
  const next = neighbour(head, direction);
  if (next === null) return { kind: 'wall' };

  const eats = next === food;
  // Not eating, the tail leaves this tick — so the body the head can run into
  // is everything but the tail. Eating, the tail stays and the whole body
  // counts (the food is never on the snake, so this cannot hit, but the rule
  // is the rule rather than a consequence of where food happens to be).
  const blocking = eats ? body.length : body.length - 1;
  for (let i = 0; i < blocking; i++) {
    if (body[i] === next) return { kind: 'self', cell: next };
  }

  if (eats) return { kind: 'eat', body: [next, ...body] };
  const moved = body.slice(0, -1);
  moved.unshift(next);
  return { kind: 'move', body: moved };
}

/**
 * A body that could be on the board: at least two cells, every one on the
 * board, no cell twice, and each one a single orthogonal step from the one
 * before it — a row's last cell and the next row's first are not neighbours
 * (§1: the edges do not wrap). Used to refuse a saved run that play could not
 * have produced (§11).
 */
export function isValidBody(body: readonly number[]): boolean {
  if (body.length < 2 || body.length > CELL_COUNT) return false;
  const seen = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < body.length; i++) {
    const cell = body[i]!;
    if (!isCell(cell) || seen[cell] === 1) return false;
    seen[cell] = 1;
    if (i > 0 && directionBetween(body[i - 1]!, cell) === null) return false;
  }
  return true;
}

/** The way the head is facing: from the neck to the head (§3). */
export function headingOf(body: readonly number[]): Direction | null {
  const head = body[0];
  const neck = body[1];
  if (head === undefined || neck === undefined) return null;
  return directionBetween(neck, head);
}
