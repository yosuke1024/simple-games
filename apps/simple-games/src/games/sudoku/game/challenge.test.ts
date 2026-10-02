/**
 * The board digest the Club House compares (docs/SUDOKU_RULES.md §15,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device played the same grid, so it is pinned like the boards
 * themselves: a digest that moves is every device's daily no longer matching.
 * Level 1 and the daily of 2026-08-01 are the boards compatibility.test.ts
 * already pins; these lines pin what they hash to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createLevelSession } from './session';

describe('board digest', () => {
  it('level 1 and the 2026-08-01 daily hash to their pinned digests', () => {
    expect(boardDigestOf(createLevelSession(1))).toBe('sd1:79e7781c');
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('sd1:a72147cb');
  });

  it('is the prefix and eight lowercase hex digits of the givens', () => {
    const session = createLevelSession(1);
    expect(boardDigestOf(session)).toMatch(/^sd1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.board.givens));
  });

  it('does not move as the board is played', () => {
    const session = createLevelSession(1);
    const empty = session.board.givens.findIndex((value) => value === 0);
    const played = {
      ...session,
      board: {
        ...session.board,
        entries: session.board.entries.map((v, i) => (i === empty ? 5 : v)),
      },
    };
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
  });
});
