/**
 * A Club House challenge's board (docs/WATER_SORT_RULES.md §14,
 * docs/architecture/club.md §6-4). The digest is what two devices compare to
 * know they are about to pour the same tubes, so it is pinned like the boards
 * themselves: a digest that moves is every open challenge refusing to play.
 * Level 1 and the daily of 2026-08-01 are the boards compatibility.test.ts
 * already pins; these lines pin what they hash to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf, challengeTierOf } from './challenge';
import { tubesToString } from './generator';
import { levelSeed } from './levels';
import {
  createClubSession,
  createDailySession,
  createFreeSession,
  createLevelSession,
  pour,
  restartSession,
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

describe('a club session', () => {
  it('is the free deal on the challenge’s seed and tier, in its own mode', () => {
    const seed = 'water-club-golden';
    const club = createClubSession({ tier: 'hard' }, seed);
    const free = createFreeSession('hard', seed);
    expect(club.mode).toBe('club');
    expect(club.seed).toBe(seed);
    expect(club.freeTier).toBe('hard');
    expect(club.level).toBeNull();
    expect(club.dailyDate).toBeNull();
    expect(club.elapsedSeconds).toBe(0);
    expect(tubesToString(club.tubes)).toBe(tubesToString(free.tubes));
    expect(boardDigestOf(club)).toBe(boardDigestOf(free));
  });

  it('restarts onto the same challenge, still a club game', () => {
    const club = createClubSession({ tier: 'easy' }, 'water-club-restart');
    const again = restartSession(onePour(club));
    expect(again.mode).toBe('club');
    expect(again.freeTier).toBe('easy');
    expect(tubesToString(again.tubes)).toBe(tubesToString(club.tubes));
  });
});

describe('the tier a challenge carries', () => {
  it('is a free board’s own tier', () => {
    expect(challengeTierOf(createFreeSession('medium', 'water-free-x'))).toBe('medium');
  });

  it('exists for a level only when a tier deals exactly that board', () => {
    // A tier is one level's colours and mix (levels.ts FREE_TIER_LEVEL): that
    // level, and no other, can be replayed as a challenge under its own seed.
    expect(challengeTierOf(createLevelSession(10))).toBe('easy');
    expect(challengeTierOf(createLevelSession(50))).toBe('medium');
    expect(challengeTierOf(createLevelSession(95))).toBe('hard');
    expect(challengeTierOf(createLevelSession(1))).toBeNull();
    expect(challengeTierOf(createLevelSession(51))).toBeNull();
    for (const level of [10, 50, 95]) {
      const board = createLevelSession(level);
      const tier = challengeTierOf(board)!;
      const replay = createClubSession({ tier }, levelSeed(level));
      expect(boardDigestOf(replay)).toBe(boardDigestOf(board));
    }
  });

  it('does not exist for the daily, whose even mix no tier deals', () => {
    expect(challengeTierOf(createDailySession('2026-08-01'))).toBeNull();
  });
});
