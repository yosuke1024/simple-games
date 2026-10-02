/**
 * The board digest the Club House sends for a daily (docs/NUMBER_MATCH_RULES.md
 * §17, docs/architecture/club.md §6-4). The digest is how two results are
 * known to be about the same board, so it is pinned like the boards
 * themselves: a digest that moves is every older result no longer matching.
 * The 2026-07-31 daily is a board compatibility.test.ts already pins; the
 * 2026-10-02 daily is past the decoration cutoff and carries two wilds (no
 * stones that day), which no other golden freezes — its board string is
 * pinned here as well.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { encodeBoard } from './serialize';
import { createDailySession, createLevelSession } from './session';

describe('board digest', () => {
  it('pins the dailies and a level it was introduced with', () => {
    expect(boardDigestOf(createDailySession('2026-07-31'))).toBe('nm1:1649ce1d');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('nm1:f0cd7c69');
    expect(boardDigestOf(createLevelSession(1))).toBe('nm1:a5b6cf12');
  });

  it('pins the decorated board of 2026-10-02 the digest is taken from', () => {
    expect(encodeBoard(createDailySession('2026-10-02').board).values).toBe(
      '00062w00000666490058215556400111160000099w000',
    );
  });

  it('is the prefix and eight lowercase hex digits of the starting board', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^nm1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.board));
  });

  it('is the same for the same date, and the starting deal’s after play', () => {
    const first = createDailySession('2026-10-02');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(boardDigestOf(first));
    // A board with every live cell cleared is as far from the start as it gets.
    const played = {
      ...first,
      board: first.board.map((cell) =>
        cell === null || cell.kind === 'stone' ? cell : { ...cell, cleared: true },
      ),
      moveCount: 12,
    };
    expect(boardDigestOf(played)).toBe(boardDigestOf(first));
  });

  it('differs between dates', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });
});
