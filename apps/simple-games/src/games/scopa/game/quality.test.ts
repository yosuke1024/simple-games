/**
 * Quality over many seeds (⑨ of docs/SCOPA_RULES.md §15.2): what self-play
 * actually looks like, measured on fixed seeds so the numbers §15 quotes are
 * the numbers this file prints.
 *
 * **None of this is a strength gate** (§4.1). The CPU has one strength and
 * there is nothing to rank it against, so no threshold is set: the counts are
 * pinned only so that the rules document and this test cannot quietly drift
 * apart. If a change to the weights moves them, the change rewrites §15 in the
 * same commit — and if it makes the CPU lose to the random players, these
 * numbers are the only place that shows. Wall-clock times are printed and
 * never asserted.
 */
import { describe, expect, it } from 'vitest';
import { dealOrder } from './engine';
import {
  cpuStrategy,
  histogram,
  percentile,
  playMatch,
  randomCardThenOption,
  randomPairs,
  seats,
  type MatchRecord,
  type Strategy,
} from './test-helpers';
import { CPU, YOU } from './types';

interface Run {
  readonly name: string;
  readonly matches: readonly MatchRecord[];
}

function run(name: string, you: Strategy, cpu: Strategy, count: number): Run {
  const matches = Array.from({ length: count }, (_, i) =>
    playMatch(`scopa-quality-${i}`, seats(you, cpu), { time: true }),
  );
  return { name, matches };
}

const share = (part: number, whole: number): string => `${((100 * part) / whole).toFixed(1)}%`;

function describeRun({ name, matches }: Run) {
  const wins = matches.filter((m) => m.status === 'won').length;
  const plays = matches.flatMap((m) => m.plays);
  const same = plays.filter((p) => p.move.captured.length === 1).length;
  const sum = plays.filter((p) => p.move.captured.length >= 2).length;
  const placed = plays.filter((p) => p.move.captured.length === 0).length;
  const tables = plays.map((p) => p.tableBefore).sort((a, b) => a - b);
  const deals = matches.flatMap((m) => m.deals);
  const scopasPerDeal = deals.map((d) => d.outcome.scopas[YOU] + d.outcome.scopas[CPU]);
  const dealsPerMatch = matches.map((m) => m.deals.length);
  const redeals = deals.filter((d) => d.redeals > 0).length;
  const scopaBuckets = [0, 1, 2, 3].map(
    (n) => scopasPerDeal.filter((k) => (n === 3 ? k >= 3 : k === n)).length,
  );
  const perMatch = new Map<number, number>();
  for (const n of dealsPerMatch) perMatch.set(n, (perMatch.get(n) ?? 0) + 1);
  const modeDeals = [...perMatch].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
  return {
    name,
    matches: matches.length,
    youWins: wins,
    cpuWins: matches.length - wins,
    plays: plays.length,
    same,
    sum,
    placed,
    tableP50: percentile(tables, 50),
    tableP99: percentile(tables, 99),
    tableMax: tables[tables.length - 1]!,
    tables: histogram(tables),
    deals: deals.length,
    scopas: histogram(scopasPerDeal),
    dealsPerMatch: histogram(dealsPerMatch),
    redeals,
    scopaBuckets,
    dealsRange: [Math.min(...dealsPerMatch), Math.max(...dealsPerMatch), modeDeals],
  };
}

function print(summary: ReturnType<typeof describeRun>): void {
  const captures = summary.same + summary.sum;
  console.log(
    `[scopa] ${summary.name}: ${summary.matches} matches, player ${summary.youWins} / CPU seat ${summary.cpuWins} ` +
      `(CPU seat ${share(summary.cpuWins, summary.matches)}); ${summary.plays} plays: same value ${summary.same} ` +
      `(${share(summary.same, summary.plays)} of plays, ${share(summary.same, captures)} of captures), ` +
      `sum ${summary.sum} (${share(summary.sum, summary.plays)}), placed ${summary.placed} ` +
      `(${share(summary.placed, summary.plays)}); table before a play p50=${summary.tableP50} ` +
      `p99=${summary.tableP99} max=${summary.tableMax} ${summary.tables}; ${summary.deals} deals, ` +
      `scopas per deal ${summary.scopas}; deals per match ${summary.dealsPerMatch}; ` +
      `deals reshuffled ${summary.redeals}`,
  );
}

/** Generous: each run is a couple of seconds alone, and the suite runs files in parallel. */
const RUN_TIMEOUT_MS = 30_000;

const cases: readonly [string, Strategy, Strategy, number][] = [
  ['random (pairs) vs CPU', randomPairs, cpuStrategy, 1000],
  ['random (card, then way) vs CPU', randomCardThenOption, cpuStrategy, 1000],
  ['CPU vs CPU', cpuStrategy, cpuStrategy, 500],
  ['random vs random', randomPairs, randomPairs, 500],
];

/**
 * Each run is played once, by whichever test first asks for it, and shared
 * from then on: a test that reads all four (the CPU's decisions) plays the
 * ones not yet played, so it passes alone (`-t`) or in any order.
 */
const played = new Map<number, Run>();
function runAt(at: number): Run {
  let measured = played.get(at);
  if (measured === undefined) {
    const [name, you, cpu, count] = cases[at]!;
    measured = run(name, you, cpu, count);
    played.set(at, measured);
  }
  return measured;
}

describe('self-play on fixed seeds (§15.2 ⑨)', () => {
  cases.forEach(([name], at) => {
    it(
      `measures ${name}`,
      () => {
        const summary = describeRun(runAt(at));
        print(summary);
        expect({
          name: summary.name,
          wins: [summary.youWins, summary.cpuWins],
          plays: [summary.same, summary.sum, summary.placed],
          table: [summary.tableP50, summary.tableP99, summary.tableMax],
          deals: summary.deals,
          scopas: summary.scopaBuckets,
          dealsPerMatch: summary.dealsRange,
          reshuffled: summary.redeals,
        }).toEqual(PINNED_RUNS[at]);
      },
      RUN_TIMEOUT_MS,
    );
  });

  it(
    'measures the CPU’s own decisions across those runs: work and wall clock',
    () => {
      const runs = cases.map((_, at) => runAt(at));
      const decisions = runs.flatMap((r) =>
        r.matches.flatMap((m) => m.plays.filter((p) => p.nodes > 0)),
      );
      const nodes = decisions.map((p) => p.nodes).sort((a, b) => a - b);
      const ms = decisions.map((p) => p.ms).sort((a, b) => a - b);
      console.log(
        `[scopa] CPU decisions: ${decisions.length}; subsets visited p50=${percentile(nodes, 50)} ` +
          `p99=${percentile(nodes, 99)} max=${nodes[nodes.length - 1]}; wall clock ms ` +
          `p50=${percentile(ms, 50).toFixed(4)} max=${ms[ms.length - 1]!.toFixed(3)} (reported, not a limit)`,
      );
      expect([
        decisions.length,
        percentile(nodes, 50),
        percentile(nodes, 99),
        nodes[nodes.length - 1],
      ]).toEqual(PINNED_DECISIONS);
    },
    RUN_TIMEOUT_MS * cases.length,
  );

  it('counts how often a deal is reshuffled for three kings', () => {
    const deals = 50_000;
    let reshuffled = 0;
    let twice = 0;
    for (let i = 0; i < deals; i++) {
      const { redeals } = dealOrder(`scopa-quality-redeal-${i}`, 1);
      if (redeals > 0) reshuffled += 1;
      if (redeals > 1) twice += 1;
    }
    console.log(
      `[scopa] reshuffles: ${reshuffled} of ${deals} deals (${share(reshuffled, deals)}; ` +
        `arithmetic 145 / 91,390 ≈ 0.159%), ${twice} needing two or more`,
    );
    expect([reshuffled, twice]).toEqual(PINNED_RESHUFFLES);
  });
});

/**
 * The numbers §11.1 and §15 quote. Pinned for reproducibility — not thresholds.
 * wins: [player seat, CPU seat]; plays: [same-value takes, sum takes,
 * placements]; table before a play: [p50, p99, max]; deals played; deals by
 * scopas: [0, 1, 2, 3 or more]; deals per match: [fewest, most, most common];
 * deals that needed a reshuffle.
 */
const PINNED_RUNS: unknown[] = [
  {
    name: 'random (pairs) vs CPU',
    wins: [145, 855],
    plays: [45_551, 18_524, 81_725],
    table: [3, 7, 10],
    deals: 4_050,
    scopas: [2_007, 1_261, 515, 267],
    dealsPerMatch: [2, 7, 4],
    reshuffled: 6,
  },
  {
    name: 'random (card, then way) vs CPU',
    wins: [126, 874],
    plays: [45_260, 18_128, 80_684],
    table: [3, 7, 10],
    deals: 4_002,
    scopas: [1_980, 1_202, 528, 292],
    dealsPerMatch: [2, 8, 4],
    reshuffled: 6,
  },
  {
    name: 'CPU vs CPU',
    wins: [264, 236],
    plays: [23_653, 8_662, 40_693],
    table: [3, 7, 10],
    deals: 2_028,
    scopas: [807, 602, 362, 257],
    dealsPerMatch: [2, 7, 4],
    reshuffled: 5,
  },
  {
    name: 'random vs random',
    wins: [279, 221],
    plays: [24_672, 10_733, 45_379],
    table: [3, 7, 9],
    deals: 2_244,
    scopas: [1_329, 635, 219, 61],
    dealsPerMatch: [2, 7, 4],
    reshuffled: 6,
  },
];
/** CPU decisions measured, and the subsets one of them visited: p50, p99, max. */
const PINNED_DECISIONS: unknown[] = [217_944, 16, 63, 296];
/** Deals reshuffled of 50,000, and those needing two reshuffles or more. */
const PINNED_RESHUFFLES: unknown[] = [83, 1];
