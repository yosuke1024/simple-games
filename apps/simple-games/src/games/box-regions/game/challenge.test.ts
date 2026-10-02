/**
 * The board digest the Club House compares (docs/BOX_REGIONS_RULES.md Club
 * section, docs/architecture/club.md §6-4). It is what tells Today's daily
 * challenge that a device played the same puzzle, so it is pinned like the
 * boards themselves: a digest that moves is every device's daily no longer
 * matching. The clue text is written here canonically (the compatibility golden
 * keeps its own test-local form); a change to either is a new digest prefix.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf, clueSignature } from './challenge';
import { createDailySession, createDifficultySession, doDraw } from './session';

describe('board digest', () => {
  it('pins the digests of three daily boards', () => {
    expect(boardDigestOf(createDailySession('2026-08-01'))).toBe('br1:a9fa9a5d');
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe('br1:4d402216');
    expect(boardDigestOf(createDailySession('2026-10-03'))).toBe('br1:61625c2d');
  });

  it('is the same digest for the same date and a different one for another date', () => {
    expect(boardDigestOf(createDailySession('2026-10-02'))).toBe(
      boardDigestOf(createDailySession('2026-10-02')),
    );
    expect(boardDigestOf(createDailySession('2026-10-02'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-03')),
    );
  });

  it('is the prefix and eight lowercase hex digits of the layout and the answer', () => {
    const session = createDailySession('2026-10-02');
    expect(boardDigestOf(session)).toMatch(/^br1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session));
  });

  it('writes a clue as index:size and its kind, with * for no number', () => {
    const session = createDifficultySession('easy', 'box-regions-easy-golden');
    expect(clueSignature(session.clues)).toBe(
      '1:*square,7:4square,9:2tall,13:10wide,22:4wide,24:1square',
    );
  });

  it('does not move as the board is played', () => {
    const session = createDifficultySession('medium', 'box-regions-medium-golden');
    // Draw the answer's first region: regions are rectangles, so its two
    // extreme cells are a legal drag.
    const cells = session.solution.flatMap((region, index) => (region === 0 ? [index] : []));
    const played = doDraw(session, cells[0]!, cells[cells.length - 1]!);
    expect(played).not.toBeNull();
    if (played === null) return;
    expect(played.assignment).not.toEqual(session.assignment);
    expect(boardDigestOf(played)).toBe(boardDigestOf(session));
    expect(boardDigestOf(session)).toBe('br1:f6dcfad5');
  });
});
