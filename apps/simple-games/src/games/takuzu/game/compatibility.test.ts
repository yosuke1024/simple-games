/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must see the same puzzle — and a personal best only
 * means something if the board it was set on still exists. Any change to the
 * rng, to the line alphabet, to the dig order or to the technique set that
 * moves a board will fail here, which is the point: changing these strings is
 * a decision, not a side effect.
 *
 * **Fix the implementation, not the test.** Two things rest on the literals
 * below. A saved game holds these strings verbatim (§11), so a change to the
 * encoding strands every game in progress. And the level list is what progress
 * is counted against (§7), so a change to the boards quietly retires every
 * best time on record.
 *
 * If a change here is intended, regenerate the strings and say so in the
 * commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { isSolved } from './engine';
import { decodeBoards, encodeBoard } from './serialize';
import { createDailySession, createLevelSession, doTap } from './session';
import { EMPTY } from './types';

describe('golden puzzles (v1)', () => {
  it('level 1 — the first 6×6 — is unchanged', () => {
    const session = createLevelSession(1);
    expect(session.size).toBe(6);
    expect(encodeBoard(session.givens)).toBe(
      '01....' + '001.0.' + '11....' + '01.1.1' + '1..001' + '..0.1.',
    );
    expect(encodeBoard(session.solution)).toBe(
      '011010' + '001101' + '110010' + '010101' + '101001' + '100110',
    );
  });

  it('level 21 — the first 8×8 — is unchanged', () => {
    const session = createLevelSession(21);
    expect(session.size).toBe(8);
    expect(encodeBoard(session.givens)).toBe(
      '.1.0.1.1' +
        '10..10..' +
        '...10010' +
        '0..01...' +
        '.001...1' +
        '0.....11' +
        '..01....' +
        '0.1..11.',
    );
    expect(encodeBoard(session.solution)).toBe(
      '01001101' +
        '10101001' +
        '11010010' +
        '01101100' +
        '10010011' +
        '00101011' +
        '11010100' +
        '00110110',
    );
  });

  it('level 61 — the first 10×10 — is unchanged', () => {
    const session = createLevelSession(61);
    expect(session.size).toBe(10);
    expect(encodeBoard(session.givens)).toBe(
      '0.00.....1' +
        '001.0...0.' +
        '..0.0.11..' +
        '0...11.1..' +
        '0..1......' +
        '1.....1.0.' +
        '.01.100...' +
        '....01..11' +
        '.0.0...10.' +
        '..110.1.1.',
    );
  });

  it('level 100 — the end of the list — is unchanged', () => {
    const session = createLevelSession(100);
    expect(encodeBoard(session.givens)).toBe(
      '.1.....0.1' +
        '.0..0...1.' +
        '...0......' +
        '....1.0.00' +
        '...0.0....' +
        '.......0..' +
        '.1..0....1' +
        '..00......' +
        '1..1.1.1.1' +
        '......0.00',
    );
    expect(encodeBoard(session.solution)).toBe(
      '0101101001' +
        '0011001011' +
        '1010010110' +
        '1101100100' +
        '0010101011' +
        '1001011010' +
        '0110010101' +
        '1100101010' +
        '1001010101' +
        '0110110100',
    );
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(8);
    expect(encodeBoard(session.givens)).toBe(
      '.00.....' +
        '.0..10..' +
        '0.01.1.1' +
        '..0.....' +
        '.0.1.1.0' +
        '01..0..0' +
        '...0....' +
        '0..0...1',
    );
    expect(encodeBoard(session.solution)).toBe(
      '10011010' +
        '10101010' +
        '01010101' +
        '01001011' +
        '10110100' +
        '01010110' +
        '10101001' +
        '01100101',
    );
  });

  /**
   * The number of digits a level hands over is the difficulty curve of §7 made
   * concrete. It is pinned per band end because a table that drifts is a table
   * that stopped describing the game.
   */
  it('hands over the number of digits its band promises', () => {
    const givens = (level: number): number =>
      createLevelSession(level).givens.filter((given) => given !== EMPTY).length;
    expect([givens(1), givens(20)]).toEqual([18, 11]);
    expect([givens(21), givens(60)]).toEqual([29, 18]);
    expect([givens(61), givens(100)]).toEqual([40, 27]);
  });
});

/**
 * The save format of §11, v1: three strings of one character per cell, plus the
 * counters. Nothing here derives a clue or a hint from the board, so there is
 * nothing that can drift between what was written and what is read back.
 */
describe('the saved game format (v1)', () => {
  it('writes the three boards a save holds', () => {
    let session = createLevelSession(1);
    session = doTap(session, 2)!; // a zero
    session = doTap(doTap(session, 3)!, 3)!; // a one, two taps around

    expect(encodeBoard(session.marks)).toBe('..01' + '.'.repeat(32));
    expect(encodeBoard(session.givens)).toBe(
      '01....' + '001.0.' + '11....' + '01.1.1' + '1..001' + '..0.1.',
    );
  });

  it('reads back exactly what it wrote', () => {
    const session = doTap(createLevelSession(1), 2)!;
    const decoded = decodeBoards(
      {
        solution: encodeBoard(session.solution),
        givens: encodeBoard(session.givens),
        marks: encodeBoard(session.marks),
      },
      session.size,
    );
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.givens).toEqual([...session.givens]);
    expect(decoded?.marks).toEqual([...session.marks]);
  });

  it('ships boards that are legal Takuzu in the first place', () => {
    for (const level of [1, 21, 61, 100]) {
      const session = createLevelSession(level);
      expect(isSolved([...session.solution], session.size), `level ${level}`).toBe(true);
    }
    const daily = createDailySession('2026-08-01');
    expect(isSolved([...daily.solution], daily.size)).toBe(true);
  });
});
