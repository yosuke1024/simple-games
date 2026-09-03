/**
 * The statistics transitions, and in particular the one rule that is easy to
 * get wrong: every record is kept per difficulty (§7, §9) — including the
 * daily's — while the *count* of dailies won is kept per day (§6).
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createFreeSession, type SpiderSession, type SuitCount } from '../game';
import { statsSchema } from '../storage/schemas';
import {
  applyGameStart,
  applyWon,
  dailyResultFor,
  previousBestsFor,
  statsFor,
  wonDailyCount,
} from './statsLogic';

const won = (session: SpiderSession, moves: number, seconds: number): SpiderSession => ({
  ...session,
  status: 'won',
  moveCount: moves,
  elapsedSeconds: seconds,
});

const daily = (date: string, suitCount: SuitCount, moves: number, seconds: number): SpiderSession =>
  won(createDailySession(date, suitCount), moves, seconds);

describe('applyWon — per-difficulty records', () => {
  it('does not let a one-suit daily become the record a four-suit daily is judged against', () => {
    // The bug this test exists for: both wins are on the same date, so a
    // record keyed by date alone would compare 150 moves at four suits with
    // 100 at one and call the harder game a failure.
    let stats = statsSchema.defaultValue();
    stats = applyWon(stats, daily('2026-08-07', 1, 100, 600)).stats;

    const outcome = applyWon(stats, daily('2026-08-07', 4, 150, 900));

    expect(outcome.isNewBestMoves).toBe(true);
    expect(outcome.isNewBestTime).toBe(true);
    expect(outcome.bestMoves).toBe(150);
    expect(outcome.bestSeconds).toBe(900);
    expect(dailyResultFor(outcome.stats, '2026-08-07', 1)).toEqual({ moves: 100, seconds: 600 });
    expect(dailyResultFor(outcome.stats, '2026-08-07', 4)).toEqual({ moves: 150, seconds: 900 });
  });

  it('compares a retry against that difficulty’s own record for the day', () => {
    let stats = statsSchema.defaultValue();
    stats = applyWon(stats, daily('2026-08-07', 1, 100, 600)).stats;
    stats = applyWon(stats, daily('2026-08-07', 4, 150, 900)).stats;

    const better = applyWon(stats, daily('2026-08-07', 1, 90, 700));
    expect(better.isNewBestMoves).toBe(true);
    expect(better.isNewBestTime).toBe(false);
    expect(better.bestMoves).toBe(90);
    // The slower time did not replace the faster one, and four suits is untouched.
    expect(better.bestSeconds).toBe(600);
    expect(dailyResultFor(better.stats, '2026-08-07', 4)).toEqual({ moves: 150, seconds: 900 });
  });

  it('keeps the worse run from overwriting either best', () => {
    let stats = statsSchema.defaultValue();
    stats = applyWon(stats, daily('2026-08-07', 2, 100, 600)).stats;

    const worse = applyWon(stats, daily('2026-08-07', 2, 120, 700));
    expect(worse.isNewBestMoves).toBe(false);
    expect(worse.isNewBestTime).toBe(false);
    expect(dailyResultFor(worse.stats, '2026-08-07', 2)).toEqual({ moves: 100, seconds: 600 });
  });

  it('counts a day once however many difficulties it was won at (§6)', () => {
    let stats = statsSchema.defaultValue();
    stats = applyWon(stats, daily('2026-08-07', 1, 100, 600)).stats;
    expect(wonDailyCount(stats)).toBe(1);

    stats = applyWon(stats, daily('2026-08-07', 2, 110, 650)).stats;
    stats = applyWon(stats, daily('2026-08-07', 4, 150, 900)).stats;
    expect(wonDailyCount(stats)).toBe(1);

    stats = applyWon(stats, daily('2026-08-08', 4, 140, 800)).stats;
    expect(wonDailyCount(stats)).toBe(2);
  });

  it('leaves the day unrecorded for a free deal', () => {
    const outcome = applyWon(statsSchema.defaultValue(), won(createFreeSession(1), 100, 600));
    expect(wonDailyCount(outcome.stats)).toBe(0);
    expect(statsFor(outcome.stats, 1).won).toBe(1);
    // A free win still compares against that difficulty's lifetime best.
    expect(outcome.bestMoves).toBe(100);
  });

  it('splits the lifetime rows by difficulty too, and does not mutate its input', () => {
    let stats = statsSchema.defaultValue();
    stats = applyGameStart(stats, 1);
    stats = applyGameStart(stats, 4);
    const before = JSON.parse(JSON.stringify(stats)) as unknown;

    const outcome = applyWon(stats, daily('2026-08-07', 1, 100, 600));
    expect(statsFor(outcome.stats, 1).won).toBe(1);
    expect(statsFor(outcome.stats, 4).won).toBe(0);
    expect(statsFor(outcome.stats, 4).bestMoves).toBeNull();
    expect(stats).toEqual(before);
  });

  it('reports no record for a difficulty that has not won that day', () => {
    const outcome = applyWon(statsSchema.defaultValue(), daily('2026-08-07', 1, 100, 600));
    expect(dailyResultFor(outcome.stats, '2026-08-07', 4)).toBeNull();
    expect(dailyResultFor(outcome.stats, '2026-08-06', 1)).toBeNull();
  });
});

describe('previousBestsFor — the record a run is measured against (§9)', () => {
  it('reads that difficulty’s record for the day, and nothing where there is none', () => {
    let stats = statsSchema.defaultValue();
    stats = applyWon(stats, daily('2026-08-07', 1, 100, 600)).stats;

    expect(previousBestsFor(stats, daily('2026-08-07', 1, 90, 700))).toEqual({
      moves: 100,
      seconds: 600,
    });
    // The same day at four suits is a different record, and there is none yet.
    expect(previousBestsFor(stats, daily('2026-08-07', 4, 90, 700))).toEqual({
      moves: null,
      seconds: null,
    });
  });

  it('reads the lifetime row for a free deal', () => {
    let stats = statsSchema.defaultValue();
    const free = (suitCount: SuitCount) => won(createFreeSession(suitCount), 120, 500);
    expect(previousBestsFor(stats, free(2))).toEqual({ moves: null, seconds: null });

    stats = applyWon(stats, won(createFreeSession(2), 100, 600)).stats;
    expect(previousBestsFor(stats, free(2))).toEqual({ moves: 100, seconds: 600 });
    expect(previousBestsFor(stats, free(4))).toEqual({ moves: null, seconds: null });
  });
});
