// @vitest-environment node
/**
 * The board digest the Club House compares (docs/MAKE_THE_TARGET_RULES.md §16,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device dealt the same problem, so it is pinned like the problems
 * themselves: a digest that moves is every device's daily no longer matching.
 * The dailies of 2026-10-21 and 2026-12-31 and the Easy golden are the
 * problems compatibility.test.ts already pins; these lines pin what they hash
 * to. A generator change that moves a daily moves its digest here too — and
 * that is the point.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_DIGEST_PREFIX, boardDigest, boardDigestOf } from './challenge';
import { DAILY_DIFFICULTY } from './daily';
import { newDailySession, newFreeSession } from './newSession';
import { restoreSession, toRecord } from './restore';
import {
  restartSession,
  revealSolution,
  tapOperator,
  tapTile,
  undo,
  type MakeTheTargetSession,
} from './session';
import { hashSeed } from './rng';
import type { Operator, Problem } from './types';

/** Taps, in order: a number is a tile's slot, a sign an operator. */
const play = (session: MakeTheTargetSession, ...steps: (number | Operator)[]) =>
  steps.reduce<MakeTheTargetSession>(
    (s, step) => (typeof step === 'number' ? tapTile(s, step) : tapOperator(s, step)),
    session,
  );

describe('board digest', () => {
  it('pins the digests of the 2026-10-21 and 2026-12-31 dailies', () => {
    const first = newDailySession('2026-10-21').session;
    const last = newDailySession('2026-12-31').session;
    // The pairs compatibility.test.ts pins for these two dates.
    expect([first.problem.numbers, first.problem.target]).toEqual([[1, 3, 5, 10], 47]);
    expect([last.problem.numbers, last.problem.target]).toEqual([[1, 3, 8, 9], 24]);
    expect(boardDigestOf(first)).toBe('tg1:a872409f');
    expect(boardDigestOf(last)).toBe('tg1:38a88107');
  });

  it('hashes the dealt numbers and the target, written `1,3,5,10=47`', () => {
    const daily = newDailySession('2026-10-21').session;
    expect(boardDigestOf(daily)).toBe(
      BOARD_DIGEST_PREFIX + hashSeed('1,3,5,10=47').toString(16).padStart(8, '0'),
    );
    expect(boardDigestOf(daily)).toBe(boardDigest({ numbers: [1, 3, 5, 10], target: 47 }));
    // The kept solution and the difficulty are not part of it.
    const otherwise: Problem = { ...daily.problem, solution: [], difficulty: 'easy' };
    expect(boardDigestOf({ ...daily, problem: otherwise })).toBe(boardDigestOf(daily));
  });

  it('pins the digest of a Free Play problem (the Easy golden)', () => {
    const free = newFreeSession('easy', 'golden').session;
    expect([free.problem.numbers, free.problem.target]).toEqual([[1, 4, 6, 6], 16]);
    expect(boardDigestOf(free)).toBe('tg1:44dc96fd');
  });

  it('is the prefix and eight lowercase hex digits', () => {
    expect(BOARD_DIGEST_PREFIX).toBe('tg1:');
    for (const date of ['2026-10-21', '2026-11-15', '2026-12-31']) {
      expect(boardDigestOf(newDailySession(date).session)).toMatch(/^tg1:[0-9a-f]{8}$/);
    }
    expect(boardDigestOf(newFreeSession('hard', 'golden').session)).toMatch(/^tg1:[0-9a-f]{8}$/);
  });

  it('is the same for the same date and different for another date', () => {
    expect(boardDigestOf(newDailySession('2026-11-15').session)).toBe(
      boardDigestOf(newDailySession('2026-11-15').session),
    );
    expect(boardDigestOf(newDailySession('2026-11-15').session)).not.toBe(
      boardDigestOf(newDailySession('2026-11-16').session),
    );
  });

  it('does not move as the problem is played, undone, restored, solved or retried', () => {
    // The Easy golden: 1, 4, 6, 6 → 16, and the taps compatibility.test.ts solves it with.
    const dealt = newFreeSession('easy', 'golden').session;
    const digest = boardDigestOf(dealt);
    const partway = play(dealt, 2, '*', 0, 3, '+', 1);
    expect(partway.slots).toEqual([6, 10, null, null]);
    expect(boardDigestOf(partway)).toBe(digest);
    expect(boardDigestOf(undo(partway)!)).toBe(digest);
    expect(boardDigestOf(restoreSession(JSON.parse(JSON.stringify(toRecord(partway, 1))))!)).toBe(
      digest,
    );
    const solved = play(partway, 1, '+', 0);
    expect(solved.status).toBe('solved');
    expect(boardDigestOf(solved)).toBe(digest);
    expect(boardDigestOf(restartSession(solved)!)).toBe(digest);
    // A missed problem whose solution was shown is still the dealt problem.
    const missed = play(dealt, 3, '+', 2, 1, '+', 2, 2, '+', 0);
    expect(missed.status).toBe('missed');
    expect(boardDigestOf(revealSolution(missed)!)).toBe(digest);
  });

  it('every daily is Medium, the params the result card sends with it (§8)', () => {
    expect(DAILY_DIFFICULTY).toBe('medium');
    expect(newDailySession('2026-11-15').session.difficulty).toBe('medium');
  });
});
