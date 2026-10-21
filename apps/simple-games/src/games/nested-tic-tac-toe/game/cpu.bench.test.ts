/**
 * What the hard CPU costs (docs/NESTED_TIC_TAC_TOE_RULES.md §4.3).
 *
 * **This gate watches deterministic work, not the clock.** A wall-clock
 * threshold in `pnpm test` measures the runner it lands on; this repository
 * settled that for its search tests — 「壁時計は判定していない」
 * (docs/RELEASE_CHECKLIST.md, docs/SUDOKU_RULES.md §7). The assertions are
 * on nodes visited — the one cumulative counter of a reply, summed over its
 * iterations (§4.1) — which is the same number on every machine; the elapsed
 * time is printed for a reader and judged by nothing.
 *
 * The limit itself was chosen by measuring against the four shipped hard
 * opponents outside this repository (§4.3 — a test here cannot import other
 * games). What this file proves is that the limit holds, holds identically
 * twice, and is actually reached.
 *
 * The set (§4.3): the empty board, plus one position from each seeded random
 * game `nt-bench-1`…`nt-bench-11` — for 1–6 the first free-move position from
 * ply 10 on (the widest roots this game has), for 7–11 plies 8, 12, 16, 20
 * and 24.
 *
 * The second half rebuilds the 213 positions §4.3's step 1 measured the time
 * of, and pins what about them is deterministic: how many there are, how
 * many are free moves, how many end in a win at once, and — in the full run
 * only, since it is 210 hard replies — how deep hard reads in each:
 *
 *   NT_SELFPLAY=full pnpm exec vitest run src/games/nested-tic-tac-toe/game/cpu.bench.test.ts
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { decideCpuMove, HARD_NODE_LIMIT, NORMAL_MAX_DEPTH } from './cpu';
import { isFreeMove, isOver, positionFromMoves } from './engine';
import { randomGame } from './test-helpers';

/** The slow checks share the self-play file's switch: one variable for "the full run". */
const FULL = process.env.NT_SELFPLAY === 'full';

function benchPosition(n: number): number[] {
  const game = randomGame(`nt-bench-${n}`);
  const unfinished = (ply: number) => !isOver(positionFromMoves(game.slice(0, ply))!);
  if (n <= 6) {
    for (let ply = 10; ply < game.length; ply++) {
      if (isFreeMove(positionFromMoves(game.slice(0, ply))!)) return game.slice(0, ply);
    }
    throw new Error(`nt-bench-${n} has no free-move position from ply 10`);
  }
  const ply = 8 + 4 * (n - 7);
  if (!unfinished(ply) || ply >= game.length)
    throw new Error(`nt-bench-${n} is over by ply ${ply}`);
  return game.slice(0, ply);
}

const POSITIONS: number[][] = [[], ...Array.from({ length: 11 }, (_, i) => benchPosition(i + 1))];

interface Cost {
  readonly plies: number;
  readonly free: boolean;
  readonly nodes: number;
  readonly again: number;
  readonly depth: number;
  readonly ms: number;
}

const costs: Cost[] = [];

/**
 * Every reply is measured here, twice, and the checks read the numbers — the
 * search runs 24 times, not once per `it()`. The timeout guards a hang; it is
 * not a performance gate.
 */
beforeAll(() => {
  for (const moves of POSITIONS) {
    const started = performance.now();
    const first = decideCpuMove({ moves, difficulty: 'hard', seed: 'nt-bench' })!;
    const ms = performance.now() - started;
    const again = decideCpuMove({ moves, difficulty: 'hard', seed: 'nt-bench' })!;
    expect(again.cell).toBe(first.cell);
    costs.push({
      plies: moves.length,
      free: isFreeMove(positionFromMoves(moves)!),
      nodes: first.nodes,
      again: again.nodes,
      depth: first.completedDepth,
      ms,
    });
  }
}, 120_000);

describe('the hard CPU keeps to its budget (§4.3)', () => {
  it('measures the set it promises: the empty board and at least five free-move positions', () => {
    expect(costs).toHaveLength(12);
    expect(costs[0]!.plies).toBe(0);
    // Seven, counting the empty board — the number §4.3 and §13 state.
    expect(costs.filter((cost) => cost.free).length).toBe(7);
  });

  it('never visits more nodes than it is allowed', () => {
    for (const cost of costs) expect(cost.nodes).toBeLessThanOrEqual(HARD_NODE_LIMIT);
  });

  it('spends exactly the same work twice — the budget is not luck', () => {
    for (const cost of costs) expect(cost.again).toBe(cost.nodes);
  });

  it('actually uses the budget — a search that stopped early proves nothing', () => {
    // A cut-off iteration ends with the counter exactly at the limit (it is
    // checked before counting, §4.1). In this set every reply is cut off.
    for (const cost of costs) expect(cost.nodes).toBe(HARD_NODE_LIMIT);
  });

  it('finishes the depths §4.1 and §4.3 state — 4 to 6 in this set, so normal’s 3 fits in each', () => {
    // Deterministic: the node count, and so the depth each reply finishes,
    // is the same on every machine (§4.1).
    expect(costs.map((cost) => cost.depth)).toEqual([4, 4, 5, 5, 6, 5, 5, 5, 6, 6, 6, 6]);
  });

  it('reports what it took in wall-clock, without judging it', () => {
    const lines = costs.map(
      (cost) =>
        `  ply ${String(cost.plies).padStart(2)} ${cost.free ? 'free' : 'sent'}: ` +
        `${cost.nodes} nodes, depth ${cost.depth}, ${cost.ms.toFixed(1)}ms`,
    );
    const total = costs.reduce((sum, cost) => sum + cost.ms, 0);
    console.log(
      `nested hard reply (node limit ${HARD_NODE_LIMIT}), ${costs.length} positions, ` +
        `${(total / costs.length).toFixed(1)}ms average — reported, not asserted\n${lines.join('\n')}`,
    );
  });
});

/**
 * §4.3 step 1's positions: seeds `measure-nested-tic-tac-toe-1`…`40`, plies
 * 4, 12, 20, 28 and 36 where the match is still going; then, while fewer
 * than 20 are free moves, the first free-move position from ply 4 of the
 * next seed, from 41 on.
 */
function measuringSet(): { moves: number[][]; base: number; baseFree: number; lastSeed: number } {
  const moves: number[][] = [];
  let baseFree = 0;
  for (let n = 1; n <= 40; n++) {
    const game = randomGame(`measure-nested-tic-tac-toe-${n}`);
    for (const ply of [4, 12, 20, 28, 36]) {
      if (ply >= game.length) continue;
      const position = positionFromMoves(game.slice(0, ply))!;
      if (isOver(position)) continue;
      moves.push(game.slice(0, ply));
      if (isFreeMove(position)) baseFree += 1;
    }
  }
  const base = moves.length;
  let free = baseFree;
  let lastSeed = 40;
  for (let n = 41; free < 20; n++) {
    lastSeed = n;
    const game = randomGame(`measure-nested-tic-tac-toe-${n}`);
    for (let ply = 4; ply < game.length; ply++) {
      if (isFreeMove(positionFromMoves(game.slice(0, ply))!)) {
        moves.push(game.slice(0, ply));
        free += 1;
        break;
      }
    }
  }
  return { moves, base, baseFree, lastSeed };
}

describe('the measuring set of §4.3 step 1', () => {
  const set = measuringSet();

  it('holds 200 positions with 7 free moves, topped up from seeds 41–53 to 213', () => {
    expect({ base: set.base, baseFree: set.baseFree }).toEqual({ base: 200, baseFree: 7 });
    expect(set.lastSeed).toBe(53);
    expect(set.moves).toHaveLength(213);
  });

  it('has 3 positions where the side to move wins at once, without searching', () => {
    // The win check is the same at every strength and comes first (§4.1);
    // asking easy keeps the 210 others from running a hard search here.
    const wins = set.moves.filter(
      (moves) => decideCpuMove({ moves, difficulty: 'easy', seed: 'measure' })!.kind === 'win',
    );
    expect(wins).toHaveLength(3);
  });

  it.skipIf(!FULL)(
    'reads hard 4 to 7 deep in the other 210 under the limit, so normal’s 3 finishes in each',
    () => {
      const depths: Record<number, number> = {};
      for (const moves of set.moves) {
        const decision = decideCpuMove({ moves, difficulty: 'hard', seed: 'measure' })!;
        if (decision.kind === 'win') continue;
        expect(decision.kind).toBe('search');
        depths[decision.completedDepth] = (depths[decision.completedDepth] ?? 0) + 1;
      }
      expect(depths).toEqual({ 4: 2, 5: 39, 6: 121, 7: 48 });
      // Normal runs the same iterations under the same limit, only capped:
      // hard finishing depth 4 everywhere means normal finishes its 3.
      expect(Math.min(...Object.keys(depths).map(Number))).toBeGreaterThan(NORMAL_MAX_DEPTH);
    },
    300_000,
  );
});
