/**
 * The board digest the Club House compares (docs/BRIDGES_RULES.md §17,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device played the same puzzle, so it is pinned like the boards
 * themselves: a digest that moves is every device's daily no longer matching.
 * The text it hashes is the board as the save writes it (`encodeBoard`, the
 * string compatibility.test.ts pins); a change to that text is a new digest
 * prefix.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_DIGEST_PREFIX, boardDigest, boardDigestOf } from './challenge';
import { encodeBoard } from './serialize';
import {
  createDailySession,
  createDifficultySession,
  doCycle,
  fromRecord,
  restartSession,
  toRecord,
} from './session';

describe('board digest', () => {
  it('pins the digests of three daily boards', () => {
    expect(boardDigestOf(createDailySession('2026-10-17'))).toBe('bg1:4f326bc8');
    expect(boardDigestOf(createDailySession('2026-11-15'))).toBe('bg1:bda6f14d');
    expect(boardDigestOf(createDailySession('2026-11-16'))).toBe('bg1:9f3a9bc7');
  });

  it('pins the digest of a free-play board', () => {
    expect(boardDigestOf(createDifficultySession('easy', 'bridges-easy-golden'))).toBe(
      'bg1:d692a690',
    );
  });

  it('hashes the size and the board string the golden pins, and nothing else', () => {
    const session = createDailySession('2026-10-17');
    // The golden board of compatibility.test.ts, as one string.
    expect(encodeBoard(session)).toBe(
      '.........' +
        '3.3...3.3' +
        '....1....' +
        '.........' +
        '....3...4' +
        '3.....3..' +
        '.........' +
        '..2.3.2..' +
        '1..1....3',
    );
    expect(boardDigestOf(session)).toBe(boardDigest(session));
    expect(boardDigest({ width: 9, height: 9, islands: session.islands })).toBe(
      boardDigestOf(session),
    );
  });

  it('is the same digest for the same date and a different one for another date', () => {
    expect(boardDigestOf(createDailySession('2026-11-15'))).toBe(
      boardDigestOf(createDailySession('2026-11-15')),
    );
    expect(boardDigestOf(createDailySession('2026-11-15'))).not.toBe(
      boardDigestOf(createDailySession('2026-11-16')),
    );
  });

  it('is the prefix and eight lowercase hex digits', () => {
    expect(BOARD_DIGEST_PREFIX).toBe('bg1:');
    for (const session of [
      createDailySession('2026-10-17'),
      createDifficultySession('medium', 'bridges-medium-golden'),
      createDifficultySession('hard', 'bridges-hard-golden'),
    ]) {
      expect(boardDigestOf(session)).toMatch(/^bg1:[0-9a-f]{8}$/);
    }
  });

  it('does not move as the board is played, retried or saved and restored', () => {
    const session = createDailySession('2026-10-17');
    const before = boardDigestOf(session);
    let played = doCycle(session, 0);
    expect(played).not.toBeNull();
    played = doCycle(played!, 2);
    expect(played).not.toBeNull();
    expect(played!.bridges).not.toEqual(session.bridges);
    expect(boardDigestOf(played!)).toBe(before);
    expect(boardDigestOf(restartSession(played!))).toBe(before);
    const restored = fromRecord(JSON.parse(JSON.stringify(toRecord(played!))));
    expect(restored).not.toBeNull();
    expect(boardDigestOf(restored!)).toBe(before);
  });

  it('reads the session’s own islands, not its seed', () => {
    // A daily restored from a save made under an older generator keeps its
    // old board (§10), so it must keep that board's digest: the seed is not
    // read. Here the seed is someone else's and the islands are the golden's.
    const session = createDailySession('2026-10-17');
    const other = createDailySession('2026-11-15');
    const reseeded = { ...session, seed: other.seed };
    expect(boardDigestOf(reseeded)).toBe(boardDigestOf(session));
    expect(boardDigestOf(other)).not.toBe(boardDigestOf(session));
  });
});
