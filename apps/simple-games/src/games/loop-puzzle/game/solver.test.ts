/**
 * The solvers of docs/LOOP_PUZZLE_RULES.md §6–§8: each technique on a board
 * built to need it, the counting search on boards with one, many and no
 * loops, both work limits, and the hint's order. The search and the
 * techniques are checked against the independent cell-colouring oracle
 * (test-helpers.ts) on random boards, where every count must agree exactly
 * and every deduction must hold in every loop the oracle finds.
 */
import { describe, expect, it } from 'vitest';
import { BUNDLED_BOARDS } from './bundled';
import { emptyMarks, findConflicts, isSolved } from './engine';
import { cluesOfLoop, generatePuzzle, growRegion, loopOfRegion } from './generator';
import { dotIndex, gridFor, horizontalEdge, verticalEdge } from './grid';
import { createRng, shuffled } from './rng';
import { decodeClues } from './serialize';
import {
  countSolutions,
  findHint,
  findStep,
  gradeOf,
  hintEdge,
  hintMark,
  hintMarks,
  solveWithTechniques,
  solverWork,
  uniqueSolution,
  type Level,
  type SolveStep,
} from './solver';
import { cornerConclusions, oracleCount } from './test-helpers';
import {
  CROSS,
  LINE,
  PRESETS,
  UNKNOWN,
  type Clue,
  type Difficulty,
  type Layout,
  type Mark,
} from './types';

const layoutOf = (width: number, height: number, clues: Clue[]): Layout => ({
  width,
  height,
  clues,
});
const blank = (width: number, height: number): Layout =>
  layoutOf(width, height, new Array<Clue>(width * height).fill(null));

const bundled = (difficulty: Difficulty, n = 0): Layout => {
  const preset = PRESETS[difficulty];
  return {
    ...preset,
    clues: decodeClues(BUNDLED_BOARDS[difficulty][n]!.clues, preset.width, preset.height)!,
  };
};

const cellRing = (width: number, height: number, cell: number): number[] => {
  const grid = gridFor(width, height);
  return Array.from(grid.cellEdges.slice(4 * cell, 4 * cell + 4));
};

describe('T1 — counting (§7)', () => {
  it('crosses every edge round a 0', () => {
    const clues = new Array<Clue>(16).fill(null);
    clues[5] = 0;
    const result = solveWithTechniques(layoutOf(4, 4, clues), 1);
    expect(result.status).toBe('stuck');
    for (const e of cellRing(4, 4, 5)) expect(result.marks[e]).toBe(CROSS);
  });

  it('fills a number whose open edges are exactly what it still needs', () => {
    const clues = new Array<Clue>(16).fill(null);
    clues[5] = 3;
    const start = emptyMarks({ width: 4, height: 4 });
    start[cellRing(4, 4, 5)[0]!] = CROSS;
    const result = solveWithTechniques(layoutOf(4, 4, clues), 1, start);
    for (const e of cellRing(4, 4, 5).slice(1)) expect(result.marks[e]).toBe(LINE);
  });

  it('crosses the rest of a dot with two LINEs, and extends a line with one way on', () => {
    const grid = gridFor(4, 4);
    const start = emptyMarks({ width: 4, height: 4 });
    // A corner of a board dot: LINE along the top, the dot below it CROSSed.
    start[horizontalEdge(grid, 0, 0)] = LINE;
    start[verticalEdge(grid, 0, 0)] = CROSS;
    // Two LINEs at the inner dot (2, 2).
    start[horizontalEdge(grid, 2, 1)] = LINE;
    start[horizontalEdge(grid, 2, 2)] = LINE;
    const result = solveWithTechniques(blank(4, 4), 1, start);
    // Dot (0, 0) has degree 1 and no way on: a contradiction.
    expect(result.status).toBe('contradiction');
    const fine = [...start];
    fine[verticalEdge(grid, 0, 0)] = UNKNOWN;
    const ok = solveWithTechniques(blank(4, 4), 1, fine);
    // At (0, 0) the one open edge must carry the line on.
    expect(ok.marks[verticalEdge(grid, 0, 0)]).toBe(LINE);
    expect(ok.marks[verticalEdge(grid, 1, 2)]).toBe(CROSS);
    expect(ok.marks[verticalEdge(grid, 2, 2)]).toBe(CROSS);
  });

  it('never closes a chain into a loop while another LINE is elsewhere', () => {
    const grid = gridFor(4, 4);
    const [top, right, bottom, left] = cellRing(4, 4, 5);
    const start = emptyMarks({ width: 4, height: 4 });
    start[top!] = LINE;
    start[right!] = LINE;
    start[bottom!] = LINE;
    start[horizontalEdge(grid, 4, 3)] = LINE; // another piece far away
    const result = solveWithTechniques(blank(4, 4), 1, start);
    expect(result.marks[left!]).toBe(CROSS);
    // Alone, closing is allowed when it meets every number: nothing to say.
    const alone = [...start];
    alone[horizontalEdge(grid, 4, 3)] = UNKNOWN;
    expect(solveWithTechniques(blank(4, 4), 1, alone).marks[left!]).toBe(UNKNOWN);
  });

  it('says contradiction when the marks break a number', () => {
    const clues = new Array<Clue>(16).fill(null);
    clues[0] = 1;
    const [top, right] = cellRing(4, 4, 0);
    const start = emptyMarks({ width: 4, height: 4 });
    start[top!] = LINE;
    start[right!] = LINE;
    expect(solveWithTechniques(layoutOf(4, 4, clues), 1, start).status).toBe('contradiction');
  });
});

describe('T2 — corners (§7)', () => {
  it('draws both outer edges of a 3 in a board corner, and only from level 2', () => {
    const clues = new Array<Clue>(16).fill(null);
    clues[0] = 3;
    const [top, , , left] = cellRing(4, 4, 0);
    const basic = solveWithTechniques(layoutOf(4, 4, clues), 1);
    expect(basic.marks[top!]).toBe(UNKNOWN);
    const corner = solveWithTechniques(layoutOf(4, 4, clues), 2);
    expect(corner.marks[top!]).toBe(LINE);
    expect(corner.marks[left!]).toBe(LINE);
  });

  it('crosses both outer edges of a 1 in a board corner', () => {
    const clues = new Array<Clue>(16).fill(null);
    clues[15] = 1;
    const [, right, bottom] = cellRing(4, 4, 15);
    const result = solveWithTechniques(layoutOf(4, 4, clues), 2);
    expect(result.marks[right!]).toBe(CROSS);
    expect(result.marks[bottom!]).toBe(CROSS);
  });

  it('draws the far corner of a 3 that a line runs into', () => {
    const grid = gridFor(4, 4);
    const clues = new Array<Clue>(16).fill(null);
    clues[5] = 3; // cell (1, 1)
    const start = emptyMarks({ width: 4, height: 4 });
    // A line arrives at the 3's top-left dot (1, 1) from above; the dot's
    // left edge is CROSSed, so the line must turn into the 3.
    start[verticalEdge(grid, 0, 1)] = LINE;
    start[horizontalEdge(grid, 1, 0)] = CROSS;
    const result = solveWithTechniques(layoutOf(4, 4, clues), 2, start);
    const [, right, bottom] = cellRing(4, 4, 5);
    expect(result.marks[right!]).toBe(LINE);
    expect(result.marks[bottom!]).toBe(LINE);
    expect(solveWithTechniques(layoutOf(4, 4, clues), 1, start).marks[right!]).toBe(UNKNOWN);
  });
});

describe('T3 — trial (§7)', () => {
  it('finishes a Hard board that T1 + T2 leave stuck', () => {
    const board = bundled('hard');
    expect(solveWithTechniques(board, 2).status).toBe('stuck');
    const result = solveWithTechniques(board, 3);
    expect(result.status).toBe('solved');
    expect(result.trials).toBeGreaterThan(0);
    expect(isSolved(board, result.marks)).toBe(true);
  });

  it('stops honestly at its work limit', () => {
    const board = bundled('hard', 1);
    const result = solveWithTechniques(board, 3, undefined, 10);
    expect(result.status).toBe('limit');
    expect(result.marks.some((m) => m === UNKNOWN)).toBe(true);
  });

  it('grades within a work limit, and says nothing when the limit runs out', () => {
    const hard = bundled('hard', 0);
    const graded = gradeOf(hard)!;
    expect(graded.grade).toBe(3);
    expect(gradeOf(hard, 3, 1e9)).toEqual(graded);
    expect(gradeOf(hard, 3, 0)).toBeNull();
    // T1 and T2 settle Easy and Medium without a trial, which is all a limit cuts.
    expect(gradeOf(bundled('easy', 0), 3, 0)?.grade).toBe(1);
  });

  it('grades each bundled board to its own tier', () => {
    const expected: Record<Difficulty, Level> = { easy: 1, medium: 2, hard: 3 };
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (let n = 0; n < BUNDLED_BOARDS[difficulty].length; n++) {
        expect(gradeOf(bundled(difficulty, n))?.grade).toBe(expected[difficulty]);
      }
    }
    expect(gradeOf(blank(3, 3))).toBeNull();
  });
});

describe('counting loops (§8)', () => {
  it('counts every loop of an empty 2×2 board: the thirteen hole-free regions', () => {
    const search = countSolutions(blank(2, 2), { limit: 100 });
    const oracle = oracleCount(blank(2, 2), 100);
    expect(search.complete).toBe(true);
    expect(search.count).toBe(13);
    expect(oracle.count).toBe(13);
  });

  it('agrees with the oracle on every empty board up to 3×3 and 4×3', () => {
    for (const [w, h] of [
      [2, 3],
      [3, 3],
      [4, 3],
    ] as const) {
      const search = countSolutions(blank(w, h), { limit: 10_000, nodeLimit: 1_000_000 });
      const oracle = oracleCount(blank(w, h), 10_000);
      expect(search.complete).toBe(true);
      expect(oracle.complete).toBe(true);
      expect(search.count, `${w}x${h}`).toBe(oracle.count);
    }
  });

  it('finds no loop where the numbers allow none', () => {
    const zeros = layoutOf(3, 3, new Array<Clue>(9).fill(0));
    expect(countSolutions(zeros)).toMatchObject({ count: 0, complete: true, solution: null });
    expect(oracleCount(zeros).count).toBe(0);
    expect(uniqueSolution(zeros)).toBeNull();
  });

  it('stops at two, and calls nothing unique past its node limit', () => {
    expect(countSolutions(blank(4, 4))).toMatchObject({ count: 2, complete: true });
    expect(uniqueSolution(blank(4, 4))).toBeNull();
    const hard = bundled('hard', 2);
    const full = countSolutions(hard);
    expect(full).toMatchObject({ count: 1, complete: true });
    expect(full.nodes).toBeGreaterThan(1);
    const cut = countSolutions(hard, { nodeLimit: 1 });
    expect(cut.complete).toBe(false);
    expect(uniqueSolution(hard, { nodeLimit: 1 })).toBeNull();
  });

  it('stops honestly at a work limit too, and a generous one changes nothing', () => {
    const hard = bundled('hard', 2);
    const full = countSolutions(hard);
    const before = solverWork.read();
    const cut = countSolutions(hard, { workLimit: 50 });
    expect(cut.complete).toBe(false);
    expect(cut.nodes).toBeLessThan(full.nodes);
    // Checked at each node: the overshoot is at most one node's propagation.
    expect(solverWork.read() - before).toBeLessThan(50 + 2_000);
    expect(uniqueSolution(hard, { workLimit: 50 })).toBeNull();
    expect(countSolutions(hard, { workLimit: 1e9 })).toEqual(full);
    // Two loops found within the limit are an exact answer however little is left.
    expect(countSolutions(blank(4, 4), { workLimit: 1e9 })).toMatchObject({
      count: 2,
      complete: true,
    });
  });

  it('counts the same with a known loop as without one', () => {
    const hard = bundled('hard', 3);
    const solution = uniqueSolution(hard)!;
    expect(countSolutions(hard, { known: solution })).toMatchObject({ count: 1, complete: true });
    const thinner = {
      ...hard,
      clues: hard.clues.map((c, i) => (i === hard.clues.findIndex((x) => x !== null) ? null : c)),
    };
    const plain = countSolutions(thinner);
    const known = countSolutions(thinner, { known: solution });
    expect(known.count).toBe(plain.count);
  });
});

/**
 * Random boards on small grids: a random loop, its numbers, and a random
 * share of them blanked — so some boards have one loop, some many, and the
 * partly blanked ones whatever they have. Both counts must agree exactly,
 * and every edge a technique decides must hold in every loop there is.
 */
describe('differential against the oracle', () => {
  const randomBoards = (count: number, width: number, height: number, seed: string): Layout[] => {
    const rng = createRng(seed);
    const boards: Layout[] = [];
    for (let i = 0; i < count; i++) {
      const preset = { width, height };
      const region = growRegion(preset, rng, 2 + Math.floor(rng() * (width * height - 3)));
      const clues: Clue[] = cluesOfLoop(preset, loopOfRegion(preset, region.inside));
      const keep = rng();
      for (const cell of shuffled(
        clues.map((_, j) => j),
        rng,
      ))
        if (rng() > keep) clues[cell] = null;
      // Now and then a number that may contradict the rest.
      if (rng() < 0.15) clues[Math.floor(rng() * clues.length)] = Math.floor(rng() * 4);
      boards.push(layoutOf(width, height, clues));
    }
    return boards;
  };

  it('counts exactly what the oracle counts (3×3 and 4×4, up to 30 loops)', () => {
    let unique = 0;
    let many = 0;
    let none = 0;
    for (const board of [
      ...randomBoards(150, 3, 3, 'diff-3'),
      ...randomBoards(150, 4, 4, 'diff-4'),
    ]) {
      const search = countSolutions(board, { limit: 30, nodeLimit: 1_000_000 });
      const oracle = oracleCount(board, 30);
      expect(search.complete && oracle.complete).toBe(true);
      expect(search.count).toBe(oracle.count);
      if (oracle.count === 1) {
        unique++;
        expect(search.solution).toEqual(oracle.solution);
      } else if (oracle.count === 0) none++;
      else many++;
    }
    // The sample really does cover all three cases.
    expect(unique).toBeGreaterThan(20);
    expect(many).toBeGreaterThan(20);
    expect(none).toBeGreaterThan(5);
  });

  it('agrees on uniqueness on 5×5 boards', () => {
    for (const board of randomBoards(60, 5, 5, 'diff-5')) {
      const search = countSolutions(board);
      const oracle = oracleCount(board, 2);
      expect(search.complete && oracle.complete).toBe(true);
      expect(search.count).toBe(oracle.count);
    }
  });

  it('never deduces an edge that some loop contradicts, at any level', () => {
    for (const board of [
      ...randomBoards(120, 3, 3, 'sound-3'),
      ...randomBoards(120, 4, 4, 'sound-4'),
    ]) {
      const oracle = oracleCount(board, 200);
      expect(oracle.complete).toBe(true);
      for (const level of [1, 2, 3] as const) {
        const result = solveWithTechniques(board, level);
        if (oracle.count === 0) {
          expect(result.status).not.toBe('solved');
          continue;
        }
        expect(result.status, `a board with ${oracle.count} loops`).not.toBe('contradiction');
        for (const loop of oracle.solutions) {
          result.marks.forEach((mark, edge) => {
            if (mark !== UNKNOWN) expect(mark).toBe(loop[edge]);
          });
        }
        if (result.status === 'solved') expect(oracle.count).toBe(1);
      }
    }
  });
});

/**
 * A T1 hint must be read off the board as the Hint reads it (§6): the marks
 * as the player sees them, plus the CROSSes settled in plain sight
 * (`hintMarks`) — the rule at its anchor already forces the edge, with no
 * CROSS from anywhere else.
 */
function expectVisibleReason(board: Layout, marks: readonly Mark[], step: SolveStep): void {
  const grid = gridFor(board.width, board.height);
  const count = (edges: readonly number[], mark: Mark): number =>
    edges.filter((e) => marks[e] === mark).length;
  const { anchor, mark, edge } = step;
  if (anchor.kind === 'cell') {
    const ring = Array.from(grid.cellEdges.slice(4 * anchor.index, 4 * anchor.index + 4));
    expect(ring).toContain(edge);
    const clue = board.clues[anchor.index]!;
    const lines = count(ring, LINE);
    const open = count(ring, UNKNOWN);
    expect(mark === CROSS ? lines === clue : lines + open === clue).toBe(true);
  } else if (anchor.kind === 'dot') {
    const around = Array.from(grid.dotEdges.slice(4 * anchor.index, 4 * anchor.index + 4)).filter(
      (e) => e >= 0,
    );
    expect(around).toContain(edge);
    const lines = count(around, LINE);
    const open = count(around, UNKNOWN);
    if (mark === LINE) expect([lines, open]).toEqual([1, 1]);
    else expect(lines === 2 || (lines === 0 && open === 1)).toBe(true);
  } else {
    // The loop rule: the edge joins two chain ends, each of degree 1 already.
    expect(anchor.kind).toBe('loop');
    expect(mark).toBe(CROSS);
    for (const end of [grid.edgeDots[2 * edge]!, grid.edgeDots[2 * edge + 1]!]) {
      const around = Array.from(grid.dotEdges.slice(4 * end, 4 * end + 4)).filter((e) => e >= 0);
      expect(count(around, LINE)).toBe(1);
    }
  }
}

describe('the hint (§6)', () => {
  const easy = bundled('easy');
  const easySolution = uniqueSolution(easy)!;

  it('points at a wrong LINE first, then a wrong CROSS', () => {
    const marks = emptyMarks(easy);
    const offLoop = easySolution.findIndex((m) => m === CROSS);
    const onLoop = easySolution.findIndex((m) => m === LINE);
    marks[onLoop] = CROSS;
    expect(findHint(easy, easySolution, marks)).toEqual({
      kind: 'wrong',
      edge: onLoop,
      mark: CROSS,
    });
    marks[offLoop] = LINE;
    expect(findHint(easy, easySolution, marks)).toEqual({
      kind: 'wrong',
      edge: offLoop,
      mark: LINE,
    });
  });

  it('gives a step the answer agrees with, never touching the marks', () => {
    const marks = emptyMarks(easy);
    const before = [...marks];
    const hint = findHint(easy, easySolution, marks);
    expect(hint?.kind).toBe('step');
    if (hint?.kind !== 'step') return;
    expect(hint.step.level).toBe(1);
    expect(hint.step.mark).toBe(easySolution[hint.step.edge]);
    expect(marks).toEqual(before);
  });

  it('walks every bundled board to the end, each hint agreeing with the answer', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (let n = 0; n < BUNDLED_BOARDS[difficulty].length; n++) {
        const board = bundled(difficulty, n);
        const solution = uniqueSolution(board)!;
        const marks = emptyMarks(board);
        const levels = new Set<Level>();
        let hints = 0;
        while (!isSolved(board, marks)) {
          const hint = findHint(board, solution, marks);
          expect(hint, `${difficulty} #${n} ran out of hints`).not.toBeNull();
          expect(hint!.kind).not.toBe('wrong');
          const edge = hint!.kind === 'step' ? hint!.step.edge : hint!.edge;
          const mark = hint!.kind === 'step' ? hint!.step.mark : hint!.mark;
          expect(mark).toBe(solution[edge]);
          expect(marks[edge]).toBe(UNKNOWN);
          if (hint!.kind === 'step') {
            levels.add(hint!.step.level);
            if (hint!.step.level === 1) {
              expectVisibleReason(board, hintMarks(board, marks), hint!.step);
            }
          }
          // The techniques never fall silent on a shipped board.
          expect(hint!.kind).toBe('step');
          marks[edge] = mark;
          hints++;
          expect(hints).toBeLessThanOrEqual(marks.length);
        }
        if (difficulty === 'easy') expect([...levels]).toEqual([1]);
        if (difficulty === 'hard') expect(levels.has(3), `hard #${n} never needed T3`).toBe(true);
        expect(findHint(board, solution, solution)).toBeNull();
      }
    }
  });

  /**
   * §6: a T2 step rests on the marks the player sees. The engine's T2 stage
   * runs dry; `cornerConclusions` (test-helpers.ts) is the independent
   * yardstick — the same rules as a plain fixpoint that never writes a mark.
   * Every T2 hint must be one of its conclusions.
   */
  it('reads every T2 step from the visible marks, never from a mark it wrote itself', () => {
    const boards: { name: string; layout: Layout }[] = [];
    for (const difficulty of ['medium', 'hard'] as const) {
      BUNDLED_BOARDS[difficulty].forEach((_, n) =>
        boards.push({ name: `${difficulty} #${n}`, layout: bundled(difficulty, n) }),
      );
      for (let i = 0; i < 8; i++) {
        const seed = `t2-visible-${difficulty}-${i}`;
        boards.push({ name: seed, layout: generatePuzzle(seed, difficulty) });
      }
    }
    let t2 = 0;
    for (const { name, layout } of boards) {
      const solution = uniqueSolution(layout)!;
      const marks = emptyMarks(layout);
      while (!isSolved(layout, marks)) {
        const hint = findHint(layout, solution, marks);
        expect(hint?.kind, name).toBe('step');
        if (hint?.kind !== 'step') break;
        if (hint.step.level === 2) {
          t2++;
          const visible = cornerConclusions(layout, hintMarks(layout, marks));
          expect(visible, name).not.toBeNull();
          expect(visible!.get(hint.step.edge), `${name}: edge ${hint.step.edge}`).toBe(
            hint.step.mark,
          );
          // The yardstick itself is sound.
          for (const [edge, mark] of visible!) expect(solution[edge], name).toBe(mark);
        }
        marks[hint.step.edge] = hint.step.mark;
      }
    }
    expect(t2).toBeGreaterThan(150);
  });

  /**
   * A CROSS is a note nobody has to write (§3), so the hint must never wait
   * for one (§6, the 2026-10-17 review): followed by a player who writes no
   * CROSS at all — who draws each LINE hint and only remembers each CROSS
   * hint, or draws some other line of the answer instead — the hints still
   * agree with the answer, never name the same CROSS twice, never ask for
   * an edge settled in plain sight (the open side of a number the board
   * shows as met — a 0's four sides least of all — or a third edge at a dot
   * two lines meet at), and finish the board.
   */
  it('moves on past every × the player leaves unwritten, and never asks for a met number’s sides', () => {
    const boards: { name: string; layout: Layout }[] = [];
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      BUNDLED_BOARDS[difficulty].forEach((_, n) =>
        boards.push({ name: `${difficulty} #${n}`, layout: bundled(difficulty, n) }),
      );
      for (let i = 0; i < 4; i++) {
        const seed = `no-cross-${difficulty}-${i}`;
        boards.push({ name: seed, layout: generatePuzzle(seed, difficulty) });
      }
    }
    let zeroSides = 0;
    for (const detour of [false, true]) {
      for (const { name, layout } of boards) {
        const solution = uniqueSolution(layout)!;
        const grid = gridFor(layout.width, layout.height);
        const marks = emptyMarks(layout);
        const hinted: number[] = [];
        let hints = 0;
        while (!isSolved(layout, marks)) {
          const hint = findHint(layout, solution, marks, hinted);
          expect(hint?.kind, `${name}: no step`).toBe('step');
          if (hint?.kind !== 'step') break;
          const edge = hintEdge(hint);
          const mark = hintMark(hint);
          expect(mark, name).toBe(solution[edge]);
          expect(marks[edge], name).toBe(UNKNOWN);
          // Not something the board already settles in plain sight.
          expect(hintMarks(layout, marks, hinted)[edge], `${name}: edge ${edge}`).toBe(UNKNOWN);
          if (mark === LINE) marks[edge] = LINE;
          else {
            expect(hinted, `${name}: the × on edge ${edge} came back`).not.toContain(edge);
            hinted.push(edge);
            if (detour) {
              const other = solution.findIndex((m, e) => m === LINE && marks[e] === UNKNOWN);
              if (other >= 0) marks[other] = LINE;
            }
          }
          hints++;
          expect(hints, name).toBeLessThanOrEqual(marks.length);
        }
        expect(marks.includes(CROSS), name).toBe(false);
        for (let cell = 0; cell < grid.cellCount; cell++) {
          if (layout.clues[cell] !== 0) continue;
          for (const edge of grid.cellEdges.slice(4 * cell, 4 * cell + 4)) {
            expect(hinted, `${name}: a hint asked for a side of a 0`).not.toContain(edge);
            zeroSides++;
          }
        }
      }
    }
    // The boards do have 0s to leave alone.
    expect(zeroSides).toBeGreaterThan(40);
  });

  it('ignores a remembered × that the answer does not cross out', () => {
    const marks = emptyMarks(easy);
    const onLoop = easySolution.findIndex((m) => m === LINE);
    expect(findHint(easy, easySolution, marks, [onLoop])).toEqual(
      findHint(easy, easySolution, marks),
    );
  });

  /**
   * §6, step 3: the techniques are monotone, so from any marks the answer
   * agrees with they prove a next edge — the reveal stage is never reached
   * on a shipped board, and such marks never show a conflict (§5). Sampled:
   * random subsets of the answer's own marks, from sparse to nearly full.
   */
  it('proves a next step from any marks the answer agrees with (§6 step 3)', () => {
    const boards: { name: string; layout: Layout }[] = [];
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      BUNDLED_BOARDS[difficulty].forEach((_, n) =>
        boards.push({ name: `${difficulty} #${n}`, layout: bundled(difficulty, n) }),
      );
      for (let i = 0; i < 4; i++) {
        const seed = `consistent-${difficulty}-${i}`;
        boards.push({ name: seed, layout: generatePuzzle(seed, difficulty) });
      }
    }
    const rng = createRng('loop-puzzle-consistent-subsets');
    let checked = 0;
    for (const { name, layout } of boards) {
      const solution = uniqueSolution(layout)!;
      for (let k = 0; k < 20; k++) {
        const keep = 0.05 + 0.9 * rng();
        const marks = solution.map((mark) => (rng() < keep ? mark : UNKNOWN));
        if (isSolved(layout, marks)) continue;
        expect(findConflicts(layout, marks).any, name).toBe(false);
        const hint = findHint(layout, solution, marks);
        expect(hint?.kind, `${name}: ${marks.join('')}`).toBe('step');
        if (hint?.kind !== 'step') continue;
        expect(hint.step.mark, name).toBe(solution[hint.step.edge]);
        expect(marks[hint.step.edge], name).toBe(UNKNOWN);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it('no longer points at a LINE that leans on CROSSes the player has not written', () => {
    // The review's case: a full T2 fixpoint writes nine CROSSes the player
    // never sees, then LINE on edge 33 at dot 3 — which nothing on screen
    // supports. Read dry, the first visible conclusion is a CROSS.
    const layout = layoutOf(5, 5, decodeClues('111.3......1203.....1.213', 5, 5)!);
    const solution = uniqueSolution(layout)!;
    const marks = [...'...LL...XL...XL...XL...XL..LLL....XL....LX...XXL....LX...XXL'].map((ch) =>
      ch === 'L' ? LINE : ch === 'X' ? CROSS : UNKNOWN,
    ) as Mark[];
    const visible = cornerConclusions(layout, marks)!;
    expect(visible.has(33)).toBe(false);
    const hint = findHint(layout, solution, marks);
    expect(hint?.kind).toBe('step');
    if (hint?.kind !== 'step') return;
    expect(hint.step.level).toBe(2);
    expect(hint.step.edge).not.toBe(33);
    expect(visible.get(hint.step.edge)).toBe(hint.step.mark);
    expect(hint.step.mark).toBe(solution[hint.step.edge]);
  });

  it('leaves the T3 stage where it was: the dry T2 run learns the same corner facts', () => {
    // A T2 fixpoint of the visible marks (nothing left for T2 to say): the
    // next hint is a trial, read from those marks.
    const hard = bundled('hard', 1);
    const solution = uniqueSolution(hard)!;
    const stuck = solveWithTechniques(hard, 2);
    expect(stuck.status).toBe('stuck');
    const step = findStep(hard, stuck.marks);
    expect(step?.level).toBe(3);
    expect(step?.anchor.kind).toBe('trial');
    expect(step!.mark).toBe(solution[step!.edge]);
  });

  it('reveals one edge of the answer when the techniques have nothing to say', () => {
    const board = blank(3, 3);
    const inside = new Array<boolean>(9).fill(false);
    inside[4] = true;
    const solution = loopOfRegion(board, inside);
    expect(findStep(board, emptyMarks(board))).toBeNull();
    const hint = findHint(board, solution, emptyMarks(board));
    expect(hint?.kind).toBe('reveal');
    if (hint?.kind === 'reveal') {
      expect(hint.mark).toBe(LINE);
      expect(solution[hint.edge]).toBe(LINE);
    }
  });

  it('names where a step was read from', () => {
    const clues = new Array<Clue>(16).fill(null);
    clues[5] = 0;
    const step = findStep(layoutOf(4, 4, clues), emptyMarks({ width: 4, height: 4 }));
    expect(step).toMatchObject({ mark: CROSS, level: 1, anchor: { kind: 'cell', index: 5 } });
    const grid = gridFor(4, 4);
    const start = emptyMarks({ width: 4, height: 4 });
    start[horizontalEdge(grid, 0, 0)] = LINE;
    const dotStep = findStep(blank(4, 4), start);
    expect(dotStep?.anchor.kind).toBe('dot');
    expect(dotStep?.anchor.index).toBe(dotIndex(grid, 0, 0));
    expect(dotStep?.mark).toBe(LINE);
  });
});

describe('determinism of the techniques', () => {
  it('returns the same marks and trial count for the same board', () => {
    const board = bundled('hard', 2);
    const a = solveWithTechniques(board, 3);
    const b = solveWithTechniques(board, 3);
    expect(a.marks).toEqual(b.marks);
    expect(a.trials).toBe(b.trials);
    const step: Mark[] = [...a.marks];
    expect(step.every((m) => m !== UNKNOWN)).toBe(true);
  });
});
