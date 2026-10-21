// @vitest-environment node
/**
 * What storage will persist (docs/OVERTAKE_RULES.md §9): the frontier, the
 * counts and the control choice — decoders that fail closed and never throw.
 */
import { describe, expect, it } from 'vitest';
import {
  addPlayed,
  addSeconds,
  advanceProgress,
  clearedCount,
  decodeControls,
  decodeHighestUnlocked,
  decodeStats,
  isUnlocked,
  playableLevel,
  raceResult,
} from './progress';

const JUNK: unknown[] = [
  undefined,
  null,
  '',
  '3',
  0,
  -1,
  102,
  1.5,
  Number.NaN,
  Infinity,
  {},
  [],
  true,
];

describe('progress (§7, §9)', () => {
  it('opens the next level on first place only; never moves back; 101 = all cleared', () => {
    expect(advanceProgress(1, 1, 1)).toBe(2);
    expect(advanceProgress(5, 1, 1)).toBe(5);
    expect(advanceProgress(5, 5, 2)).toBe(5);
    expect(advanceProgress(5, 5, 4)).toBe(5);
    expect(advanceProgress(100, 100, 1)).toBe(101);
    expect(advanceProgress(101, 100, 1)).toBe(101);
    expect(advanceProgress(-3, 1, 1)).toBe(2);
  });

  it('ignores a place on a level that is not unlocked, or not a level', () => {
    expect(advanceProgress(5, 50, 1)).toBe(5);
    expect(advanceProgress(5, 6, 1)).toBe(5);
    expect(advanceProgress(5, 0, 1)).toBe(5);
    expect(advanceProgress(5, 1.5, 1)).toBe(5);
    expect(advanceProgress(5, Number.NaN, 1)).toBe(5);
    expect(advanceProgress(101, 101, 1)).toBe(101);
  });

  it('points Play at the frontier, held at 100; the chip counts cleared levels', () => {
    expect([1, 2, 57, 100, 101].map(playableLevel)).toEqual([1, 2, 57, 100, 100]);
    expect([1, 2, 57, 100, 101].map(clearedCount)).toEqual([0, 1, 56, 99, 100]);
    expect(isUnlocked(5, 5)).toBe(true);
    expect(isUnlocked(5, 6)).toBe(false);
    expect(isUnlocked(101, 100)).toBe(true);
    expect(isUnlocked(101, 101)).toBe(false);
  });

  it('decodes fail-closed without throwing', () => {
    for (const v of JUNK) {
      expect(() => decodeHighestUnlocked(v)).not.toThrow();
      if (!(typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 101)) {
        expect(decodeHighestUnlocked(v)).toBeNull();
      }
      expect(decodeControls(v)).toBeNull();
      expect(decodeStats(v)).toBeNull();
    }
    expect(decodeHighestUnlocked(101)).toBe(101);
    expect(decodeControls('drag')).toBe('drag');
    expect(decodeControls('buttons')).toBe('buttons');
    expect(decodeControls('Drag')).toBeNull();
    expect(decodeStats({ played: 3, totalPlaySeconds: 40 })).toEqual({
      played: 3,
      totalPlaySeconds: 40,
    });
    expect(decodeStats({ played: 3 })).toBeNull();
    expect(decodeStats({ played: -1, totalPlaySeconds: 0 })).toBeNull();
    expect(decodeStats({ played: 1.5, totalPlaySeconds: 0 })).toBeNull();
  });

  it('books played races and whole seconds only', () => {
    const s = { played: 0, totalPlaySeconds: 0 };
    expect(addPlayed(s)).toEqual({ played: 1, totalPlaySeconds: 0 });
    expect(addSeconds(s, 12.9)).toEqual({ played: 0, totalPlaySeconds: 12 });
    expect(addSeconds(s, -4)).toEqual(s);
    expect(addSeconds(s, Number.NaN)).toEqual(s);
  });

  it('describes a result factually: first place clears and offers Next below Lv100', () => {
    expect(raceResult(12, 1, 2)).toEqual({
      level: 12,
      place: 1,
      bumps: 2,
      cleared: true,
      nextLevel: 13,
      outcome: 'completed',
    });
    expect(raceResult(12, 3, 0)).toEqual({
      level: 12,
      place: 3,
      bumps: 0,
      cleared: false,
      nextLevel: null,
      outcome: 'played',
    });
    expect(raceResult(100, 1, 0).nextLevel).toBeNull();
  });
});
