/**
 * The board digest the Club House compares (docs/UNBLOCK_PUZZLE_RULES.md §18,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device dealt the same board, so it is pinned like the boards
 * themselves: a digest that moves is every device's daily no longer matching.
 * The daily is a bundled Medium board (§8, §9), so a catalogue rebuild that
 * moves a daily moves its digest here too — and that is the point.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_DIGEST_PREFIX, boardDigest, boardDigestOf } from './challenge';
import { hashSeed } from './rng';
import { encodeBoard } from './serialize';
import { createDailySession, createFreeSession, doSlide, restartSession } from './session';

/** A board string, six cells per row. */
const rows = (...lines: string[]): string => lines.join('');

describe('board digest', () => {
  it('pins the digests of three daily boards', () => {
    expect(boardDigestOf(createDailySession('2026-10-17'))).toBe('ub1:b82f3e86');
    expect(boardDigestOf(createDailySession('2026-11-15'))).toBe('ub1:27dd6bae');
    expect(boardDigestOf(createDailySession('2026-11-16'))).toBe('ub1:78065ac9');
  });

  it('hashes the dealt board in the form the golden pins', () => {
    // compatibility.test.ts pins this string for the 2026-10-17 daily.
    const golden = rows('bb..cc', 'ddee.f', '..aa.f', 'g.hiif', 'g.hjkk', 'g.hj..');
    const session = createDailySession('2026-10-17');
    expect(encodeBoard(session.start)).toBe(golden);
    expect(boardDigestOf(session)).toBe(
      BOARD_DIGEST_PREFIX + hashSeed(golden).toString(16).padStart(8, '0'),
    );
  });

  it('pins the digest of a Free Play board', () => {
    const session = createFreeSession('easy', 'unblock-puzzle-easy-golden');
    expect(encodeBoard(session.start)).toBe(
      rows('...bb.', '.cddee', '.c.aaf', '...g.f', 'hh.g.i', '.....i'),
    );
    expect(boardDigestOf(session)).toBe('ub1:ededc29d');
  });

  it('is the same digest for the same date and a different one for another date', () => {
    expect(boardDigestOf(createDailySession('2026-11-15'))).toBe(
      boardDigestOf(createDailySession('2026-11-15')),
    );
    expect(boardDigestOf(createDailySession('2026-11-15'))).not.toBe(
      boardDigestOf(createDailySession('2026-11-16')),
    );
  });

  it('is the prefix and eight lowercase hex digits of the dealt board', () => {
    const session = createDailySession('2026-11-15');
    expect(BOARD_DIGEST_PREFIX).toBe('ub1:');
    expect(boardDigestOf(session)).toMatch(/^ub1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session.start));
  });

  it('does not move as the board is played, reset or cleared', () => {
    const dealt = createFreeSession('easy', 'unblock-puzzle-easy-golden');
    const digest = boardDigestOf(dealt);
    // The golden save's moves: b 3→1, then c down one cell.
    let played = doSlide(dealt, 1, 1)!;
    played = doSlide(played, 2, 2)!;
    expect(encodeBoard(played.board)).not.toBe(encodeBoard(dealt.board));
    expect(boardDigestOf(played)).toBe(digest);
    expect(boardDigestOf(restartSession(played))).toBe(digest);
    // The digest of the board in play would be another string altogether.
    expect(boardDigest(played.board)).not.toBe(digest);
  });
});
