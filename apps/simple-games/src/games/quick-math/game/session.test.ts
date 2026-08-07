import { describe, expect, it } from 'vitest';
import {
  answerDigits,
  answerQuestion,
  createDailySession,
  createLevelSession,
  currentQuestion,
  restartSession,
  restoreSession,
  type QuickMathSession,
} from './session';

/** Answers the question on screen correctly. */
function solve(session: QuickMathSession): QuickMathSession {
  const question = currentQuestion(session);
  expect(question).not.toBeNull();
  const outcome = answerQuestion(session, question!.answer);
  expect(outcome?.correct).toBe(true);
  return outcome!.session;
}

/** Answers every question in the set correctly. */
function playThrough(start: QuickMathSession): QuickMathSession {
  let session = start;
  while (session.status === 'playing') session = solve(session);
  return session;
}

describe('a set (docs/QUICK_MATH_RULES.md §2, §3)', () => {
  it('asks ten questions at a level and twenty on a daily', () => {
    expect(createLevelSession(1).questions).toHaveLength(10);
    expect(createDailySession('2026-08-07').questions).toHaveLength(20);
  });

  it('clears once every question is answered', () => {
    for (const level of [1, 25, 45, 65, 95]) {
      const done = playThrough(createLevelSession(level));
      expect(done.status).toBe('cleared');
      expect(done.solvedCount).toBe(10);
      expect(done.missCount).toBe(0);
      expect(currentQuestion(done)).toBeNull();
    }
  });

  it('keeps the same question after a wrong answer, and takes nothing away', () => {
    // §3: no penalty of any kind — the tally moves and nothing else does.
    const session = createLevelSession(1);
    const question = currentQuestion(session)!;
    const outcome = answerQuestion(session, question.answer + 1);

    expect(outcome?.correct).toBe(false);
    expect(outcome?.session.missCount).toBe(1);
    expect(outcome?.session.solvedCount).toBe(0);
    expect(currentQuestion(outcome!.session)).toEqual(question);
    expect(outcome?.session.status).toBe('playing');
  });

  it('lets a set be finished however many wrong answers it took', () => {
    let session = createLevelSession(1);
    for (let i = 0; i < 5; i++) {
      session = answerQuestion(session, currentQuestion(session)!.answer + 7)!.session;
    }
    expect(session.missCount).toBe(5);
    const done = playThrough(session);
    expect(done.status).toBe('cleared');
    expect(done.missCount).toBe(5);
  });

  it('ignores an answer once the set is finished', () => {
    const done = playThrough(createLevelSession(1));
    expect(answerQuestion(done, 1)).toBeNull();
  });

  it('reports how many digits the keypad is waiting for (§3)', () => {
    const session = createLevelSession(1);
    const question = currentQuestion(session)!;
    expect(answerDigits(question)).toBe(String(question.answer).length);
  });
});

describe('starting and restarting', () => {
  it('rebuilds the identical set on retry', () => {
    const first = createLevelSession(42);
    const again = restartSession(solve(first));
    expect(again.questions).toEqual(first.questions);
    expect(again.solvedCount).toBe(0);
    expect(again.missCount).toBe(0);
    expect(again.elapsedSeconds).toBe(0);
  });

  it('keeps a daily on its own date when retried', () => {
    const daily = createDailySession('2026-08-07');
    const again = restartSession(daily);
    expect(again.mode).toBe('daily');
    expect(again.dailyDate).toBe('2026-08-07');
    expect(again.questions).toEqual(daily.questions);
  });

  it('clamps a level outside the ladder instead of throwing', () => {
    expect(createLevelSession(0).level).toBe(1);
    expect(createLevelSession(9999).level).toBe(100);
  });
});

describe('resuming (docs/QUICK_MATH_RULES.md §9)', () => {
  it('comes back to the same question, from the seed alone', () => {
    // The questions are not saved — only which one you were on.
    const original = solve(solve(createLevelSession(37)));
    const restored = restoreSession({
      mode: 'level',
      dailyDate: null,
      level: 37,
      solvedCount: original.solvedCount,
      missCount: 4,
      elapsedSeconds: 91,
    });

    expect(restored?.questions).toEqual(original.questions);
    expect(currentQuestion(restored!)).toEqual(currentQuestion(original));
    expect(restored?.missCount).toBe(4);
    expect(restored?.elapsedSeconds).toBe(91);
  });

  it('resumes a daily on its own date', () => {
    const restored = restoreSession({
      mode: 'daily',
      dailyDate: '2026-08-07',
      level: null,
      solvedCount: 12,
      missCount: 0,
      elapsedSeconds: 60,
    });
    expect(restored?.mode).toBe('daily');
    expect(restored?.questions).toEqual(createDailySession('2026-08-07').questions);
    expect(restored?.solvedCount).toBe(12);
  });

  it('refuses a record pointing past the end of its set', () => {
    // A save from a build whose ladder asked a different number of questions.
    // One lost set beats putting the game on a question that does not exist.
    expect(
      restoreSession({
        mode: 'level',
        dailyDate: null,
        level: 1,
        solvedCount: 10,
        missCount: 0,
        elapsedSeconds: 5,
      }),
    ).toBeNull();
    expect(
      restoreSession({
        mode: 'level',
        dailyDate: null,
        level: 1,
        solvedCount: -1,
        missCount: 0,
        elapsedSeconds: 5,
      }),
    ).toBeNull();
  });

  it('refuses a record that names neither a level nor a date', () => {
    expect(
      restoreSession({
        mode: 'level',
        dailyDate: null,
        level: null,
        solvedCount: 0,
        missCount: 0,
        elapsedSeconds: 0,
      }),
    ).toBeNull();
  });
});
