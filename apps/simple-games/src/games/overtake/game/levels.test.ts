// @vitest-environment node
/**
 * The ladder's levers (docs/OVERTAKE_RULES.md §7): the integer formulas, the
 * arithmetic table of §7 reproduced, and where each piece of vocabulary first
 * appears.
 */
import { describe, expect, it } from 'vitest';
import {
  CAR_DIMENSIONS,
  LEVEL_COUNT,
  VOCABULARY_HEADS,
  ZONE_GAP,
  baseLengthFor,
  checkSpeedFor,
  clampLevel,
  GATE_SLACK_SHARE,
  INTRO_GATE_PAIRS,
  gatePairsFor,
  lanesFor,
  lengthFor,
  levelSpec,
  sigmaFor,
  slackFor,
} from './levels';
import { LEVELS, report } from './test-helpers';

describe('levels (§7)', () => {
  it('clamps level numbers to 1..100 and never extrapolates', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(-5)).toBe(1);
    expect(clampLevel(101)).toBe(100);
    expect(clampLevel(12.7)).toBe(12);
    expect(clampLevel(Number.NaN)).toBe(1);
    expect(levelSpec(250).level).toBe(LEVEL_COUNT);
  });

  it('changes the lane count only at block boundaries: 3 → 4 at Lv21, 4 → 5 at Lv51', () => {
    for (const l of LEVELS) {
      expect(lanesFor(l)).toBe(l <= 20 ? 3 : l <= 50 ? 4 : 5);
      if (lanesFor(l) !== lanesFor(Math.max(1, l - 1))) expect((l - 1) % 10).toBe(0);
    }
  });

  it('grows U₀ strictly from 16,000 to 26,000 without saturating; finals are 1.25 ×', () => {
    for (let l = 2; l <= 100; l++) expect(baseLengthFor(l)).toBeGreaterThan(baseLengthFor(l - 1));
    expect(baseLengthFor(1)).toBe(16000);
    expect(baseLengthFor(100)).toBe(26000);
    for (const l of LEVELS) {
      expect(lengthFor(l)).toBe(
        l % 10 === 0 ? Math.floor((baseLengthFor(l) * 5) / 4) : baseLengthFor(l),
      );
    }
  });

  it('reproduces the §7 table', () => {
    const rows = [1, 10, 11, 21, 50, 51, 100].map((l) => [
      l,
      lanesFor(l),
      lengthFor(l),
      sigmaFor(l),
      checkSpeedFor(l),
      slackFor(l),
      gatePairsFor(l),
    ]);
    expect(rows).toEqual([
      [1, 3, 16000, 2200, 420, 250, 0],
      [10, 3, 21136, 2114, 420, 215, 0],
      [11, 3, 17010, 2105, 300, 273, 6],
      [21, 4, 18020, 2009, 300, 256, 15],
      [50, 4, 26186, 1730, 300, 146, 20],
      [51, 5, 21050, 1721, 300, 205, 22],
      [100, 5, 32500, 1250, 300, 80, 14],
    ]);
    const pairs = LEVELS.filter((l) => l >= 11).map(gatePairsFor);
    report('n_gate Lv11–100 (min..max)', Math.min(...pairs), Math.max(...pairs));
  });

  it('ramps the pairs without a density jump when four lanes arrive (2026-10-23)', () => {
    expect([...INTRO_GATE_PAIRS]).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    const formula = (l: number) =>
      Math.ceil((slackFor(l) * lengthFor(l)) / (420 * GATE_SLACK_SHARE)) + 1;
    for (let l = 11; l <= 20; l++) {
      expect(gatePairsFor(l), `Lv${l}`).toBe(INTRO_GATE_PAIRS[l - 11]);
      if (l > 11) expect(gatePairsFor(l), `Lv${l}`).toBeGreaterThan(gatePairsFor(l - 1));
    }
    expect(gatePairsFor(21)).toBe(15);
    expect(gatePairsFor(21)).toBeGreaterThanOrEqual(gatePairsFor(20));
    for (let l = 21; l <= 100; l++) {
      expect(gatePairsFor(l), `Lv${l}`).toBe(Math.min(15 + l - 21, formula(l)));
    }
    report(
      'n_gate formula Lv11–20 (not used)',
      [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(formula).join(' '),
    );
  });

  it('keeps σ and the slack inside their ranges, +40 ‰ exactly on the four heads', () => {
    for (const l of LEVELS) {
      expect(sigmaFor(l)).toBeGreaterThanOrEqual(1250);
      expect(sigmaFor(l)).toBeLessThanOrEqual(2200);
      expect(slackFor(l)).toBeGreaterThanOrEqual(80);
    }
    // The +40 ‰ itself (a block start is always above the level before it —
    // the sawtooth resets — so that comparison would not see it).
    const base = (l: number) => 250 - Math.floor((170 * (l - 1)) / 99);
    for (const head of [11, 21, 31, 51]) {
      expect(slackFor(head), `Lv${head}`).toBe(base(head) + 40);
    }
    expect(slackFor(31)).toBe(239);
    for (const start of [1, 41, 61, 71, 81, 91]) {
      expect(slackFor(start), `Lv${start}`).toBe(Math.max(80, base(start)));
    }
  });

  it('introduces the vocabulary where §7 says', () => {
    const first = (pred: (l: number) => boolean) => LEVELS.find(pred);
    expect(first((l) => levelSpec(l).smallKinds.includes('van'))).toBe(11);
    expect(first((l) => levelSpec(l).sCurves)).toBe(11);
    expect(first((l) => levelSpec(l).gatePairs > 0)).toBe(11);
    expect(first((l) => levelSpec(l).templates.truck > 0)).toBe(21);
    expect(first((l) => levelSpec(l).wallKinds.includes('truck'))).toBe(21);
    expect(first((l) => levelSpec(l).templates.works > 0)).toBe(31);
    expect(first((l) => levelSpec(l).lanes === 5)).toBe(51);
    expect(first((l) => levelSpec(l).templates.cones > 0)).toBe(6);
    expect(first((l) => levelSpec(l).templates.sand > 0)).toBe(16);
    expect(CAR_DIMENSIONS).toEqual({
      sedan: { width: 34, length: 58 },
      van: { width: 38, length: 70 },
      truck: { width: 42, length: 104 },
    });
  });

  it('weighs the templates as §7 says, cones and sand last (2026-10-22)', () => {
    for (const l of LEVELS) {
      const t = levelSpec(l).templates;
      expect(Object.keys(t)).toEqual(['single', 'two', 'truck', 'works', 'cones', 'sand']);
      expect(t).toEqual({
        single: 5,
        two: 3,
        truck: l >= 21 ? 2 : 0,
        works: l >= 31 ? 1 : 0,
        cones: l >= 6 ? 2 : 0,
        sand: l >= 16 ? 2 : 0,
      });
    }
    expect(ZONE_GAP).toBe(4);
  });

  it('keeps the vocabulary heads at 11, 21, 31, 51 — no +40 ‰ for Lv6 (cones) or Lv16 (sand)', () => {
    expect([...VOCABULARY_HEADS].sort((a, b) => a - b)).toEqual([11, 21, 31, 51]);
    const base = (l: number) =>
      Math.max(
        80,
        250 - Math.floor((170 * (l - 1)) / 99) - Math.floor((20 * (((l - 1) % 10) + 1 - 1)) / 9),
      );
    for (const l of [6, 16]) expect(slackFor(l), `Lv${l}`).toBe(base(l));
  });
});
