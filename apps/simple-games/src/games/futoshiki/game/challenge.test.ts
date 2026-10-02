/**
 * The board digest the Club House compares (docs/FUTOSHIKI_RULES.md §15,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device played the same grid and signs, so it is pinned like the
 * boards themselves: a digest that moves is every device's daily no longer
 * matching. Level 1 and the daily of 2026-08-01 are boards
 * compatibility.test.ts already pins; the 2026-10-02 daily is the first Today
 * this digest ever names.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createLevelSession, doPlace } from './session';
import { EMPTY, type Digit } from './types';

describe('board digest', () => {
  it('level 1 and the 2026 dailies hash to their pinned digests', () => {
    expect(boardDigestOf(createLevelSession(1))).toBe('fs1:577ccb1a');
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('fs1:b5090037');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('fs1:f5af6625');
  });

  it('is the prefix and eight lowercase hex digits of the givens and signs', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^fs1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(
      boardDigest(session.board.givens, session.constraints, session.size),
    );
  });

  it('is the same for the same date and different for another date', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });

  it('hashes the signs as well as the givens', () => {
    const session = createDailySession('2026-10-02');
    const [first, ...rest] = session.constraints;
    expect(first).toBeDefined();
    expect(boardDigest(session.board.givens, rest, session.size)).not.toBe(boardDigestOf(session));
  });

  it('does not move as the board is played', () => {
    const session = createDailySession('2026-10-02');
    const open = session.board.givens.findIndex((cell) => cell === EMPTY);
    const played = doPlace(session, open, session.solution[open]! as Digit);
    expect(played).not.toBeNull();
    expect(boardDigestOf(played!)).toBe(boardDigestOf(session));
  });
});
