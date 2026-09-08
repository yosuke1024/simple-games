/**
 * Golden puzzles: level 1, the first level of the 10×10 band, and one daily,
 * pinned exactly.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must see the same picture — and the clear times
 * kept per level and per date (`ng.progress`: `bestSeconds`, `dailySeconds`)
 * only mean something if the puzzles behind them still exist. A suspended
 * board is stored as its solution and the player's marks (storage/schemas.ts),
 * so a generator that draws a different picture does not corrupt the save; it
 * quietly hands back clues for a puzzle nobody was solving.
 *
 * Any change to the rng, to the draw order, to the candidate-rejection loop of
 * §5 or to the fill rates of §6 will move these boards, which is the point:
 * it costs players their recorded times, so it has to be a decision rather
 * than a side effect. The level table itself is pinned in levels.test.ts —
 * this file pins what that table actually generates.
 *
 * This pins released behaviour — the values are v1.2.2's, whose `game/` tree
 * is byte-identical to this one. Do not edit these strings to go green. If a
 * change is intended, regenerate them and say so in the commit message, along
 * with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { encodeCells } from './serialize';
import { createDailySession, createLevelSession } from './session';

/** One row per string, '1' painted — a failure prints the picture. */
function rowsOf(cells: readonly number[], size: number): string[] {
  const text = encodeCells(cells);
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

describe('puzzles that must never change', () => {
  it('level 1 is unchanged', () => {
    const session = createLevelSession(1);
    expect(session.size).toBe(5);
    expect(session.seed).toBe('nono-level-1');
    //   # . # # #
    //   . . # # #
    //   # # # . .
    //   . . . . #
    //   # . # # .
    expect(rowsOf(session.solution, session.size)).toEqual([
      '10111',
      '00111',
      '11100',
      '00001',
      '10110',
    ]);
    // The clues are the puzzle as the player reads it: the solution alone
    // could change shape without either list moving.
    expect(session.clues.rows).toEqual([[1, 3], [3], [3], [1], [1, 2]]);
    expect(session.clues.cols).toEqual([[1, 1, 1], [1], [3, 1], [2, 1], [2, 1]]);
  });

  it('level 21, the first 10×10, is unchanged', () => {
    // The board size steps up here (§6). A level either side of the boundary
    // is the likeliest thing a change to the band table moves.
    const session = createLevelSession(21);
    expect(session.size).toBe(10);
    expect(rowsOf(session.solution, session.size)).toEqual([
      '1100111010',
      '1010100111',
      '1111000111',
      '0000101110',
      '0001001101',
      '1000101110',
      '1111001001',
      '1111001010',
      '0001010001',
      '1100110101',
    ]);
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(10);
    expect(session.seed).toBe('nono-daily-2026-08-01');
    expect(rowsOf(session.solution, session.size)).toEqual([
      '0000110111',
      '1110100101',
      '0011110110',
      '0001110100',
      '0010101110',
      '1010000001',
      '0100101101',
      '1010001110',
      '0110110001',
      '1111001011',
    ]);
  });
});
