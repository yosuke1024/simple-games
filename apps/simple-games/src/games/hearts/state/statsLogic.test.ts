/**
 * The statistics transitions, and the two rules that are easy to get wrong: a
 * match counts as played the moment it is dealt (so walking away from one is
 * not a loss), and a draw is a real result — four seats make a tie for the
 * lowest score ordinary, and a match the player shares it in is neither a win
 * nor a loss.
 */
import { describe, expect, it } from 'vitest';
import { statsSchema, type Stats } from '../storage/schemas';
import { applyGameStart, applyMatchEnd, applyPlayTime } from './statsLogic';

const fresh = (): Stats => statsSchema.defaultValue();
const frozen = (stats: Stats): unknown => JSON.parse(JSON.stringify(stats));

describe('a match that is dealt', () => {
  it('counts as played, and as nothing else yet', () => {
    const stats = applyGameStart(fresh(), 'normal');
    expect(stats.normal).toEqual({ played: 1, wins: 0, losses: 0, draws: 0 });
    expect(stats.easy.played).toBe(0);
    expect(stats.hard.played).toBe(0);
  });

  it('books against the strength it was dealt against', () => {
    let stats = applyGameStart(fresh(), 'easy');
    stats = applyGameStart(stats, 'hard');
    stats = applyGameStart(stats, 'hard');
    expect(stats.easy.played).toBe(1);
    expect(stats.hard.played).toBe(2);
    expect(stats.normal.played).toBe(0);
  });

  it('never mutates the record it was given', () => {
    const stats = fresh();
    const before = frozen(stats);
    applyGameStart(stats, 'normal');
    expect(stats).toEqual(before);
  });
});

describe('a match that ends', () => {
  it('books a win against that strength', () => {
    const stats = applyMatchEnd(applyGameStart(fresh(), 'hard'), 'hard', 'won');
    expect(stats.hard).toEqual({ played: 1, wins: 1, losses: 0, draws: 0 });
  });

  it('books a loss against that strength', () => {
    const stats = applyMatchEnd(applyGameStart(fresh(), 'easy'), 'easy', 'lost');
    expect(stats.easy).toEqual({ played: 1, wins: 0, losses: 1, draws: 0 });
  });

  it('books a draw when the player shares the lowest score', () => {
    // Not rounded up into a win and not down into a loss: nobody at the table
    // was below you, and somebody was level with you. That is its own result.
    const stats = applyMatchEnd(applyGameStart(fresh(), 'normal'), 'normal', 'draw');
    expect(stats.normal).toEqual({ played: 1, wins: 0, losses: 0, draws: 1 });
  });

  it('books nothing while it is still being played', () => {
    const started = applyGameStart(fresh(), 'normal');
    expect(applyMatchEnd(started, 'normal', 'playing')).toBe(started);
  });
});

describe('a match that is walked away from', () => {
  it('stays played and is never counted as lost', () => {
    // Dealt, abandoned for a second one, and that one lost. Two played, one
    // loss — the record is what you did, not a scold for stopping.
    let stats = applyGameStart(fresh(), 'normal');
    stats = applyGameStart(stats, 'normal');
    stats = applyMatchEnd(stats, 'normal', 'lost');
    expect(stats.normal).toEqual({ played: 2, wins: 0, losses: 1, draws: 0 });
  });

  it('keeps results from ever exceeding what was played', () => {
    let stats = fresh();
    for (const status of ['won', 'lost', 'draw', 'won'] as const) {
      stats = applyMatchEnd(applyGameStart(stats, 'hard'), 'hard', status);
    }
    const { played, wins, losses, draws } = stats.hard;
    expect(played).toBe(4);
    expect(wins + losses + draws).toBe(played);
  });
});

describe('play time', () => {
  it('is kept once for the whole game, not per strength', () => {
    const stats = applyPlayTime(applyPlayTime(fresh(), 90), 30);
    expect(stats.totalPlaySeconds).toBe(120);
    expect(stats.normal).not.toHaveProperty('totalPlaySeconds');
  });

  it('books nothing for zero or negative seconds', () => {
    const stats = fresh();
    expect(applyPlayTime(stats, 0)).toBe(stats);
    expect(applyPlayTime(stats, -5)).toBe(stats);
  });

  it('never mutates the record it was given', () => {
    const stats = fresh();
    const before = frozen(stats);
    applyPlayTime(stats, 42);
    expect(stats).toEqual(before);
  });
});
