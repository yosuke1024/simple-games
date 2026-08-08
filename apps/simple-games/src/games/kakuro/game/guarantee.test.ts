/**
 * The promises of docs/KAKURO_RULES.md §7–§9, measured rather than assumed:
 * every puzzle that ships is settled by the six techniques alone — which is
 * both "no guessing" and "exactly one solution" — generation is
 * deterministic, the fallback stays theoretical, and the work stays inside its
 * budget.
 *
 * The whole list is walked, not a sample. There are 100 levels and two years
 * of dailies, and sampling would only buy the chance of shipping the one board
 * that is broken.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_SIZE, DAILY_SPEC, addDays, dailySeed } from './daily';
import { findViolations } from './engine';
import { ATTEMPT_LIMIT, generatePuzzle, type GeneratedPuzzle } from './generator';
import { MAX_LEVEL, levelSeed, sizeForLevel, specForLevel } from './levels';
import { solve, type Technique } from './solver';
import { EMPTY, MAX_RUN, MIN_RUN, type Size } from './types';

/**
 * Reads the solver may spend on one board (`solverWork`, and the reason it is
 * counted at all is in that comment). Measured on this list: the worst level
 * is 88 at 2,264,623 reads and the worst of two years of dailies is 1,152,756,
 * so the budget sits at roughly 1.8× the worst case. The median board costs
 * 80,920, and the three sizes sit at 69,780 / 80,920 / 399,676 — the spread
 * that pays for the last band's larger boards.
 *
 * **It is an order of magnitude above its siblings' 60,000, and that is the
 * shape of the game rather than a regression.** Takuzu and Futoshiki generate
 * by digging: one finished board, then a descent that only ever removes. A
 * Kakuro has nothing to dig — the clues are the whole puzzle (§1) — so
 * generation is instead a search for an answer whose own sums pin it down
 * (`tighten`), and every step of that search costs a full solve. The budget is
 * a regression gate, not a device promise — the device promise is checked on a
 * device, per docs/RELEASE_CHECKLIST.md §2 — and what it catches is a
 * technique ladder that stops escalating cheapest-first, a partition table
 * rebuilt per read, or a climb that stops converging.
 */
const WORK_BUDGET = 4_000_000;

/**
 * Derived seeds one board may cost (§8). Measured: the band ends sit at the
 * median reachable density (levels.ts), so 601 of the 830 boards land on the
 * first seed they are given and the worst — the daily for 2028-06-14 — needs
 * six. The cap is
 * ATTEMPT_LIMIT and this budget is far below it, so a level drifting up to
 * here is a warning long before anything falls back — RELIEF_AFTER is 12, and
 * nothing on this list reaches it.
 */
const ATTEMPT_BUDGET = 10;

/**
 * Two years of daily seeds. The figure is not decorative: the budgets above
 * are stated against "the worst of two years of dailies", and a gate that
 * walked two months while the claim said two years would be leaving 670 days
 * of fallback, retry and work regressions unguarded behind a promise.
 */
const DAILY_DAYS = 730;

interface Run {
  readonly name: string;
  readonly size: Size;
  /** What the band asked for — what "fell back" is measured against. */
  readonly target: number;
  readonly puzzle: GeneratedPuzzle;
}

/** Built once: every describe below reads the same walk rather than repeating it. */
function walk(): { runs: Run[]; ms: number } {
  const started = performance.now();
  const runs: Run[] = [];

  for (let level = 1; level <= MAX_LEVEL; level++) {
    const size = sizeForLevel(level);
    const spec = specForLevel(level);
    runs.push({
      name: `level ${level}`,
      size,
      target: spec.blocks,
      puzzle: generatePuzzle(levelSeed(level), size, spec),
    });
  }

  let date = '2026-08-01';
  for (let day = 0; day < DAILY_DAYS; day++) {
    runs.push({
      name: `daily ${date}`,
      size: DAILY_SIZE,
      target: DAILY_SPEC.blocks,
      puzzle: generatePuzzle(dailySeed(date), DAILY_SIZE, DAILY_SPEC),
    });
    date = addDays(date, 1);
  }

  return { runs, ms: performance.now() - started };
}

const { runs, ms } = walk();

describe('no-guess generation (§7, §8)', () => {
  it('settles every level and daily with the techniques alone, from an empty board', () => {
    for (const { name, size, puzzle } of runs) {
      const empty = new Array<number>(size * size).fill(EMPTY);
      const result = solve(empty, puzzle.table);
      expect(result.contradiction, `${name} contradicts itself`).toBe(false);
      expect(result.solved, `${name} needs a guess`).toBe(true);
      // The board the techniques reach is the board the clues were added up
      // from, so the puzzle has exactly one solution — anything else would
      // need the solver to have written a digit the generator did not.
      expect(result.entries, `${name} settles on a different board`).toEqual([...puzzle.solution]);
    }
  });

  it('never falls back to a board easier than its band asked for', () => {
    for (const { name, target, puzzle } of runs) {
      expect(puzzle.fallback, `${name} fell back`).toBe(false);
      expect(puzzle.blockCount, `${name} kept too many clue cells`).toBeLessThanOrEqual(target);
    }
  });

  /**
   * The layout is the half of the puzzle the solver cannot check for itself:
   * a board with a one-cell run or a ten-cell one is not a Kakuro at all (§1),
   * and it would reach the player as a cell with its answer printed on it or
   * as a row that cannot legally be filled.
   */
  it('ships layouts that are Kakuro boards: runs of 2..9, every cell in two of them', () => {
    for (const { name, size, puzzle } of runs) {
      expect(puzzle.table.runs.length, `${name} has no runs`).toBeGreaterThan(0);
      for (const run of puzzle.table.runs) {
        expect(run.cells.length, `${name} has a run of ${run.cells.length}`).toBeGreaterThanOrEqual(
          MIN_RUN,
        );
        expect(run.cells.length, `${name} has a run of ${run.cells.length}`).toBeLessThanOrEqual(
          MAX_RUN,
        );
        const sum = run.cells.reduce<number>((n, index) => n + puzzle.solution[index]!, 0);
        expect(sum, `${name} has a clue the answer breaks`).toBe(run.sum);
      }
      for (const index of puzzle.table.white) {
        expect(puzzle.table.rowRun[index], `${name} cell ${index}`).toBeGreaterThanOrEqual(0);
        expect(puzzle.table.colRun[index], `${name} cell ${index}`).toBeGreaterThanOrEqual(0);
      }
      expect(findViolations([...puzzle.solution], puzzle.table).any, `${name} answer breaks`).toBe(
        false,
      );
      expect(puzzle.layout.cells).toHaveLength(size * size);
    }
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    const spec = { blocks: 24 };
    const a = generatePuzzle('kakuro-repeat', 8, spec);
    const b = generatePuzzle('kakuro-repeat', 8, spec);
    expect(a.solution).toEqual(b.solution);
    expect(a.layout.cells).toEqual(b.layout.cells);
    expect(a.attempts).toBe(b.attempts);
    // And a level is a pure function of its number, walk or no walk.
    const again = generatePuzzle(levelSeed(37), sizeForLevel(37), specForLevel(37));
    expect(again.solution).toEqual([...runs[36]!.puzzle.solution]);
    expect(again.layout.cells).toEqual([...runs[36]!.puzzle.layout.cells]);
  });
});

/**
 * §8 budgets generation per board on the device. Asserting that here with
 * `performance.now()` would measure the work times whatever else the machine
 * is doing — under `pnpm test`, six other vitest forks — so the gate is the
 * work itself, which is a function of the seed and therefore identical on
 * every machine. The milliseconds are printed and never asserted. The
 * reasoning, and the 41× spread that produced it, is in SUDOKU_RULES.md §7.
 */
describe('generation cost (§8)', () => {
  it('stays inside the work budget on every board', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
    const total = runs.reduce((sum, run) => sum + run.puzzle.work, 0);
    const summarise = (name: string, group: Run[]): string => {
      if (group.length === 0) return `${name}: none`;
      const sorted = group.map((run) => run.puzzle.work).sort((a, b) => a - b);
      return `${name} n=${group.length} p50=${sorted[Math.floor(sorted.length / 2)]} worst=${sorted[sorted.length - 1]}`;
    };
    const levels = runs.filter((run) => run.name.startsWith('level'));
    const dailies = runs.filter((run) => run.name.startsWith('daily'));
    const bySize = ([6, 8, 10] as Size[]).map((size) =>
      summarise(
        `${size}×${size}`,
        runs.filter((run) => run.size === size),
      ),
    );
    console.log(
      `[kakuro] ${runs.length} boards: worst work=${worst.puzzle.work} (${worst.name}) ` +
        `total=${total} — ${bySize.join(' | ')} — ${summarise('levels', levels)} — ` +
        `${summarise('dailies', dailies)} — ms=${ms.toFixed(0)} (printed, not asserted)`,
    );
    expect(worst.puzzle.work, `worst work ${worst.puzzle.work} at ${worst.name}`).toBeLessThan(
      WORK_BUDGET,
    );
  });

  it('rarely needs a second derived seed, and never approaches the cap', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.attempts > a.puzzle.attempts ? b : a));
    const retried = runs.filter((run) => run.puzzle.attempts > 1).length;
    console.log(
      `[kakuro] ${retried}/${runs.length} boards needed a derived seed; ` +
        `worst ${worst.puzzle.attempts} (${worst.name}) of ${ATTEMPT_LIMIT}`,
    );
    expect(
      worst.puzzle.attempts,
      `${worst.name} took ${worst.puzzle.attempts}`,
    ).toBeLessThanOrEqual(ATTEMPT_BUDGET);
  });
});

/**
 * Sudoku §6's honesty measurement, run on this game: a tier — here, the single
 * technique set of §7 — may promise which techniques are ALLOWED, never that
 * one is required. §7 has a table waiting for these counts, and the decision
 * they settle is whether Kakuro should have difficulty tiers at all.
 */
describe('what the ladder actually needs (§7)', () => {
  it('counts the boards that require each of the six', () => {
    const tally = new Map<Technique, number>();
    for (const { size, puzzle } of runs) {
      const empty = new Array<number>(size * size).fill(EMPTY);
      for (const technique of solve(empty, puzzle.table).techniques) {
        tally.set(technique, (tally.get(technique) ?? 0) + 1);
      }
    }
    console.log(
      `[kakuro] boards needing each technique, of ${runs.length}: ` +
        [...tally].map(([technique, count]) => `${technique}=${count}`).join(' '),
    );
    // The two that carry the game (§7): a board with no fixed partition and no
    // intersection would not be a Kakuro being solved, it would be a
    // coincidence.
    expect(tally.get('intersection')).toBe(runs.length);
    expect(tally.get('naked-single')).toBe(runs.length);
  });
});
