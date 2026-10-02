/**
 * The board digest the Club House sends for a daily (docs/MEMORY_MATCH_RULES.md
 * §14, docs/architecture/club.md §6-4). The digest is how two results are
 * known to be about the same cards, so it is pinned like the boards
 * themselves: a digest that moves is every older result no longer matching.
 * The 2026-08-01 daily is the board compatibility.test.ts already pins; these
 * lines pin what it hashes to.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf } from './challenge';
import { createDailySession, createDifficultySession } from './session';

describe('board digest', () => {
  it('pins the dailies it was introduced with', () => {
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('mm1:8c6bcf7a');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('mm1:e735304f');
  });

  it('pins a difficulty board by its seed', () => {
    expect(boardDigestOf(createDifficultySession('easy', 'memory-easy-golden'))).toBe(
      'mm1:7a30ec81',
    );
  });

  it('is the prefix and eight lowercase hex digits', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^mm1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.difficulty, session.deck));
  });

  it('is the same for the same date, on a fresh deal and after play', () => {
    const first = createDailySession('2026-10-02');
    const again = createDailySession('2026-10-02');
    expect(boardDigestOf(again)).toBe(boardDigestOf(first));
    const played = { ...first, matched: first.matched.map((_, i) => i < 2), moveCount: 5 };
    expect(boardDigestOf(played)).toBe(boardDigestOf(first));
  });

  it('differs between dates', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });
});
