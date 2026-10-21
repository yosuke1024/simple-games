// @vitest-environment node
/**
 * Goldens, v1: fixed seeds → exact problems, a fixed sequence of taps →
 * exact boards, and the exact record a save writes.
 *
 * A seed is a promise. The daily is the same problem for everyone who opens
 * it, and the same Free Play seed is the same problem — so any change to the
 * rng, to the draws, to the order the build consumes them, to the operators'
 * odds, to the tiers or to the count that moves a problem fails here. That is
 * the point: changing these values is a decision, not a side effect
 * (docs/MAKE_THE_TARGET_RULES.md §6「乱数の消費の順番」).
 *
 * Make the Target is a Web-beta title (docs/WEB_VERSION.md「先行公開」), for
 * now `in-development` in the registry: its save schema is not frozen, and a saved game carries its own numbers,
 * target and solution (§10), so a generator change does not strand a game in
 * progress — but it retires every daily already played and the bundled table
 * (bundled.test.ts fails with this one). If a change here is intended,
 * rewrite these values and the bundled table, and say so in the commit.
 */
import { describe, expect, it } from 'vitest';
import { dailyProblem, generateProblem } from './generator';
import { newDailySession, newFreeSession } from './newSession';
import { restoreSession, toRecord } from './restore';
import { encodeMoves } from './serialize';
import {
  expressionLines,
  tapOperator,
  tapTile,
  undo,
  withElapsed,
  type MakeTheTargetSession,
} from './session';

const pin = (seed: string, difficulty: 'easy' | 'medium' | 'hard') => {
  const g = generateProblem(seed, difficulty);
  return {
    numbers: g.problem.numbers,
    target: g.problem.target,
    solution: encodeMoves(g.problem.solution),
    ways: g.ways,
    waysWithoutDivision: g.waysWithoutDivision,
    attempts: g.attempts,
    work: g.work,
    divisionRound: g.divisionRound,
    fallback: g.fallback,
  };
};

describe('golden problems (v1)', () => {
  it('easy, seed make-the-target-easy-golden', () => {
    expect(pin('make-the-target-easy-golden', 'easy')).toEqual({
      numbers: [1, 4, 6, 6],
      target: 16,
      solution: '2*00+33+1',
      ways: 20,
      waysWithoutDivision: 10,
      attempts: 2,
      work: 60,
      divisionRound: false,
      fallback: false,
    });
  });

  it('medium, seed make-the-target-medium-golden', () => {
    expect(pin('make-the-target-medium-golden', 'medium')).toEqual({
      numbers: [1, 3, 4, 7, 7],
      target: 11,
      solution: '4*13+00*22-1',
      ways: 117,
      waysWithoutDivision: 67,
      attempts: 7,
      work: 1012,
      divisionRound: false,
      fallback: false,
    });
  });

  it('hard, seed make-the-target-hard-golden', () => {
    expect(pin('make-the-target-hard-golden', 'hard')).toEqual({
      numbers: [1, 4, 5, 9, 15],
      target: 119,
      solution: '4*32-00*13-1',
      ways: 18,
      waysWithoutDivision: 18,
      attempts: 1,
      work: 937,
      divisionRound: false,
      fallback: false,
    });
  });

  it('the dailies for 2026-10-21 and 2026-12-31 (a ÷ round)', () => {
    const first = dailyProblem('2026-10-21');
    expect([
      first.problem.numbers,
      first.problem.target,
      encodeMoves(first.problem.solution),
    ]).toEqual([[1, 3, 5, 10], 47, '3*22*00-1']);
    expect([first.ways, first.waysWithoutDivision, first.attempts, first.work]).toEqual([
      12, 6, 1, 99,
    ]);
    const last = dailyProblem('2026-12-31');
    expect([last.problem.numbers, last.problem.target, encodeMoves(last.problem.solution)]).toEqual(
      [[1, 3, 8, 9], 24, '3*22/00/1'],
    );
    expect([
      last.ways,
      last.waysWithoutDivision,
      last.attempts,
      last.work,
      last.divisionRound,
    ]).toEqual([24, 0, 36, 3574, true]);
  });

  it('newSession deals the same problems', () => {
    const free = newFreeSession('easy', 'golden').session;
    expect(free.seed).toBe('make-the-target-easy-golden');
    expect([free.problem.numbers, free.problem.target]).toEqual([[1, 4, 6, 6], 16]);
    const daily = newDailySession('2026-10-21').session;
    expect(daily).toMatchObject({ mode: 'daily', difficulty: 'medium', dailyDate: '2026-10-21' });
    expect(daily.seed).toBe('make-the-target-daily-2026-10-21');
    expect([daily.problem.numbers, daily.problem.target]).toEqual([[1, 3, 5, 10], 47]);
  });
});

/** Taps: a number is a slot, a string an operator, 'undo' is Undo. */
function play(session: MakeTheTargetSession, steps: (number | '+' | '-' | '*' | '/' | 'undo')[]) {
  return steps.reduce<MakeTheTargetSession>((s, step) => {
    if (step === 'undo') return undo(s) ?? s;
    return typeof step === 'number' ? tapTile(s, step) : tapOperator(s, step);
  }, session);
}

describe('golden play (v1)', () => {
  const start = () => newFreeSession('easy', 'golden').session; // 1, 4, 6, 6 → 16

  it('a fixed sequence of taps gives a fixed board', () => {
    // prettier-ignore
    const steps = [
      2, '*', 0, // 6 × 1 = 6 in slot 0
      3, '-', 0, // 6 − 6 is 0: refused, slot 3 and − stay chosen
      3, // the chosen tile again: everything cleared
      3, '+', 1, // 6 + 4 = 10 in slot 1
      'undo', // back to 6, 4, _, 6
      1, '-', 3, // 4 − 6 is negative: refused
      '-', // the operator again: only the operator cleared
      3, // the choice moves to slot 3
      '+', 1, // 6 + 4 = 10 in slot 1
      1, '+', 0, // 10 + 6 = 16 in slot 0
    ] as const;
    const end = play(start(), [...steps]);
    expect(end.status).toBe('solved');
    expect(end.slots).toEqual([16, null, null, null]);
    expect(encodeMoves(end.moves)).toBe('2*03+11+0');
    expect(expressionLines(end)).toEqual([
      { left: 6, op: '*', right: 1, result: 6 },
      { left: 6, op: '+', right: 4, result: 10 },
      { left: 10, op: '+', right: 6, result: 16 },
    ]);
  });

  it('a sequence that misses ends at 17, not 16', () => {
    const end = play(start(), [3, '+', 2, 1, '+', 2, 2, '+', 0]);
    expect(end.status).toBe('missed');
    expect(end.slots).toEqual([17, null, null, null]);
  });
});

describe('the saved record (v1)', () => {
  const played = () =>
    withElapsed(play(newFreeSession('easy', 'golden').session, [2, '*', 0, 3, '+', 1]), 95);

  it('writes exactly this', () => {
    expect(JSON.stringify(toRecord(played(), 1_790_000_000_123))).toBe(
      '{"schemaVersion":1,"mode":"free","seed":"make-the-target-easy-golden","difficulty":"easy",' +
        '"dailyDate":null,"numbers":[1,4,6,6],"target":16,"solution":"2*00+33+1","moves":"2*03+1",' +
        '"repeat":false,"elapsedSeconds":95,"savedAt":1790000000123}',
    );
  });

  it('reads it back to the same board', () => {
    const back = restoreSession(JSON.parse(JSON.stringify(toRecord(played(), 1))))!;
    expect(back.slots).toEqual(played().slots);
    expect(back.slots).toEqual([6, 10, null, null]);
    expect(back.elapsedSeconds).toBe(95);
  });
});
