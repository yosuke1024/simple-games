/**
 * Hint — implements docs/NUMBER_MATCH_RULES.md §9.
 * Deterministic scan: returns the valid pair with the lowest indices,
 * or null when no pair exists (UI then guides the player to Add Numbers).
 */
import { isValidPair } from './rules';
import { isLive, type Board } from './types';

export function findHint(board: Board): readonly [number, number] | null {
  const live: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (isLive(board[i])) live.push(i);
  }
  for (let x = 0; x < live.length; x++) {
    for (let y = x + 1; y < live.length; y++) {
      const i = live[x]!;
      const j = live[y]!;
      if (isValidPair(board, i, j)) return [i, j];
    }
  }
  return null;
}

export function hasAnyMove(board: Board): boolean {
  return findHint(board) !== null;
}
