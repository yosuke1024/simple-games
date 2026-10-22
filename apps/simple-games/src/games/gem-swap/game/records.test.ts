import { describe, expect, it } from 'vitest';
import {
  bestFor,
  countRoundStart,
  countsTowardRecord,
  emptyStats,
  recordRoundEnd,
} from './records';
import type { Round } from './round';
import { freshTape, type ColorCount } from './types';

function finished(
  colors: ColorCount,
  score: number,
  endReason: Round['endReason'],
  status: Round['status'] = 'over',
): Round {
  return {
    seed: 's',
    colors,
    initial: [],
    bundled: false,
    board: [],
    tape: freshTape(),
    score,
    swaps: [],
    status,
    endReason,
  };
}

describe('statistics semantics (§5)', () => {
  it('played counts round starts, not split by colour count', () => {
    let stats = emptyStats();
    stats = countRoundStart(stats);
    stats = countRoundStart(stats);
    expect(stats.played).toBe(2);
    expect(stats.best5).toBe(0);
    expect(stats.best6).toBe(0);
  });

  it('rounds ended by 30 swaps or by being stuck are record candidates', () => {
    expect(countsTowardRecord(finished(6, 10, 'swaps'))).toBe(true);
    expect(countsTowardRecord(finished(6, 10, 'stuck'))).toBe(true);
  });

  it('a capped round and a round still being played are not', () => {
    expect(countsTowardRecord(finished(6, 999, 'cap'))).toBe(false);
    expect(countsTowardRecord(finished(6, 999, null, 'playing'))).toBe(false);
    const stats = emptyStats();
    expect(recordRoundEnd(stats, finished(6, 999, 'cap'))).toBe(stats);
    expect(recordRoundEnd(stats, finished(6, 999, null, 'playing'))).toBe(stats);
  });

  it('the best is per colour count and only ever rises', () => {
    let stats = emptyStats();
    stats = recordRoundEnd(stats, finished(5, 120, 'swaps'));
    stats = recordRoundEnd(stats, finished(6, 90, 'stuck'));
    expect(bestFor(stats, 5)).toBe(120);
    expect(bestFor(stats, 6)).toBe(90);
    stats = recordRoundEnd(stats, finished(5, 100, 'swaps'));
    expect(bestFor(stats, 5)).toBe(120);
    stats = recordRoundEnd(stats, finished(6, 91, 'swaps'));
    expect(bestFor(stats, 6)).toBe(91);
    expect(stats.played).toBe(0);
  });

  it('a short stuck round still counts (§5)', () => {
    const stats = recordRoundEnd(emptyStats(), finished(6, 7, 'stuck'));
    expect(stats.best6).toBe(7);
  });
});
