/**
 * The solvers of docs/BRIDGES_RULES.md §6, §7 and §9: what each technique
 * proves on boards drawn to need it, what the counter says about one answer,
 * two answers and none, what both do when their work limit comes first, and
 * the hint's two answers. Then the whole solver against an exhaustive,
 * independently written enumeration on a few hundred small boards.
 */
import { describe, expect, it } from 'vitest';
import { buildGraph, isSolved } from './engine';
import { TIERS, generatePuzzle, growNetwork } from './generator';
import { createRng } from './rng';
import {
  SEARCH_NODE_LIMIT,
  countRounds,
  countSolutions,
  findHint,
  gradeLayout,
  isUnique,
  settledByPairs,
  solve,
  solverWork,
} from './solver';
import type { Layout } from './types';

function board(rows: readonly string[]): Layout {
  const width = rows[0]!.length;
  const islands = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < width; c++) {
      const ch = rows[r]![c]!;
      if (ch !== '.') islands.push({ index: r * width + c, value: Number(ch) });
    }
  }
  return { width, height: rows.length, islands };
}

/** Settled by counting alone: a 1 at each end of the row. */
const ROW = board(['1.2.1', '.....', '.....']);

/**
 * Two 1s side by side above two 2s. Counting cannot choose the 1s' edges;
 * joining the two 1s would close them off (T3), so each 1 goes down, and the
 * 2s are joined once. Edges: top pair 0, left column 1, right column 2,
 * bottom pair 3.
 */
const ISOLATION = board(['1.1', '...', '2.2']);

/** A square of 3s: (1, 2, 1, 2) and (2, 1, 2, 1) round the loop both keep every rule. */
const TWO_ANSWERS = board(['3.3', '...', '3.3']);

/** The only two edges cross: no answer at all. */
const NO_ANSWER = board(['..1..', '.....', '1...1', '.....', '..1..']);

describe('the techniques (§6)', () => {
  it('settles a board by counting alone (T1–T2)', () => {
    const result = solve(ROW, 1);
    expect(result.solved).toBe(true);
    expect(result.fixed).toEqual([1, 1]);
    expect(gradeLayout(ROW).grade).toBe('basic');
    expect(gradeLayout(ROW).stalls).toBe(0);
  });

  it('needs the closed-group rule (T3) where counting stalls', () => {
    expect(solve(ISOLATION, 1).solved).toBe(false);
    expect(solve(ISOLATION, 1).fixed).toEqual([-1, -1, -1, -1]);
    const result = solve(ISOLATION, 2);
    expect(result.solved).toBe(true);
    expect(result.fixed).toEqual([0, 1, 1, 1]);
    const grade = gradeLayout(ISOLATION);
    expect(grade.grade).toBe('connect');
    expect(grade.stalls).toBeGreaterThanOrEqual(1);
    expect(grade.solution).toEqual([0, 1, 1, 1]);
  });

  it('rules out the double on every side of a square of 2s, and finds the loop', () => {
    const loop = board(['2.2', '...', '2.2']);
    expect(solve(loop, 1).solved).toBe(false);
    expect(solve(loop, 2).fixed).toEqual([1, 1, 1, 1]);
  });

  it('closes an edge a sure bridge crosses (T2)', () => {
    // The vertical pair must be built (the top island sees nothing else),
    // which closes the horizontal pair it crosses — and the board is lost.
    const result = solve(NO_ANSWER, 1);
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(true);
  });

  it('needs a hypothesis (T4) on a hard board that T1–T3 cannot finish', () => {
    const puzzle = generatePuzzle('bridges-hard-g7', 'hard');
    expect(puzzle.grade).toBe('advanced');
    expect(solve(puzzle, 2).solved).toBe(false);
    const result = solve(puzzle, 3);
    expect(result.solved).toBe(true);
    expect(result.hypothesisSteps).toBeGreaterThan(0);
    expect(result.fixed).toEqual([...puzzle.solution]);
  });

  it('leaves a board with two answers unsolved, and claims nothing about it', () => {
    const result = solve(TWO_ANSWERS, 3);
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(false);
    expect(gradeLayout(TWO_ANSWERS).grade).toBe('unsolved');
    expect(gradeLayout(TWO_ANSWERS).solution).toBeNull();
  });

  it('stops at its work limit and says so — no guess, no false contradiction', () => {
    const puzzle = generatePuzzle('bridges-hard-g7', 'hard');
    const result = solve(puzzle, 3, 3);
    expect(result.aborted).toBe(true);
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(false);
    expect(gradeLayout(puzzle, 3).grade).toBe('unsolved');
  });
});

describe('the measures Hard is banded on (§7)', () => {
  /** A square of 2s: no pair may double, so every side takes one. */
  const LOOP = board(['2.2', '...', '2.2']);

  it('counts a round once however many deductions it has in view', () => {
    // One at a time, the ladder climbs twice (two "no double" deductions
    // before counting can finish); taken together they are one round.
    expect(solve(LOOP, 3).stalls).toBe(2);
    expect(countRounds(LOOP)).toBe(1);
    // A generated board with three deductions in view at once.
    const medium = generatePuzzle('bridges-medium-g3', 'medium');
    expect(medium.stalls).toBe(3);
    expect(countRounds(medium)).toBe(1);
  });

  it('tells a board the two pair rules settle from one that needs more', () => {
    // Two 1s that may not join, two 2s that may not double: counting does the rest.
    expect(settledByPairs(ISOLATION)).toBe(true);
    expect(settledByPairs(LOOP)).toBe(true);
    expect(settledByPairs(generatePuzzle('bridges-medium-g3', 'medium'))).toBe(true);
    // Counting alone settles ROW, so the pair rules do too.
    expect(settledByPairs(ROW)).toBe(true);
    // A Hard board needs more than the pair rules (a cut edge, a larger
    // closed group, or a hypothesis) — and stalls more than once.
    const hard = generatePuzzle('bridges-hard-g7', 'hard');
    expect(settledByPairs(hard)).toBe(false);
    expect(countRounds(hard)).toBeGreaterThanOrEqual(2);
    // Two answers: neither measure claims a settled board.
    expect(settledByPairs(TWO_ANSWERS)).toBe(false);
    expect(countRounds(TWO_ANSWERS)).toBeNull();
  });

  it('claims nothing when the work limit comes first', () => {
    const hard = generatePuzzle('bridges-hard-g7', 'hard');
    expect(settledByPairs(hard, 1)).toBeNull();
    expect(countRounds(hard, 3)).toBeNull();
  });
});

describe('counting answers (§6)', () => {
  it('proves one answer', () => {
    const result = countSolutions(ISOLATION);
    expect(result).toMatchObject({ solutions: 1, complete: true });
    expect(result.solution).toEqual([0, 1, 1, 1]);
    expect(isUnique(ISOLATION)).toBe(true);
  });

  it('finds the second answer and stops there', () => {
    const result = countSolutions(TWO_ANSWERS);
    expect(result).toMatchObject({ solutions: 2, complete: true });
    expect(isUnique(TWO_ANSWERS)).toBe(false);
    const graph = buildGraph(TWO_ANSWERS);
    expect(isSolved(graph, [1, 2, 2, 1])).toBe(true);
    expect(isSolved(graph, [2, 1, 1, 2])).toBe(true);
  });

  it('proves there is no answer', () => {
    expect(countSolutions(NO_ANSWER)).toMatchObject({ solutions: 0, complete: true });
    expect(isUnique(NO_ANSWER)).toBe(false);
  });

  it('reports an incomplete count at the node limit, and isUnique never trusts one', () => {
    const result = countSolutions(TWO_ANSWERS, 2, 1);
    expect(result.complete).toBe(false);
    expect(result.solutions).toBeLessThan(2);
    // A hard board with a cap of one node: no claim either way.
    const puzzle = generatePuzzle('bridges-hard-g7', 'hard');
    const capped = countSolutions(puzzle, 2, 1);
    expect(capped.complete).toBe(false);
    expect(countSolutions(puzzle).complete).toBe(true);
  });

  it('reports an incomplete count at the work limit — never a pruned branch, never "no answer"', () => {
    const puzzle = generatePuzzle('bridges-hard-g7', 'hard');
    for (const workLimit of [1, 5, 20, 60]) {
      const capped = countSolutions(puzzle, 2, SEARCH_NODE_LIMIT, buildGraph(puzzle), workLimit);
      expect(capped.complete, `work limit ${workLimit}`).toBe(false);
      expect(capped.solutions, `work limit ${workLimit}`).toBe(0);
    }
    const noAnswer = countSolutions(NO_ANSWER, 2, SEARCH_NODE_LIMIT, buildGraph(NO_ANSWER), 1);
    expect(noAnswer.complete).toBe(false);
    // With room enough the same calls finish and agree with the unlimited count.
    const full = countSolutions(puzzle, 2, SEARCH_NODE_LIMIT, buildGraph(puzzle), 100_000);
    expect(full).toMatchObject({ solutions: 1, complete: true });
  });
});

describe('the hint (§9)', () => {
  it('names an edge carrying more bridges than the answer, before anything else', () => {
    const answer = [0, 1, 1, 1];
    expect(findHint(ISOLATION, answer, [1, 0, 0, 0])).toEqual({
      kind: 'wrong',
      edge: 0,
      count: 1,
      answer: 0,
    });
    expect(findHint(ISOLATION, answer, [0, 1, 1, 2])).toMatchObject({ kind: 'wrong', edge: 3 });
  });

  it('otherwise shows a bridge the board proves, and names the island when one shows it', () => {
    const answer = [0, 1, 1, 1];
    // Seen at one island: the bottom-left 2 can take at most one bridge
    // upward (the 1 above it has one to give), so it needs at least one
    // along the bottom.
    expect(findHint(ISOLATION, answer, [0, 0, 0, 0])).toEqual({
      kind: 'step',
      edge: 3,
      atLeast: 1,
      technique: 'count',
      island: 2,
    });
    // From the player's own bridges: what is built is not hinted again. With
    // the bottom pair built, no island shows a bridge on its own; the reason
    // is that the two 1s may not join (T3), so a 1 must go down — a chain,
    // so no island is named.
    const next = findHint(ISOLATION, answer, [0, 0, 0, 1]);
    expect(next).toMatchObject({ kind: 'step', atLeast: 1, technique: 'count', island: -1 });
    if (next?.kind === 'step') expect([1, 2]).toContain(next.edge);
  });

  it('names no island when no single island shows the reason', () => {
    // The review case (§9): the edge from the 3 at (6,8) down to the 1 at
    // (8,8) needs a bridge, but the 1 sees two partners — what rules out the
    // other one is that two 1s may not join (T3). The hint used to name the
    // 1 as the reason; it shows the same bridge now, with no island.
    const puzzle = generatePuzzle('bridges-medium-vh0', 'medium');
    const graph = buildGraph(puzzle);
    const state = '011211100000100000'.split('').map(Number);
    expect(state).toHaveLength(graph.edges.length);
    expect(findHint(puzzle, puzzle.solution, state, undefined, graph)).toEqual({
      kind: 'step',
      edge: 14,
      atLeast: 1,
      technique: 'count',
      island: -1,
    });
    expect(puzzle.islands[graph.edges[14]!.b]!.value).toBe(1);
    expect(graph.islandEdges[graph.edges[14]!.b]).toHaveLength(2);
  });

  it('stops at the first rise instead of running the whole ladder', () => {
    // Measured on this board's hint path (§6): the chained hint at step 8
    // costs 89 units, and the whole path 1,296; run to the end of the
    // ladder, they cost 884 and 4,561. Work is a function of the board, so
    // these are the same on every machine.
    const puzzle = generatePuzzle('bridges-hard-g8', 'hard');
    const graph = buildGraph(puzzle);
    let bridges = new Array<number>(graph.edges.length).fill(0);
    let total = 0;
    for (let step = 0; step < 100 && !isSolved(graph, bridges); step++) {
      const before = solverWork.read();
      const hint = findHint(puzzle, puzzle.solution, bridges, undefined, graph);
      const cost = solverWork.read() - before;
      total += cost;
      expect(hint?.kind).toBe('step');
      if (hint?.kind !== 'step') return;
      if (step === 8) {
        expect(hint.island).toBe(-1);
        expect(cost).toBeLessThan(300);
      }
      bridges = [...bridges];
      bridges[hint.edge] = hint.atLeast;
    }
    expect(isSolved(graph, bridges)).toBe(true);
    expect(total).toBeLessThan(2_000);
  });

  it('is silent when the work limit comes first', () => {
    const puzzle = generatePuzzle('bridges-hard-g7', 'hard');
    const empty = new Array<number>(puzzle.solution.length).fill(0);
    expect(findHint(puzzle, puzzle.solution, empty, 1)).toBeNull();
    expect(findHint(puzzle, puzzle.solution, empty)).not.toBeNull();
  });
});

// ---------- the exhaustive oracle ----------

/**
 * Every answer of a small board, by enumerating every assignment of 0–2
 * bridges to every pair in sight — written from the rules alone, sharing no
 * code with engine.ts or solver.ts: its own scan for "the first island in
 * each direction", its own crossing test, its own counting and grouping.
 */
function enumerateAnswers(layout: Layout, cap: number): number[][] {
  const { width, height } = layout;
  const value = new Map(layout.islands.map((island) => [island.index, island.value]));
  const islands = layout.islands.map((island) => island.index);
  const pairs: { a: number; b: number; cells: number[] }[] = [];
  for (const cell of islands) {
    const row = Math.floor(cell / width);
    const col = cell % width;
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const between: number[] = [];
      for (let r = row + dr, c = col + dc; r < height && c < width; r += dr, c += dc) {
        const at = r * width + c;
        if (value.has(at)) {
          pairs.push({ a: cell, b: at, cells: between });
          break;
        }
        between.push(at);
      }
    }
  }
  const counts = new Array<number>(pairs.length).fill(0);
  const answers: number[][] = [];
  const check = (): boolean => {
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        if (
          counts[i]! > 0 &&
          counts[j]! > 0 &&
          pairs[i]!.cells.some((c) => pairs[j]!.cells.includes(c))
        ) {
          return false;
        }
      }
    }
    for (const cell of islands) {
      let total = 0;
      pairs.forEach((pair, i) => {
        if (pair.a === cell || pair.b === cell) total += counts[i]!;
      });
      if (total !== value.get(cell)) return false;
    }
    const reached = new Set([islands[0]!]);
    for (let grew = true; grew;) {
      grew = false;
      pairs.forEach((pair, i) => {
        if (counts[i] === 0) return;
        if (reached.has(pair.a) !== reached.has(pair.b)) {
          reached.add(pair.a).add(pair.b);
          grew = true;
        }
      });
    }
    return reached.size === islands.length;
  };
  const walk = (i: number): void => {
    if (answers.length >= cap) return;
    if (i === pairs.length) {
      if (check()) answers.push([...counts]);
      return;
    }
    for (let k = 0; k <= 2; k++) {
      counts[i] = k;
      walk(i + 1);
    }
    counts[i] = 0;
  };
  walk(0);
  return answers;
}

/**
 * Small boards of every kind: networks grown the generator's way on 5×5 and
 * 6×5 grids (so they have an answer), and the same boards with one number
 * nudged up or down (so many have none, or several).
 */
function smallBoards(): { name: string; layout: Layout }[] {
  const out: { name: string; layout: Layout }[] = [];
  const presets = [
    { width: 5, height: 5, minIslands: 4, maxIslands: 7 },
    { width: 6, height: 5, minIslands: 5, maxIslands: 7 },
  ];
  for (let n = 0; n < 160; n++) {
    const preset = presets[n % presets.length]!;
    const rng = createRng(`bridges-oracle-${n}`);
    const target =
      preset.minIslands + Math.floor(rng() * (preset.maxIslands - preset.minIslands + 1));
    const network = growNetwork(preset, target, n % 3 === 0 ? TIERS.easy : TIERS.hard, rng);
    if (network === null) continue;
    const skeleton = buildGraph({
      width: preset.width,
      height: preset.height,
      islands: network.islands.map((index) => ({ index, value: 1 })),
    });
    if (skeleton.edges.length > 11) continue;
    const totals = new Map<number, number>();
    for (const bridge of network.bridges) {
      totals.set(bridge.from, (totals.get(bridge.from) ?? 0) + bridge.count);
      totals.set(bridge.to, (totals.get(bridge.to) ?? 0) + bridge.count);
    }
    const islands = network.islands.map((index) => ({ index, value: totals.get(index)! }));
    out.push({ name: `grown ${n}`, layout: { ...preset, islands } });
    const nudged = Math.floor(rng() * islands.length);
    const delta = rng() < 0.5 ? -1 : 1;
    const value = islands[nudged]!.value + delta;
    if (value >= 1 && value <= 8) {
      const changed = islands.map((island, i) => (i === nudged ? { ...island, value } : island));
      out.push({ name: `nudged ${n}`, layout: { ...preset, islands: changed } });
    }
  }
  return out;
}

const SMALL = smallBoards();

describe('the solver agrees with exhaustive enumeration (§6)', () => {
  it('walks enough boards of each kind to mean something', () => {
    const counts = SMALL.map(({ layout }) => Math.min(enumerateAnswers(layout, 3).length, 2));
    console.log(
      `[bridges] small boards: ${SMALL.length} — no answer ${counts.filter((c) => c === 0).length}, ` +
        `one ${counts.filter((c) => c === 1).length}, two or more ${counts.filter((c) => c === 2).length}`,
    );
    expect(SMALL.length).toBeGreaterThan(150);
    expect(counts.filter((c) => c === 0).length).toBeGreaterThan(20);
    expect(counts.filter((c) => c === 1).length).toBeGreaterThan(40);
    expect(counts.filter((c) => c === 2).length).toBeGreaterThan(10);
  });

  it.each(SMALL)('counts the same answers on $name', ({ name, layout }) => {
    const answers = enumerateAnswers(layout, 3);
    const counted = countSolutions(layout, 3, 100_000);
    expect(counted.complete, name).toBe(true);
    expect(counted.solutions, name).toBe(Math.min(answers.length, 3));
    if (answers.length === 1) expect(counted.solution, name).toEqual(answers[0]);

    // The techniques never decide an edge against any answer, never call a
    // board with answers impossible, and settle only boards with one answer.
    const result = solve(layout, 3, 1_000_000);
    expect(result.aborted, name).toBe(false);
    if (result.contradiction) expect(answers.length, name).toBe(0);
    if (result.solved) {
      expect(answers.length, name).toBe(1);
      expect(result.fixed, name).toEqual(answers[0]);
    }
    for (const answer of answers) {
      result.fixed.forEach((count, edge) => {
        if (count !== -1) expect(count, `${name} edge ${edge}`).toBe(answer[edge]);
      });
    }
  });
});
