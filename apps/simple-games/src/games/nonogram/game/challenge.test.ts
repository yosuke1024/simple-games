/**
 * The board digest the Club House compares (docs/NONOGRAM_RULES.md §14,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device played the same puzzle, so it is pinned like the boards
 * themselves: a digest that moves is every device's daily no longer matching.
 * Level 1 and the daily of 2026-08-01 are boards compatibility.test.ts already
 * pins; the 2026-10-02 daily is the first Today this digest ever names.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createLevelSession, paintCell } from './session';

describe('board digest', () => {
  it('level 1 and the 2026 dailies hash to their pinned digests', () => {
    expect(boardDigestOf(createLevelSession(1))).toBe('ng1:fbc97da3');
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('ng1:3c719a3a');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('ng1:05327017');
  });

  it('is the prefix and eight lowercase hex digits of the solution', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^ng1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.solution));
  });

  it('is the same for the same date and different for another date', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });

  it('does not move as the board is played', () => {
    const session = createDailySession('2026-10-02');
    const played = paintCell(session, 0);
    expect(played).not.toBeNull();
    expect(boardDigestOf(played!)).toBe(boardDigestOf(session));
  });
});
