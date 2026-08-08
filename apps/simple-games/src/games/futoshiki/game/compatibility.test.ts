/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must see the same puzzle — and a personal best only
 * means something if the board it was set on still exists. Any change to the
 * rng, to the Latin-square search, to which gaps take a sign, to the dig order
 * or to the technique set that moves a board will fail here, which is the
 * point: changing these strings is a decision, not a side effect.
 *
 * **Fix the implementation, not the test.** Two things rest on the literals
 * below. A saved game holds these strings verbatim (§11), so a change to the
 * encoding strands every game in progress. And the level list is what progress
 * is counted against (§9), so a change to the boards quietly retires every
 * best time on record.
 *
 * If a change here is intended, regenerate the strings and say so in the
 * commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { isSolved } from './engine';
import { decodeGame, encodeConstraints, encodeGrid, encodeNotes } from './serialize';
import { createDailySession, createLevelSession, doPlace, doToggleNote } from './session';
import { EMPTY } from './types';

describe('golden puzzles (v1)', () => {
  it('level 1 — the first 4×4 — is unchanged', () => {
    const session = createLevelSession(1);
    expect(session.size).toBe(4);
    expect(encodeGrid(session.board.givens)).toBe('14..' + '...4' + '...3' + '..41');
    expect(encodeGrid(session.solution)).toBe('1432' + '2314' + '4123' + '3241');
    expect(encodeConstraints(session.constraints, session.size)).toBe(
      '0v<,2h>,2v>,4v<,5h>,6h<,6v<,8v>,9v<,10h<,12h>,14h>',
    );
  });

  it('level 16 — the first 5×5 — is unchanged', () => {
    const session = createLevelSession(16);
    expect(session.size).toBe(5);
    expect(encodeGrid(session.board.givens)).toBe('.5...' + '.32..' + '..5..' + '.23..' + '2..5.');
    expect(encodeGrid(session.solution)).toBe('35124' + '53241' + '14532' + '42315' + '21453');
    expect(encodeConstraints(session.constraints, session.size)).toBe(
      '0h<,1h>,2h<,3h<,5v>,6h>,7h<,7v<,10h<,11h<,12h>,12v>,13h>,14v<,17v<,18h<,19v>,20h>',
    );
  });

  it('level 46 — the first 6×6 — is unchanged', () => {
    const session = createLevelSession(46);
    expect(session.size).toBe(6);
    expect(encodeGrid(session.board.givens)).toBe(
      '......' + '.....1' + '.3..4.' + '...1..' + '162.5.' + '.13..2',
    );
    expect(encodeGrid(session.solution)).toBe(
      '654213' + '425631' + '231546' + '346125' + '162354' + '513462',
    );
  });

  it('level 81 — the first 7×7 — is unchanged', () => {
    const session = createLevelSession(81);
    expect(session.size).toBe(7);
    expect(encodeGrid(session.board.givens)).toBe(
      '..1...3' + '.....76' + '64.....' + '....13.' + '....451' + '1.....4' + '.5.....',
    );
    expect(encodeGrid(session.solution)).toBe(
      '5714623' + '2145376' + '6423517' + '4276135' + '7632451' + '1357264' + '3561742',
    );
  });

  it('level 100 — the end of the list — is unchanged', () => {
    const session = createLevelSession(100);
    expect(encodeGrid(session.board.givens)).toBe(
      '134.6..' + '......1' + '.......' + '.47....' + '3....5.' + '....2..' + '.......',
    );
    expect(encodeConstraints(session.constraints, session.size)).toBe(
      '3h>,8v>,9v<,10v<,11h<,11v>,14h>,15h<,17h>,21v<,23v>,24h<,24v<,25v>,26v<,27v>,28v<,' +
        '29h>,30v<,33v<,35v>,36h>,37h>,37v<,38v<,40h>,40v>,46h>',
    );
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(6);
    expect(encodeGrid(session.board.givens)).toBe(
      '.5...1' + '..32..' + '..2.36' + '.....4' + '......' + '...1..',
    );
    expect(encodeGrid(session.solution)).toBe(
      '256341' + '413265' + '142536' + '531624' + '625413' + '364152',
    );
    expect(encodeConstraints(session.constraints, session.size)).toBe(
      '0h<,1h<,2v>,4h>,4v<,6v>,8v>,13h>,15h>,15v<,16h<,18h>,20h<,22h<,22v>,23v>,27v>,28h<,' +
        '28v<,30h<,31h>,32h>,34h>',
    );
  });

  /**
   * The two numbers a level hands over are the difficulty curve of §9 made
   * concrete. They are pinned per band end because a table that drifts is a
   * table that stopped describing the game.
   */
  it('hands over the number of signs and digits its band promises', () => {
    const counts = (level: number): [number, number] => {
      const session = createLevelSession(level);
      return [
        session.constraints.length,
        session.board.givens.filter((given) => given !== EMPTY).length,
      ];
    };
    expect([counts(1), counts(15)]).toEqual([
      [12, 6],
      [8, 2],
    ]);
    expect([counts(16), counts(45)]).toEqual([
      [18, 8],
      [13, 3],
    ]);
    expect([counts(46), counts(80)]).toEqual([
      [26, 11],
      [20, 6],
    ]);
    expect([counts(81), counts(100)]).toEqual([
      [34, 14],
      [28, 10],
    ]);
  });
});

/**
 * The save format of §11, v1: five strings — three grids, the sign list and
 * the notes — plus the counters. Nothing here recomputes a sign or a hint from
 * the board, so there is nothing that can drift between what was written and
 * what is read back.
 */
describe('the saved game format (v1)', () => {
  it('writes the five strings a save holds', () => {
    let session = createLevelSession(1);
    session = doPlace(session, 2, 3)!;
    session = doToggleNote(session, 3, 2)!;

    expect(encodeGrid(session.board.givens)).toBe('14..' + '...4' + '...3' + '..41');
    expect(encodeGrid(session.board.entries)).toBe('..3.' + '....' + '....' + '....');
    expect(encodeNotes(session.board.notes)).toBe('0,0,0,2,' + '0,'.repeat(11) + '0');
    expect(encodeConstraints(session.constraints, session.size)).toBe(
      '0v<,2h>,2v>,4v<,5h>,6h<,6v<,8v>,9v<,10h<,12h>,14h>',
    );
    expect(session.mistakeCount).toBe(0);
    expect(session.hintCount).toBe(0);
  });

  it('reads back exactly what it wrote', () => {
    const session = doPlace(createLevelSession(1), 2, 3)!;
    const decoded = decodeGame(
      {
        solution: encodeGrid(session.solution),
        constraints: encodeConstraints(session.constraints, session.size),
        givens: encodeGrid(session.board.givens),
        entries: encodeGrid(session.board.entries),
        notes: encodeNotes(session.board.notes),
      },
      session.size,
    );
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.constraints).toEqual([...session.constraints]);
    expect(decoded?.board).toEqual(session.board);
  });

  it('ships boards that are legal Futoshiki in the first place', () => {
    for (const level of [1, 16, 46, 81, 100]) {
      const session = createLevelSession(level);
      expect(
        isSolved([...session.solution], session.size, session.constraints),
        `level ${level}`,
      ).toBe(true);
    }
    const daily = createDailySession('2026-08-01');
    expect(isSolved([...daily.solution], daily.size, daily.constraints)).toBe(true);
  });
});
