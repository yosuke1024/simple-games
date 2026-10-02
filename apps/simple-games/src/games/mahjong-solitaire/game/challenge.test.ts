/**
 * The board digest the Club House compares (docs/MAHJONG_SOLITAIRE_RULES.md
 * §14, docs/architecture/club.md §6-4). It tells Today's daily challenge that
 * two devices generated the same board, so it is pinned like the boards
 * themselves: a digest that moves is every device's daily no longer matching.
 * Level 1 and the daily of 2026-08-01 are the boards compatibility.test.ts
 * already pins; these lines pin what they hash to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createLevelSession, removePair, restartSession } from './session';

describe('board digest', () => {
  it('level 1 and the 2026-10-02 and 2026-08-01 dailies hash to their pinned digests', () => {
    expect(boardDigestOf(createLevelSession(1))).toBe('mj1:66e2f8cc');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('mj1:96a6f956');
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('mj1:5b7f20cc');
  });

  it('is the prefix and eight lowercase hex digits', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toMatch(/^mj1:[0-9a-f]{8}$/);
  });

  it('the same date gives the same digest, on a retry too', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(boardDigestOf(session));
    expect(boardDigestOf(restartSession(session))).toBe(boardDigestOf(session));
    expect(boardDigestOf(session)).toBe(boardDigest(session.layout.id, session.faces));
  });

  it('a different date gives a different digest', () => {
    expect(boardDigestOf(createDailySession('2026-10-03'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
  });

  it('the layout is part of the board: the same faces under another layout differ', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigest('sprout', session.faces)).not.toBe(boardDigest('turtle', session.faces));
  });

  it('does not move as pairs are removed', () => {
    const session = createDailySession('2026-10-02');
    const pair = findPair(session);
    const played = removePair(session, pair[0], pair[1]);
    expect(played).not.toBeNull();
    expect(played!.removed.length).toBe(1);
    expect(boardDigestOf(played!)).toBe(boardDigestOf(session));
  });
});

function findPair(session: ReturnType<typeof createDailySession>): [number, number] {
  for (let a = 0; a < session.faces.length; a++) {
    for (let b = a + 1; b < session.faces.length; b++) {
      if (removePair(session, a, b) !== null) return [a, b];
    }
  }
  throw new Error('no removable pair');
}
