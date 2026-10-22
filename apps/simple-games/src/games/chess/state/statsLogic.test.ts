/**
 * The statistics transitions (docs/CHESS_RULES.md §7.3): a start counts as
 * played, only an ended game books a result, and nothing is ever a streak.
 */
import { describe, expect, it } from 'vitest';
import { statsSchema } from '../storage/schemas';
import { applyGameStart, applyMatchEnd, applyPlayTime } from './statsLogic';

describe('statistics (§7.3)', () => {
  it('counts a started game as played, per difficulty', () => {
    const next = applyGameStart(statsSchema.defaultValue(), 'hard');
    expect(next.hard.played).toBe(1);
    expect(next.easy.played).toBe(0);
  });

  it('books won, lost and drawn into their own counts, and nothing for a game still on', () => {
    let stats = statsSchema.defaultValue();
    stats = applyMatchEnd(stats, 'normal', 'won');
    stats = applyMatchEnd(stats, 'normal', 'lost');
    stats = applyMatchEnd(stats, 'normal', 'draw');
    expect(stats.normal).toEqual({ played: 0, wins: 1, losses: 1, draws: 1 });
    expect(applyMatchEnd(stats, 'normal', 'playing')).toBe(stats);
  });

  it('adds play time, and leaves the record alone for none', () => {
    const stats = statsSchema.defaultValue();
    expect(applyPlayTime(stats, 30).totalPlaySeconds).toBe(30);
    expect(applyPlayTime(stats, 0)).toBe(stats);
  });

  it('never changes the record it was given', () => {
    const stats = statsSchema.defaultValue();
    applyGameStart(stats, 'easy');
    applyMatchEnd(stats, 'easy', 'won');
    expect(stats).toEqual(statsSchema.defaultValue());
  });
});
