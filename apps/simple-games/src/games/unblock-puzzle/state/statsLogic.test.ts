/**
 * The statistics transitions (docs/UNBLOCK_PUZZLE_RULES.md §10): what a start,
 * a clock tick and a clear each add — and what they never add.
 */
import { describe, expect, it } from 'vitest';
import {
  createDailySession,
  createFreeSession,
  doSlide,
  legalSlides,
  moveCount,
  solve,
  withElapsedSeconds,
  type UnblockSession,
} from '../game';
import { statsSchema } from '../storage/schemas';
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  clearFactsOf,
  dailiesCleared,
  totalPlaySeconds,
} from './statsLogic';

/** Plays a board out along a shortest solution from wherever it stands. */
function finish(session: UnblockSession): UnblockSession {
  let current = session;
  const rest = solve(current.board, 6000);
  if (rest.status !== 'solved') throw new Error('a dealt board must solve');
  for (const move of rest.solution) current = doSlide(current, move.block, move.to)!;
  return current;
}

/**
 * A clear in exactly the fewest moves or, with `detour`, one that took more:
 * three moves first that take nothing anywhere (one block slid away, another
 * slid, the first slid back), kept only when the clear really ends above the
 * fewest — a following move can merge with or cancel the slide back (§4).
 */
function solvedSession(session: UnblockSession, seconds: number, detour = false): UnblockSession {
  if (!detour) return withElapsedSeconds(finish(session), seconds);
  for (const away of legalSlides(session.board)) {
    const first = doSlide(session, away.block, away.to)!;
    for (const other of legalSlides(first.board)) {
      if (other.block === away.block) continue;
      const second = doSlide(first, other.block, other.to)!;
      const back = doSlide(second, away.block, session.board.positions[away.block]!);
      if (back === null || back.status !== 'playing') continue;
      const done = finish(back);
      if (moveCount(done) > session.minMoves) return withElapsedSeconds(done, seconds);
    }
  }
  throw new Error('no detour on this board');
}

const free = createFreeSession('easy', 'unblock-puzzle-easy-stats');
const daily = createDailySession('2026-10-17');

describe('statistics transitions (§10)', () => {
  it('counts a start in the difficulty it was played at, the daily as medium', () => {
    let stats = applyGameStart(statsSchema.defaultValue(), 'easy');
    stats = applyGameStart(stats, daily.difficulty);
    expect(stats.easy.played).toBe(1);
    expect(stats.medium.played).toBe(1);
    expect(stats.hard.played).toBe(0);
  });

  it('books whole play seconds only, and nothing for nothing', () => {
    const base = statsSchema.defaultValue();
    expect(applyPlayTime(base, 'hard', 0)).toBe(base);
    expect(applyPlayTime(base, 'hard', -5)).toBe(base);
    expect(applyPlayTime(base, 'hard', Number.NaN)).toBe(base);
    expect(applyPlayTime(base, 'hard', 12.7).hard.totalPlaySeconds).toBe(12);
    expect(totalPlaySeconds(applyPlayTime(applyPlayTime(base, 'easy', 3), 'medium', 4))).toBe(7);
  });

  it('counts a clear, an exact clear, and the fastest time — and calls a first clear no record broken', () => {
    const exact = solvedSession(free, 40);
    expect(exact.status).toBe('solved');
    const first = applySolved(statsSchema.defaultValue(), exact);
    expect(first.optimal).toBe(true);
    expect(first.improved).toBe(false);
    expect(first.previous).toBeNull();
    expect(first.stats.easy).toMatchObject({ solved: 1, optimal: 1, bestSeconds: 40 });
    // Play time is not booked by the clear: it is booked as the clock runs.
    expect(first.stats.easy.totalPlaySeconds).toBe(0);

    const faster = applySolved(first.stats, solvedSession(free, 25));
    expect(faster.improved).toBe(true);
    expect(faster.previous).toBe(40);
    expect(faster.stats.easy.bestSeconds).toBe(25);

    const slower = applySolved(faster.stats, solvedSession(free, 90, true));
    expect(slower.improved).toBe(false);
    expect(slower.stats.easy.bestSeconds).toBe(25);
    expect(slower.stats.easy.solved).toBe(3);
  });

  it('counts a clear that took more than the fewest moves as a clear, not an exact one', () => {
    const long = solvedSession(free, 60, true);
    const facts = clearFactsOf(long);
    expect(facts.moves).toBeGreaterThan(facts.minMoves);
    const outcome = applySolved(statsSchema.defaultValue(), long);
    expect(outcome.optimal).toBe(false);
    expect(outcome.stats.easy).toMatchObject({ solved: 1, optimal: 0 });
  });

  it('keeps the fewest moves per cleared day for the daily, never a run of days', () => {
    const exact = solvedSession(daily, 100);
    const first = applySolved(statsSchema.defaultValue(), exact);
    expect(first.stats.dailyMoves).toEqual({ '2026-10-17': daily.minMoves });
    expect(first.improved).toBe(false);
    expect(first.stats.medium.solved).toBe(1);
    expect(dailiesCleared(first.stats)).toBe(1);

    // A longer clear the same day changes nothing in the day's record.
    const long = solvedSession(daily, 50, true);
    const again = applySolved(first.stats, long);
    expect(again.stats.dailyMoves['2026-10-17']).toBe(daily.minMoves);
    expect(again.improved).toBe(false);
    expect(again.previous).toBe(daily.minMoves);
    expect(JSON.stringify(again.stats)).not.toMatch(/streak/i);
  });

  it('reports a daily improvement in moves when a later clear that day takes fewer', () => {
    const long = solvedSession(daily, 50, true);
    const first = applySolved(statsSchema.defaultValue(), long);
    const exact = applySolved(first.stats, solvedSession(daily, 80));
    expect(exact.improved).toBe(true);
    expect(exact.previous).toBe(clearFactsOf(long).moves);
    expect(exact.stats.dailyMoves['2026-10-17']).toBe(daily.minMoves);
  });

  it('reads the result card’s facts off the session', () => {
    const exact = solvedSession(free, 33);
    const facts = clearFactsOf({ ...exact, hintCount: 2 });
    expect(facts).toMatchObject({
      moves: free.minMoves,
      minMoves: free.minMoves,
      seconds: 33,
      hints: 2,
    });
    expect(facts.cellsMoved).toBeGreaterThanOrEqual(facts.moves);
  });
});
