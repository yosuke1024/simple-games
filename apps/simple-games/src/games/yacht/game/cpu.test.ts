/**
 * The CPU's one-turn expectimax (docs/YACHT_RULES.md §5): every action it
 * returns is legal for the throws used, it always rolls on an empty hand and
 * always scores once the third throw is spent, it prefers the box a bad
 * throw costs the least rather than the box with the biggest number, it is
 * deterministic, and its search stays inside a counted work budget rather
 * than a stopwatch (docs/GAME_LIFECYCLE.md「CPU 探索」, the same discipline
 * as `games/dots-and-boxes/game/cpu.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import { chooseCpuAction, cpuCost, type CpuAction, type CpuInput } from './cpu';
import { createRng } from './rng';
import { CATEGORIES, DICE_COUNT, FACES, ROLLS_PER_TURN, type Category } from './types';

/** Whether `action` is something the raw rules allow from `input` (§2, §5). */
function isLegal(input: CpuInput, action: CpuAction): boolean {
  switch (action.kind) {
    case 'roll':
      return (
        input.rollsUsed < ROLLS_PER_TURN &&
        (input.rollsUsed === 0 || input.held.some((kept) => !kept))
      );
    case 'hold':
      return (
        input.rollsUsed > 0 && input.rollsUsed < ROLLS_PER_TURN && action.held.length === DICE_COUNT
      );
    case 'score':
      return input.rollsUsed > 0 && input.cpuScores[CATEGORIES.indexOf(action.category)] === null;
  }
}

/** Every sorted five-dice state — the same 252 multisets `cpu.ts` searches. */
function allDiceStates(): number[][] {
  const out: number[][] = [];
  const walk = (from: number, prefix: number[]) => {
    if (prefix.length === DICE_COUNT) {
      out.push(prefix);
      return;
    }
    for (let face = from; face <= FACES; face++) walk(face, [...prefix, face]);
  };
  walk(1, []);
  return out;
}

/** A random cpuScores sheet with at least one open box. */
function randomCpuScores(rng: () => number): (number | null)[] {
  const scores = CATEGORIES.map(() => (rng() < 0.5 ? 0 : null));
  scores[Math.floor(rng() * CATEGORIES.length)] = null;
  return scores;
}

/** A spread of positions: every rollsUsed, random dice, holds and sheets. */
const POSITIONS: readonly CpuInput[] = (() => {
  const rng = createRng('yacht-cpu-property');
  const out: CpuInput[] = [];
  for (let i = 0; i < 300; i++) {
    const dice = Array.from({ length: DICE_COUNT }, () => Math.floor(rng() * FACES) + 1);
    const rollsUsed = Math.floor(rng() * 4) as 0 | 1 | 2 | 3;
    const held =
      rollsUsed === 0
        ? new Array<boolean>(DICE_COUNT).fill(false)
        : Array.from({ length: DICE_COUNT }, () => rng() < 0.4);
    out.push({ dice, held, rollsUsed, cpuScores: randomCpuScores(rng) });
  }
  return out;
})();

describe('the CPU’s line (§5)', () => {
  // The two sweeps below call the CPU a few hundred times at ~9ms each: past
  // vitest's 5s default under a loaded machine (the full suite), so they get
  // the same allowance as the work-budget sweep at the end of this file.
  it('always returns an action the raw rules allow', () => {
    for (const input of POSITIONS) {
      expect(isLegal(input, chooseCpuAction(input)), JSON.stringify(input)).toBe(true);
    }
  }, 30_000);

  it('always rolls with nothing thrown yet', () => {
    for (const input of POSITIONS) {
      if (input.rollsUsed !== 0) continue;
      expect(chooseCpuAction(input)).toEqual({ kind: 'roll' });
    }
  });

  it('always scores once the third throw is spent', () => {
    let seen = 0;
    for (const input of POSITIONS) {
      if (input.rollsUsed !== ROLLS_PER_TURN) continue;
      seen += 1;
      expect(chooseCpuAction(input).kind).toBe('score');
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('is deterministic: the same input always yields the same action', () => {
    for (const input of POSITIONS) {
      expect(chooseCpuAction(input)).toEqual(chooseCpuAction(input));
    }
  }, 30_000);

  it('holds the four 4s when Fours and Four of a Kind are the only boxes open, two throws left', () => {
    // rollsUsed 1: one throw made, two still to come.
    const cpuScores = CATEGORIES.map((category) =>
      category === 'fours' || category === 'fourOfAKind' ? null : 0,
    );
    const input: CpuInput = {
      dice: [4, 4, 4, 4, 2],
      held: [false, false, false, false, false],
      rollsUsed: 1,
      cpuScores,
    };
    expect(chooseCpuAction(input)).toEqual({
      kind: 'hold',
      held: [true, true, true, true, false],
    });
  });

  it('rolls again once the keep already matches what it wants held', () => {
    const cpuScores = CATEGORIES.map((category) =>
      category === 'fours' || category === 'fourOfAKind' ? null : 0,
    );
    const input: CpuInput = {
      dice: [4, 4, 4, 4, 2],
      held: [true, true, true, true, false],
      rollsUsed: 1,
      cpuScores,
    };
    expect(chooseCpuAction(input)).toEqual({ kind: 'roll' });
  });

  it('dumps a bad third throw where it costs the least, not on the biggest box', () => {
    const cpuScores = CATEGORIES.map(() => null);
    const input: CpuInput = {
      dice: [1, 2, 3, 4, 6],
      held: [false, false, false, false, false],
      rollsUsed: ROLLS_PER_TURN,
      cpuScores,
    };
    // Ones costs the least against its baseline (§5); Sixes costs the most.
    expect(chooseCpuAction(input)).toEqual({ kind: 'score', category: 'ones' });
  });

  it('scores the one box left on the last turn, after the third throw', () => {
    const cpuScores = CATEGORIES.map((category) => (category === 'yacht' ? null : 0));
    const input: CpuInput = {
      dice: [1, 2, 3, 4, 6],
      held: [false, false, false, false, false],
      rollsUsed: ROLLS_PER_TURN,
      cpuScores,
    };
    expect(chooseCpuAction(input)).toEqual({ kind: 'score', category: 'yacht' });
  });

  it('stays inside a counted work budget, worst case over every state and rollsUsed', () => {
    // A half-full sheet, as docs/YACHT_RULES.md §5 measures it: the upper six
    // taken, the six combinations still open.
    const OPEN = new Set<Category>([
      'fullHouse',
      'fourOfAKind',
      'littleStraight',
      'bigStraight',
      'choice',
      'yacht',
    ]);
    const cpuScores = CATEGORIES.map((category) => (OPEN.has(category) ? null : 0));
    const states = allDiceStates();
    expect(states).toHaveLength(252);

    let worst = 0;
    let calls = 0;
    const started = performance.now();
    for (const dice of states) {
      for (const rollsUsed of [1, 2, 3] as const) {
        chooseCpuAction({ dice, held: [false, false, false, false, false], rollsUsed, cpuScores });
        worst = Math.max(worst, cpuCost.work);
        calls += 1;
      }
    }
    const elapsedMs = performance.now() - started;
    // The bound is work, not milliseconds (docs/SUDOKU_RULES.md §7): candidate
    // keeps and the outcomes they are weighed against, together.
    expect(worst).toBeLessThan(1_000_000);
    expect(worst).toBeGreaterThan(0);
    // Reported for a reader, not judged: see the comment above.
    console.log(
      `yacht CPU: worst ${worst} work units over ${calls} calls (252 states × 3 rollsUsed), ` +
        `${(elapsedMs / calls).toFixed(3)}ms average — reported, not asserted`,
    );
    // 756 calls at ~9ms each is well past vitest's 5s default; the sweep is
    // the point of the test, so it gets the time (Mancala's budget test has
    // the same allowance).
  }, 30_000);
});
