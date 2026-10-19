/**
 * The promises of docs/BRIDGES_RULES.md §1 and §6–§9, measured rather than
 * assumed: every board that ships keeps the layout rules, has an answer that
 * keeps every rule, has exactly one answer (proven twice — by the counter and
 * by an independent rules-only search), is graded into its tier's band, is
 * deterministic, never falls back, stays inside its work budget, and can be
 * finished by following the hint alone — and the hint, from seeded partial
 * boards too, is sound and names an island only when that island shows the
 * reason. Hard is measurably harder than Medium, and Medium than Easy.
 *
 * Two hundred fixed seeds per tier plus two years of dailies are walked, not
 * sampled: difficulty seeds are minted at play time and cannot all be
 * walked, so a fixed set stands in for them, while the dailies are the exact
 * boards every player will see. The bundled fallback boards are re-made
 * from their seeds and re-verified the same way.
 */
import { describe, expect, it } from 'vitest';
import { BUNDLED_BOARDS, decodeBundled } from './bundled';
import { addDays, dailySeed, DAILY_DIFFICULTY } from './daily';
import { buildGraph, emptyBridges, isBlocked, isSolved, isValidLayout, type Graph } from './engine';
import {
  ATTEMPT_LIMIT,
  GENERATION_WORK_LIMIT,
  GROW_STEP_LIMIT,
  TIERS,
  buildCandidate,
  generatePuzzle,
  meetsTier,
  type GeneratedPuzzle,
} from './generator';
import { createRng } from './rng';
import { encodeBoard, encodeBridges } from './serialize';
import { fromRecord, toRecord, type BridgesSession } from './session';
import {
  SEARCH_NODE_LIMIT,
  countRounds,
  countSolutions,
  findHint,
  settledByPairs,
  solve,
  solverWork,
} from './solver';
import { DIFFICULTIES, PRESETS, type Bridges, type Difficulty, type Layout } from './types';

/**
 * Solver work plus growth steps per board, per group (§6). Measured: on this
 * walk easy 3,317, medium 12,163, hard 24,323 and the dailies 12,407 at
 * worst; on 20,000 random Free Play seeds per tier (and 6,000 dailies past
 * the walk) easy 5,545, medium 25,688, hard 62,959 and the dailies 20,210.
 * Each budget sits about 1.5–2× above the larger sample's worst and under
 * GENERATION_WORK_LIMIT, the ceiling generation itself obeys. A regression
 * gate, not a device promise — what it catches is a technique that stops
 * propagating, a counter that branches where it used to settle, or a tier
 * whose hit rate collapsed.
 */
const WORK_BUDGET: Record<Difficulty | 'daily', number> = {
  easy: 9_000,
  medium: 40_000,
  hard: 100_000,
  daily: 40_000,
};

/**
 * Derived seeds one board may cost (§6). Measured: on this walk easy lands
 * within 6, medium within 18, hard within 27, the dailies within 22; on the
 * larger sample above easy 13, medium 25, hard 58, the dailies 22. The cap
 * is ATTEMPT_LIMIT (80) and these sit short of it, so a tier drifting up
 * here is a warning before anything falls back.
 */
const ATTEMPT_BUDGET: Record<Difficulty | 'daily', number> = {
  easy: 15,
  medium: 36,
  hard: 70,
  daily: 40,
};

const SEEDS_PER_TIER = 200;
const DAILY_DAYS = 730;
const FIRST_DAY = '2026-10-17';

interface Run {
  readonly name: string;
  readonly difficulty: Difficulty;
  readonly group: Difficulty | 'daily';
  readonly puzzle: GeneratedPuzzle;
  readonly ms: number;
}

function walk(): { runs: Run[]; ms: number } {
  const started = performance.now();
  const runs: Run[] = [];
  const timed = (name: string, difficulty: Difficulty, group: Run['group'], seed: string): Run => {
    const t0 = performance.now();
    const puzzle = generatePuzzle(seed, difficulty);
    return { name, difficulty, group, puzzle, ms: performance.now() - t0 };
  };
  for (const difficulty of DIFFICULTIES) {
    for (let n = 1; n <= SEEDS_PER_TIER; n++) {
      const seed = `bridges-${difficulty}-g${n}`;
      runs.push(timed(seed, difficulty, difficulty, seed));
    }
  }
  let date = FIRST_DAY;
  for (let day = 0; day < DAILY_DAYS; day++) {
    runs.push(timed(`daily ${date}`, DAILY_DIFFICULTY, 'daily', dailySeed(date)));
    date = addDays(date, 1);
  }
  return { runs, ms: performance.now() - started };
}

const { runs, ms } = walk();
const GROUPS = [...DIFFICULTIES, 'daily'] as const;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

describe('every shipped board keeps the rules (§1, §3)', () => {
  it('is a legal layout of its preset, with an answer that wins', () => {
    for (const { name, difficulty, puzzle } of runs) {
      const preset = PRESETS[difficulty];
      expect([puzzle.width, puzzle.height], name).toEqual([preset.width, preset.height]);
      expect(isValidLayout(puzzle), name).toBe(true);
      expect(puzzle.islands.length, name).toBeGreaterThanOrEqual(preset.minIslands);
      expect(puzzle.islands.length, name).toBeLessThanOrEqual(preset.maxIslands);
      expect(isSolved(buildGraph(puzzle), puzzle.solution), `${name} answer breaks a rule`).toBe(
        true,
      );
    }
  });

  it('never falls back, on any walked seed', () => {
    for (const { name, puzzle } of runs) expect(puzzle.fallback, `${name} fell back`).toBe(false);
  });

  it('is deterministic: the same seed is the same board', () => {
    for (const { name, difficulty, puzzle } of runs.filter((_, i) => i % 37 === 0)) {
      const seed = name.startsWith('daily ') ? dailySeed(name.slice(6)) : name;
      const again = generatePuzzle(seed, difficulty);
      expect(encodeBoard(again), name).toBe(encodeBoard(puzzle));
      expect(again.solution, name).toEqual(puzzle.solution);
      expect(again.attempts, name).toBe(puzzle.attempts);
    }
  });
});

describe('one answer, graded into its tier (§6, §7)', () => {
  it('has exactly one answer by the counter, and it is the generated one', () => {
    for (const { name, puzzle } of runs) {
      const count = countSolutions(puzzle);
      expect(count.complete, `${name} count did not finish`).toBe(true);
      expect(count.solutions, `${name} is not unique`).toBe(1);
      expect(count.solution, name).toEqual([...puzzle.solution]);
    }
  });

  it('is settled by its tier’s techniques, in its tier’s band, landing on its own answer', () => {
    for (const { name, difficulty, puzzle } of runs) {
      const tier = TIERS[difficulty];
      const result = solve(puzzle, 3);
      expect(result.solved, `${name} needs a guess`).toBe(true);
      expect(result.fixed, `${name} settles on another board`).toEqual([...puzzle.solution]);
      expect(result.stalls, name).toBe(puzzle.stalls);
      expect(puzzle.stalls, `${name} stalls ${puzzle.stalls}`).toBeGreaterThanOrEqual(
        tier.minStalls,
      );
      expect(puzzle.stalls, `${name} stalls ${puzzle.stalls}`).toBeLessThanOrEqual(tier.maxStalls);
      if (!tier.allowHypothesis) expect(puzzle.grade, name).not.toBe('advanced');
      if (difficulty === 'easy') {
        // Counting alone, every time.
        expect(solve(puzzle, 1).solved, name).toBe(true);
      } else {
        // Counting alone is never enough.
        expect(solve(puzzle, 1).solved, `${name} needs no connectivity`).toBe(false);
      }
      if (difficulty === 'medium') expect(solve(puzzle, 2).solved, name).toBe(true);
      if (tier.beyondPairs) {
        // More than counting and the two pair rules (§7).
        expect(settledByPairs(puzzle), `${name} is settled by the pair rules`).toBe(false);
      }
      if (tier.minRounds > 0) {
        const rounds = countRounds(puzzle);
        expect(rounds, `${name} rounds ${rounds}`).not.toBeNull();
        expect(rounds!, `${name} rounds ${rounds}`).toBeGreaterThanOrEqual(tier.minRounds);
      }
    }
  });

  it('makes Hard harder than Medium, and Medium harder than Easy (§7)', () => {
    const of = (group: Run['group']) => runs.filter((run) => run.group === group);
    const stalls = (group: Run['group']) => of(group).map((run) => run.puzzle.stalls);
    const islands = (group: Run['group']) => of(group).map((run) => run.puzzle.islands.length);
    const rounds = (group: Run['group']) => of(group).map((run) => countRounds(run.puzzle) ?? -1);
    const byPairs = (group: Run['group']) =>
      of(group).filter((run) => settledByPairs(run.puzzle) === true).length;
    // Easy never stalls; Medium always does.
    expect(Math.max(...stalls('easy'))).toBe(0);
    expect(Math.min(...stalls('medium'))).toBeGreaterThanOrEqual(1);
    // Hard needs more deductions past counting than any Medium board — and,
    // since several can be in view at once, more on two measures that do
    // not count them one by one: counting gets stuck at least twice with
    // every connectivity deduction in sight taken together, and the two
    // pair rules are never enough. A large share of Medium meets neither.
    expect(Math.min(...stalls('hard'))).toBeGreaterThan(Math.max(...stalls('medium')));
    expect(Math.min(...rounds('hard'))).toBeGreaterThanOrEqual(2);
    expect(byPairs('hard')).toBe(0);
    expect(median(rounds('hard'))).toBeGreaterThan(median(rounds('medium')));
    expect(byPairs('medium')).toBeGreaterThan(0);
    expect(rounds('medium').filter((r) => r === 1).length).toBeGreaterThan(of('medium').length / 2);
    expect(median(islands('hard'))).toBeGreaterThan(median(islands('medium')));
    expect(median(islands('medium'))).toBeGreaterThan(median(islands('easy')));
    // Some Hard boards need a hypothesis; no Medium or Easy board does.
    expect(of('hard').some((run) => run.puzzle.grade === 'advanced')).toBe(true);
    for (const group of ['easy', 'medium', 'daily'] as const) {
      expect(
        of(group).every((run) => run.puzzle.grade !== 'advanced'),
        group,
      ).toBe(true);
    }
    const histogram = (values: readonly number[]): string => {
      const counts = new Map<number, number>();
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
      return JSON.stringify(Object.fromEntries([...counts].sort((a, b) => a[0] - b[0])));
    };
    for (const group of GROUPS) {
      const grades = new Map<string, number>();
      for (const run of of(group))
        grades.set(run.puzzle.grade, (grades.get(run.puzzle.grade) ?? 0) + 1);
      console.log(
        `[bridges] ${group}: stalls ${histogram(stalls(group))} rounds ${histogram(rounds(group))} ` +
          `settled by pairs ${byPairs(group)} grades ${JSON.stringify(Object.fromEntries(grades))} ` +
          `islands min=${Math.min(...islands(group))} p50=${median(islands(group))} max=${Math.max(...islands(group))}`,
      );
    }
  });
});

/**
 * Every answer of a board, read from its text alone — `.` water, `1`–`8` an
 * island — by a depth-first search over the pairs in sight that shares no
 * code with engine.ts or solver.ts: its own scan for the first island in
 * each direction, its own crossing test, its own counting and grouping. Its
 * only pruning is arithmetic on each island's running total. Counting up to
 * two answers, it re-proves the uniqueness the generator claims from a
 * second reading of the rules, so a drift between the rules (engine.ts) and
 * the techniques (solver.ts) cannot hide behind the techniques' own proof.
 */
function rulesOnlyCount(text: string, width: number, height: number, limit: number): number {
  const at = (r: number, c: number): string => text[r * width + c]!;
  const islands: { r: number; c: number; value: number }[] = [];
  const ordinal = new Map<number, number>();
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (at(r, c) === '.') continue;
      ordinal.set(r * width + c, islands.length);
      islands.push({ r, c, value: Number(at(r, c)) });
    }
  }
  interface Pair {
    a: number;
    b: number;
    across: boolean;
    line: number;
    from: number;
    to: number;
  }
  const pairs: Pair[] = [];
  islands.forEach((island, i) => {
    for (let c = island.c + 1; c < width; c++) {
      if (at(island.r, c) === '.') continue;
      pairs.push({
        a: i,
        b: ordinal.get(island.r * width + c)!,
        across: true,
        line: island.r,
        from: island.c,
        to: c,
      });
      break;
    }
    for (let r = island.r + 1; r < height; r++) {
      if (at(r, island.c) === '.') continue;
      pairs.push({
        a: i,
        b: ordinal.get(r * width + island.c)!,
        across: false,
        line: island.c,
        from: island.r,
        to: r,
      });
      break;
    }
  });
  const crosses = (x: Pair, y: Pair): boolean => {
    if (x.across === y.across) return false;
    const [h, v] = x.across ? [x, y] : [y, x];
    return h.from < v.line && v.line < h.to && v.from < h.line && h.line < v.to;
  };
  const crossing = pairs.map((p) =>
    pairs.map((q, j) => (crosses(p, q) ? j : -1)).filter((j) => j >= 0),
  );
  const lastPair = islands.map(() => -1);
  const open = islands.map(() => 0);
  pairs.forEach((p, j) => {
    lastPair[p.a] = Math.max(lastPair[p.a]!, j);
    lastPair[p.b] = Math.max(lastPair[p.b]!, j);
    open[p.a]! += 2;
    open[p.b]! += 2;
  });
  if (lastPair.some((j) => j === -1)) return 0;
  const total = islands.map(() => 0);
  const counts = pairs.map(() => 0);
  let found = 0;
  const oneGroup = (): boolean => {
    const reached = new Set([0]);
    for (let grew = true; grew;) {
      grew = false;
      pairs.forEach((p, j) => {
        if (counts[j] === 0 || reached.has(p.a) === reached.has(p.b)) return;
        reached.add(p.a).add(p.b);
        grew = true;
      });
    }
    return reached.size === islands.length;
  };
  const go = (j: number): void => {
    if (found >= limit) return;
    if (j === pairs.length) {
      if (islands.every((island, i) => total[i] === island.value) && oneGroup()) found++;
      return;
    }
    const p = pairs[j]!;
    open[p.a]! -= 2;
    open[p.b]! -= 2;
    for (let k = 0; k <= 2 && found < limit; k++) {
      if (k > 0 && crossing[j]!.some((q) => q < j && counts[q]! > 0)) break;
      const ta = total[p.a]! + k;
      const tb = total[p.b]! + k;
      if (ta > islands[p.a]!.value || tb > islands[p.b]!.value) break;
      if (ta + open[p.a]! < islands[p.a]!.value || tb + open[p.b]! < islands[p.b]!.value) continue;
      if (lastPair[p.a] === j && ta !== islands[p.a]!.value) continue;
      if (lastPair[p.b] === j && tb !== islands[p.b]!.value) continue;
      counts[j] = k;
      total[p.a] = ta;
      total[p.b] = tb;
      go(j + 1);
      total[p.a] = ta - k;
      total[p.b] = tb - k;
      counts[j] = 0;
    }
    open[p.a]! += 2;
    open[p.b]! += 2;
  };
  go(0);
  return found;
}

describe('an independent rules-only search agrees: one answer (§6)', () => {
  it.each(runs)('finds exactly one answer on $name', ({ name, puzzle }) => {
    expect(rulesOnlyCount(encodeBoard(puzzle), puzzle.width, puzzle.height, 2), name).toBe(1);
  });

  it('sees a second answer where there is one, and none where there is none', () => {
    expect(rulesOnlyCount('3.3' + '...' + '3.3', 3, 3, 2)).toBe(2);
    expect(rulesOnlyCount('..1..' + '.....' + '1...1' + '.....' + '..1..', 5, 5, 2)).toBe(0);
    expect(rulesOnlyCount('1.1' + '...' + '2.2', 3, 3, 2)).toBe(1);
  });
});

/**
 * What one island shows on its own (§9, step 2a), read from the rules with
 * none of solver.ts: the least `edge` must carry so that `island` can reach
 * its number, when each of its other pairs carries at most what is visible —
 * nothing where a built bridge crosses the way, otherwise two, and no more
 * than either end has left beside its other built bridges.
 */
function visiblyForced(graph: Graph, bridges: Bridges, island: number, edge: number): number {
  const value = (i: number): number => graph.layout.islands[i]!.value;
  const built = (i: number): number =>
    graph.islandEdges[i]!.reduce((sum, id) => sum + bridges[id]!, 0);
  let others = 0;
  for (const id of graph.islandEdges[island]!) {
    if (id === edge) continue;
    const { a, b } = graph.edges[id]!;
    const most = isBlocked(graph, bridges, id)
      ? 0
      : Math.min(2, value(a) - (built(a) - bridges[id]!), value(b) - (built(b) - bridges[id]!));
    others += Math.max(bridges[id]!, most);
  }
  return value(island) - others;
}

/**
 * Checks one hint against the answer and the board (§9): an edge over the
 * answer is named as such; otherwise the hint asks for more than is built
 * and no more than the answer holds, and an island it names shows the
 * reason on its own. Returns the hint for the caller to follow.
 */
function checkHint(
  name: string,
  layout: Layout,
  graph: Graph,
  answer: Bridges,
  bridges: Bridges,
): ReturnType<typeof findHint> {
  const hint = findHint(layout, answer, bridges, undefined, graph);
  const over = bridges.findIndex((count, edge) => count > answer[edge]!);
  if (over !== -1) {
    expect(hint, name).toEqual({
      kind: 'wrong',
      edge: over,
      count: bridges[over],
      answer: answer[over],
    });
    return hint;
  }
  expect(hint?.kind, `${name} found no step`).toBe('step');
  if (hint?.kind !== 'step') return hint;
  expect(hint.atLeast, name).toBeLessThanOrEqual(answer[hint.edge]!);
  expect(hint.atLeast, name).toBeGreaterThan(bridges[hint.edge]!);
  if (hint.island !== -1) {
    expect(hint.technique, name).toBe('count');
    expect(graph.islandEdges[hint.island], name).toContain(hint.edge);
    expect(
      visiblyForced(graph, bridges, hint.island, hint.edge),
      `${name}: island ${hint.island} does not show it`,
    ).toBeGreaterThanOrEqual(hint.atLeast);
  }
  return hint;
}

describe('the hint alone finishes every board (§9)', () => {
  let worstWork = 0;
  let named = 0;
  let chained = 0;

  /**
   * From an empty board, build exactly what each hint names and nothing
   * else, until the board is won. Every hint must be a step (the board never
   * goes over the answer this way), must name a count the answer has, must
   * ask for more than is built, and must name an island only when that
   * island shows the reason.
   */
  it.each(runs.filter((_, i) => i % 3 === 0))('on $name', ({ name, puzzle }) => {
    const graph = buildGraph(puzzle);
    let bridges: number[] = emptyBridges(graph);
    for (let step = 0; step <= graph.edges.length * 2; step++) {
      if (isSolved(graph, bridges)) break;
      const before = solverWork.read();
      const hint = checkHint(`${name} step ${step}`, puzzle, graph, puzzle.solution, bridges);
      worstWork = Math.max(worstWork, solverWork.read() - before);
      if (hint?.kind !== 'step') return;
      if (hint.island === -1) chained++;
      else named++;
      bridges = [...bridges];
      bridges[hint.edge] = hint.atLeast;
    }
    expect(isSolved(graph, bridges), `${name} not finished by hints`).toBe(true);
  });

  it('stays cheap along every path (§6)', () => {
    console.log(
      `[bridges] hint paths: ${named} hints named an island, ${chained} did not; ` +
        `worst hint work ${worstWork}`,
    );
    expect(worstWork).toBeLessThan(3_000);
  });
});

/**
 * A partial board with every rise one island shows already built — by
 * `visiblyForced`, not by the solver — so that the hint must come from the
 * techniques (§9, step 2b). Sound on a board at or under the answer.
 */
function closeVisible(graph: Graph, start: Bridges): number[] {
  const bridges = [...start];
  for (let changed = true; changed;) {
    changed = false;
    graph.islandEdges.forEach((edges, island) => {
      for (const edge of edges) {
        const need = visiblyForced(graph, bridges, island, edge);
        if (need > bridges[edge]!) {
          bridges[edge] = need;
          changed = true;
        }
      }
    });
  }
  return bridges;
}

/**
 * The hint from boards a player could have left half-built (§9): thirty
 * walked boards per tier, ten seeded partial boards each — every edge at a
 * random count from 0 to its answer — then the same board with everything
 * one island shows already built (so the techniques have to find the step),
 * and one legal board with one bridge too many. A board at or under the
 * answer always gets a step (the techniques are monotone, §9), and one with
 * nothing left that a single island shows gets a step that names none; a
 * board over the answer is always told so. Pinned so that a solver change
 * that breaks any of it fails here.
 */
describe('the hint from partial boards (§9)', () => {
  let chainedStates = 0;

  const sample = DIFFICULTIES.flatMap((difficulty) => {
    const subset = runs.filter((run) => run.group === difficulty);
    const stride = Math.floor(subset.length / 30);
    return subset.filter((_, i) => i % stride === 0).slice(0, 30);
  });

  it('samples thirty boards per tier', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(sample.filter((run) => run.group === difficulty)).toHaveLength(30);
    }
  });

  it.each(sample)('on $name', ({ name, puzzle }) => {
    const graph = buildGraph(puzzle);
    const answer = puzzle.solution;
    for (let k = 0; k < 10; k++) {
      const rng = createRng(`bridges-partial-${name}-${k}`);
      const partial = answer.map((count) => Math.floor(rng() * (count + 1)));
      if (isSolved(graph, partial)) continue;
      let worst = solverWork.read();
      checkHint(`${name} partial ${k}`, puzzle, graph, answer, partial);
      worst = solverWork.read() - worst;
      expect(worst, `${name} partial ${k} hint work`).toBeLessThan(3_000);
      const closed = closeVisible(graph, partial);
      expect(
        closed.every((count, edge) => count <= answer[edge]!),
        `${name} partial ${k} closed past the answer`,
      ).toBe(true);
      if (!isSolved(graph, closed)) {
        chainedStates++;
        worst = solverWork.read();
        const hint = checkHint(`${name} closed ${k}`, puzzle, graph, answer, closed);
        worst = solverWork.read() - worst;
        expect(worst, `${name} closed ${k} hint work`).toBeLessThan(3_000);
        // No island shows a step here, by the reading above: the hint names none.
        expect(hint, `${name} closed ${k}`).toMatchObject({ kind: 'step', island: -1 });
      }
      // One bridge too many, on an edge nothing blocks.
      const open = answer.findIndex(
        (count, edge) => count < 2 && partial[edge] === count && !isBlocked(graph, partial, edge),
      );
      if (open === -1) continue;
      const over = [...partial];
      over[open] = answer[open]! + 1;
      checkHint(`${name} over ${k}`, puzzle, graph, answer, over);
    }
  });

  it('reaches the techniques often enough to mean something', () => {
    console.log(
      `[bridges] partial boards: ${chainedStates} where only the techniques find the step`,
    );
    expect(chainedStates).toBeGreaterThan(100);
  });
});

describe('the bundled fallback boards (§6, step 6)', () => {
  const entries = DIFFICULTIES.flatMap((difficulty) =>
    BUNDLED_BOARDS[difficulty].map((board) => ({ difficulty, board, name: board.seed })),
  );

  it('carries four boards per tier', () => {
    for (const difficulty of DIFFICULTIES) expect(BUNDLED_BOARDS[difficulty]).toHaveLength(4);
  });

  it.each(entries)(
    '$name is this generator’s own board, unique and in its tier',
    ({ difficulty, board }) => {
      const preset = PRESETS[difficulty];
      const tier = TIERS[difficulty];
      // Re-made from its seed, character for character.
      const candidate = buildCandidate(board.seed, preset, tier);
      expect(candidate).not.toBeNull();
      expect(meetsTier(candidate!, preset, tier)).toBe(true);
      expect(encodeBoard(candidate!.layout)).toBe(board.board.join(''));
      expect(encodeBridges(candidate!.solution)).toBe(board.solution);
      expect(candidate!.grade).toBe(board.grade);
      expect(candidate!.stalls).toBe(board.stalls);
      // And verified as shipped: a win, one answer twice over, graded in band.
      const { layout, solution } = decodeBundled(difficulty, board);
      expect(isSolved(buildGraph(layout), solution)).toBe(true);
      expect(countSolutions(layout)).toMatchObject({ solutions: 1, complete: true });
      expect(rulesOnlyCount(board.board.join(''), preset.width, preset.height, 2)).toBe(1);
      const result = solve(layout, 3);
      expect(result.solved).toBe(true);
      expect(result.fixed).toEqual(solution);
      expect(result.stalls).toBeGreaterThanOrEqual(tier.minStalls);
      expect(result.stalls).toBeLessThanOrEqual(tier.maxStalls);
      if (tier.beyondPairs) expect(settledByPairs(layout)).toBe(false);
      if (tier.minRounds > 0) expect(countRounds(layout)!).toBeGreaterThanOrEqual(tier.minRounds);
    },
  );

  it.each(entries)(
    '$name survives a save and a load: the load re-proves it under the same cap',
    ({ difficulty, board }) => {
      const { layout, solution } = decodeBundled(difficulty, board);
      const graph = buildGraph(layout);
      // As a Free Play board, and — Medium being the daily's tier — as a daily.
      const modes =
        difficulty === DAILY_DIFFICULTY
          ? (['difficulty', 'daily'] as const)
          : (['difficulty'] as const);
      for (const mode of modes) {
        const session: BridgesSession = {
          mode,
          seed: board.seed,
          difficulty,
          dailyDate: mode === 'daily' ? '2026-10-17' : null,
          ...layout,
          graph,
          solution,
          bridges: emptyBridges(graph),
          history: [],
          status: 'playing',
          elapsedSeconds: 0,
          hintCount: 0,
        };
        const restored = fromRecord(JSON.parse(JSON.stringify(toRecord(session))));
        expect(restored, `${board.seed} as ${mode}`).not.toBeNull();
        expect(encodeBoard(restored!)).toBe(board.board.join(''));
        expect(encodeBridges(restored!.solution)).toBe(board.solution);
        expect(restored!.status).toBe('playing');
      }
    },
  );

  it('ships one of them when every attempt misses, picked by the seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const fallback = generatePuzzle(`bridges-${difficulty}-fallback`, difficulty, 0);
      expect(fallback.fallback).toBe(true);
      const boards = BUNDLED_BOARDS[difficulty].map((board) => board.board.join(''));
      expect(boards).toContain(encodeBoard(fallback));
      expect(isSolved(buildGraph(fallback), fallback.solution)).toBe(true);
      // The same seed falls back to the same board.
      const again = generatePuzzle(`bridges-${difficulty}-fallback`, difficulty, 0);
      expect(encodeBoard(again)).toBe(encodeBoard(fallback));
    }
  });

  it('ships one of them when the work budget runs out first, and spends no more than it', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const budget of [1, 500, 2_000]) {
        const seed = `bridges-${difficulty}-g1`;
        const capped = generatePuzzle(seed, difficulty, ATTEMPT_LIMIT, budget);
        const full = generatePuzzle(seed, difficulty);
        if (full.work <= budget) continue;
        expect(capped.fallback, `${difficulty} budget ${budget}`).toBe(true);
        // At most the budget, one growth past it, and a few units of overshoot.
        expect(capped.work, `${difficulty} budget ${budget}`).toBeLessThanOrEqual(
          budget + GROW_STEP_LIMIT + PRESETS[difficulty].maxIslands,
        );
        expect(capped.attempts).toBeLessThanOrEqual(full.attempts);
        expect(isSolved(buildGraph(capped), capped.solution)).toBe(true);
      }
    }
    // The ceiling sits far above every walked board.
    expect(Math.max(...runs.map((run) => run.puzzle.work))).toBeLessThan(GENERATION_WORK_LIMIT / 2);
  });

  it('counts the growth steps of a growth that fell short', () => {
    // This seed's first network cannot reach Hard's twenty islands (it ran
    // out of room): the growth spent every step, and no solver ran.
    const seed = 'bridges-bundled-hard-6';
    expect(buildCandidate(seed, PRESETS.hard, TIERS.hard)).toBeNull();
    const missed = generatePuzzle(seed, 'hard', 1);
    expect(missed.fallback).toBe(true);
    expect(missed.attempts).toBe(1);
    expect(missed.work).toBe(GROW_STEP_LIMIT);
  });

  it('throws on a bundled board that does not decode, rather than shipping it', () => {
    const broken = { ...BUNDLED_BOARDS.easy[0]!, solution: '0' };
    expect(() => decodeBundled('easy', broken)).toThrow();
  });
});

/**
 * §6 budgets generation per board on the device. Asserting that here with
 * `performance.now()` would measure the work times whatever else the machine
 * is doing — under `pnpm test`, several other vitest forks — so the gate is
 * the work itself, which is a function of the seed and therefore identical
 * on every machine. The milliseconds are printed and never asserted.
 */
describe('generation cost (§6)', () => {
  const pct = (sorted: readonly number[], p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;

  it('stays inside the work budget on every board', () => {
    for (const group of GROUPS) {
      const subset = runs.filter((run) => run.group === group);
      const works = subset.map((run) => run.puzzle.work).sort((a, b) => a - b);
      const times = subset.map((run) => run.ms).sort((a, b) => a - b);
      const worst = subset.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
      console.log(
        `[bridges] ${group}: n=${subset.length} work p50=${pct(works, 0.5)} ` +
          `p90=${pct(works, 0.9)} max=${works[works.length - 1]} ` +
          `fallback=${subset.filter((r) => r.puzzle.fallback).length} ` +
          `ms p50=${pct(times, 0.5).toFixed(2)} p90=${pct(times, 0.9).toFixed(2)} ` +
          `max=${times[times.length - 1]!.toFixed(2)}`,
      );
      expect(worst.puzzle.work, `worst work ${worst.puzzle.work} at ${worst.name}`).toBeLessThan(
        WORK_BUDGET[group],
      );
    }
    console.log(`[bridges] ${runs.length} boards — ms=${ms.toFixed(0)} for the whole walk`);
  });

  it('rarely needs many derived seeds, and never approaches the cap', () => {
    for (const group of GROUPS) {
      const subset = runs.filter((run) => run.group === group);
      const attempts = subset.map((run) => run.puzzle.attempts).sort((a, b) => a - b);
      const worst = subset.reduce((a, b) => (b.puzzle.attempts > a.puzzle.attempts ? b : a));
      const first = subset.filter((run) => run.puzzle.attempts === 1).length;
      console.log(
        `[bridges] ${group}: ${first}/${subset.length} boards on the first seed; ` +
          `attempts p50=${pct(attempts, 0.5)} p90=${pct(attempts, 0.9)} ` +
          `worst ${worst.puzzle.attempts} (${worst.name}) of ${ATTEMPT_LIMIT}`,
      );
      expect(
        worst.puzzle.attempts,
        `${worst.name} took ${worst.puzzle.attempts}`,
      ).toBeLessThanOrEqual(ATTEMPT_BUDGET[group]);
    }
  });

  it('keeps the counter and the hint cheap on every board', () => {
    let countNodes = 0;
    let hintWork = 0;
    for (const { puzzle } of runs) {
      const graph = buildGraph(puzzle);
      countNodes = Math.max(countNodes, countSolutions(puzzle, 2, undefined, graph).nodes);
      const before = solverWork.read();
      findHint(puzzle, puzzle.solution, emptyBridges(graph), undefined, graph);
      hintWork = Math.max(hintWork, solverWork.read() - before);
    }
    console.log(`[bridges] counter nodes max=${countNodes}; first hint work max=${hintWork}`);
    expect(countNodes).toBeLessThan(SEARCH_NODE_LIMIT / 5);
    expect(hintWork).toBeLessThan(300);
  });
});
