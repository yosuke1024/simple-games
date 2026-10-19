/**
 * What docs/SNAKE_RULES.md promises across many seeds, checked by methods
 * that do not trust the engine (§16):
 *
 * - a full board is reachable on every seed: the cycle of §4 is checked to be
 *   a Hamiltonian cycle from first principles, and a pilot that follows it
 *   is run to the clear on 200 seeds;
 * - the engine moves exactly as a second, independently written model of
 *   §3/§8 does, tick for tick, over 200 runs of mixed play;
 * - no burst of input ever makes two consecutive moves opposite (300 runs of
 *   random presses, up to five between ticks);
 * - the same seed and the same play give the same run, every time.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { createSession, start, tick, turn, type SnakeSession } from './session';
import {
  TEST_REVERSE,
  cyclePilot,
  cycleSuccessors,
  directionStream,
  hamiltonianCycle,
  invariantViolations,
  playRun,
  referenceBody,
  referenceFoodCell,
  referenceStart,
  referenceStep,
  stepBetween,
  wanderer,
  type ReferenceState,
} from './test-helpers';
import { CELL_COUNT, INITIAL_BODY, MAX_SCORE, type Direction } from './types';

const PILOT_SEEDS = 200;
const DIFFERENTIAL_RUNS = 200;
const BURST_RUNS = 300;

/** The most moves a pilot can need: each food is less than one lap away (§4, §16). */
const PILOT_TICK_BOUND = MAX_SCORE * CELL_COUNT;

describe('the cycle behind §4', () => {
  const order = hamiltonianCycle();

  it('visits every cell exactly once', () => {
    expect(order).toHaveLength(CELL_COUNT);
    expect(new Set(order).size).toBe(CELL_COUNT);
    for (const cell of order) {
      expect(Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT).toBe(true);
    }
  });

  it('steps to a neighbour every time, including from the last cell back to the first', () => {
    for (let i = 0; i < order.length; i++) {
      expect(stepBetween(order[i]!, order[(i + 1) % order.length]!), `at ${i}`).not.toBeNull();
    }
  });

  it('carries the opening snake tail to head, so the pilot can take the first move', () => {
    const at = INITIAL_BODY.map((cell) => order.indexOf(cell));
    // Head first: head at k, neck at k − 1, tail at k − 2.
    expect(at[1]).toBe(at[0]! - 1);
    expect(at[2]).toBe(at[0]! - 2);
  });
});

const seeds = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}-${i}`);

/**
 * Each seed is its own case: the work is deterministic and about ten
 * milliseconds a run, and one `it()` over all of them would trade a per-test
 * budget for a wider timeout (docs/ARCHITECTURE.md「CI / リリース」). Inner
 * loops compare with plain code and hand vitest one verdict per run — an
 * `expect` per tick is most of the cost of a run otherwise.
 */
describe(`a full board is reachable (${PILOT_SEEDS} seeds, §4)`, () => {
  const pilot = cyclePilot(cycleSuccessors());

  it.each(seeds('snake-pilot', PILOT_SEEDS).map((seed, index) => ({ seed, index })))(
    'the cycle pilot clears $seed without a crash',
    ({ seed, index }) => {
      // Every move is checked against the rules for the first ten seeds; the
      // rest are checked at the end, which is where the claim lives.
      let firstViolation: string | null = null;
      const check =
        index < 10
          ? (session: SnakeSession) => {
              if (firstViolation !== null) return;
              const problems = invariantViolations(session);
              if (problems.length > 0)
                firstViolation = `tick ${session.ticks}: ${problems.join(', ')}`;
            }
          : undefined;
      const run = playRun(createSession(seed), pilot, PILOT_TICK_BOUND + 1, check);
      expect(firstViolation).toBeNull();
      expect(run.session.status).toBe('cleared');
      expect(run.session.score).toBe(MAX_SCORE);
      expect(run.session.body).toHaveLength(CELL_COUNT);
      expect(run.session.food).toBe(-1);
      expect(run.events.wall + run.events.self).toBe(0);
      expect(run.events.eat).toBe(MAX_SCORE - 1);
      expect(run.events.clear).toBe(1);
      expect(run.session.ticks).toBeLessThanOrEqual(PILOT_TICK_BOUND);
      expect(invariantViolations(run.session)).toEqual([]);
    },
  );
});

const sameArray = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Engine and reference, one tick each, with the same press. Returns how the
 * run ended and the first disagreement, if any.
 */
function compareRun(
  seed: string,
  policy: (session: SnakeSession) => Direction,
  maxTicks: number,
): { ending: 'over' | 'cleared' | 'running'; mismatch: string | null; ticks: number } {
  let session = start(createSession(seed));
  let reference: ReferenceState = referenceStart(seed);
  if (
    !sameArray(session.body, referenceBody(reference)) ||
    session.food !== referenceFoodCell(reference)
  ) {
    return { ending: 'running', mismatch: 'opening differs', ticks: 0 };
  }
  for (let t = 0; t < maxTicks; t++) {
    const press = policy(session);
    session = tick(turn(session, press)).session;
    reference = referenceStep(seed, reference, press);
    const fail = (what: string) => ({
      ending: 'running' as const,
      mismatch: `tick ${t}: ${what}`,
      ticks: t,
    });
    if (session.score !== reference.score) return fail('score');
    if (session.direction !== reference.direction) return fail('direction');
    if (reference.outcome === 'wall' || reference.outcome === 'self') {
      if (session.status !== 'over' || session.crash !== reference.outcome) return fail('crash');
      return { ending: 'over', mismatch: null, ticks: t + 1 };
    }
    if (!sameArray(session.body, referenceBody(reference))) return fail('body');
    if (session.food !== referenceFoodCell(reference)) return fail('food');
    if (reference.outcome === 'full') {
      if (session.status !== 'cleared') return fail('clear');
      return { ending: 'cleared', mismatch: null, ticks: t + 1 };
    }
    if (session.status !== 'running') return fail(`status ${session.status}`);
  }
  return { ending: 'running', mismatch: null, ticks: maxTicks };
}

describe(`the engine against an independent model of §3 and §8 (${DIFFERENTIAL_RUNS} runs)`, () => {
  it.each(seeds('snake-diff-wander', DIFFERENTIAL_RUNS / 2))(
    'agrees move for move with a wandering run to its crash: %s',
    (seed) => {
      const result = compareRun(seed, wanderer(seed), 20_000);
      expect(result.mismatch).toBeNull();
      expect(result.ending).toBe('over');
    },
  );

  // The pilot grows the snake to a real length along the cycle, then the
  // wanderer takes over: tail-chasing and self-crashes with long bodies.
  it.each(seeds('snake-diff-long', DIFFERENTIAL_RUNS / 2))(
    'agrees move for move with a long piloted snake that then wanders: %s',
    (seed) => {
      const pilot = cyclePilot(cycleSuccessors());
      const switchAt = 500 + Math.floor(createRng(`${seed}:switch`)() * 8000);
      const wander = wanderer(seed, 0.8);
      let t = 0;
      const policy = (session: SnakeSession) => (t++ < switchAt ? pilot(session) : wander(session));
      const result = compareRun(seed, policy, 40_000);
      expect(result.mismatch).toBeNull();
      expect(result.ending).not.toBe('running');
    },
  );

  it('agrees on the clear itself', () => {
    const result = compareRun('snake-diff-clear', cyclePilot(cycleSuccessors()), PILOT_TICK_BOUND);
    expect(result.mismatch).toBeNull();
    expect(result.ending).toBe('cleared');
  });
});

describe(`bursts of input never reverse the snake (${BURST_RUNS} runs, §5)`, () => {
  const batches = Array.from({ length: 10 }, (_, b) => ({ from: (b * BURST_RUNS) / 10 }));

  it.each(batches)(
    'holds for up to five random presses between every tick (runs $from+)',
    ({ from }) => {
      let ticks = 0;
      let firstProblem: string | null = null;
      for (let s = from; s < from + BURST_RUNS / 10 && firstProblem === null; s++) {
        const seed = `snake-burst-${s}`;
        const rng = createRng(`${seed}:count`);
        const press = directionStream(`${seed}:press`);
        const wander = wanderer(seed);
        let session = start(createSession(seed));
        for (let t = 0; t < 5000 && session.status === 'running'; t++) {
          // Half the runs press the wanderer's move first, so they live long
          // enough for the bursts to land on long, turning bodies.
          if (s % 2 === 0) session = turn(session, wander(session));
          const burst = Math.floor(rng() * 6);
          for (let p = 0; p < burst; p++) session = turn(session, press());
          const before = session.direction;
          session = tick(session).session;
          ticks++;
          if (session.direction === TEST_REVERSE[before]) {
            firstProblem = `${seed} tick ${t}: reversed`;
            break;
          }
          if (session.status === 'running') {
            const problems = invariantViolations(session);
            if (problems.length > 0) firstProblem = `${seed} tick ${t}: ${problems.join(', ')}`;
          }
        }
      }
      expect(firstProblem).toBeNull();
      expect(ticks).toBeGreaterThan((BURST_RUNS / 10) * 20);
    },
  );
});

describe('determinism (§8)', () => {
  /** A run reduced to one string: every food, in order, and how it ended. */
  function trace(seed: string): string {
    const wander = wanderer(seed);
    const foods: number[] = [];
    let session = start(createSession(seed));
    foods.push(session.food);
    while (session.status === 'running') {
      const outcome = tick(turn(session, wander(session)));
      session = outcome.session;
      if (outcome.event === 'eat') foods.push(session.food);
    }
    return `${foods.join(',')}|${session.score}|${session.ticks}|${session.crash}`;
  }

  it('plays the same seed the same way every time', () => {
    for (let s = 0; s < 50; s++) expect(trace(`snake-same-${s}`)).toBe(trace(`snake-same-${s}`));
  });

  it('gives different seeds different food', () => {
    const firsts = new Set<string>();
    for (let s = 0; s < 50; s++) firsts.add(trace(`snake-other-${s}`).split('|')[0]!);
    expect(firsts.size).toBe(50);
  });

  it('spreads the first food of a run evenly over the free cells across seeds', () => {
    const free = CELL_COUNT - INITIAL_BODY.length;
    const perCell = 50;
    const counts = new Map<number, number>();
    for (let s = 0; s < free * perCell; s++) {
      const food = createSession(`snake-first-${s}`).food;
      counts.set(food, (counts.get(food) ?? 0) + 1);
    }
    expect(counts.size).toBe(free);
    let chiSquare = 0;
    for (const count of counts.values()) chiSquare += (count - perCell) ** 2 / perCell;
    // 192 degrees of freedom; the seeds are fixed, so this is one number.
    expect(chiSquare).toBeLessThan(192 + 5 * 19.6);
  });
});
