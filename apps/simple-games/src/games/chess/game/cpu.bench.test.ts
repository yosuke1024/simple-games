/**
 * What the hard CPU costs (docs/CHESS_RULES.md §5.3, §13).
 *
 * **This gate watches deterministic work, not the clock.** A wall-clock
 * threshold in `pnpm test` measures the runner it lands on; this repository
 * settled that for its search tests — 「壁時計は判定していない」
 * (docs/RELEASE_CHECKLIST.md, docs/SUDOKU_RULES.md §7). The assertions are
 * on nodes visited — the one counter of a reply, summed over its iterations
 * (§5.3) — which is the same number on every machine; the elapsed time is
 * printed for a reader and judged by nothing.
 *
 * The limit itself was chosen by measuring against the shipped hard
 * opponents outside this repository (§5.3 — a test here cannot import other
 * games). What this file proves is that the limit holds, holds identically
 * twice, is actually reached, and leaves hard reading at least as deep as
 * normal's fixed depth in every position of the set.
 *
 * The set (§5.3): the starting position, the four published perft positions
 * of §12 (sharp middlegames with castling, en passant and promotions in
 * reach), and one position from each seeded random game `chess-bench-1` …
 * `chess-bench-3` at plies 10, 20 and 30. Eight positions, each searched
 * twice: a hard reply costs about a second inside vitest on the machine this
 * was written on (§13), so the set is kept to what the checks need.
 *
 * The second half rebuilds §5.3's measuring set (seeds `measure-chess-1` …
 * `40`, plies 4, 12, 20, 28, 36) and pins what about it is deterministic: how
 * many positions there are and how many are decided without a search; in the
 * full run only (200 hard replies), how deep hard reads in each:
 *
 *   CHESS_SELFPLAY=full pnpm exec vitest run src/games/chess/game/cpu.bench.test.ts
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { decideCpuMove, HARD_NODE_LIMIT, MATE_VALUE, NORMAL_MAX_DEPTH } from './cpu';
import { clonePosition, type Position } from './engine';
import { createGame, playMove } from './record';
import { createRng } from './rng';
import type { HistoryEntry } from './rules';
import { fen } from './test-helpers';

/** The slow checks share the self-play file's switch: one variable for "the full run". */
const FULL = process.env.CHESS_SELFPLAY === 'full';

interface Snapshot {
  readonly name: string;
  readonly position: Position;
  readonly history?: readonly HistoryEntry[];
  readonly moveCount: number;
}

/** A seeded random game played to `ply` (or null when it ended sooner). */
function randomPosition(seed: string, ply: number): Snapshot | null {
  const rng = createRng(seed);
  const game = createGame();
  while (game.moves.length < ply && game.outcome === null) {
    playMove(game, game.legal[Math.floor(rng() * game.legal.length)]!);
  }
  if (game.outcome !== null) return null;
  return {
    name: `${seed}@${ply}`,
    position: clonePosition(game.position),
    history: [...game.history],
    moveCount: ply,
  };
}

const PUBLISHED: readonly [string, string][] = [
  ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'],
];

const POSITIONS: Snapshot[] = [
  ...PUBLISHED.map(([name, text]) => ({ name, position: fen(text), moveCount: 0 })),
  ...Array.from({ length: 3 }, (_, i) => randomPosition(`chess-bench-${i + 1}`, 10 + 10 * i)!),
];

interface Cost {
  readonly name: string;
  readonly kind: string;
  readonly nodes: number;
  readonly again: number;
  readonly depth: number;
  readonly capped: boolean;
  readonly ms: number;
}

const costs: Cost[] = [];

const reply = (snapshot: Snapshot) =>
  decideCpuMove({
    position: snapshot.position,
    history: snapshot.history,
    difficulty: 'hard',
    seed: 'chess-bench',
    moveCount: snapshot.moveCount,
  })!;

/**
 * Every reply is measured here, twice, and the checks read the numbers. The
 * timeout guards a hang; it is not a performance gate.
 */
beforeAll(() => {
  for (const snapshot of POSITIONS) {
    const started = performance.now();
    const first = reply(snapshot);
    const ms = performance.now() - started;
    const again = reply(snapshot);
    expect(again.move).toBe(first.move);
    costs.push({
      name: snapshot.name,
      kind: first.kind,
      nodes: first.nodes,
      again: again.nodes,
      depth: first.completedDepth,
      capped: first.capped,
      ms,
    });
  }
}, 120_000);

describe('the hard CPU keeps to its budget (§5.3)', () => {
  it('measures the eight positions it promises, every one by search', () => {
    expect(costs).toHaveLength(8);
    for (const cost of costs) expect(cost.kind).toBe('search');
  });

  it('never visits more nodes than it is allowed', () => {
    for (const cost of costs) expect(cost.nodes).toBeLessThanOrEqual(HARD_NODE_LIMIT);
  });

  it('spends exactly the same work twice — the budget is not luck', () => {
    for (const cost of costs) expect(cost.again).toBe(cost.nodes);
  });

  it('actually uses the budget, and says so — a search that stopped early proves nothing', () => {
    // A cut-off reply ends with the counter exactly at the limit (it is
    // checked before counting) and reports `capped`.
    for (const cost of costs) {
      expect(cost.capped).toBe(cost.nodes === HARD_NODE_LIMIT);
    }
    expect(costs.filter((cost) => cost.capped).length).toBe(BENCH_CAPPED);
  });

  it('visits the node counts §13 states, position by position', () => {
    expect(costs.map((cost) => cost.nodes)).toEqual(BENCH_NODES);
  });

  it('finishes the depths §5.3 and §13 state — never shallower than normal’s fixed depth', () => {
    expect(costs.map((cost) => cost.depth)).toEqual(BENCH_DEPTHS);
    for (const cost of costs) expect(cost.depth).toBeGreaterThanOrEqual(NORMAL_MAX_DEPTH);
  });

  it('reports what it took in wall-clock, without judging it', () => {
    const lines = costs.map(
      (cost) =>
        `  ${cost.name.padEnd(18)} ${String(cost.nodes).padStart(6)} nodes, depth ${cost.depth}` +
        `${cost.capped ? ' (capped)' : ''}, ${cost.ms.toFixed(1)}ms`,
    );
    const total = costs.reduce((sum, cost) => sum + cost.ms, 0);
    console.log(
      `chess hard reply (node limit ${HARD_NODE_LIMIT}), ${costs.length} positions, ` +
        `${(total / costs.length).toFixed(1)}ms average — reported, not asserted\n${lines.join('\n')}`,
    );
  });
});

/** §5.3's measuring set: seeds `measure-chess-1` … `40`, plies 4, 12, 20, 28, 36, where still going. */
function measuringSet(): Snapshot[] {
  const out: Snapshot[] = [];
  for (let n = 1; n <= 40; n++) {
    for (const ply of [4, 12, 20, 28, 36]) {
      const snapshot = randomPosition(`measure-chess-${n}`, ply);
      if (snapshot === null) break;
      out.push(snapshot);
    }
  }
  return out;
}

describe('the measuring set of §5.3', () => {
  const set = measuringSet();

  it(`holds ${MEASURING_SET_SIZE} positions, ${MEASURING_SET_UNSEARCHED} of them decided without a search`, () => {
    expect(set).toHaveLength(MEASURING_SET_SIZE);
    // Easy is asked: the mate-in-one and single-move checks come first at
    // every strength (§5.1), and easy runs no search for the others.
    const unsearched = set.filter((snapshot) => {
      const kind = decideCpuMove({
        position: snapshot.position,
        history: snapshot.history,
        difficulty: 'easy',
        seed: 'measure',
        moveCount: snapshot.moveCount,
      })!.kind;
      return kind === 'mate' || kind === 'only';
    });
    expect(unsearched).toHaveLength(MEASURING_SET_UNSEARCHED);
  });

  it.skipIf(!FULL)(
    'reads hard to the depths §5.3 states — never shallower than normal unless a mate was read (CHESS_SELFPLAY=full)',
    () => {
      const depths: Record<number, number> = {};
      let shallowUncapped = 0;
      for (const snapshot of set) {
        const decision = decideCpuMove({
          position: snapshot.position,
          history: snapshot.history,
          difficulty: 'hard',
          seed: 'measure',
          moveCount: snapshot.moveCount,
        })!;
        if (decision.kind !== 'search') continue;
        depths[decision.completedDepth] = (depths[decision.completedDepth] ?? 0) + 1;
        // Shallower than normal's depth is allowed only when the search stopped
        // on its own — a forced mate read — never because the budget ran out.
        if (decision.completedDepth < NORMAL_MAX_DEPTH) {
          expect(decision.capped).toBe(false);
          expect(Math.abs(decision.value)).toBeGreaterThan(MATE_VALUE / 2);
          shallowUncapped += 1;
        }
      }
      console.log(`chess measuring set, hard completed depths: ${JSON.stringify(depths)}`);
      expect(depths).toEqual(MEASURING_SET_DEPTHS);
      expect(shallowUncapped).toBe(MEASURING_SET_DEPTHS[1] ?? 0);
    },
    600_000,
  );
});

/* The measured literals (§13). Deterministic: the same on every machine. */
const BENCH_DEPTHS: number[] = [5, 4, 6, 5, 4, 5, 5, 4];
const BENCH_CAPPED = 7;
const BENCH_NODES: number[] = [80_000, 80_000, 44_906, 80_000, 80_000, 80_000, 80_000, 80_000];
const MEASURING_SET_SIZE = 200;
const MEASURING_SET_UNSEARCHED = 2;
const MEASURING_SET_DEPTHS: Record<number, number> = { 1: 1, 3: 1, 4: 54, 5: 137, 6: 5 };
