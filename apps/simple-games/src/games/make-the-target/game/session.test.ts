/**
 * The session of docs/MAKE_THE_TARGET_RULES.md §3–§5 (§15「セッションと
 * Undo」): selection, silent refusal, merges, Undo, Restart and `repeat`, and
 * showing the solution.
 */
import { describe, expect, it } from 'vitest';
import { replay } from './engine';
import {
  canReveal,
  canUndo,
  clearSelection,
  createSession,
  dailyOrigin,
  expressionLines,
  freeOrigin,
  freeSeed,
  isFreeSeed,
  newSeedToken,
  playMove,
  restartSession,
  revealSolution,
  solutionLines,
  tapOperator,
  tapTile,
  undo,
  withElapsed,
  type MakeTheTargetSession,
} from './session';
import type { Problem } from './types';

/** 1, 2, 3, 4 → 21, kept with (1+2)×(3+4) as slot moves. */
const PROBLEM: Problem = {
  difficulty: 'easy',
  numbers: [1, 2, 3, 4],
  target: 21,
  solution: [
    { left: 0, op: '+', right: 1 },
    { left: 2, op: '+', right: 3 },
    { left: 1, op: '*', right: 3 },
  ],
};

const free = (): MakeTheTargetSession =>
  createSession(PROBLEM, freeOrigin(freeSeed('easy', 'test')));
const daily = (): MakeTheTargetSession =>
  createSession({ ...PROBLEM, difficulty: 'medium' }, dailyOrigin('2026-10-21'));

/** Taps a sequence: a number is a slot, a string an operator. */
function taps(session: MakeTheTargetSession, ...steps: (number | '+' | '-' | '*' | '/')[]) {
  return steps.reduce<MakeTheTargetSession>(
    (s, step) => (typeof step === 'number' ? tapTile(s, step) : tapOperator(s, step)),
    session,
  );
}

const solve = (s: MakeTheTargetSession) => taps(s, 0, '+', 1, 2, '+', 3, 1, '*', 3);
const miss = (s: MakeTheTargetSession) => taps(s, 0, '+', 1, 2, '+', 3, 1, '+', 3);

describe('a fresh game', () => {
  it('deals the numbers ascending with nothing chosen and nothing played', () => {
    const s = createSession(
      { ...PROBLEM, numbers: [4, 3, 2, 1] },
      freeOrigin('make-the-target-easy-t'),
    );
    expect(s.slots).toEqual([1, 2, 3, 4]);
    expect(s).toMatchObject({
      status: 'playing',
      moves: [],
      selectedTile: null,
      selectedOperator: null,
      repeat: false,
      elapsedSeconds: 0,
      mode: 'free',
      dailyDate: null,
    });
  });
});

describe('selection (§3)', () => {
  it('a tile, then the same tile again, clears it', () => {
    const one = tapTile(free(), 2);
    expect(one.selectedTile).toBe(2);
    expect(tapTile(one, 2)).toMatchObject({ selectedTile: null, selectedOperator: null });
  });

  it('another tile with no operator moves the choice', () => {
    expect(taps(free(), 2, 0).selectedTile).toBe(0);
  });

  it('operators do nothing until a tile is chosen', () => {
    const s = free();
    expect(tapOperator(s, '+')).toBe(s);
  });

  it('the same operator again clears only the operator; another replaces it', () => {
    const chosen = taps(free(), 2, '+');
    expect(chosen.selectedOperator).toBe('+');
    expect(tapOperator(chosen, '+')).toMatchObject({ selectedTile: 2, selectedOperator: null });
    expect(tapOperator(chosen, '*')).toMatchObject({ selectedTile: 2, selectedOperator: '*' });
  });

  it('the chosen tile again with an operator clears everything', () => {
    expect(taps(free(), 2, '+', 2)).toMatchObject({ selectedTile: null, selectedOperator: null });
  });

  it('Escape clears the selection, and is the same session when nothing is chosen', () => {
    const s = free();
    expect(clearSelection(s)).toBe(s);
    expect(clearSelection(taps(s, 1, '*'))).toMatchObject({
      selectedTile: null,
      selectedOperator: null,
    });
  });

  it('an empty slot and a slot off the board are not tiles', () => {
    const merged = taps(free(), 0, '+', 1);
    expect(merged.slots[0]).toBeNull();
    expect(tapTile(merged, 0)).toBe(merged);
    expect(tapTile(merged, 7)).toBe(merged);
    expect(tapTile(merged, -1)).toBe(merged);
    expect(tapTile(merged, 1.5)).toBe(merged);
  });
});

describe('merging (§2, §3)', () => {
  it('tile → operator → tile merges into the second tile’s slot and clears the selection', () => {
    const s = taps(free(), 2, '*', 0); // 3 × 1
    expect(s.slots).toEqual([3, 2, null, 4]);
    expect(s.moves).toEqual([{ left: 2, op: '*', right: 0 }]);
    expect(s).toMatchObject({ selectedTile: null, selectedOperator: null, status: 'playing' });
  });

  it('a merge the rules refuse changes nothing at all — the same session', () => {
    for (const [op, a, b] of [
      ['-', 0, 3], // 1 − 4 is negative
      ['/', 1, 2], // 2 ÷ 3 is a fraction
    ] as const) {
      const chosen = taps(free(), a, op);
      expect(tapTile(chosen, b), `${a}${op}${b}`).toBe(chosen);
    }
    // 2 − 2 is 0.
    const twos = createSession(
      { ...PROBLEM, numbers: [2, 2, 3, 4] },
      freeOrigin('make-the-target-easy-t'),
    );
    const chosen = taps(twos, 0, '-');
    expect(tapTile(chosen, 1)).toBe(chosen);
  });

  it('the order chosen is the direction', () => {
    expect(taps(free(), 3, '-', 0).slots).toEqual([3, 2, 3, null]); // 4 − 1
    const refused = taps(free(), 0, '-');
    expect(tapTile(refused, 3)).toBe(refused); // 1 − 4
  });

  it('a number equal to the target mid-way is nothing', () => {
    // 20 + 1 makes 21, the target, with two tiles left.
    const s = createSession({ ...PROBLEM, numbers: [1, 1, 3, 20] }, freeOrigin('x'));
    const exact = taps(s, 3, '+', 0);
    expect(exact.slots).toEqual([21, 1, 3, null]);
    expect(exact.status).toBe('playing');
  });

  it('n−1 merges end the board: solved when it equals the target, missed when not', () => {
    const solved = solve(free());
    expect(solved.status).toBe('solved');
    expect(solved.moves).toHaveLength(3);
    const missed = miss(free());
    expect(missed.status).toBe('missed');
    expect(missed.slots.filter((v) => v !== null)).toEqual([10]);
  });

  it('a finished board takes no taps', () => {
    for (const done of [solve(free()), miss(free())]) {
      expect(tapTile(done, 3)).toBe(done);
      expect(playMove(done, { left: 3, op: '+', right: 3 })).toBeNull();
    }
  });

  it('writes one expression line per move', () => {
    expect(expressionLines(solve(free()))).toEqual([
      { left: 1, op: '+', right: 2, result: 3 },
      { left: 3, op: '+', right: 4, result: 7 },
      { left: 3, op: '*', right: 7, result: 21 },
    ]);
  });
});

describe('Undo (§5)', () => {
  it('takes the last move back exactly: both slots and values', () => {
    const one = taps(free(), 2, '*', 0);
    const two = taps(one, 3, '-', 0); // 4 − 3
    const back = undo(two)!;
    expect(back.slots).toEqual(one.slots);
    expect(back.moves).toEqual(one.moves);
    expect(undo(back)!.slots).toEqual([1, 2, 3, 4]);
    expect(undo(undo(back)!)).toBeNull();
  });

  it('every prefix of a missed board’s move list undoes to the replay of that prefix', () => {
    // (random play over generated problems: properties.test.ts)
    let s = miss(free());
    expect(s.status).toBe('missed');
    const moves = s.moves;
    expect(moves).toHaveLength(3);
    for (let n = 3; n > 0; n--) {
      s = undo(s)!;
      expect(s.moves).toEqual(moves.slice(0, n - 1));
      expect(s.slots).toEqual(replay(PROBLEM.numbers, moves.slice(0, n - 1))!.slots);
      expect(s.status).toBe('playing');
    }
    expect(undo(s)).toBeNull();
  });

  it('brings a missed board back into play', () => {
    const back = undo(miss(free()))!;
    expect(back.status).toBe('playing');
    expect(back.moves).toHaveLength(2);
  });

  it('clears the selection', () => {
    const s = taps(taps(free(), 0, '+', 1), 2, '+');
    expect(undo(s)).toMatchObject({ selectedTile: null, selectedOperator: null });
  });

  it('does not take back a solved or a revealed board', () => {
    expect(canUndo(solve(free()))).toBe(false);
    expect(undo(solve(free()))).toBeNull();
    const revealed = revealSolution(miss(free()))!;
    expect(canUndo(revealed)).toBe(false);
    expect(undo(revealed)).toBeNull();
  });
});

describe('Restart and `repeat` (§5, §9)', () => {
  it('keeps the problem and clears the moves and the clock — nothing is regenerated', () => {
    const played = withElapsed(taps(free(), 0, '+', 1), 42);
    const again = restartSession(played)!;
    expect(again.problem).toBe(played.problem);
    expect(again).toMatchObject({
      moves: [],
      elapsedSeconds: 0,
      status: 'playing',
      seed: played.seed,
    });
    expect(again.slots).toEqual([1, 2, 3, 4]);
  });

  it('a Free Play retry of a solved problem is a repeat, and stays one', () => {
    const retry = restartSession(solve(free()))!;
    expect(retry.repeat).toBe(true);
    expect(restartSession(retry)!.repeat).toBe(true);
    expect(restartSession(miss(retry))!.repeat).toBe(true);
    expect(restartSession(solve(retry))!.repeat).toBe(true);
  });

  it('a retry of a problem not yet solved is not', () => {
    expect(restartSession(miss(free()))!.repeat).toBe(false);
    expect(restartSession(taps(free(), 0, '+', 1))!.repeat).toBe(false);
  });

  it('the daily is never a repeat', () => {
    expect(restartSession(solve(daily()))!.repeat).toBe(false);
  });

  it('a revealed board has no retry', () => {
    expect(restartSession(revealSolution(miss(free()))!)).toBeNull();
  });
});

describe('showing a solution (§5)', () => {
  it('is offered only on a missed Free Play board', () => {
    expect(canReveal(miss(free()))).toBe(true);
    expect(canReveal(free())).toBe(false);
    expect(canReveal(solve(free()))).toBe(false);
    expect(canReveal(miss(daily()))).toBe(false);
    expect(revealSolution(miss(daily()))).toBeNull();
    expect(revealSolution(free())).toBeNull();
  });

  it('ends the board with the solution kept, which replays legally to the target', () => {
    const revealed = revealSolution(miss(free()))!;
    expect(revealed.status).toBe('revealed');
    expect(tapTile(revealed, 3)).toBe(revealed);
    const lines = solutionLines(revealed)!;
    expect(lines).toHaveLength(3);
    expect(lines.at(-1)!.result).toBe(PROBLEM.target);
    expect(
      replay(PROBLEM.numbers, revealed.problem.solution)!.slots.filter((v) => v !== null),
    ).toEqual([PROBLEM.target]);
  });
});

describe('the solution is reached only through `revealed` (§5)', () => {
  it('solutionLines is null on a board in play, missed or solved, in either mode', () => {
    for (const start of [free, daily]) {
      for (const s of [start(), taps(start(), 0, '+', 1), miss(start()), solve(start())]) {
        expect(s.status).not.toBe('revealed');
        expect(solutionLines(s)).toBeNull();
      }
    }
    expect(solutionLines(revealSolution(miss(free()))!)).not.toBeNull();
  });
});

describe('the clock is handed in (§9)', () => {
  it('takes a larger reading and ignores a smaller or broken one', () => {
    const s = withElapsed(free(), 10);
    expect(s.elapsedSeconds).toBe(10);
    expect(withElapsed(s, 9)).toBe(s);
    expect(withElapsed(s, NaN)).toBe(s);
    expect(withElapsed(s, Infinity)).toBe(s);
  });
});

describe('seeds (§8)', () => {
  it('mints a Free Play token from the time and the random source handed in', () => {
    expect(newSeedToken(1_700_000_000_000, () => 0.5)).toBe('loyw3v28-4zsov');
    expect(freeSeed('hard', 'abc')).toBe('make-the-target-hard-abc');
  });

  it('knows a Free Play seed of a difficulty', () => {
    expect(isFreeSeed('make-the-target-hard-abc', 'hard')).toBe(true);
    expect(isFreeSeed('make-the-target-hard-', 'hard')).toBe(false);
    expect(isFreeSeed('make-the-target-easy-abc', 'hard')).toBe(false);
    expect(isFreeSeed('make-the-target-daily-2026-10-21', 'medium')).toBe(false);
  });
});
