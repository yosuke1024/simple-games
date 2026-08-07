/**
 * Golden layouts. These literals pin released behaviour: a player's fastest
 * time for a level is a time against layouts this generator produces, and a
 * record standing against boards that no longer exist is a lie the app tells
 * quietly.
 *
 * If this test is red, either a migration plan exists and this file changes in
 * the same commit, or the generator has drifted. Do not "fix" the expectation
 * to make it pass.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createLevelSession } from './session';

describe('generated layouts never drift (docs/NUMBER_RECALL_RULES.md §6)', () => {
  it('pins the first level of each size band', () => {
    expect(createLevelSession(1).layout).toEqual([0, 0, 0, 0, 0, 2, 1, 0, 3]);
    expect(createLevelSession(16).layout).toEqual([4, 0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0]);
    expect(createLevelSession(56).layout).toEqual([
      5, 0, 0, 0, 0, 0, 6, 8, 4, 0, 0, 0, 0, 0, 9, 0, 1, 7, 0, 0, 2, 3, 0, 0, 0,
    ]);
    expect(createLevelSession(100).layout).toEqual([
      0, 0, 0, 0, 5, 1, 0, 0, 12, 0, 0, 7, 3, 4, 0, 0, 8, 9, 0, 0, 10, 0, 6, 2, 11,
    ]);
  });

  it('pins the second attempt at a level, which is a different board (§8)', () => {
    // Attempts are part of the seed, so "retry" is reproducible too — and it
    // has to differ from attempt 0, or the retry would be a re-read.
    expect(createLevelSession(1, 1).layout).toEqual([0, 2, 3, 0, 0, 0, 0, 1, 0]);
    expect(createLevelSession(1, 1).layout).not.toEqual(createLevelSession(1, 0).layout);
  });

  it('pins a daily board', () => {
    expect(createDailySession('2026-08-07').layout).toEqual([
      0, 0, 0, 5, 0, 2, 3, 0, 0, 9, 0, 4, 0, 0, 0, 0, 7, 6, 0, 0, 0, 1, 8, 0, 0,
    ]);
  });
});
