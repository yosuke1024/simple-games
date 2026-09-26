/**
 * One move, resolved (docs/MANCALA_RULES.md §2, §3): where the seeds go,
 * whether the last one earned another turn or a capture, and when the game
 * is over. Pure functions over a plain array — no identity, no time, no
 * randomness. The CPU's search (cpu.ts) plays through these same functions;
 * there is one set of rules, not a fast copy beside it.
 */
import {
  BOARD_SIZE,
  CPU,
  CPU_STORE,
  firstPitOf,
  isPitOf,
  oppositeOf,
  opponentOf,
  PITS_PER_SIDE,
  PLAYER,
  PLAYER_STORE,
  seedsOnSide,
  storeOf,
  type Pits,
  type Side,
} from './types';

export interface SowOutcome {
  readonly pits: Pits;
  /** The last seed went into the mover's own store: the same side moves again (§2.1). */
  readonly extraTurn: boolean;
  /**
   * Seeds a capture moved into the mover's store — the opposite pit's seeds
   * plus the last seed itself — or 0 when nothing was captured (§2.2).
   */
  readonly captured: number;
  /** Where the last seed landed (before any capture lifted it). */
  readonly lastIndex: number;
  /**
   * Every index that received a seed, in sowing order. A lap of thirteen or
   * more passes the same pits twice, and they appear twice. The screen's
   * short highlight reads this (§10).
   */
  readonly touched: readonly number[];
}

/** Every pit `side` may sow from: its own, and not empty (§2, §6). Left to right. */
export function legalPits(pits: Pits, side: Side): number[] {
  const first = firstPitOf(side);
  const legal: number[] = [];
  for (let i = first; i < first + PITS_PER_SIDE; i++) {
    if (pits[i]! > 0) legal.push(i);
  }
  return legal;
}

/** Whether every one of `side`'s six pits is empty (§3). */
export function isSideEmpty(pits: Pits, side: Side): boolean {
  return seedsOnSide(pits, side) === 0;
}

/** Either side out of seeds ends the game (§3). */
export function isGameOver(pits: Pits): boolean {
  return isSideEmpty(pits, PLAYER) || isSideEmpty(pits, CPU);
}

/**
 * Sows `side`'s pit `pit` (§2). Null when the pit is not the mover's or is
 * empty — the rules offer nothing there, so the input is nothing.
 */
export function sow(pits: Pits, side: Side, pit: number): SowOutcome | null {
  if (!isPitOf(side, pit) || pits[pit]! === 0) return null;

  const next = [...pits];
  const skip = storeOf(opponentOf(side));
  let seeds = next[pit]!;
  next[pit] = 0;
  const touched: number[] = [];
  let index = pit;
  while (seeds > 0) {
    index = (index + 1) % BOARD_SIZE;
    // The opponent's store is never sown into (§2). The pit the seeds came
    // from is NOT skipped on a lap — that is Oware's rule, not Kalah's (§11).
    if (index === skip) continue;
    next[index]! += 1;
    touched.push(index);
    seeds -= 1;
  }

  const store = storeOf(side);
  if (index === store) {
    return { pits: next, extraTurn: true, captured: 0, lastIndex: index, touched };
  }

  // A capture needs the last seed alone in one of the mover's own pits (it
  // was empty until this seed arrived) and something across the board to
  // take (§2.2). An empty opposite pit takes nothing, and the seed stays.
  let captured = 0;
  if (isPitOf(side, index) && next[index] === 1) {
    const across = oppositeOf(index);
    if (next[across]! > 0) {
      captured = next[across]! + 1;
      next[store]! += captured;
      next[across] = 0;
      next[index] = 0;
    }
  }
  return { pits: next, extraTurn: false, captured, lastIndex: index, touched };
}

/**
 * The end-of-game collection (§3): whatever is still in a side's pits goes to
 * that side's own store. Called once the game is over; harmless otherwise.
 */
export function sweepRemaining(pits: Pits): Pits {
  const next = [...pits];
  for (const side of [PLAYER, CPU] as const) {
    const first = firstPitOf(side);
    let swept = 0;
    for (let i = first; i < first + PITS_PER_SIDE; i++) {
      swept += next[i]!;
      next[i] = 0;
    }
    next[storeOf(side)]! += swept;
  }
  return next;
}

/** The two stores, from the player's side of the table. */
export interface StoreCounts {
  readonly player: number;
  readonly cpu: number;
}

export const storeCounts = (pits: Pits): StoreCounts => ({
  player: pits[PLAYER_STORE]!,
  cpu: pits[CPU_STORE]!,
});
