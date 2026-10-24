/**
 * The one booking (docs/BOUNCE_UP_RULES.md §5「計上は 1 本」) over the
 * persisted record: the seconds and the score's growth go in, the best is
 * raised by max, the record of the other width is never touched, and booking
 * twice adds nothing.
 */
import { describe, expect, it } from 'vitest';
import { statsSchema, type Stats } from '../storage/schemas';
import { applyBooking, applyRunStart } from './statsLogic';

const base = (): Stats => ({
  schemaVersion: 1,
  played: 2,
  best: { normal: 50, wide: 30 },
  total: { normal: 80, wide: 30 },
  totalPlaySeconds: 40,
});

describe('statsLogic', () => {
  it('counts a run once when it starts moving', () => {
    expect(applyRunStart(base()).played).toBe(3);
  });

  it('adds the growth since the last booking, and the seconds', () => {
    const first = applyBooking(base(), { width: 'normal', seconds: 5, bookedScore: 0, score: 20 });
    expect(first.booked).toBe(20);
    expect(first.stats.total).toEqual({ normal: 100, wide: 30 });
    expect(first.stats.best).toEqual({ normal: 50, wide: 30 });
    expect(first.stats.totalPlaySeconds).toBe(45);

    const second = applyBooking(first.stats, {
      width: 'normal',
      seconds: 3,
      bookedScore: first.booked,
      score: 70,
    });
    expect(second.booked).toBe(70);
    expect(second.stats.total.normal).toBe(150);
    expect(second.stats.best.normal).toBe(70);
    expect(second.stats.totalPlaySeconds).toBe(48);
  });

  it('adds nothing when booked twice, and hands back the same record', () => {
    const once = applyBooking(base(), { width: 'wide', seconds: 0, bookedScore: 0, score: 12 });
    const twice = applyBooking(once.stats, {
      width: 'wide',
      seconds: 0,
      bookedScore: once.booked,
      score: 12,
    });
    expect(twice.stats).toBe(once.stats);
    expect(twice.booked).toBe(12);
  });

  it('never lowers a booked score, and reads nonsense seconds as none', () => {
    const before = base();
    const r = applyBooking(before, { width: 'normal', seconds: NaN, bookedScore: 40, score: 10 });
    expect(r.booked).toBe(40);
    expect(r.stats).toBe(before);
    expect(r.stats.total.normal).toBe(80);
    expect(r.stats.totalPlaySeconds).toBe(40);
  });

  it('only ever produces records the schema accepts', () => {
    let stats = statsSchema.defaultValue();
    let booked = 0;
    stats = applyRunStart(stats);
    for (const score of [0, 15, 15, 40, 41, 300]) {
      const r = applyBooking(stats, { width: 'wide', seconds: 1, bookedScore: booked, score });
      stats = r.stats;
      booked = r.booked;
      expect(statsSchema.validate(stats)).toEqual(stats);
    }
    expect(stats.best.wide).toBe(300);
    expect(stats.total.wide).toBe(300);
    expect(stats.total.normal).toBe(0);
  });
});
