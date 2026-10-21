/**
 * The statistics transitions (docs/NESTED_TIC_TAC_TOE_RULES.md §7): played
 * when a match starts, a result only when one ends, play time only forwards,
 * and nothing that could become a streak.
 */
import { describe, expect, it } from 'vitest';
import { statsSchema } from '../storage/schemas';
import { applyGameStart, applyMatchEnd, applyPlayTime } from './statsLogic';

const fresh = () => statsSchema.defaultValue();

describe('statsLogic', () => {
  it('counts a start on its own difficulty only', () => {
    const next = applyGameStart(fresh(), 'normal');
    expect(next.normal.played).toBe(1);
    expect(next.easy.played).toBe(0);
    expect(next.hard.played).toBe(0);
  });

  it('books each outcome under its own name, and nothing while playing', () => {
    let stats = fresh();
    stats = applyMatchEnd(stats, 'hard', 'won');
    stats = applyMatchEnd(stats, 'hard', 'lost');
    stats = applyMatchEnd(stats, 'hard', 'draw');
    expect(stats.hard).toEqual({ played: 0, wins: 1, losses: 1, draws: 1 });
    expect(applyMatchEnd(stats, 'hard', 'playing')).toBe(stats);
  });

  it('adds play time forwards only, in whole seconds', () => {
    const stats = fresh();
    expect(applyPlayTime(stats, 0)).toBe(stats);
    expect(applyPlayTime(stats, -5)).toBe(stats);
    expect(applyPlayTime(stats, Number.NaN)).toBe(stats);
    expect(applyPlayTime(stats, 7).totalPlaySeconds).toBe(7);
  });

  it('never mutates the record it was given', () => {
    const stats = fresh();
    const snapshot = JSON.stringify(stats);
    applyGameStart(stats, 'easy');
    applyMatchEnd(stats, 'easy', 'won');
    applyPlayTime(stats, 3);
    expect(JSON.stringify(stats)).toBe(snapshot);
  });

  it('keeps every record a valid record', () => {
    const stats = applyPlayTime(applyMatchEnd(applyGameStart(fresh(), 'easy'), 'easy', 'won'), 9);
    expect(statsSchema.validate(stats)).toEqual(stats);
    // A record per opponent, and no field that counts days in a row.
    expect(Object.keys(stats).sort()).toEqual(
      ['easy', 'hard', 'normal', 'schemaVersion', 'totalPlaySeconds'].sort(),
    );
  });
});
