/**
 * The statistics and the per-figure record (docs/TANGRAM_RULES.md §6, §7):
 * plays counted at the start, time booked once per bucket, completions per
 * tier with the figure's fastest time, the daily in a row of its own with a
 * set of dates — and nothing that is a streak, a score or "n of N".
 */
import { describe, expect, it } from 'vitest';
import { figuresOf, nextFigure } from '../game';
import { progressSchema, statsSchema } from '../storage/schemas';
import {
  applyCompletion,
  applyGameStart,
  applyLastStarted,
  applyPlayTime,
  bucketOf,
  dailiesCompleted,
  isSolvedIn,
  solvedFiguresOf,
  totalPlaySeconds,
} from './statsLogic';

const fresh = () => statsSchema.defaultValue();
const noProgress = () => progressSchema.defaultValue();

describe('starts and time (§7)', () => {
  it('counts a start in its tier, or in the daily’s own row — never Medium for a daily', () => {
    let stats = applyGameStart(fresh(), bucketOf('free', 'medium'));
    stats = applyGameStart(stats, bucketOf('daily', 'medium'));
    expect(stats.medium.played).toBe(1);
    expect(stats.daily.played).toBe(1);
    expect(stats.easy.played).toBe(0);
  });

  it('books whole seconds, and nothing for nothing', () => {
    const before = fresh();
    expect(applyPlayTime(before, 'easy', 0)).toBe(before);
    expect(applyPlayTime(before, 'easy', -3)).toBe(before);
    expect(applyPlayTime(before, 'easy', Number.NaN)).toBe(before);
    const after = applyPlayTime(applyPlayTime(before, 'easy', 10.9), 'daily', 5);
    expect(after.easy.totalPlaySeconds).toBe(10);
    expect(after.daily.totalPlaySeconds).toBe(5);
    expect(totalPlaySeconds(after)).toBe(15);
    // The input is never changed.
    expect(before.easy.totalPlaySeconds).toBe(0);
  });
});

describe('completions (§7)', () => {
  const done = (seconds: number, figure = 'square') => ({
    mode: 'free' as const,
    tier: 'easy' as const,
    figure,
    dailyDate: null,
    seconds,
  });

  it('records a first completion without a delta, then measures against the fastest', () => {
    const first = applyCompletion(fresh(), noProgress(), done(95));
    expect(first.previous).toBeNull();
    expect(first.stats.easy.solved).toBe(1);
    expect(first.progress.best).toEqual({ square: 95 });

    const slower = applyCompletion(first.stats, first.progress, done(120));
    expect(slower.previous).toBe(95);
    expect(slower.progress.best.square).toBe(95);
    // The same figure completed twice counts twice (§7).
    expect(slower.stats.easy.solved).toBe(2);

    const faster = applyCompletion(slower.stats, slower.progress, done(80));
    expect(faster.previous).toBe(95);
    expect(faster.progress.best.square).toBe(80);
  });

  it('keeps the daily out of the per-figure record and the tier rows', () => {
    const daily = {
      mode: 'daily' as const,
      tier: 'medium' as const,
      figure: 'corner',
      dailyDate: '2026-10-21',
      seconds: 185,
    };
    const first = applyCompletion(fresh(), noProgress(), daily);
    expect(first.previous).toBeNull();
    expect(first.stats.dailyTimes).toEqual({ '2026-10-21': 185 });
    expect(first.stats.medium.solved).toBe(0);
    expect(first.progress).toEqual(noProgress());
    const again = applyCompletion(first.stats, first.progress, { ...daily, seconds: 150 });
    expect(again.previous).toBe(185);
    expect(again.stats.dailyTimes['2026-10-21']).toBe(150);
    expect(dailiesCompleted(again.stats)).toBe(1);
  });

  it('counts different figures per tier as a number, not against the whole list', () => {
    let progress = noProgress();
    for (const id of ['square', 'triangle', 'corner']) {
      progress = { ...progress, best: { ...progress.best, [id]: 60 } };
    }
    expect(solvedFiguresOf(progress, 'easy')).toBe(2);
    expect(solvedFiguresOf(progress, 'medium')).toBe(1);
    expect(solvedFiguresOf(progress, 'hard')).toBe(0);
  });
});

describe('the next figure reads the record (§6)', () => {
  it('moves a tier’s place only through Free Play starts, and skips solved figures', () => {
    const easy = figuresOf('easy');
    let progress = applyLastStarted(noProgress(), 'easy', easy[0]!.id);
    expect(applyLastStarted(progress, 'easy', easy[0]!.id)).toBe(progress);
    progress = { ...progress, best: { [easy[1]!.id]: 30 } };
    const next = nextFigure('easy', progress.last.easy, isSolvedIn(progress));
    expect(next).toBe(easy[2]);
  });
});
