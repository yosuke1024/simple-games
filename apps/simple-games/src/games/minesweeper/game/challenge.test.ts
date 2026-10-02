/**
 * The board digest the Club House ranking carries (docs/MINESWEEPER_RULES.md
 * §14, docs/architecture/club.md §6-4). It is how two results are known to be
 * about the same minefield, so it is pinned like the boards themselves: a
 * digest that moves is every older result no longer matching. The two (seed,
 * first tap) pairs are the ones compatibility.test.ts
 * already pins; these lines pin what their mines hash to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { encodeBoard } from './serialize';
import { createDailySession, createDifficultySession, flagCell, tapCell } from './session';

describe('board digest', () => {
  it('the golden boards hash to their pinned digests', () => {
    const easy = tapCell(createDifficultySession('easy', 'mines-easy-golden'), 40)!;
    const daily = tapCell(createDailySession('2026-08-01'), 40)!;
    expect(boardDigestOf(easy)).toBe('ms1:a5bd5e78');
    expect(boardDigestOf(daily)).toBe('ms1:c74970ac');
  });

  it('is the prefix and eight lowercase hex digits of the mine bits', () => {
    const session = tapCell(createDifficultySession('easy', 'mines-easy-golden'), 40)!;
    expect(boardDigestOf(session)).toMatch(/^ms1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.board));
  });

  it('does not move as the board is played', () => {
    const session = tapCell(createDifficultySession('easy', 'mines-easy-golden'), 40)!;
    const mine = encodeBoard(session.board).mines.indexOf('1');
    const flagged = flagCell(session, mine)!;
    expect(boardDigestOf(flagged)).toBe(boardDigestOf(session));
  });
});
