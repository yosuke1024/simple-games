/**
 * The board digest the Club House compares (docs/SOLITAIRE_RULES.md §14,
 * docs/architecture/club.md §6-4). It tells Today's daily challenge that two
 * devices dealt the same game, so it is pinned like the deals themselves: a
 * digest that moves is every device's daily no longer matching. The daily of
 * 2026-08-01 and the free seed are the deals compatibility.test.ts already
 * pins; these lines pin what they hash to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createFreeSession, freeSeed, restartSession } from './session';

describe('board digest', () => {
  it('the 2026-10-02 and 2026-08-01 dailies hash to their pinned digests', () => {
    expect(boardDigestOf(createDailySession('2026-10-02', false))).toBe('sl1:bf43a85b');
    expect(boardDigestOf(createDailySession('2026-08-01', false))).toBe('sl1:e3f5f48a');
    expect(boardDigestOf(createFreeSession(false, 'sol-free-golden'))).toBe('sl1:0b87ccc5');
  });

  it('is the prefix and eight lowercase hex digits', () => {
    expect(boardDigestOf(createDailySession('2026-10-02', true))).toMatch(/^sl1:[0-9a-f]{8}$/);
  });

  it('the same date gives the same digest, on a retry too', () => {
    const session = createDailySession('2026-10-02', false);
    expect(boardDigestOf(createDailySession('2026-10-02', false))).toBe(boardDigestOf(session));
    expect(boardDigestOf(restartSession(session))).toBe(boardDigestOf(session));
    expect(boardDigestOf(session)).toBe(boardDigest(session.seed, false));
  });

  it('a different date gives a different digest', () => {
    expect(boardDigestOf(createDailySession('2026-10-03', false))).not.toBe(
      boardDigestOf(createDailySession('2026-10-02', false)),
    );
  });

  it('draw 1 and draw 3 are different challenges on the same deal', () => {
    expect(boardDigestOf(createDailySession('2026-10-02', true))).not.toBe(
      boardDigestOf(createDailySession('2026-10-02', false)),
    );
  });

  it('does not move as the game is played', () => {
    const session = createDailySession('2026-10-02', false);
    const played = { ...session, board: { ...session.board, stock: [], waste: [] } };
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
    expect(freeSeed('x')).toBe('sol-free-x');
  });
});
