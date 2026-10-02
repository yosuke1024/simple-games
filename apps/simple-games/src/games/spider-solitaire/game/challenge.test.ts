/**
 * The board digest the Club House compares (docs/SPIDER_SOLITAIRE_RULES.md
 * §14, docs/architecture/club.md §6-4). It tells Today's daily challenge that
 * two devices dealt the same game, so it is pinned like the deals themselves:
 * a digest that moves is every device's daily no longer matching. The daily of
 * 2026-08-07 (four suits) is the deal compatibility.test.ts already pins;
 * these lines pin what it hashes to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, restartSession } from './session';

describe('board digest', () => {
  it('the 2026-10-02 and 2026-08-07 dailies hash to their pinned digests', () => {
    expect(boardDigestOf(createDailySession('2026-10-02', 4))).toBe('ss1:74f86bbf');
    expect(boardDigestOf(createDailySession('2026-08-07', 4))).toBe('ss1:89a9ccfa');
    expect(boardDigestOf(createDailySession('2026-10-02', 1))).toBe('ss1:fd510c99');
  });

  it('is the prefix and eight lowercase hex digits', () => {
    expect(boardDigestOf(createDailySession('2026-10-02', 2))).toMatch(/^ss1:[0-9a-f]{8}$/);
  });

  it('the same date gives the same digest, on a retry too', () => {
    const session = createDailySession('2026-10-02', 4);
    expect(boardDigestOf(createDailySession('2026-10-02', 4))).toBe(boardDigestOf(session));
    expect(boardDigestOf(restartSession(session))).toBe(boardDigestOf(session));
    expect(boardDigestOf(session)).toBe(boardDigest(session.seed, 4));
  });

  it('a different date gives a different digest', () => {
    expect(boardDigestOf(createDailySession('2026-10-03', 4))).not.toBe(
      boardDigestOf(createDailySession('2026-10-02', 4)),
    );
  });

  it('one, two and four suits are three different challenges on the same cards', () => {
    const digests = ([1, 2, 4] as const).map((suits) =>
      boardDigestOf(createDailySession('2026-10-02', suits)),
    );
    expect(new Set(digests).size).toBe(3);
  });

  it('does not move as the game is played', () => {
    const session = createDailySession('2026-10-02', 4);
    const played = { ...session, board: { ...session.board, stock: [] } };
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
  });
});
