/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must see the same puzzle — and a personal best only
 * means something if the board it was set on still exists. Any change to the
 * rng, to which cells become clue cells, to the fill, to the tightening search
 * or to the technique set that decides a board will fail here, which is the
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
import { decodeGame, encodeGrid, encodeLayout, encodeNotes } from './serialize';
import { createDailySession, createLevelSession, doPlace, doToggleNote } from './session';
import { EMPTY, type Digit } from './types';

describe('golden puzzles (v1)', () => {
  it('level 1 — the first 6×6 — is unchanged', () => {
    const session = createLevelSession(1);
    expect(session.size).toBe(6);
    expect(encodeLayout(session.layout)).toBe(
      '######' + '######' + '#..###' + '#.....' + '###...' + '###...',
    );
    expect(encodeGrid([...session.solution])).toBe(
      '......' + '......' + '.24...' + '.16982' + '...631' + '...869',
    );
    // The clues are the whole of the puzzle (§1), so they are pinned too —
    // recomputed from the two strings above, never stored beside them (§11).
    expect(session.table.runs.map((run) => run.sum)).toEqual([6, 26, 10, 23, 3, 10, 23, 17, 12]);
  });

  it('level 21 — the first 8×8 — is unchanged', () => {
    const session = createLevelSession(21);
    expect(session.size).toBe(8);
    expect(encodeLayout(session.layout)).toBe(
      '########' +
        '########' +
        '######..' +
        '####....' +
        '#.....##' +
        '#...#..#' +
        '#####..#' +
        '#####..#',
    );
    expect(encodeGrid([...session.solution])).toBe(
      '........' +
        '........' +
        '......17' +
        '....1326' +
        '.59867..' +
        '.135.98.' +
        '.....17.' +
        '.....29.',
    );
  });

  it('level 66 — the first 10×10 — is unchanged', () => {
    const session = createLevelSession(66);
    expect(session.size).toBe(10);
    expect(encodeLayout(session.layout)).toBe(
      '##########' +
        '##########' +
        '#####..###' +
        '##..#...##' +
        '##....#..#' +
        '###...#...' +
        '##..####..' +
        '##..######' +
        '##########' +
        '##########',
    );
    expect(encodeGrid([...session.solution])).toBe(
      '..........' +
        '..........' +
        '.....63...' +
        '..98.968..' +
        '..3125.24.' +
        '...597.132' +
        '..13....97' +
        '..59......' +
        '..........' +
        '..........',
    );
  });

  it('level 100 — the end of the list — is unchanged', () => {
    const session = createLevelSession(100);
    expect(encodeLayout(session.layout)).toBe(
      '##########' +
        '##..###..#' +
        '#...##...#' +
        '#......###' +
        '####...###' +
        '######..##' +
        '#####....#' +
        '###...##..' +
        '###...##..' +
        '####..####',
    );
    expect(encodeGrid([...session.solution])).toBe(
      '..........' +
        '..71...48.' +
        '.162..769.' +
        '.498312...' +
        '....936...' +
        '......12..' +
        '.....7389.' +
        '...521..21' +
        '...846..63' +
        '....13....',
    );
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(8);
    expect(encodeLayout(session.layout)).toBe(
      '########' +
        '#...##..' +
        '#.......' +
        '##......' +
        '####..##' +
        '####..##' +
        '########' +
        '########',
    );
    expect(encodeGrid([...session.solution])).toBe(
      '........' +
        '.163..13' +
        '.4967835' +
        '..819524' +
        '....86..' +
        '....41..' +
        '........' +
        '........',
    );
  });

  /**
   * The one number a level hands over is the difficulty curve of §9 made
   * concrete: how many cells the player has to fill. Pinned per band end
   * because a table that drifts is a table that stopped describing the game.
   * The counts are what the layouts actually reached, which is at or just
   * inside what the band asked for — the target is a target (§8).
   */
  it('hands over the number of cells its band promises', () => {
    const white = (level: number): number => createLevelSession(level).table.white.length;
    expect([white(1), white(20)]).toEqual([13, 17]);
    expect([white(21), white(65)]).toEqual([20, 25]);
    expect([white(66), white(100)]).toEqual([25, 37]);
  });
});

/**
 * The save format of §11, v1: four strings — the layout, the answer, the
 * player's digits and the notes — plus the counters. **The clues are not among
 * them**, and that is the format's one real decision: they are the sum of each
 * run, so layout plus answer already holds them, and a second copy is a second
 * thing that can rot. Nothing here reads a clue from a record, so nothing can
 * drift between what was written and what is read back.
 */
describe('the saved game format (v1)', () => {
  it('writes the four strings a save holds', () => {
    let session = createLevelSession(1);
    session = doPlace(session, 13, session.solution[13] as Digit)!;
    session = doToggleNote(session, 14, 2)!;

    expect(encodeLayout(session.layout)).toBe(
      '######' + '######' + '#..###' + '#.....' + '###...' + '###...',
    );
    expect(encodeGrid([...session.board.entries])).toBe(
      '......' + '......' + '.2....' + '......' + '......' + '......',
    );
    expect(encodeNotes([...session.board.notes])).toBe(
      '0,'.repeat(14) + '2,' + '0,'.repeat(20) + '0',
    );
    expect(session.mistakeCount).toBe(0);
    expect(session.hintCount).toBe(0);
  });

  it('reads back exactly what it wrote, clues and all', () => {
    const session = doPlace(createLevelSession(1), 13, 2)!;
    const decoded = decodeGame(
      {
        layout: encodeLayout(session.layout),
        solution: encodeGrid([...session.solution]),
        entries: encodeGrid([...session.board.entries]),
        notes: encodeNotes([...session.board.notes]),
      },
      session.size,
    );
    expect(decoded?.layout).toEqual(session.layout);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.board).toEqual(session.board);
    expect(decoded?.table.runs).toEqual([...session.table.runs]);
  });

  it('ships boards that are legal Kakuro in the first place', () => {
    for (const level of [1, 21, 66, 100]) {
      const session = createLevelSession(level);
      expect(isSolved([...session.solution], session.table), `level ${level}`).toBe(true);
      expect(session.board.entries.every((entry) => entry === EMPTY)).toBe(true);
    }
    const daily = createDailySession('2026-08-01');
    expect(isSolved([...daily.solution], daily.table)).toBe(true);
  });
});
