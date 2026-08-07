/**
 * Golden boards. These literals pin released behaviour: a player's fastest
 * time for level 1 is a time against *this* board, and a record standing
 * against a board that no longer exists is a lie the app tells quietly.
 *
 * If this test is red, either a migration plan exists and this file changes in
 * the same commit, or the generator has drifted. Do not "fix" the expectation
 * to make it pass.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createLevelSession } from './session';

describe('generated boards never drift (docs/SCHULTE_TABLE_RULES.md §6)', () => {
  it('pins the first level of the size bands', () => {
    expect(createLevelSession(1).values).toEqual([7, 3, 6, 1, 8, 2, 9, 5, 4]);
    expect(createLevelSession(16).values).toEqual([6, 1, 4, 3, 9, 7, 5, 8, 2]);
    expect(createLevelSession(21).values).toEqual([
      3, 12, 5, 1, 2, 11, 16, 14, 6, 7, 13, 4, 15, 9, 8, 10,
    ]);
    expect(createLevelSession(56).values).toEqual([
      20, 15, 4, 8, 23, 16, 18, 2, 6, 24, 21, 3, 12, 22, 11, 10, 9, 25, 17, 5, 1, 14, 13, 19, 7,
    ]);
  });

  it('pins a daily board', () => {
    expect(createDailySession('2026-08-07').values).toEqual([
      8, 16, 1, 15, 19, 12, 7, 9, 6, 17, 4, 11, 24, 5, 14, 22, 2, 3, 25, 13, 20, 18, 23, 10, 21,
    ]);
  });

  it('pins the size and order each of those levels is played at', () => {
    // The board alone does not say how it is played: level 16 and level 1 are
    // both 3x3, and only the order tells them apart (§7).
    expect([createLevelSession(1).size, createLevelSession(1).order]).toEqual([3, 'ascending']);
    expect([createLevelSession(16).size, createLevelSession(16).order]).toEqual([3, 'descending']);
    expect([createLevelSession(91).size, createLevelSession(91).order]).toEqual([5, 'oddThenEven']);
  });
});
