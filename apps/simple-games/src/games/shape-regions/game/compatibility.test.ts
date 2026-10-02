/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * A seed is a promise. A daily is the same puzzle for everyone who opens it,
 * and a suspended board has to come back as the board it was — so any change
 * to the rng, to the catalog order, to the tiling, to the clue draw, to the
 * reduction or to the technique set that moves a board fails here. That is
 * the point: changing these strings is a decision, not a side effect.
 *
 * **Fix the implementation, not the test.** A saved game holds these strings
 * verbatim (§11), so a change to the encoding strands every game in progress;
 * a change to the boards retires the daily record of every day already
 * played. Shape Regions left the web-beta channel on 2026-10-02
 * (docs/WEB_VERSION.md): its save schema is frozen since, and a stored shape
 * changes only by migration. If a change here is intended, regenerate the
 * strings and say so in the commit
 * message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { isSolved } from './engine';
import { decodeBoards, encodeRegions } from './serialize';
import { createDailySession, createDifficultySession, doStroke } from './session';
import type { Clue } from './types';

/** `index:size shape`, one clue per entry, `*` for a side that is absent. */
const signature = (clues: readonly Clue[]): string[] =>
  clues.map((clue) => `${clue.index}:${clue.size ?? '*'}${clue.shape ? clue.shape[0] : '*'}`);

describe('golden puzzles (v1)', () => {
  it('the easy board for seed shape-regions-easy-golden is unchanged', () => {
    const session = createDifficultySession('easy', 'shape-regions-easy-golden');
    expect(encodeRegions(session.solution)).toBe('aaaab' + 'cddab' + 'cddab' + 'ceebb' + 'cccff');
    expect(signature(session.clues)).toEqual([
      '13:6*',
      '18:5c',
      '20:6c',
      '12:4b',
      '17:2l',
      '23:2l',
    ]);
  });

  it('the medium board for seed shape-regions-medium-golden is unchanged', () => {
    const session = createDifficultySession('medium', 'shape-regions-medium-golden');
    expect(encodeRegions(session.solution)).toBe(
      'aabbbb' + 'caadbe' + 'ccfdee' + 'gcfdhh' + 'gcfddd' + 'iiffjj',
    );
    expect(signature(session.clues)).toEqual([
      '7:4s',
      '4:5t',
      '6:*s',
      '21:6*',
      '16:3c',
      '20:5c',
      '24:2*',
      '22:2*',
      '31:2l',
      '34:2*',
    ]);
  });

  it('the hard board for seed shape-regions-hard-golden is unchanged', () => {
    const session = createDifficultySession('hard', 'shape-regions-hard-golden');
    expect(encodeRegions(session.solution)).toBe(
      'aabbbcd' + 'eafgbcd' + 'eefggcd' + 'hefgccd' + 'heiicjd' + 'hekiijd' + 'hhkkkll',
    );
    expect(signature(session.clues)).toEqual([
      '8:3*',
      '3:4*',
      '5:*s',
      '41:*l',
      '22:6s',
      '9:*l',
      '17:*t',
      '21:5*',
      '30:*s',
      '40:*l',
      '46:*c',
      '48:*l',
    ]);
  });

  it('the daily for 2026-09-26 is unchanged', () => {
    const session = createDailySession('2026-09-26');
    expect(session.difficulty).toBe('medium');
    expect(encodeRegions(session.solution)).toBe(
      'aaabcc' + 'aaabbb' + 'deeeef' + 'degggf' + 'dhhigj' + 'kkkiij',
    );
    expect(signature(session.clues)).toEqual([
      '8:6b',
      '3:*c',
      '4:2l',
      '18:3*',
      '19:5c',
      '23:2*',
      '20:4c',
      '25:*l',
      '34:3c',
      '29:2*',
      '32:3*',
    ]);
  });

  it('ships boards that are legal Shape Regions in the first place', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `shape-regions-${difficulty}-golden`);
      expect(isSolved(session, session.solution), difficulty).toBe(true);
    }
    const daily = createDailySession('2026-09-26');
    expect(isSolved(daily, daily.solution)).toBe(true);
  });
});

/**
 * The save format of §11, v1: two strings of one letter per cell, plus the
 * clues and the counters. Nothing here derives a clue from the board, so
 * there is nothing that can drift between what was written and what is read.
 */
describe('the saved game format (v1)', () => {
  it('writes the two boards a save holds', () => {
    let session = createDifficultySession('easy', 'shape-regions-easy-golden');
    // Region 3 (block, clue at 12) grows into cell 7 above it.
    session = doStroke(session, 3, [7])!;
    // Clues sit at 12 (d), 13 (a), 17 (e), 18 (b), 20 (c) and 23 (f).
    expect(encodeRegions(session.assignment)).toBe('.....' + '..d..' + '..da.' + '..eb.' + 'c..f.');
  });

  it('reads back exactly what it wrote', () => {
    const session = doStroke(createDifficultySession('easy', 'shape-regions-easy-golden'), 3, [7])!;
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
