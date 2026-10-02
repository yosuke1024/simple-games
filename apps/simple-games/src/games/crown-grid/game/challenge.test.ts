/**
 * The board digest the Club House compares (docs/CROWN_GRID_RULES.md,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device played the same board, so it is pinned like the boards
 * themselves: a digest that moves is every device's daily no longer matching.
 * The daily of 2026-08-01 is the board compatibility.test.ts already pins; these
 * lines pin what it hashes to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigestOf } from './challenge';
import { createDailySession, createDifficultySession } from './session';

describe('board digest', () => {
  it('the 2026-08-01 daily and the 2026-10-02 daily hash to their pinned digests', () => {
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('cg1:21c9f9d8');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('cg1:72e438fb');
  });

  it('a difficulty-mode board hashes to its pinned digest', () => {
    expect(boardDigestOf(createDifficultySession('medium', 'crown-grid-medium-test'))).toBe(
      'cg1:2bcbd8ec',
    );
  });

  it('is the prefix and eight lowercase hex digits', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toMatch(/^cg1:[0-9a-f]{8}$/);
  });

  it('the same date gives the same digest', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
  });

  it('a different date gives a different digest', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });

  it('does not move as the board is played', () => {
    const session = createDailySession('2026-10-02');
    const played = { ...session, marks: session.marks.map((_, i) => (i === 0 ? 2 : 0)) };
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
  });
});
