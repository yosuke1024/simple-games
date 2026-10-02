/**
 * The board digest the Club House compares (docs/KAKURO_RULES.md §15,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device played the same layout and sums, so it is pinned like the
 * boards themselves: a digest that moves is every device's daily no longer
 * matching. Level 1 and the daily of 2026-08-01 are boards
 * compatibility.test.ts already pins; the 2026-10-02 daily is the first Today
 * this digest ever names.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createLevelSession, doPlace } from './session';
import { isWhite, type Digit } from './types';

describe('board digest', () => {
  it('level 1 and the 2026 dailies hash to their pinned digests', () => {
    expect(boardDigestOf(createLevelSession(1))).toBe('kk1:699181ce');
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('kk1:01f32830');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('kk1:5100ad89');
  });

  it('is the prefix and eight lowercase hex digits of the layout and answer', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^kk1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.layout, session.solution));
  });

  it('is the same for the same date and different for another date', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });

  it('hashes the answer as well as the layout', () => {
    const session = createDailySession('2026-10-02');
    const first = session.layout.cells.findIndex((_, index) => isWhite(session.layout, index));
    const other = session.solution.map((digit, index) =>
      index === first ? (digit === 9 ? 1 : digit + 1) : digit,
    );
    expect(boardDigest(session.layout, other)).not.toBe(boardDigestOf(session));
  });

  it('does not move as the board is played', () => {
    const session = createDailySession('2026-10-02');
    const open = session.layout.cells.findIndex((_, index) => isWhite(session.layout, index));
    const played = doPlace(session, open, session.solution[open]! as Digit);
    expect(played).not.toBeNull();
    expect(boardDigestOf(played!)).toBe(boardDigestOf(session));
  });
});
