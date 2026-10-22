/**
 * One round as a pure, immutable value (docs/GEM_SWAP_RULES.md §1, §5–§7).
 *
 * A round is fully determined by (seed, colors, swaps): the initial board
 * comes from the seed (§4.1), every refill from the seed's column tapes
 * (§4.2), and every move from `resolveSwap` (§4.3). So the round keeps that
 * triple as its truth and everything else — board, score, tape, status — is
 * what replaying it gives.
 *
 * That one fact carries three features:
 *   - Undo (§6) is "replay all but the last swap". No snapshots, no history
 *     limit; a round has at most 30 swaps.
 *   - The suspended record (§7) is the triple. Restoring it replays it, and a
 *     list the rules could not have produced — a non-adjacent pair, a swap
 *     that makes no run, a 31st swap, a swap after the round ended — is
 *     rejected rather than repaired (fail-closed).
 *   - "Same board again" (§9) is the same seed and colours with no swaps.
 *
 * The status flips to 'over' exactly once. An invalid swap returns null and
 * changes nothing — not the board, not the count (§1, §3).
 */
import { hasValidSwap } from './board';
import { generateInitialBoard } from './generator';
import { resolveSwap, type MoveResult } from './resolve';
import {
  CASCADE_STAGE_LIMIT,
  ROUND_SWAPS,
  freshTape,
  isCellIndex,
  isColorCount,
  normaliseSwap,
  type Board,
  type ColorCount,
  type Swap,
  type Tape,
} from './types';

export type RoundStatus = 'playing' | 'over';

/** How a round ended (§5). Only 'swaps' and 'stuck' count toward the record. */
export type EndReason = 'swaps' | 'stuck' | 'cap';

export interface Round {
  readonly seed: string;
  readonly colors: ColorCount;
  /** The starting board (generated or bundled) — kept so Undo can replay from it. */
  readonly initial: Board;
  /** True when the initial board is the bundled one (§4.1). */
  readonly bundled: boolean;
  readonly board: Board;
  readonly tape: Tape;
  readonly score: number;
  /** Valid swaps made, in order, normalised (a < b). Its length is the move count. */
  readonly swaps: readonly Swap[];
  readonly status: RoundStatus;
  readonly endReason: EndReason | null;
}

/** The suspended record's content (§7). Storage adds elapsed seconds and a version. */
export interface RoundRecord {
  readonly seed: string;
  readonly colors: ColorCount;
  readonly swaps: readonly Swap[];
}

/**
 * A token that makes one round's seed its own (§2). A new round gets a new
 * deal; "same board again" reuses the seed.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const gemSwapSeed = (token: string): string => `gem-swap-${token}`;

/** A fresh round: the seed's initial board, full tapes, no swaps. */
export function createRound(seed: string, colors: ColorCount): Round {
  const initial = generateInitialBoard(seed, colors);
  return {
    seed,
    colors,
    initial: initial.board,
    bundled: initial.fallback,
    board: initial.board,
    tape: freshTape(),
    score: 0,
    swaps: [],
    status: 'playing',
    endReason: null,
  };
}

export const swapsLeft = (round: Round): number => ROUND_SWAPS - round.swaps.length;

/** The outcome of one valid swap: the next round and the move to replay on screen. */
export interface SwapOutcome {
  readonly round: Round;
  readonly move: MoveResult;
}

/**
 * Tries the swap of cells a and b. Null when the round is over or the swap is
 * not valid (§1) — the round is unchanged and the caller shows nothing (§3).
 * `stageLimit` exists for the test that drives the cascade cap; play, Undo
 * and replay always use CASCADE_STAGE_LIMIT.
 */
export function trySwap(
  round: Round,
  a: number,
  b: number,
  stageLimit: number = CASCADE_STAGE_LIMIT,
): SwapOutcome | null {
  if (round.status !== 'playing') return null;
  const move = resolveSwap(
    round.board,
    a,
    b,
    { seed: round.seed, colors: round.colors, tape: round.tape },
    stageLimit,
  );
  if (move === null) return null;

  const swaps = [...round.swaps, normaliseSwap(a, b)];
  let endReason: EndReason | null = null;
  if (move.capped) endReason = 'cap';
  else if (swaps.length >= ROUND_SWAPS) endReason = 'swaps';
  else if (!hasValidSwap(move.board)) endReason = 'stuck';

  return {
    move,
    round: {
      ...round,
      board: move.board,
      tape: move.tape,
      score: round.score + move.score,
      swaps,
      status: endReason === null ? 'playing' : 'over',
      endReason,
    },
  };
}

/** Undo is offered only while the round is playing and has a swap to take back (§6). */
export const canUndo = (round: Round): boolean =>
  round.status === 'playing' && round.swaps.length > 0;

/**
 * Takes the last swap back, whole (§6): board, score, swaps left and every
 * column's tape position, by replaying the rest from the initial board. Null
 * when there is nothing to undo or the round is over.
 */
export function undoRound(round: Round): Round | null {
  if (!canUndo(round)) return null;
  return replayFrom(
    round.seed,
    round.colors,
    round.initial,
    round.bundled,
    round.swaps.slice(0, -1),
  );
}

function replayFrom(
  seed: string,
  colors: ColorCount,
  initial: Board,
  bundled: boolean,
  swaps: readonly Swap[],
): Round | null {
  let round: Round = {
    seed,
    colors,
    initial,
    bundled,
    board: initial,
    tape: freshTape(),
    score: 0,
    swaps: [],
    status: 'playing',
    endReason: null,
  };
  for (const swap of swaps) {
    const outcome = trySwap(round, swap[0], swap[1]);
    if (outcome === null) return null;
    round = outcome.round;
  }
  return round;
}

/** The record to suspend (§7). */
export const toRecord = (round: Round): RoundRecord => ({
  seed: round.seed,
  colors: round.colors,
  swaps: round.swaps,
});

/**
 * The record's shape alone, with no replay (§7): a non-empty seed, a known
 * colour count, and at most 30 pairs of cell indices, normalised (a < b).
 * Null otherwise. This is the gate that bounds the work of a replay — a list
 * longer than 30 is rejected here, before any resolution is attempted (§4.5).
 * Whether the pairs are adjacent and valid is the replay's question.
 */
export function parseRoundRecord(record: unknown): RoundRecord | null {
  if (typeof record !== 'object' || record === null) return null;
  const { seed, colors, swaps } = record as Record<string, unknown>;
  if (typeof seed !== 'string' || seed.length === 0) return null;
  if (!isColorCount(colors)) return null;
  if (!Array.isArray(swaps) || swaps.length > ROUND_SWAPS) return null;
  const parsed: Swap[] = [];
  for (const pair of swaps) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [a, b] = pair as unknown[];
    if (!isCellIndex(a) || !isCellIndex(b)) return null;
    parsed.push(normaliseSwap(a, b));
  }
  return { seed, colors, swaps: parsed };
}

/**
 * Rebuilds a round from (seed, colors, swaps), or null if the rules could not
 * have produced that list (§7): unknown colour count, empty seed, a pair that
 * is not two cell indices, a non-adjacent or run-less swap, more than 30
 * swaps, or any swap after the round ended. Work is bounded: at most 30
 * resolutions, checked by `parseRoundRecord` before any is attempted.
 */
export function replayRound(record: unknown): Round | null {
  const parsed = parseRoundRecord(record);
  if (parsed === null) return null;
  const start = generateInitialBoard(parsed.seed, parsed.colors);
  return replayFrom(parsed.seed, parsed.colors, start.board, start.fallback, parsed.swaps);
}

/**
 * The suspended record as storage should read it (§7): a round that replays
 * and is still being played. A finished round is never saved, so one that
 * reads back finished is rejected like any other impossible record.
 */
export function restoreRound(record: unknown): Round | null {
  const round = replayRound(record);
  return round !== null && round.status === 'playing' ? round : null;
}
