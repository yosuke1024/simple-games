/**
 * The record transitions the provider calls (docs/OVERTAKE_RULES.md §7, §9).
 * The rules themselves are tested in game/progress.test.ts; this proves they
 * are carried over the persisted shapes without a field going missing.
 */
import { describe, expect, it } from 'vitest';
import { progressSchema, statsSchema, type Progress } from '../storage/schemas';
import {
  applyFirstPlace,
  applyPlayTime,
  applyRaceStart,
  clearedLevels,
  homeLevel,
} from './statsLogic';

const at = (highestUnlocked: number): Progress => ({ schemaVersion: 1, highestUnlocked });

describe('statistics (§9)', () => {
  it('counts a race when it starts moving, and keeps the record shape', () => {
    const next = applyRaceStart(statsSchema.defaultValue());
    expect(next).toEqual({ schemaVersion: 1, played: 1, totalPlaySeconds: 0 });
    expect(statsSchema.validate(next)).toEqual(next);
  });

  it('books whole seconds only, and returns the same record when there is nothing to book', () => {
    const start = { schemaVersion: 1 as const, played: 3, totalPlaySeconds: 40 };
    expect(applyPlayTime(start, 12)).toEqual({ ...start, totalPlaySeconds: 52 });
    expect(applyPlayTime(start, 2.9)).toEqual({ ...start, totalPlaySeconds: 42 });
    expect(applyPlayTime(start, 0)).toBe(start);
    expect(applyPlayTime(start, -5)).toBe(start);
    expect(applyPlayTime(start, Number.NaN)).toBe(start);
  });
});

describe('the unlock frontier (§7)', () => {
  it('first place on the frontier opens the next level', () => {
    expect(applyFirstPlace(at(1), 1)).toEqual(at(2));
    expect(applyFirstPlace(at(12), 12)).toEqual(at(13));
  });

  it('replaying a cleared level never moves the frontier, back or forward', () => {
    const progress = at(30);
    expect(applyFirstPlace(progress, 4)).toBe(progress);
  });

  it('ignores a level that is not open yet', () => {
    const progress = at(5);
    expect(applyFirstPlace(progress, 9)).toBe(progress);
  });

  it('winning Lv100 moves the frontier to 101, which the schema accepts', () => {
    const done = applyFirstPlace(at(100), 100);
    expect(done).toEqual(at(101));
    expect(progressSchema.validate(done)).toEqual(done);
    expect(applyFirstPlace(done, 100)).toBe(done);
  });

  it('Play points at the frontier and stays on 100 once everything is cleared', () => {
    expect(homeLevel(at(1))).toBe(1);
    expect(homeLevel(at(57))).toBe(57);
    expect(homeLevel(at(101))).toBe(100);
  });

  it('the Levels chip counts what is cleared, up to 100/100', () => {
    expect(clearedLevels(at(1))).toBe(0);
    expect(clearedLevels(at(57))).toBe(56);
    expect(clearedLevels(at(100))).toBe(99);
    expect(clearedLevels(at(101))).toBe(100);
  });
});
