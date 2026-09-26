/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * A seed is a promise. A daily is the same board for everyone, and a player's
 * suspended game or best time only means something if the board it was set
 * on still exists. Any change to the rng, to the crown search, to the region
 * growth, to the repair, or to the technique set that moves a board will fail
 * here, which is the point: changing these strings is a decision, not a side
 * effect. The beta channel allows a schema change — never a silent one
 * (docs/WEB_VERSION.md「先行公開」).
 *
 * **Fix the implementation, not the test.** A saved game holds the region and
 * solution strings verbatim (§11), so a change to the encoding strands every
 * game in progress. If a change here is intended, regenerate the strings and
 * say so in the commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { isSolved, marksOf } from './engine';
import { decodeBoards, encodeMarks, encodeRegions, encodeSolution } from './serialize';
import { createDailySession, createDifficultySession, doMarkCross, doTap } from './session';
import { countSolutions, grade } from './solver';

describe('golden puzzles (v1)', () => {
  it('the easy board for a fixed seed — the 6×6 — is unchanged', () => {
    const session = createDifficultySession('easy', 'crown-grid-easy-golden');
    expect(session.size).toBe(6);
    expect(encodeRegions(session.regions)).toBe(
      'ddacff' + 'bdacff' + 'dddccf' + 'ddffff' + 'ddfffe' + 'ddffff',
    );
    expect(encodeSolution(session.solution)).toBe('204153');
  });

  it('the medium board for a fixed seed — the 8×8 — is unchanged', () => {
    const session = createDifficultySession('medium', 'crown-grid-medium-golden');
    expect(session.size).toBe(8);
    expect(encodeRegions(session.regions)).toBe(
      'ccccaabb' +
        'ccccccbb' +
        'eeeccbbb' +
        'eedccbbb' +
        'ebbbbbff' +
        'hbbbbbff' +
        'hbbgbbbf' +
        'hhgggfff',
    );
    expect(encodeSolution(session.solution)).toBe('57420631');
  });

  it('the hard board for a fixed seed — the 9×9 — is unchanged', () => {
    const session = createDifficultySession('hard', 'crown-grid-hard-golden');
    expect(session.size).toBe(9);
    expect(encodeRegions(session.regions)).toBe(
      'ebbbbcaaa' +
        'eebbbcada' +
        'eeebfcddd' +
        'eeebffffd' +
        'eieiiffff' +
        'eieiffggf' +
        'iieiiggff' +
        'ihhiigggg' +
        'iiiiigggg',
    );
    expect(encodeSolution(session.solution)).toBe('725804613');
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(8);
    expect(encodeRegions(session.regions)).toBe(
      'aabbbbbe' +
        'cabbbebe' +
        'caaabebe' +
        'ccdeeeee' +
        'ccfeeeee' +
        'ccfffeee' +
        'ccfffggh' +
        'fffffhhh',
    );
    expect(encodeSolution(session.solution)).toBe('14026357');
  });

  /**
   * The tier a golden board grades at is the difficulty curve of §7 made
   * concrete, and its uniqueness is the promise of §8. Pinned here because a
   * grader that drifted would quietly retire the meaning of the three buttons.
   */
  it('ships boards that are unique and grade at their tier', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `crown-grid-${difficulty}-golden`);
      expect(countSolutions(session.regions, session.size), difficulty).toBe(1);
      expect(grade(session.regions, session.size).tier, difficulty).toBe(difficulty);
      expect(isSolved(marksOf(session.solution, session.size), session.regions, session.size)).toBe(
        true,
      );
    }
    const daily = createDailySession('2026-08-01');
    expect(grade(daily.regions, daily.size).tier).toBe('medium');
  });
});

/**
 * The save format of §11, v1: regions and marks as one character per cell,
 * the solution as one digit per row, plus the counters.
 */
describe('the saved game format (v1)', () => {
  it('writes the three strings a save holds', () => {
    let session = createDifficultySession('easy', 'crown-grid-easy-golden');
    session = doTap(session, 2)!; // a cross
    session = doTap(doTap(session, 3)!, 3)!; // a crown, two taps around
    session = doMarkCross(session, [4, 5])!; // a stroke

    expect(encodeMarks(session.marks)).toBe('..xqxx' + '.'.repeat(30));
  });

  it('reads back exactly what it wrote', () => {
    const session = doTap(createDifficultySession('easy', 'crown-grid-easy-golden'), 2)!;
    const decoded = decodeBoards(
      {
        regions: encodeRegions(session.regions),
        solution: encodeSolution(session.solution),
        marks: encodeMarks(session.marks),
      },
      session.size,
    );
    expect(decoded?.regions).toEqual([...session.regions]);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.marks).toEqual([...session.marks]);
  });
});
