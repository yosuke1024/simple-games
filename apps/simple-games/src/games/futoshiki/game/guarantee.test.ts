/**
 * The promises of docs/FUTOSHIKI_RULES.md §7–§9, measured rather than assumed:
 * every puzzle that ships is settled by the five techniques alone — which is
 * both "no guessing" and "exactly one solution" — generation is
 * deterministic, the fallback stays theoretical, and the work stays inside its
 * budget.
 *
 * The whole list is walked, not a sample. There are 100 levels and the walk
 * costs a fraction of a second, so sampling would only buy the chance of
 * shipping the one level that is broken.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_SIZE, DAILY_SPEC, addDays, dailySeed } from './daily';
import { ATTEMPT_LIMIT, adjacentPairs, generatePuzzle, type GeneratedPuzzle } from './generator';
import { MAX_LEVEL, levelSeed, sizeForLevel, specForLevel } from './levels';
import { solve, type Technique } from './solver';
import { constraintAxis, type Size } from './types';

/**
 * Reads the solver may spend on one board (`solverWork`, and the reason it is
 * counted at all is in that comment). Measured on this list: the worst level
 * is 91 at 34,192 reads and the worst of two years of dailies is 16,070, so
 * the budget sits at roughly 1.75× the worst case. It is a regression gate,
 * not a device promise — the device promise is checked on a device, per
 * docs/RELEASE_CHECKLIST.md §2 — and what it catches is a technique ladder
 * that stops escalating cheapest-first, or a dig that starts re-solving what
 * it has already settled.
 */
const WORK_BUDGET = 60_000;

/**
 * Derived seeds one board may cost (§8). Measured: 97 of the 100 levels land
 * on the first Latin square they are given, two need a second and level 45
 * needs four; every daily across two years lands on the first. The cap is
 * ATTEMPT_LIMIT and this budget is far below it, so a level drifting up to
 * here is a warning long before anything falls back.
 */
const ATTEMPT_BUDGET = 8;

/** 60 days is two months of daily seeds — enough to see a bad day coming. */
const DAILY_DAYS = 60;

interface Run {
  readonly name: string;
  readonly size: Size;
  /** What the band asked for — what "fell back" is measured against. */
  readonly target: number;
  readonly signs: number;
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
      target: spec.givens,
      signs: spec.constraints,
      puzzle: generatePuzzle(levelSeed(level), size, spec),
    });
  }

  let date = '2026-08-01';
  for (let day = 0; day < DAILY_DAYS; day++) {
    runs.push({
      name: `daily ${date}`,
      size: DAILY_SIZE,
      target: DAILY_SPEC.givens,
      signs: DAILY_SPEC.constraints,
      puzzle: generatePuzzle(dailySeed(date), DAILY_SIZE, DAILY_SPEC),
    });
    date = addDays(date, 1);
  }

  return { runs, ms: performance.now() - started };
}

const { runs, ms } = walk();

describe('no-guess generation (§7, §8)', () => {
  it('settles every level and daily with the techniques alone', () => {
    for (const { name, size, puzzle } of runs) {
      const result = solve(puzzle.givens, size, puzzle.constraints);
      expect(result.contradiction, `${name} contradicts itself`).toBe(false);
      expect(result.solved, `${name} needs a guess`).toBe(true);
      // The board the techniques reach is the board that was dug from, so the
      // puzzle has exactly one solution — anything else would need the solver
      // to have written a digit the generator did not.
      expect(result.grid, `${name} settles on a different board`).toEqual([...puzzle.solution]);
    }
  });

  it('never falls back to a board easier than its band asked for', () => {
    for (const { name, target, puzzle } of runs) {
      expect(puzzle.fallback, `${name} fell back`).toBe(false);
      expect(puzzle.givensCount, `${name} kept too many givens`).toBeLessThanOrEqual(target);
    }
  });

  /**
   * The signs are the half of the puzzle a Latin square cannot check. Each one
   * has to be a real gap between two adjacent cells, appear once, and agree
   * with the answer — the same three things §11 refuses a save for.
   */
  it('ships signs that are real gaps, once each, all pointing at the answer', () => {
    for (const { name, size, signs, puzzle } of runs) {
      expect(puzzle.constraints, `${name} carries the wrong number of signs`).toHaveLength(signs);
      expect(signs, `${name} asks for more signs than the board has gaps`).toBeLessThanOrEqual(
        adjacentPairs(size).length,
      );
      const seen = new Set<string>();
      for (const constraint of puzzle.constraints) {
        expect(
          constraintAxis(constraint, size),
          `${name} has a sign between two far cells`,
        ).not.toBeNull();
        const gap = [constraint.less, constraint.greater].sort((a, b) => a - b).join('-');
        expect(seen.has(gap), `${name} draws the same gap twice`).toBe(false);
        seen.add(gap);
        expect(
          puzzle.solution[constraint.less]! < puzzle.solution[constraint.greater]!,
          `${name} has a sign the answer breaks`,
        ).toBe(true);
      }
    }
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    const spec = { constraints: 20, givens: 8 };
    const a = generatePuzzle('futoshiki-repeat', 6, spec);
    const b = generatePuzzle('futoshiki-repeat', 6, spec);
    expect(a.solution).toEqual(b.solution);
    expect(a.constraints).toEqual(b.constraints);
    expect(a.givens).toEqual(b.givens);
    expect(a.attempts).toBe(b.attempts);
    // And a level is a pure function of its number, walk or no walk.
    const again = generatePuzzle(levelSeed(37), sizeForLevel(37), specForLevel(37));
    expect(again.givens).toEqual([...runs[36]!.puzzle.givens]);
    expect(again.constraints).toEqual([...runs[36]!.puzzle.constraints]);
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
    console.log(
      `[futoshiki] ${runs.length} boards: worst work=${worst.puzzle.work} (${worst.name}) ` +
        `total=${total} — ms=${ms.toFixed(0)} (printed, not asserted)`,
    );
    expect(worst.puzzle.work, `worst work ${worst.puzzle.work} at ${worst.name}`).toBeLessThan(
      WORK_BUDGET,
    );
  });

  it('rarely needs a second Latin square, and never approaches the cap', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.attempts > a.puzzle.attempts ? b : a));
    const retried = runs.filter((run) => run.puzzle.attempts > 1).length;
    console.log(
      `[futoshiki] ${retried}/${runs.length} boards needed a derived seed; ` +
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
 * one is required. The counts below say how often the expensive end of the
 * ladder earns its place, and the answer is "rarely": the signs and the naked
 * single settle every board, a hidden single is wanted on about a third, and
 * the two pair techniques are between them needed on one board in 160.
 *
 * That is the measurement behind having no difficulty tier at all (types.ts):
 * a tier that allowed pairs would name a technique almost no board asks for.
 * They stay in the ladder because the Hint runs on the player's own board,
 * which is a position this walk never visits.
 */
describe('what the ladder actually needs (§7)', () => {
  it('is settled by the sign and the singles, with the pairs a rarity', () => {
    const tally = new Map<Technique, number>();
    for (const { size, puzzle } of runs) {
      for (const technique of solve(puzzle.givens, size, puzzle.constraints).techniques) {
        tally.set(technique, (tally.get(technique) ?? 0) + 1);
      }
    }
    console.log(
      `[futoshiki] boards needing each technique, of ${runs.length}: ` +
        [...tally].map(([technique, count]) => `${technique}=${count}`).join(' '),
    );
    expect(tally.get('inequality')).toBe(runs.length);
    expect(tally.get('naked-single')).toBe(runs.length);
  });
});
