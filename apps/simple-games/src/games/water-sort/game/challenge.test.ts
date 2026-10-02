/**
 * The board digest and ranking tier the Club House sends (docs/WATER_SORT_RULES.md
 * §14, docs/architecture/club.md §6-4). The digest is how two results are known
 * to be about the same tubes, so it is pinned like the boards themselves: a
 * digest that moves is every older result no longer matching.
 * Level 1 and the daily of 2026-08-01 are the boards compatibility.test.ts
 * already pins; these lines pin what they hash to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf, challengeTierOf } from './challenge';
import { tubesToString } from './generator';
import { levelSeed } from './levels';
import {
  createDailySession,
  createFreeSession,
  createLevelSession,
  pour,
  type WaterSession,
} from './session';

/** The first legal pour on the board, played. */
function onePour(session: WaterSession): WaterSession {
  for (let from = 0; from < session.tubes.length; from++) {
    for (let to = 0; to < session.tubes.length; to++) {
      const next = from === to ? null : pour(session, from, to);
      if (next) return next;
    }
  }
  throw new Error('no legal pour');
}

describe('board digest', () => {
  it('level 1 and the 2026-08-01 daily hash to their pinned digests', () => {
    expect(boardDigestOf(createLevelSession(1))).toBe('ws1:b77325da');
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('ws1:ebdce163');
  });

  it('is the prefix and eight lowercase hex digits of the starting tubes', () => {
    const session = createLevelSession(1);
    expect(boardDigestOf(session)).toMatch(/^ws1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.tubes));
  });

  it('is the starting deal’s, however far the board has been played', () => {
    const session = createDailySession('2026-08-01');
    const played = onePour(session);
    expect(tubesToString(played.tubes)).not.toBe(tubesToString(session.tubes));
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
  });
});

describe('the ranking tier of a board', () => {
  it('is a free board’s own tier', () => {
    expect(challengeTierOf(createFreeSession('medium', 'water-free-x'))).toBe('medium');
  });

  it('exists for a level only when a tier deals exactly that board', () => {
    // A tier is one level's colours and mix (levels.ts FREE_TIER_LEVEL): that
    // level, and no other, is dealt exactly by its tier under its own seed.
    expect(challengeTierOf(createLevelSession(10))).toBe('easy');
    expect(challengeTierOf(createLevelSession(50))).toBe('medium');
    expect(challengeTierOf(createLevelSession(95))).toBe('hard');
    expect(challengeTierOf(createLevelSession(1))).toBeNull();
    expect(challengeTierOf(createLevelSession(51))).toBeNull();
    for (const level of [10, 50, 95]) {
      const board = createLevelSession(level);
      const tier = challengeTierOf(board)!;
      const replay = createFreeSession(tier, levelSeed(level));
      expect(boardDigestOf(replay)).toBe(boardDigestOf(board));
    }
  });

  it('does not exist for the daily, whose even mix no tier deals', () => {
    expect(challengeTierOf(createDailySession('2026-08-01'))).toBeNull();
  });
});
