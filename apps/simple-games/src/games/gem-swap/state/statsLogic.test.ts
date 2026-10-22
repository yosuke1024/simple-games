import { describe, expect, it } from 'vitest';
import { createRound, gemSwapSeed, type Round } from '../game';
import { firstValid, playFirst, roundAfter } from '../game/play-helpers';
import { trySwap } from '../game';
import type { Stats } from '../storage/schemas';
import { applyPlayTime, applyRoundEnd, applyRoundStart } from './statsLogic';

const empty = (): Stats => ({
  schemaVersion: 1,
  played: 0,
  best5: 0,
  best6: 0,
  totalPlaySeconds: 0,
});

/** A round that ended by its 30th swap. */
function finished(colors: 5 | 6 = 6): Round {
  const last = roundAfter(29, colors);
  const [a, b] = firstValid(last);
  return trySwap(last, a, b)!.round;
}

describe('statistics (§5, §7)', () => {
  it('counts a round once when it starts, not split by gem count', () => {
    const once = applyRoundStart(empty());
    expect(once).toEqual({ ...empty(), played: 1 });
    expect(applyRoundStart(once).played).toBe(2);
  });

  it('books only positive play seconds', () => {
    expect(applyPlayTime(empty(), 0)).toEqual(empty());
    expect(applyPlayTime(empty(), -3)).toEqual(empty());
    expect(applyPlayTime(empty(), 12).totalPlaySeconds).toBe(12);
  });

  it('sets the best of its own gem count, and reports a first best as new', () => {
    const round = finished(6);
    const booking = applyRoundEnd(empty(), round);
    expect(booking.counted).toBe(true);
    expect(booking.previousBest).toBeNull();
    expect(booking.isNewBest).toBe(true);
    expect(booking.best).toBe(round.score);
    expect(booking.stats.best6).toBe(round.score);
    expect(booking.stats.best5).toBe(0);
    expect(booking.stats.schemaVersion).toBe(1);
  });

  it('keeps a higher best, and says what it was', () => {
    const round = finished(5);
    const stats = { ...empty(), best5: round.score + 10 };
    const booking = applyRoundEnd(stats, round);
    expect(booking.isNewBest).toBe(false);
    expect(booking.previousBest).toBe(round.score + 10);
    expect(booking.stats).toEqual(stats);
  });

  it('does not count a round still being played, or one stopped by the cap', () => {
    const playing = playFirst(createRound(gemSwapSeed('stats'), 6), 3);
    expect(applyRoundEnd(empty(), playing).counted).toBe(false);
    const capped: Round = { ...finished(6), endReason: 'cap' };
    const booking = applyRoundEnd(empty(), capped);
    expect(booking.counted).toBe(false);
    expect(booking.stats.best6).toBe(0);
    expect(booking.isNewBest).toBe(false);
  });
});
