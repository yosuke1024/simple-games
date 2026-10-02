/**
 * The board digest the Club House sends for a daily (docs/SLIDING_PUZZLE_RULES.md
 * §14, docs/architecture/club.md §6-4). The digest is how two results are
 * known to be about the same puzzle, so it is pinned like the boards
 * themselves: a digest that moves is every older result no longer matching.
 * The 2026-08-01 daily and level 1 are boards compatibility.test.ts already
 * pins; these lines pin what they hash to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { neighborsOfBlank } from './engine';
import { createDailySession, createLevelSession, moveTile } from './session';

describe('board digest', () => {
  it('pins the dailies and a level it was introduced with', () => {
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('sg1:376de20f');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('sg1:627f946c');
    expect(boardDigestOf(createLevelSession(1))).toBe('sg1:7384bb55');
  });

  it('is the prefix and eight lowercase hex digits of the starting puzzle', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^sg1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.size, session.tiles));
  });

  it('is the same for the same date, and the starting deal’s after play', () => {
    const first = createDailySession('2026-10-02');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(boardDigestOf(first));
    const slide = neighborsOfBlank(first.tiles, first.size)[0]!;
    const played = moveTile(first, slide);
    expect(played).not.toBeNull();
    expect(played!.tiles).not.toEqual(first.tiles);
    expect(boardDigestOf(played!)).toBe(boardDigestOf(first));
  });

  it('differs between dates', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });
});
