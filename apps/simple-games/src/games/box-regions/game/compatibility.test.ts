/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * A seed is a promise. A daily is the same puzzle for everyone who opens it,
 * and a suspended board has to come back as the board it was — so any change
 * to the rng, to the size order, to the tiling, to the clue draw, to the
 * reduction or to the technique set that moves a board fails here. That is
 * the point: changing these strings is a decision, not a side effect.
 *
 * **Fix the implementation, not the test.** A saved game holds these strings
 * verbatim (docs/BOX_REGIONS_RULES.md §11), so a change to the encoding
 * strands every game in progress; a change to the boards retires the daily
 * record of every day already played. Box Regions is on the web-beta channel,
 * where a schema change is allowed (docs/WEB_VERSION.md) — but allowed is not
 * the same as silent. If a change here is intended, regenerate the strings
 * and say so in the commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { isSolved } from './engine';
import { decodeBoards, encodeRegions } from './serialize';
import { createDailySession, createDifficultySession, doDraw, doTap } from './session';
import type { Clue } from './types';

/** `index:size kind`, one clue per entry, `*` for an absent number, kind by its first letter. */
const signature = (clues: readonly Clue[]): string[] =>
  clues.map((clue) => `${clue.index}:${clue.size ?? '*'}${clue.kind[0]}`);

describe('golden puzzles (v1)', () => {
  it('the easy board for seed box-regions-easy-golden is unchanged', () => {
    const session = createDifficultySession('easy', 'box-regions-easy-golden');
    expect(encodeRegions(session.solution)).toBe('aabbc' + 'aabbc' + 'ddddd' + 'ddddd' + 'eeeef');
    expect(signature(session.clues)).toEqual(['1:*s', '7:4s', '9:2t', '13:10w', '22:4w', '24:1s']);
  });

  it('the medium board for seed box-regions-medium-golden is unchanged', () => {
    const session = createDifficultySession('medium', 'box-regions-medium-golden');
    expect(encodeRegions(session.solution)).toBe(
      'abbcdd' + 'abbcdd' + 'abbcdd' + 'ebbcff' + 'ebbcff' + 'gggggg',
    );
    expect(signature(session.clues)).toEqual([
      '12:3t',
      '14:10f',
      '21:*f',
      '17:*t',
      '18:*f',
      '28:4s',
      '31:6w',
    ]);
  });

  it('the hard board for seed box-regions-hard-golden is unchanged', () => {
    const session = createDifficultySession('hard', 'box-regions-hard-golden');
    expect(encodeRegions(session.solution)).toBe(
      'aaabbbc' + 'aaabbbc' + 'dddbbbc' + 'dddbbbc' + 'dddeefc' + 'dddeegg' + 'hhijjjj',
    );
    expect(signature(session.clues)).toEqual([
      '7:*f',
      '4:*f',
      '13:*f',
      '14:*f',
      '32:4f',
      '33:1f',
      '41:2f',
      '42:*f',
      '44:1f',
      '45:*f',
    ]);
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.difficulty).toBe('medium');
    expect(encodeRegions(session.solution)).toBe(
      'abbccd' + 'abbccd' + 'abbcce' + 'afffge' + 'hfffge' + 'iijjgk',
    );
    expect(signature(session.clues)).toEqual([
      '12:4t',
      '13:6f',
      '10:*f',
      '11:2f',
      '23:*f',
      '26:*f',
      '22:3t',
      '24:*f',
      '30:2w',
      '33:2w',
      '35:1s',
    ]);
  });

  it('ships boards that are legal Box Regions in the first place', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `box-regions-${difficulty}-golden`);
      expect(isSolved(session, session.solution), difficulty).toBe(true);
    }
    const daily = createDailySession('2026-08-01');
    expect(isSolved(daily, daily.solution)).toBe(true);
  });
});

/**
 * The save format of §11, v1: two strings of one letter per cell, plus the
 * clues and the counters. Nothing here derives a clue from the board, so
 * there is nothing that can drift between what was written and what is read.
 */
describe('the saved game format (v1)', () => {
  const played = () => {
    let session = createDifficultySession('easy', 'box-regions-easy-golden');
    // Box b (clue at 7) drawn as its answer, 2 to 8; the 1×1 f tapped in.
    session = doDraw(session, 2, 8)!;
    return doTap(session, 24)!;
  };

  it('writes the two boards a save holds', () => {
    expect(encodeRegions(played().assignment)).toBe(
      '..bb.' + '..bb.' + '.....' + '.....' + '....f',
    );
  });

  it('reads back exactly what it wrote', () => {
    const session = played();
    const decoded = decodeBoards(
      {
        solution: encodeRegions(session.solution),
        assignment: encodeRegions(session.assignment),
      },
      session,
    );
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.assignment).toEqual([...session.assignment]);
  });
});
