import { describe, expect, it } from 'vitest';
import {
  FIRST_ROUND,
  LEVEL_COUNT,
  LEVELS,
  levelSeed,
  levelSpec,
  MAX_TARGET,
  MIN_TARGET,
  nextLevelInTier,
  previousLevelInTier,
} from './levels';
import { DAILY_PAD_COUNT, DAILY_TARGET, dailySeed, isLocalDateString } from './daily';

describe('the level ladder (docs/ECHO_PADS_RULES.md §2)', () => {
  it('is 2 tiers × target lengths 4..14 = 22 levels', () => {
    expect(LEVEL_COUNT).toBe(22);
    expect(LEVELS).toHaveLength(22);
    expect(LEVELS.map((l) => l.level)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
  });

  it('puts 4 pads on levels 1–11 and 6 pads on 12–22, each with targets 4..14 in order', () => {
    const targets = Array.from({ length: 11 }, (_, i) => MIN_TARGET + i);
    expect(LEVELS.slice(0, 11).map((l) => [l.padCount, l.target])).toEqual(
      targets.map((t) => [4, t]),
    );
    expect(LEVELS.slice(11).map((l) => [l.padCount, l.target])).toEqual(targets.map((t) => [6, t]));
    expect(MIN_TARGET).toBe(4);
    expect(MAX_TARGET).toBe(14);
    expect(FIRST_ROUND).toBe(3);
  });

  it('opens both tiers from the start and nothing else', () => {
    expect(LEVELS.filter((l) => l.tierStart).map((l) => l.level)).toEqual([1, 12]);
  });

  it('steps inside a tier and never across', () => {
    expect(nextLevelInTier(1)).toBe(2);
    expect(nextLevelInTier(10)).toBe(11);
    expect(nextLevelInTier(11)).toBeNull();
    expect(nextLevelInTier(21)).toBe(22);
    expect(nextLevelInTier(22)).toBeNull();
    expect(previousLevelInTier(1)).toBeNull();
    expect(previousLevelInTier(12)).toBeNull();
    expect(previousLevelInTier(13)).toBe(12);
    expect(previousLevelInTier(0)).toBeNull();
  });

  it('refuses levels that do not exist', () => {
    for (const bad of [0, 23, -1, 1.5, Number.NaN]) expect(levelSpec(bad)).toBeNull();
  });

  it('builds the seeds of §3 and §7', () => {
    expect(levelSeed(7, 0)).toBe('echo-level-7-r0');
    expect(levelSeed(22, 3)).toBe('echo-level-22-r3');
    expect(dailySeed('2026-10-22', 1)).toBe('echo-daily-2026-10-22-r1');
    expect(DAILY_PAD_COUNT).toBe(6);
    expect(DAILY_TARGET).toBe(10);
  });

  it('reads only real local dates', () => {
    expect(isLocalDateString('2026-02-28')).toBe(true);
    expect(isLocalDateString('2028-02-29')).toBe(true);
    expect(isLocalDateString('2026-02-29')).toBe(false);
    expect(isLocalDateString('2026-1-01')).toBe(false);
    expect(isLocalDateString(20261022)).toBe(false);
  });
});
