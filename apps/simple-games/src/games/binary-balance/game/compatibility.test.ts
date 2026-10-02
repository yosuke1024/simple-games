/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * The Hard board moved once, on 2026-09-30, before the game shipped anywhere:
 * Hard went from 8×8 to 6×6 (docs/BINARY_BALANCE_RULES.md §1, §6), so its
 * golden seed deals a different board. Easy, Medium and the daily did not
 * move.
 *
 * A seed is a promise. A daily is the same board for everyone, and a player's
 * suspended game or best time only means something if the board it was set
 * on still exists. Any change to the rng, to the solution search, to the link
 * draw, to the dig or the prune, or to the technique set that moves a board
 * will fail here, which is the point: changing these strings is a decision,
 * not a side effect. Since 2026-10-02 the game is out of the web-beta channel
 * and its save schema is frozen: a stored shape changes only by migration
 * (docs/WEB_VERSION.md「先行公開」, docs/BINARY_BALANCE_RULES.md §6).
 *
 * **Fix the implementation, not the test.** A saved game holds the solution,
 * givens, marks and link strings verbatim (§11), so a change to the encoding
 * strands every game in progress. If a change here is intended, regenerate the
 * strings and say so in the commit message, along with what it costs existing
 * players.
 */
import { describe, expect, it } from 'vitest';
import { decodeBoards, encodeBoard, encodeLinks } from './serialize';
import { createDailySession, createDifficultySession, doTap } from './session';
import { buildLayout, countSolutions, grade } from './solver';

describe('golden puzzles (v1)', () => {
  it('the easy board for a fixed seed — the 6×6 — is unchanged', () => {
    const session = createDifficultySession('easy', 'binary-balance-easy-golden');
    expect(session.size).toBe(6);
    expect(encodeBoard(session.solution)).toBe(
      '100101' + '010101' + '011010' + '101010' + '010101' + '101010',
    );
    expect(encodeBoard(session.givens)).toBe(
      '..0...' + '......' + '.....0' + '.0.01.' + '.....1' + '.0..1.',
    );
    expect(encodeLinks(session.links)).toBe('h1=,v2=');
  });

  it('the medium board for a fixed seed — the 6×6 — is unchanged', () => {
    const session = createDifficultySession('medium', 'binary-balance-medium-golden');
    expect(session.size).toBe(6);
    expect(encodeBoard(session.solution)).toBe(
      '010011' + '010110' + '101001' + '100110' + '011001' + '101100',
    );
    expect(encodeBoard(session.givens)).toBe(
      '.1....' + '.....0' + '...0..' + '..0...' + '.1..0.' + '....00',
    );
    expect(encodeLinks(session.links)).toBe('h12x,v13=');
  });

  it('the hard board for a fixed seed — the 6×6 — is unchanged', () => {
    const session = createDifficultySession('hard', 'binary-balance-hard-golden');
    expect(session.size).toBe(6);
    expect(encodeBoard(session.solution)).toBe(
      '110010' + '110100' + '001101' + '110010' + '001101' + '001011',
    );
    expect(encodeBoard(session.givens)).toBe(
      '1.0...' + '......' + '.....1' + '......' + '...1..' + '......',
    );
    expect(encodeLinks(session.links)).toBe('v3x,v6x,v7x,v10=,v14x,v17x,h20=,v22x,h26=');
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(6);
    expect(encodeBoard(session.solution)).toBe(
      '010110' + '011001' + '101001' + '100110' + '010101' + '101010',
    );
    expect(encodeBoard(session.givens)).toBe(
      '......' + '..1...' + '....0.' + '..0...' + '..0...' + '......',
    );
    expect(encodeLinks(session.links)).toBe('v1=,v11=,v15x,v18x,v22x,v24x,h25x');
  });

  /**
   * The tier a golden board grades at is the difficulty curve of §7 made
   * concrete, and its uniqueness is the promise of §5. Pinned here because a
   * grader that drifted would quietly retire the meaning of the three buttons.
   */
  it('ships boards that are unique and grade at their tier', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `binary-balance-${difficulty}-golden`);
      const layout = buildLayout(session.links, session.size);
      expect(countSolutions(session.givens, layout), difficulty).toBe(1);
      expect(grade(session.givens, layout), difficulty).toBe(difficulty);
    }
    const daily = createDailySession('2026-08-01');
    expect(grade(daily.givens, buildLayout(daily.links, daily.size))).toBe('medium');
  });
});

/**
 * The save format of §11, v1: solution, givens and marks as one character per
 * cell, links as `h<i>=` / `v<i>x` joined by commas.
 */
describe('the saved game format (v1)', () => {
  it('writes the strings a save holds', () => {
    let session = createDifficultySession('easy', 'binary-balance-easy-golden');
    session = doTap(session, 0)!; // a sun
    session = doTap(doTap(session, 1)!, 1)!; // a moon, two taps around
    expect(encodeBoard(session.marks)).toBe('01' + '.'.repeat(34));
  });

  it('reads back exactly what it wrote', () => {
    const hard = createDifficultySession('hard', 'binary-balance-hard-golden');
    const session = doTap(hard, hard.givens.indexOf(-1))!;
    const decoded = decodeBoards(
      {
        links: encodeLinks(session.links),
        solution: encodeBoard(session.solution),
        givens: encodeBoard(session.givens),
        marks: encodeBoard(session.marks),
      },
      session.size,
    );
    expect(decoded?.links).toEqual([...session.links]);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.givens).toEqual([...session.givens]);
    expect(decoded?.marks).toEqual([...session.marks]);
  });
});
