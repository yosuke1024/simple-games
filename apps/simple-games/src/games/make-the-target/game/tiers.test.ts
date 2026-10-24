/**
 * The tier table of docs/MAKE_THE_TARGET_RULES.md §7: the shape each tier
 * deals (`isDealableShape`, which the restore path also uses) and the one
 * acceptance predicate (`meetsTier`).
 */
import { describe, expect, it } from 'vitest';
import { isDealableShape, MAX_TILES, meetsTier, TIERS } from './tiers';

describe('the shape a tier deals (§7, §10)', () => {
  it('Easy: four numbers 1–10, ascending, target 10–24', () => {
    expect(isDealableShape('easy', [1, 2, 3, 4], 10)).toBe(true);
    expect(isDealableShape('easy', [1, 2, 3, 4], 24)).toBe(true);
    expect(isDealableShape('easy', [1, 2, 3, 4], 9)).toBe(false);
    expect(isDealableShape('easy', [1, 2, 3, 4], 25)).toBe(false);
    expect(isDealableShape('easy', [1, 2, 3, 4, 5], 20)).toBe(false);
    expect(isDealableShape('easy', [2, 1, 3, 4], 20)).toBe(false);
    expect(isDealableShape('easy', [1, 2, 3, 11], 20)).toBe(false);
    expect(isDealableShape('easy', [0, 2, 3, 4], 20)).toBe(false);
  });

  it('Medium: four or five numbers 1–10, target 10–60', () => {
    expect(isDealableShape('medium', [1, 2, 3, 4], 60)).toBe(true);
    expect(isDealableShape('medium', [1, 2, 3, 4, 10], 10)).toBe(true);
    expect(isDealableShape('medium', [1, 2, 3, 4, 10], 61)).toBe(false);
    expect(isDealableShape('medium', [1, 2, 3], 20)).toBe(false);
    expect(isDealableShape('medium', [1, 2, 3, 4, 12], 20)).toBe(false);
  });

  it('Hard: five numbers, exactly one or two from 11–25, target 50–300', () => {
    expect(isDealableShape('hard', [1, 2, 3, 4, 11], 50)).toBe(true);
    expect(isDealableShape('hard', [1, 2, 3, 20, 25], 300)).toBe(true);
    expect(isDealableShape('hard', [1, 2, 3, 4, 5], 100)).toBe(false);
    expect(isDealableShape('hard', [1, 2, 13, 20, 25], 100)).toBe(false);
    expect(isDealableShape('hard', [1, 2, 3, 4, 26], 100)).toBe(false);
    expect(isDealableShape('hard', [1, 2, 3, 4, 11], 49)).toBe(false);
    expect(isDealableShape('hard', [1, 2, 3, 4, 11], 301)).toBe(false);
    expect(isDealableShape('hard', [1, 2, 3, 4, 5, 11], 100)).toBe(false);
  });

  it('no v1 tier deals six tiles, though the format could hold them (§1)', () => {
    expect(MAX_TILES).toBe(6);
    for (const tier of Object.values(TIERS)) expect(tier.tileCounts).not.toContain(6);
  });

  it('never throws on what came off the disk', () => {
    for (const numbers of [null, 'abc', {}, [1, 2, '3', 4], [1, 2, 3.5, 4], [NaN, 1, 2, 3]]) {
      expect(isDealableShape('easy', numbers, 20)).toBe(false);
    }
    expect(isDealableShape('easy', [1, 2, 3, 4], '20')).toBe(false);
    expect(isDealableShape('easy', [1, 2, 3, 4], 20.5)).toBe(false);
  });
});

describe('the acceptance predicate (§7)', () => {
  const easy = [1, 2, 3, 4];
  it('Easy: ways ≥ 4 and at least one procedure without ÷', () => {
    expect(meetsTier('easy', easy, 21, { ways: 4, waysWithoutDivision: 1 })).toBe(true);
    expect(meetsTier('easy', easy, 21, { ways: 3, waysWithoutDivision: 3 })).toBe(false);
    expect(meetsTier('easy', easy, 21, { ways: 9, waysWithoutDivision: 0 })).toBe(false);
  });

  it('Medium: ÷ required at any count, or ≤ 200 ways and not Easy', () => {
    // (a) ÷ is the only way: no ceiling on ways.
    expect(meetsTier('medium', easy, 21, { ways: 500, waysWithoutDivision: 0 })).toBe(true);
    // (b) An Easy problem is not Medium…
    expect(meetsTier('medium', easy, 21, { ways: 6, waysWithoutDivision: 6 })).toBe(false);
    // …but fewer than 4 ways, a target past 24, or five tiles is not Easy.
    expect(meetsTier('medium', easy, 21, { ways: 3, waysWithoutDivision: 3 })).toBe(true);
    expect(meetsTier('medium', easy, 25, { ways: 6, waysWithoutDivision: 6 })).toBe(true);
    expect(meetsTier('medium', [1, 2, 3, 4, 5], 21, { ways: 6, waysWithoutDivision: 6 })).toBe(
      true,
    );
    // The ceiling of (b) is inclusive: 200 is in, 201 is out.
    expect(meetsTier('medium', easy, 25, { ways: 200, waysWithoutDivision: 1 })).toBe(true);
    expect(meetsTier('medium', easy, 25, { ways: 201, waysWithoutDivision: 1 })).toBe(false);
    expect(meetsTier('medium', easy, 25, { ways: 0, waysWithoutDivision: 0 })).toBe(false);
  });

  it('Hard: 1 to 40 ways', () => {
    const hard = [1, 2, 3, 4, 11];
    expect(meetsTier('hard', hard, 50, { ways: 1, waysWithoutDivision: 0 })).toBe(true);
    expect(meetsTier('hard', hard, 50, { ways: 40, waysWithoutDivision: 40 })).toBe(true);
    expect(meetsTier('hard', hard, 50, { ways: 41, waysWithoutDivision: 40 })).toBe(false);
    expect(meetsTier('hard', hard, 50, { ways: 0, waysWithoutDivision: 0 })).toBe(false);
  });

  it('a problem outside the tier’s shape never meets it', () => {
    expect(meetsTier('easy', [1, 2, 3, 11], 21, { ways: 9, waysWithoutDivision: 9 })).toBe(false);
  });
});
