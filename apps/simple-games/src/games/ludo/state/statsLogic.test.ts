/**
 * The statistics transitions, and the three rules that are easy to get wrong:
 * a match counts as played the moment it starts (so walking away from one is
 * not a loss), a match stopped by the roll cap books no result at all, and
 * there is no draw column because a Ludo match cannot end in one.
 */
import { describe, expect, it } from 'vitest';
import { statsSchema, type Stats } from '../storage/schemas';
import { applyGameStart, applyMatchEnd, applyPlayTime } from './statsLogic';

const fresh = (): Stats => statsSchema.defaultValue();
const frozen = (stats: Stats): unknown => JSON.parse(JSON.stringify(stats));

describe('a match that is started', () => {
  it('counts as played, and as nothing else yet', () => {
    const stats = applyGameStart(fresh(), 'normal');
    expect(stats.normal).toEqual({ played: 1, wins: 0, losses: 0 });
    expect(stats.easy.played).toBe(0);
    expect(stats.hard.played).toBe(0);
  });

  it('books against the strength it was started against', () => {
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
    expect(stats.hard).toEqual({ played: 1, wins: 1, losses: 0 });
  });

  it('books a loss against that strength', () => {
    const stats = applyMatchEnd(applyGameStart(fresh(), 'easy'), 'easy', 'lost');
    expect(stats.easy).toEqual({ played: 1, wins: 0, losses: 1 });
  });

  it('books nothing while it is still being played', () => {
    const started = applyGameStart(fresh(), 'normal');
    expect(applyMatchEnd(started, 'normal', 'playing')).toBe(started);
  });

  it('books nothing at all for a no-contest', () => {
    // The roll cap stops a match with nobody home (docs/LUDO_RULES.md §2.7).
    // It is not a win, not a loss, and not a draw — the rules produce no draw
    // — so the only column it touches is the one it already touched when it
    // started: played.
    const started = applyGameStart(fresh(), 'normal');
    const ended = applyMatchEnd(started, 'normal', 'noContest');
    expect(ended).toBe(started);
    expect(ended.normal).toEqual({ played: 1, wins: 0, losses: 0 });
  });

  it('has no draw column to book into', () => {
    // A Ludo match ends the instant one seat gets four pawns home (§2.8), so
    // two seats level for first is unreachable rather than merely rare.
    expect(Object.keys(fresh().normal).sort()).toEqual(['losses', 'played', 'wins']);
  });
});

describe('a match that is walked away from', () => {
  it('stays played and is never counted as lost', () => {
    // Started, abandoned for a second one, and that one lost. Two played, one
    // loss — the record is what you did, not a scold for stopping.
    let stats = applyGameStart(fresh(), 'normal');
    stats = applyGameStart(stats, 'normal');
    stats = applyMatchEnd(stats, 'normal', 'lost');
    expect(stats.normal).toEqual({ played: 2, wins: 0, losses: 1 });
  });

  it('keeps results from ever exceeding what was played', () => {
    let stats = fresh();
    for (const status of ['won', 'lost', 'noContest', 'won'] as const) {
      stats = applyMatchEnd(applyGameStart(stats, 'hard'), 'hard', status);
    }
    const { played, wins, losses } = stats.hard;
    expect(played).toBe(4);
    // Three results out of four matches: the no-contest is the difference the
    // rules said would exist (§9).
    expect(wins + losses).toBe(3);
    expect(wins + losses).toBeLessThanOrEqual(played);
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
