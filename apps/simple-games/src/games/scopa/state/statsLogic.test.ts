/**
 * The statistics transitions (docs/SCOPA_RULES.md §8): a match is counted when
 * it starts, only a match that ended books a result, a replaced match is never
 * a loss, and there is no draw, streak or best to book.
 */
import { describe, expect, it } from 'vitest';
import { statsSchema, type Stats } from '../storage/schemas';
import { applyGameStart, applyMatchEnd, applyPlayTime } from './statsLogic';

const zero = (): Stats => statsSchema.defaultValue();

describe('statistics', () => {
  it('counts a match when it starts, and only then', () => {
    expect(applyGameStart(zero())).toEqual({ ...zero(), played: 1 });
  });

  it('books a win and a loss, and nothing for a match still in play', () => {
    expect(applyMatchEnd(zero(), 'won')).toEqual({ ...zero(), wins: 1 });
    expect(applyMatchEnd(zero(), 'lost')).toEqual({ ...zero(), losses: 1 });
    // A match replaced by a new one is finalized while still 'playing': its
    // time is booked, its result is not — abandoning is not losing.
    expect(applyMatchEnd(zero(), 'playing')).toEqual(zero());
  });

  it('adds play seconds, and ignores nothing-to-add', () => {
    expect(applyPlayTime(zero(), 7).totalPlaySeconds).toBe(7);
    const same = zero();
    expect(applyPlayTime(same, 0)).toBe(same);
    expect(applyPlayTime(same, -3)).toBe(same);
  });

  it('keeps exactly the four fields — no draws, no streak, no best', () => {
    const booked = applyMatchEnd(applyPlayTime(applyGameStart(zero()), 5), 'won');
    expect(Object.keys(booked).sort()).toEqual(
      ['losses', 'played', 'schemaVersion', 'totalPlaySeconds', 'wins'].sort(),
    );
  });

  it('never mutates the record it is given', () => {
    const before = zero();
    applyGameStart(before);
    applyMatchEnd(before, 'won');
    applyPlayTime(before, 9);
    expect(before).toEqual(zero());
  });
});
