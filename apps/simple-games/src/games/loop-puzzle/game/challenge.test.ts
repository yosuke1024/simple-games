/**
 * The board digest the Club House compares (docs/LOOP_PUZZLE_RULES.md §17,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device played the same puzzle, so it is pinned like the boards
 * themselves: a digest that moves is every device's daily no longer matching.
 * The text it hashes is the board as the golden boards write it
 * (compatibility.test.ts); a change to that text is a new digest prefix.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_DIGEST_PREFIX, boardDigest, boardDigestOf } from './challenge';
import { hashSeed } from './rng';
import { cluesDigest } from './serialize';
import { createDailySession, createDifficultySession, doCycle, doSet } from './session';
import { LINE } from './types';

describe('board digest', () => {
  it('pins the digests of three daily boards', () => {
    expect(boardDigestOf(createDailySession('2026-10-17'))).toBe('lp1:0b878a4c');
    expect(boardDigestOf(createDailySession('2026-11-14'))).toBe('lp1:79346ce8');
    expect(boardDigestOf(createDailySession('2026-11-15'))).toBe('lp1:d4279ae9');
  });

  it('pins the digest of a Free Play board', () => {
    expect(boardDigestOf(createDifficultySession('hard', 'loop-puzzle-hard-golden'))).toBe(
      'lp1:f1c55392',
    );
  });

  it('hashes the size, the clues and the answer exactly as the golden daily writes them', () => {
    // The strings of compatibility.test.ts's daily for 2026-10-17, joined by `|`.
    const text =
      '5x5|' +
      '0.2.3' +
      '.....' +
      '.22.3' +
      '.20..' +
      '3.112' +
      '|XXLLLXXXLLXXXXLXLXLXLXXXXLLLLLXXLXXLXXLLXXXXLLLLXLXXXLLXXXXL';
    expect(boardDigestOf(createDailySession('2026-10-17'))).toBe(
      BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0'),
    );
  });

  it('is the same digest for the same date and a different one for another date', () => {
    expect(boardDigestOf(createDailySession('2026-11-15'))).toBe(
      boardDigestOf(createDailySession('2026-11-15')),
    );
    expect(boardDigestOf(createDailySession('2026-11-14'))).not.toBe(
      boardDigestOf(createDailySession('2026-11-15')),
    );
  });

  it('is the prefix and eight lowercase hex digits, and never the save’s clue digest', () => {
    const session = createDailySession('2026-11-15');
    expect(boardDigestOf(session)).toMatch(/^lp1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session));
    // Same `lp1:` prefix as the save's cluesDigest (§12), a different text.
    expect(cluesDigest(session.clues)).toMatch(/^lp1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).not.toBe(cluesDigest(session.clues));
  });

  it('does not move as the board is played, nor once it is solved', () => {
    const session = createDifficultySession('medium', 'loop-puzzle-medium-golden');
    const before = boardDigestOf(session);
    expect(before).toBe('lp1:acf9de0d');

    const tapped = doCycle(doCycle(session, 0)!, 3)!;
    expect(tapped.marks).not.toEqual(session.marks);
    expect(boardDigestOf(tapped)).toBe(before);

    // Draw the answer's loop edge by edge; the last LINE solves the board.
    let played = session;
    session.solution.forEach((mark, edge) => {
      if (mark !== LINE) return;
      played = doSet(played, edge, LINE) ?? played;
    });
    expect(played.status).toBe('solved');
    expect(boardDigestOf(played)).toBe(before);
  });
});
