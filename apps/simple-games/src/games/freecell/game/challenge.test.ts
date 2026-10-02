/**
 * The board digest the Club House compares (docs/FREECELL_RULES.md §14,
 * docs/architecture/club.md §6-4). It tells Today's daily challenge that two
 * devices dealt the same game, so it is pinned like the deals themselves: a
 * digest that moves is every device's daily no longer matching. The daily of
 * 2026-08-07 and the free seed are the deals compatibility.test.ts already
 * pins; these lines pin what they hash to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createFreeSession, restartSession } from './session';

describe('board digest', () => {
  it('the 2026-10-02 and 2026-08-07 dailies hash to their pinned digests', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('fc1:5099efb0');
    expect(boardDigestOf(createDailySession('2026-08-07'))).toBe('fc1:c810703e');
    expect(boardDigestOf(createFreeSession('fc-free-golden'))).toBe('fc1:7b2c7acd');
  });

  it('is the prefix and eight lowercase hex digits', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toMatch(/^fc1:[0-9a-f]{8}$/);
  });

  it('the same date gives the same digest, on a retry too', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(boardDigestOf(session));
    expect(boardDigestOf(restartSession(session))).toBe(boardDigestOf(session));
    expect(boardDigestOf(session)).toBe(boardDigest(session.seed));
  });

  it('a different date gives a different digest', () => {
    expect(boardDigestOf(createDailySession('2026-10-03'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
  });

  it('does not move as the game is played', () => {
    const session = createDailySession('2026-10-02');
    const played = { ...session, board: { ...session.board, cells: [1, null, null, null] } };
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
  });
});
