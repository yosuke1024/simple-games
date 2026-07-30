/**
 * The board rules of docs/GAME_2048_RULES.md §2, §3 and §7: sliding, merging,
 * spawning, and the two end conditions. Pure functions over plain boards — no
 * tile objects, no state, nothing to keep in sync.
 *
 * A slide reports where every tile went as well as the board it produced. The
 * engine does not need that, but the UI does: without it, animating movement
 * would mean re-deriving the moves from two boards, which is guesswork.
 */
import { createRng } from './rng';
import { CELLS, SIZE, WIN_VALUE, type Board, type Direction } from './types';

/** One tile's journey during a slide, in board indices. */
export interface Movement {
  readonly from: number;
  readonly to: number;
  /** The value the tile carried *before* the move. */
  readonly value: number;
  /**
   * True for both halves of a merge. The two tiles share a `to`; the one
   * listed first is the one nearer the direction's leading edge.
   */
  readonly merged: boolean;
}

export interface SlideResult {
  readonly board: Board;
  /** Score earned by this move: the sum of the tiles created (§4). */
  readonly gained: number;
  /** False when nothing shifted or combined — an invalid move (§2.4). */
  readonly moved: boolean;
  readonly movements: readonly Movement[];
}

export function emptyBoard(): Board {
  return new Array<number>(CELLS).fill(0);
}

/**
 * The indices of each row or column, ordered from the direction's leading edge
 * backwards. Collapsing a line is then always "compact towards index 0", which
 * is what makes the merge-order rule of §2.3 one rule instead of four.
 */
function lines(direction: Direction): readonly (readonly number[])[] {
  const out: number[][] = [];
  for (let n = 0; n < SIZE; n++) {
    const line: number[] = [];
    for (let k = 0; k < SIZE; k++) {
      switch (direction) {
        case 'left':
          line.push(n * SIZE + k);
          break;
        case 'right':
          line.push(n * SIZE + (SIZE - 1 - k));
          break;
        case 'up':
          line.push(k * SIZE + n);
          break;
        case 'down':
          line.push((SIZE - 1 - k) * SIZE + n);
          break;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Slides every tile one move in the given direction (§2.1–§2.3).
 *
 * Merging walks the compacted line from the leading edge, so 2,2,2 combines
 * the first two and leaves the third — and a tile produced by a merge is never
 * merged again in the same move, because the walk steps past it.
 */
export function slide(board: Board, direction: Direction): SlideResult {
  const next = emptyBoard() as number[];
  const movements: Movement[] = [];
  let gained = 0;
  let moved = false;

  for (const line of lines(direction)) {
    // The occupied squares of this line, still in leading-edge-first order.
    const filled: { index: number; value: number }[] = [];
    for (const index of line) {
      const value = board[index] ?? 0;
      if (value !== 0) filled.push({ index, value });
    }

    let slot = 0;
    for (let i = 0; i < filled.length; i++) {
      const current = filled[i]!;
      const partner = filled[i + 1];
      const target = line[slot]!;
      if (partner !== undefined && partner.value === current.value) {
        const combined = current.value * 2;
        next[target] = combined;
        gained += combined;
        movements.push({ from: current.index, to: target, value: current.value, merged: true });
        movements.push({ from: partner.index, to: target, value: partner.value, merged: true });
        moved = true;
        i++;
      } else {
        next[target] = current.value;
        movements.push({ from: current.index, to: target, value: current.value, merged: false });
        if (current.index !== target) moved = true;
      }
      slot++;
    }
  }

  return { board: next, gained, moved, movements };
}

export function emptyCells(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) if ((board[i] ?? 0) === 0) out.push(i);
  return out;
}

export interface Spawn {
  readonly board: Board;
  readonly index: number;
  readonly value: number;
}

/**
 * Drops one new tile: 90% a 2, 10% a 4 (§2). Position first, then value, so
 * the draw order is fixed and a replay of the same seed lands identically.
 * Returns null when there is nowhere to put it.
 */
export function spawnTile(board: Board, rng: () => number): Spawn | null {
  const empties = emptyCells(board);
  if (empties.length === 0) return null;
  const index = empties[Math.min(empties.length - 1, Math.floor(rng() * empties.length))]!;
  const value = rng() < 0.9 ? 2 : 4;
  const next = [...board];
  next[index] = value;
  return { board: next, index, value };
}

/**
 * The random stream for one spawn. A fresh stream per spawn index, rather than
 * one long stream, is what lets a suspended game resume — and an undone move
 * be replayed — on exactly the sequence §6 promises every player of a daily,
 * without replaying the whole run to get there.
 */
export function spawnRng(seed: string, spawnIndex: number): () => number {
  return createRng(`${seed}#${spawnIndex}`);
}

/** Whether any direction would change the board — the negation of §3's end. */
export function hasMoves(board: Board): boolean {
  for (let i = 0; i < CELLS; i++) {
    const value = board[i] ?? 0;
    if (value === 0) return true;
    const col = i % SIZE;
    // Right and down neighbours only: every adjacent pair is seen once.
    if (col + 1 < SIZE && (board[i + 1] ?? 0) === value) return true;
    if (i + SIZE < CELLS && (board[i + SIZE] ?? 0) === value) return true;
  }
  return false;
}

/** No empty square and no adjacent pair left to combine (§3). */
export function isGameOver(board: Board): boolean {
  return !hasMoves(board);
}

/** The largest tile on the board — what §8 records as the peak reached. */
export function maxTile(board: Board): number {
  let best = 0;
  for (let i = 0; i < CELLS; i++) {
    const value = board[i] ?? 0;
    if (value > best) best = value;
  }
  return best;
}

/** Whether 2048 has been made. The game is not stopped by it (§3). */
export function hasWon(board: Board): boolean {
  return maxTile(board) >= WIN_VALUE;
}
