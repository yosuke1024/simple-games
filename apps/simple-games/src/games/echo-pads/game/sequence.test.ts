import { describe, expect, it } from 'vitest';
import { LEVELS, levelSeed } from './levels';
import {
  bannedNext,
  biasCap,
  breaksLocalRules,
  drawCandidate,
  GEN_DRAW_LIMIT,
  generateSequence,
  maxPadCount,
} from './sequence';
import { createRng } from './rng';
import { PAD_COUNTS, PAD_RING } from './types';

describe('the local rules (docs/ECHO_PADS_RULES.md §3)', () => {
  it('bans the pad that would make three of a kind', () => {
    expect(bannedNext([2, 2], 4)).toBe(2);
    expect(bannedNext([0, 5, 5], 6)).toBe(5);
  });

  it('bans the pad that would continue a trace of the ring, either way round', () => {
    // 4 pads, ring 0 → 1 → 3 → 2 → 0.
    expect(bannedNext([0, 1], 4)).toBe(3);
    expect(bannedNext([1, 3], 4)).toBe(2);
    expect(bannedNext([2, 0], 4)).toBe(1);
    expect(bannedNext([3, 1], 4)).toBe(0);
    // 6 pads, ring 0 → 1 → 2 → 5 → 4 → 3 → 0.
    expect(bannedNext([1, 2], 6)).toBe(5);
    expect(bannedNext([5, 2], 6)).toBe(1);
    expect(bannedNext([3, 0], 6)).toBe(1);
    expect(bannedNext([0, 3], 6)).toBe(4);
  });

  it('bans nothing after a jump across, or with fewer than two items', () => {
    expect(bannedNext([0, 3], 4)).toBe(-1); // diagonal of the 2 × 2
    expect(bannedNext([1, 4], 6)).toBe(-1);
    expect(bannedNext([0, 5], 6)).toBe(-1);
    expect(bannedNext([], 6)).toBe(-1);
    expect(bannedNext([3], 6)).toBe(-1);
  });

  it('knows a broken sequence when it sees one', () => {
    expect(breaksLocalRules([1, 1, 1], 4)).toBe(true);
    expect(breaksLocalRules([0, 1, 3], 4)).toBe(true);
    expect(breaksLocalRules([0, 1, 2, 5], 6)).toBe(true);
    expect(breaksLocalRules([1, 1, 0, 0, 3], 4)).toBe(false);
  });

  it('keeps every pad on the ring exactly once', () => {
    for (const count of PAD_COUNTS) {
      expect([...PAD_RING[count]].sort()).toEqual(Array.from({ length: count }, (_, i) => i));
    }
  });
});

describe('generateSequence (§3)', () => {
  it('is deterministic per seed', () => {
    for (const seed of ['echo-level-1-r0', 'echo-level-22-r7', 'echo-daily-2026-10-22-r0']) {
      expect(generateSequence(seed, 6, 14)).toEqual(generateSequence(seed, 6, 14));
    }
  });

  it('gives each attempt its own seed, and the same sequence as the previous attempt only where §9 says', () => {
    // A retry is a new seed, not a promise of a new sequence (§9): levels 1
    // and 2 have few sequences that keep the rules, so a retry can draw the
    // one just heard. Over every level × attempts 0..499 these are all of it.
    const repeats: string[] = [];
    for (const spec of LEVELS) {
      const seeds = new Set<string>();
      let previous: readonly number[] | null = null;
      for (let attempt = 0; attempt < 500; attempt++) {
        const seed = levelSeed(spec.level, attempt);
        seeds.add(seed);
        const pads = generateSequence(seed, spec.padCount, spec.target).pads;
        if (previous && pads.every((pad, i) => pad === previous![i])) {
          repeats.push(`L${spec.level} r${attempt - 1}=r${attempt}`);
        }
        previous = pads;
      }
      expect(seeds.size).toBe(500);
    }
    expect(repeats).toEqual([
      'L1 r129=r130',
      'L1 r255=r256',
      'L1 r388=r389',
      'L1 r449=r450',
      'L2 r256=r257',
    ]);
  });

  it('gives the target length, pads in range, and the local rules on every level and attempt 0..49', () => {
    for (const spec of LEVELS) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const g = generateSequence(levelSeed(spec.level, attempt), spec.padCount, spec.target);
        expect(g.pads).toHaveLength(spec.target);
        expect(g.pads.every((p) => Number.isInteger(p) && p >= 0 && p < spec.padCount)).toBe(true);
        expect(breaksLocalRules(g.pads, spec.padCount)).toBe(false);
        expect(g.draws).toBeGreaterThanOrEqual(1);
        expect(g.draws).toBeLessThanOrEqual(GEN_DRAW_LIMIT);
        if (!g.fallback)
          expect(maxPadCount(g.pads, spec.padCount)).toBeLessThanOrEqual(
            biasCap(spec.target, spec.padCount),
          );
        else expect(g.draws).toBe(GEN_DRAW_LIMIT);
      }
    }
  });

  it('caps the bias at twice the fair share, rounded up', () => {
    expect(biasCap(4, 4)).toBe(2);
    expect(biasCap(8, 4)).toBe(4);
    expect(biasCap(14, 4)).toBe(7);
    expect(biasCap(4, 6)).toBe(2);
    expect(biasCap(10, 6)).toBe(4);
    expect(biasCap(14, 6)).toBe(5);
  });

  it('stops after GEN_DRAW_LIMIT candidates and takes the last one (the bound is real)', () => {
    expect(GEN_DRAW_LIMIT).toBe(24);
    // A cap of 1 on 14 items over 4 pads cannot be met, so every candidate
    // fails and the generator must still return — with the 24th candidate,
    // which still keeps the local rules.
    const seed = 'echo-level-11-r0';
    const g = generateSequence(seed, 4, 14, 1);
    expect(g.fallback).toBe(true);
    expect(g.draws).toBe(GEN_DRAW_LIMIT);
    expect(g.pads).toHaveLength(14);
    expect(breaksLocalRules(g.pads, 4)).toBe(false);
    // The fallback is the last candidate drawn: the 24th the seed's stream
    // gives, not the first (which any cap accepts) nor any other.
    const rng = createRng(seed);
    const candidates = Array.from({ length: GEN_DRAW_LIMIT }, () => drawCandidate(rng, 4, 14));
    expect(g.pads).toEqual(candidates[GEN_DRAW_LIMIT - 1]);
    expect(g.pads).not.toEqual(generateSequence(seed, 4, 14, Infinity).pads);
    expect(generateSequence(seed, 4, 14, Infinity).pads).toEqual(candidates[0]);
    expect(g.pads.join('')).toMatchInlineSnapshot(`"31313131332202"`);
    expect(generateSequence(seed, 4, 14, 1)).toEqual(g);
  });
});
