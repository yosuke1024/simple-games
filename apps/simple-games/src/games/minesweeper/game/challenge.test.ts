/**
 * A Club House challenge's board (docs/MINESWEEPER_RULES.md §14,
 * docs/architecture/club.md §6-4). The digest is what two devices compare to
 * know they are about to play the same minefield, so it is pinned like the
 * boards themselves: a digest that moves is every open challenge refusing to
 * play. The two (seed, first tap) pairs are the ones compatibility.test.ts
 * already pins; these lines pin what their mines hash to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { encodeBoard } from './serialize';
import {
  createClubSession,
  createDailySession,
  createDifficultySession,
  flagCell,
  restartSession,
  tapCell,
} from './session';

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

describe('a club session', () => {
  it('opens on the challenge’s first cell, with the clock at zero', () => {
    const club = createClubSession({ difficulty: 'easy', firstIndex: 40 }, 'mines-easy-golden');
    const reference = tapCell(createDifficultySession('easy', 'mines-easy-golden'), 40)!;
    expect(club.mode).toBe('club');
    expect(club.seed).toBe('mines-easy-golden');
    expect(club.difficulty).toBe('easy');
    expect(club.dailyDate).toBeNull();
    expect(club.firstIndex).toBe(40);
    expect(club.elapsedSeconds).toBe(0);
    expect(club.status).toBe('playing');
    expect(club.board.opened[40]).toBe(true);
    expect(encodeBoard(club.board)).toEqual(encodeBoard(reference.board));
    expect(boardDigestOf(club)).toBe('ms1:a5bd5e78');
  });

  it('refuses a first cell outside the board', () => {
    expect(() =>
      createClubSession({ difficulty: 'easy', firstIndex: 81 }, 'mines-club-x'),
    ).toThrow();
  });

  it('restarts onto the same challenge, still a club game', () => {
    const club = createClubSession({ difficulty: 'medium', firstIndex: 7 }, 'mines-club-restart');
    const again = restartSession(club);
    expect(again.mode).toBe('club');
    expect(again.firstIndex).toBe(7);
    expect(boardDigestOf(again)).toBe(boardDigestOf(club));
  });
});
