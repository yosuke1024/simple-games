/**
 * The set digest the Club House compares (docs/QUICK_MATH_RULES.md Club
 * section, docs/architecture/club.md §6-4). It is what tells Today's daily
 * challenge that a device was asked the same twenty questions, so it is pinned
 * like the sets themselves: a digest that moves is every device's daily no
 * longer matching.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createLevelSession, questionsForDaily } from './session';

describe('board digest', () => {
  it('pins the digests of three daily sets', () => {
    expect(boardDigestOf(createDailySession('2026-08-07'))).toBe('qm1:0cab90e9');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('qm1:2e05c052');
    expect(boardDigestOf(createDailySession('2026-10-03'))).toBe('qm1:f68bf85d');
  });

  it('is the same digest for the same date and a different one for another date', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });

  it('is the prefix and eight lowercase hex digits of the questions', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^qm1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(questionsForDaily('2026-10-02')));
    expect(boardDigestOf(createLevelSession(1))).toBe('qm1:a9945b4e');
  });

  it('does not move as the set is answered', () => {
    const session = createDailySession('2026-10-02');
    const played = { ...session, solvedCount: 7, missCount: 3, elapsedSeconds: 90 };
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
  });
});
