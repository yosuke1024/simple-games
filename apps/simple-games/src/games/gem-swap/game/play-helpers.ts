/**
 * Test-only (not exported from index.ts): rounds played through the rules by
 * a fixed policy — always the first valid swap in ADJACENT_PAIRS order — so
 * the storage and UI tests stand on positions the game can actually reach.
 */
import { ADJACENT_PAIRS, isValidSwap, validSwaps } from './board';
import { resolveSwap } from './resolve';
import { createRound, gemSwapSeed, trySwap, type Round } from './round';
import type { ColorCount, Swap } from './types';

/** The first valid swap on a board, in ADJACENT_PAIRS order. */
export const firstValid = (round: Round): Swap => validSwaps(round.board)[0]!;

/** Two neighbouring gems of different kinds whose swap makes no line. */
export function invalidAdjacent(round: Round): Swap {
  const pair = ADJACENT_PAIRS.find(
    ([a, b]) => round.board[a] !== round.board[b] && !isValidSwap(round.board, a, b),
  );
  if (!pair) throw new Error('every neighbouring pair is a valid swap');
  return pair;
}

/** `round` after `count` first-valid swaps (fewer if it ends first). */
export function playFirst(round: Round, count: number): Round {
  let current = round;
  for (let i = 0; i < count && current.status === 'playing'; i++) {
    const [a, b] = firstValid(current);
    current = trySwap(current, a, b)!.round;
  }
  return current;
}

/** A seed whose first-valid round is still being played after `swaps` swaps. */
export function roundAfter(swaps: number, colors: ColorCount = 6): Round {
  for (let i = 0; i < 200; i++) {
    const round = playFirst(createRound(gemSwapSeed(`ui-${swaps}-${i}`), colors), swaps);
    if (round.status === 'playing' && round.swaps.length === swaps) return round;
  }
  throw new Error(`no seed reaches ${swaps} swaps`);
}

/** A fresh round with a valid swap that cascades at least `stages` stages. */
export function cascadingRound(stages = 2): { round: Round; swap: Swap; stages: number } {
  for (let i = 0; i < 500; i++) {
    const round = createRound(gemSwapSeed(`ui-cascade-${i}`), 6);
    for (const [a, b] of validSwaps(round.board)) {
      const move = resolveSwap(round.board, a, b, round);
      if (move && move.stages.length >= stages) {
        return { round, swap: [a, b], stages: move.stages.length };
      }
    }
  }
  throw new Error(`no opening swap cascades ${stages} stages`);
}
