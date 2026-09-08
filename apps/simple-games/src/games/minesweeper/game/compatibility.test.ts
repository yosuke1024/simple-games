/**
 * Golden boards: one daily and one difficulty seed, pinned exactly.
 *
 * A daily is a promise. Everybody who opens 2026-08-01 gets the same field,
 * and the best time stored against that date (`ms.stats.dailyTimes`) only
 * means something if the field it was set on still exists. The same goes for a
 * board a player is in the middle of: a suspended game is restored from the
 * mine layout it was saved with (storage/schemas.ts), so a generator that
 * moves the mines does not corrupt the save — it silently hands back a board
 * nobody was playing.
 *
 * The mines do not exist until the first tap names a cell (§4), so a golden
 * here is a (seed, first tap) pair rather than a seed alone. Any change to the
 * rng, to the sampling order, to the derived-seed retry loop (§5) or to the
 * preset table will fail here, which is the point: it costs players their
 * recorded times, so it has to be a decision rather than a side effect.
 *
 * This pins released behaviour — the values are v1.2.2's, whose `game/` tree
 * is byte-identical to this one. Do not edit these strings to go green. If a
 * change is intended, regenerate them and say so in the commit message, along
 * with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { encodeBoard } from './serialize';
import { createDailySession, createDifficultySession, tapCell } from './session';
import { PRESETS } from './types';

/** One bit string per row, so a failure prints a board rather than a wall. */
function rowsOf(bits: string, width: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < bits.length; i += width) out.push(bits.slice(i, i + width));
  return out;
}

const countMines = (rows: readonly string[]): number =>
  rows.reduce((total, row) => total + [...row].filter((bit) => bit === '1').length, 0);

describe('boards that must never change', () => {
  it('the daily for 2026-08-01, opened at the centre, is unchanged', () => {
    const session = tapCell(createDailySession('2026-08-01'), 40);
    expect(session).not.toBeNull();
    expect(session!.difficulty).toBe('medium');
    expect(session!.seed).toBe('mines-daily-2026-08-01');

    const encoded = encodeBoard(session!.board);
    const rows = rowsOf(encoded.mines, encoded.width);
    expect(rows).toEqual([
      '000001000010',
      '000000000000',
      '010000000001',
      '100000000100',
      '000000100100',
      '000100000100',
      '000000001000',
      '011001010100',
      '010100000010',
      '000001000100',
      '100000010000',
      '000100001000',
    ]);
    expect(countMines(rows)).toBe(PRESETS.medium.mines);
  });

  it('the same daily opens the same region', () => {
    // The opening the first tap gives is the board the player actually sees,
    // and it is what the solver of §5 worked from when this layout was
    // accepted. A reveal that flood-fills differently changes the puzzle even
    // when every mine stays where it is.
    const session = tapCell(createDailySession('2026-08-01'), 40)!;
    const encoded = encodeBoard(session.board);
    expect(rowsOf(encoded.opened, encoded.width)).toEqual([
      '111110111100',
      '111111111100',
      '001111111100',
      '001111111000',
      '001111000000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000',
    ]);
  });

  it('a difficulty seed rebuilds the same board', () => {
    // Difficulty mode has no levels and no dates, but the seed still pins the
    // board completely — that is what makes "the same board again" free (§2)
    // and what lets a suspended game come back.
    const session = tapCell(createDifficultySession('easy', 'mines-easy-golden'), 40);
    expect(session).not.toBeNull();

    const encoded = encodeBoard(session!.board);
    const rows = rowsOf(encoded.mines, encoded.width);
    expect(rows).toEqual([
      '010000000',
      '000010000',
      '000101000',
      '000000000',
      '110000000',
      '001000000',
      '010000000',
      '001000000',
      '000000100',
    ]);
    expect(countMines(rows)).toBe(PRESETS.easy.mines);
  });

  it('the preset table is unchanged', () => {
    // Named here as well as in types.ts: a saved board is decoded against the
    // shape its difficulty promises (serialize.ts), so changing one of these
    // numbers does not migrate a saved game — it discards every one of them.
    expect(PRESETS).toEqual({
      easy: { width: 9, height: 9, mines: 10 },
      medium: { width: 12, height: 12, mines: 25 },
      hard: { width: 14, height: 18, mines: 50 },
    });
  });
});
