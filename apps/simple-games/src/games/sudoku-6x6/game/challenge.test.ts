/**
 * The board digest the Club House compares (docs/SUDOKU_6X6_RULES.md Club
 * section, docs/architecture/club.md §6-4). It is what tells Today's daily
 * challenge that a device played the same grid, so it is pinned like the
 * boards themselves: a digest that moves is every device's daily no longer
 * matching. The 2026-08-01 daily is the board compatibility.test.ts already
 * pins; these lines pin what it hashes to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { gridToString } from './generator';
import { createDailySession, createDifficultySession } from './session';

describe('board digest', () => {
  it('pins the digests of three daily boards', () => {
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('s61:358db6a1');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('s61:4d938b6b');
    expect(boardDigestOf(createDailySession('2026-10-03'))).toBe('s61:b55c4795');
  });

  it('is the same digest for the same date and a different one for another date', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });

  it('is the prefix and eight lowercase hex digits of the givens', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^s61:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.board.givens));
    expect(gridToString(session.board.givens)).toHaveLength(36);
  });

  it('does not move as the board is played', () => {
    const session = createDifficultySession('medium', 'sudoku-6x6-medium-golden');
    const empty = session.board.givens.findIndex((value) => value === 0);
    const played = {
      ...session,
      board: {
        ...session.board,
        entries: session.board.entries.map((v, i) => (i === empty ? 5 : v)),
      },
    };
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
    expect(boardDigestOf(session)).toBe('s61:eb3ab221');
  });
});
