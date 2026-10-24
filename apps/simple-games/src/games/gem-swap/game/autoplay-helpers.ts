/**
 * Quality measurement by auto-play (docs/GEM_SWAP_RULES.md §14, plan test ⑨)
 * — the shared part of autoplay-random.test.ts and autoplay-greedy.test.ts.
 * Test-only; not exported from index.ts.
 *
 * Two simple players (defined in docs/GEM_SWAP_RULES.md §14), each over
 * 2,000 seeds for both colour counts:
 *   - random: a uniformly random valid swap (seeded per round);
 *   - greedy: the valid swap whose first stage clears the most gems right
 *     away (ties: the first in ADJACENT_PAIRS order). It looks at nothing
 *     the screen does not show — no refill, no cascade, no Undo.
 * Neither uses Undo or look-ahead, so the numbers describe the rules and the
 * generator, not a person's play (§13).
 *
 * The gate is the workload — 2,000 rounds of at most 30 moves, at most 64
 * stages a move — never wall-clock, which is printed only. The rounds run in
 * chunks of CHUNK seeds, one `it` each, so no single test carries more than
 * about a second of deterministic work (docs/ARCHITECTURE.md「CI / リリース」:
 * split by seed rather than raise the timeout). CHUNK was 50 until the
 * seven-kind measurement joined the run: under a host load average near 20,
 * fifty greedy seeds took up to 4.5 s and one chunk failed once, so it is 25.
 */
import { expect } from 'vitest';
import { ADJACENT_PAIRS, clearedCells, hasRun, swapCells, validSwaps } from './board';
import { generateInitialBoard } from './generator';
import { createRng } from './rng';
import { createRound, replayRound, toRecord, trySwap, type EndReason, type Round } from './round';
import { summarize } from './test-helpers';
import { CASCADE_STAGE_LIMIT, ROUND_SWAPS, type Board, type ColorCount, type Swap } from './types';

export const ROUNDS = 2_000;
export const CHUNK = 25;
/** §15: written before measuring. Above this, the default colour count goes back to the owner. */
export const STUCK_THRESHOLD = 0.1;

export type Policy = 'random' | 'greedy';

/**
 * Seven kinds are not in v1 (§2): not a ColorCount, refused by the record
 * gate, never offered on screen. autoplay-seven.test.ts runs the same two
 * players over seven kinds only so the owner can decide with numbers (§14,
 * §15). The pure functions treat the count as "kinds 0..n-1" and nothing
 * else, so the measurement passes 7 through a cast; nothing outside the
 * tests ever does.
 */
export const SEVEN = 7;
export type MeasuredColors = ColorCount | typeof SEVEN;

/**
 * The definition of a valid swap, by brute force: the two gems differ and the
 * exchanged board has a run anywhere (§1). `validSwaps` uses the local check
 * (only the lines through the two cells — §13), which is right only on a
 * settled board; every decision of the first chunk is compared with this.
 */
const bruteValidSwaps = (board: Board): Swap[] =>
  ADJACENT_PAIRS.filter(([a, b]) => board[a] !== board[b] && hasRun(swapCells(board, a, b)));

/** Seeds below this get the brute-force comparison at every decision. */
export const BRUTE_FORCE_SEEDS = 50;

/**
 * The brute-forced seeds run ten to a test: their decisions cost several
 * times the others', and fifty of them in one `it` ran past vitest's 5 s
 * timeout under the full parallel run of Phase 3 (5.5 s once; about 1.2 s
 * alone). Split by seed rather than raise the timeout, as above.
 */
export const BRUTE_FORCE_CHUNK = 10;

/** The [from, to) seed ranges, one `it` each. */
export function chunkRanges(): [number, number][] {
  const ranges: [number, number][] = [];
  for (let from = 0; from < ROUNDS;) {
    const size = from < BRUTE_FORCE_SEEDS ? BRUTE_FORCE_CHUNK : CHUNK;
    ranges.push([from, Math.min(ROUNDS, from + size)]);
    from += size;
  }
  return ranges;
}

function choose(policy: Policy, round: Round, swaps: readonly Swap[], pick: () => number): Swap {
  if (policy === 'random') return swaps[Math.floor(pick() * swaps.length)]!;
  let best = swaps[0]!;
  let bestCount = -1;
  for (const swap of swaps) {
    const count = clearedCells(swapCells(round.board, swap[0], swap[1])).length;
    if (count > bestCount) {
      best = swap;
      bestCount = count;
    }
  }
  return best;
}

export interface Measured {
  rounds: number;
  ends: Record<EndReason, number>;
  scores: number[];
  stuckAt: number[];
  stagesPerMove: Map<number, number>;
  moves: number;
  maxStages: number;
  fallbacks: number;
  choicesPerDecision: number[];
  /** Initial-board draws per round (§4.1). */
  attempts: number[];
  /** Decisions whose `validSwaps` was compared with the brute force (seeds below BRUTE_FORCE_SEEDS). */
  bruteChecked: number;
  millis: number;
}

export const emptyMeasured = (): Measured => ({
  rounds: 0,
  ends: { swaps: 0, stuck: 0, cap: 0 },
  scores: [],
  stuckAt: [],
  stagesPerMove: new Map(),
  moves: 0,
  maxStages: 0,
  fallbacks: 0,
  choicesPerDecision: [],
  attempts: [],
  bruteChecked: 0,
  millis: 0,
});

/**
 * Plays seeds [from, to) and adds them to `into`. Every 5- or 6-kind round's
 * record must replay exactly (§7); a 7-kind record must be refused.
 */
export function playChunk(
  policy: Policy,
  colors: MeasuredColors,
  from: number,
  to: number,
  into: Measured,
): void {
  const started = performance.now();
  // See SEVEN: the cast is the measurement's alone.
  const count = colors as ColorCount;
  for (let i = from; i < to; i++) {
    const seed = `gem-swap-auto-${i}`;
    const pick = createRng(`auto-pick:${policy}:${seed}`);
    into.attempts.push(generateInitialBoard(seed, count).attempts);
    let round = createRound(seed, count);
    if (round.bundled) into.fallbacks++;
    while (round.status === 'playing') {
      const swaps = validSwaps(round.board);
      if (i < BRUTE_FORCE_SEEDS) {
        expect(swaps).toEqual(bruteValidSwaps(round.board));
        into.bruteChecked++;
      }
      into.choicesPerDecision.push(swaps.length);
      const [a, b] = choose(policy, round, swaps, pick);
      const outcome = trySwap(round, a, b)!;
      const stages = outcome.move.stages.length;
      into.stagesPerMove.set(stages, (into.stagesPerMove.get(stages) ?? 0) + 1);
      into.maxStages = Math.max(into.maxStages, stages);
      into.moves++;
      round = outcome.round;
    }
    const reason = round.endReason!;
    into.ends[reason]++;
    if (reason === 'stuck') into.stuckAt.push(round.swaps.length);
    into.scores.push(round.score);
    into.rounds++;
    const replayed = replayRound(JSON.parse(JSON.stringify(toRecord(round))) as unknown);
    if (colors === SEVEN) expect(replayed).toBeNull();
    else expect(replayed).toEqual(round);
  }
  into.millis += performance.now() - started;
}

/**
 * Prints the whole run and checks what the rules promise about it. The stuck
 * rate is gated against STUCK_THRESHOLD for the shipped counts only; for
 * seven kinds it is the number the owner decides with (§15), printed, not a
 * gate.
 */
export function reportAndCheck(policy: Policy, colors: MeasuredColors, m: Measured): void {
  const rate = m.ends.stuck / m.rounds;
  const histogram = [...m.stagesPerMove.entries()].sort((x, y) => x[0] - y[0]);
  console.log(
    `[gem-swap §14] auto-play ${policy}, ${colors} colours, ${m.rounds} rounds: ` +
      `ends ${JSON.stringify(m.ends)}, stuck before 30 ${m.ends.stuck} ` +
      `(${(rate * 100).toFixed(2)} %, threshold ${STUCK_THRESHOLD * 100} %), ` +
      `stuck at swap ${m.stuckAt.length > 0 ? JSON.stringify(summarize(m.stuckAt)) : '-'}, ` +
      `score ${JSON.stringify(summarize(m.scores))}, ` +
      `moves ${m.moves}, stages per move ${JSON.stringify(histogram)}, max stages ${m.maxStages}, ` +
      `valid swaps per decision ${JSON.stringify(summarize(m.choicesPerDecision))}, ` +
      `validSwaps = brute force at ${m.bruteChecked} decisions (seeds 0–${BRUTE_FORCE_SEEDS - 1}), ` +
      `initial draws ${JSON.stringify(attemptCounts(m.attempts))}, ` +
      `initial fallbacks ${m.fallbacks}, ${(m.millis / 1000).toFixed(1)} s (wall-clock, printed only)`,
  );
  expect(m.rounds).toBe(ROUNDS);
  expect(m.ends.swaps + m.ends.stuck + m.ends.cap).toBe(ROUNDS);
  expect(m.moves).toBeLessThanOrEqual(ROUNDS * ROUND_SWAPS);
  // §13: the local validity check matched the brute force at every decision of the first chunk.
  expect(m.bruteChecked).toBeGreaterThan(0);
  // §4.4: the cap is never reached, nor approached (max seen is far below 64).
  expect(m.ends.cap).toBe(0);
  expect(m.maxStages).toBeLessThan(CASCADE_STAGE_LIMIT / 4);
  // §4.1: no seed needed the bundled board.
  expect(m.fallbacks).toBe(0);
  if (colors === SEVEN) return;
  // §15: under the threshold, the default (6 colours) stands without the owner.
  expect(rate).toBeLessThanOrEqual(STUCK_THRESHOLD);
}

/** Draws → rounds, ascending by draws. */
function attemptCounts(attempts: readonly number[]): [number, number][] {
  const counts = new Map<number, number>();
  for (const a of attempts) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => x[0] - y[0]);
}
