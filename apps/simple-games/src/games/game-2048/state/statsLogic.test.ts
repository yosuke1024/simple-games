/**
 * The records of docs/GAME_2048_RULES.md §4 and §8: what is kept per mode, what
 * a daily keeps per day, and what "the score to beat" means. Nothing here
 * counts consecutive days, and booking the same run twice changes nothing —
 * that is what lets a run be booked when it ends or when it is replaced.
 */
import { describe, expect, it } from 'vitest';
import { createClassicSession, createDailySession, type Game2048Session } from '../game';
import { progressSchema, statsSchema } from '../storage/schemas';
import {
  applyGameStart,
  applyPlayTime,
  applyRunRecords,
  applyRunToProgress,
  applyWin,
  bestScoreFor,
  dailiesPlayedCount,
} from './statsLogic';

const run = (session: Game2048Session, score: number, board?: readonly number[]) => ({
  ...session,
  score,
  board: board ?? session.board,
});

const bigBoard = [2048, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

describe('per-mode statistics (§8)', () => {
  it('counts a started game against its own mode only', () => {
    const stats = applyGameStart(statsSchema.defaultValue(), 'classic');
    expect(stats.classic.played).toBe(1);
    expect(stats.daily.played).toBe(0);
    expect(applyGameStart(stats, 'daily').daily.played).toBe(1);
  });

  it('keeps the best score and the highest tile, and never lowers either', () => {
    const session = createClassicSession('records');
    let stats = applyRunRecords(statsSchema.defaultValue(), run(session, 5000, bigBoard));
    expect(stats.classic.bestScore).toBe(5000);
    expect(stats.classic.bestTile).toBe(2048);

    // A worse run leaves the records alone — and does not even copy them.
    const after = applyRunRecords(stats, run(session, 100));
    expect(after).toBe(stats);
    expect(after.classic.bestScore).toBe(5000);
    expect(after.classic.bestTile).toBe(2048);

    // Booking the same run again is a no-op, which is what makes it safe to
    // book a run both when it ends and when it is replaced.
    expect(applyRunRecords(stats, run(session, 5000, bigBoard))).toBe(stats);

    stats = applyRunRecords(stats, run(session, 9000, bigBoard));
    expect(stats.classic.bestScore).toBe(9000);
  });

  it('counts each 2048 once, and books only play time it has been given', () => {
    const stats = applyWin(statsSchema.defaultValue(), 'daily');
    expect(stats.daily.wins).toBe(1);
    expect(stats.classic.wins).toBe(0);

    expect(applyPlayTime(stats, 'daily', 0)).toBe(stats);
    expect(applyPlayTime(stats, 'daily', -5)).toBe(stats);
    expect(applyPlayTime(stats, 'daily', 30).daily.totalPlaySeconds).toBe(30);
  });

  it('has nowhere to put a streak', () => {
    const bucket = statsSchema.defaultValue().classic;
    expect(Object.keys(bucket).sort()).toEqual([
      'bestScore',
      'bestTile',
      'played',
      'totalPlaySeconds',
      'wins',
    ]);
  });
});

describe("a daily's record (§6)", () => {
  it('keeps the best score for the day, and improves on a replay', () => {
    const session = createDailySession('2026-08-03');
    const first = applyRunToProgress(progressSchema.defaultValue(), run(session, 1200));
    expect(first.isNewBest).toBe(true);
    expect(first.progress.dailyScores['2026-08-03']).toBe(1200);

    const worse = applyRunToProgress(first.progress, run(session, 900));
    expect(worse.isNewBest).toBe(false);
    expect(worse.bestScore).toBe(1200);
    expect(worse.progress).toBe(first.progress);

    const better = applyRunToProgress(first.progress, run(session, 3000));
    expect(better.isNewBest).toBe(true);
    expect(better.progress.dailyScores['2026-08-03']).toBe(3000);
    expect(dailiesPlayedCount(better.progress)).toBe(1);
  });

  it('keeps no calendar for classic', () => {
    const outcome = applyRunToProgress(
      progressSchema.defaultValue(),
      run(createClassicSession('no-calendar'), 4000),
    );
    expect(outcome.progress.dailyScores).toEqual({});
    expect(outcome.isNewBest).toBe(false);
    expect(dailiesPlayedCount(outcome.progress)).toBe(0);
  });
});

describe('the score to beat (§4)', () => {
  it('is every classic game before this one, or this same day', () => {
    const stats = applyRunRecords(
      statsSchema.defaultValue(),
      run(createClassicSession('to-beat'), 7000),
    );
    const progress = applyRunToProgress(
      progressSchema.defaultValue(),
      run(createDailySession('2026-08-03'), 1500),
    ).progress;

    expect(bestScoreFor(stats, progress, 'classic', null)).toBe(7000);
    expect(bestScoreFor(stats, progress, 'daily', '2026-08-03')).toBe(1500);
    // A day never played has nothing to beat — and borrows nobody else's.
    expect(bestScoreFor(stats, progress, 'daily', '2026-08-04')).toBe(0);
    expect(bestScoreFor(stats, progress, 'daily', null)).toBe(0);
  });
});
