/**
 * The board digest the Club House compares (docs/SCHULTE_TABLE_RULES.md Club
 * section, docs/architecture/club.md §6-4). It is what tells Today's daily
 * challenge that a device was dealt the same board, so it is pinned like the
 * boards themselves: a digest that moves is every device's daily no longer
 * matching. The 2026-08-07 daily is the board compatibility.test.ts already
 * pins; these lines pin what it hashes to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createLevelSession, tapCell } from './session';

describe('board digest', () => {
  it('pins the digests of three daily boards', () => {
    expect(boardDigestOf(createDailySession('2026-08-07'))).toBe('st1:cd276aa0');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('st1:929fe35c');
    expect(boardDigestOf(createDailySession('2026-10-03'))).toBe('st1:e94d5ee3');
  });

  it('is the same digest for the same date and a different one for another date', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });

  it('is the prefix and eight lowercase hex digits of the size, order and numbers', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^st1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session));
    expect(boardDigestOf(createLevelSession(1))).toBe('st1:ee913a76');
  });

  it('does not move as the round is played', () => {
    const session = createDailySession('2026-10-02');
    const first = session.values.indexOf(1);
    const played = tapCell(session, first)?.session;
    expect(played?.tappedCount).toBe(1);
    if (played === undefined) return;
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
  });
});
