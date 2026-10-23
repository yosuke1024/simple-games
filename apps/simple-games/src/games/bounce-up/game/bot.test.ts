/**
 * Reachability, measured with the real step (docs/BOUNCE_UP_RULES.md §3「踏破」,
 * §10): the reference bot climbing 2,000 segments, and every link of the
 * safety chain jumped on its own at 70 % of the top speed with no wrap.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMERA_ANCHOR,
  CHAIN_MOVE_SPEED,
  CHAIN_MOVE_SPAN_PX,
  CHAIN_SPEED_PERCENT,
  GEN_PER_STEP_LIMIT,
  JUMP_SPEED,
  RUN_SPEED,
  SUB,
} from './constants';
import { runBot, type BotResult } from './bot';
import { generateTower, platformLeft } from './generate';
import { apexUnits, createRun, start, step } from './physics';
import { report } from './test-helpers';
import type { Platform, PlatformWidth, RunState } from './types';

const BOT_SEEDS = 200;
const BOT_SEGMENTS = 2000;
/** Work bound on one bot run (§11): far above the ~145,000 steps a 2,000-segment climb takes. */
const BOT_STEP_LIMIT = 600_000;

function summary(results: readonly BotResult[]): string {
  const segs = results.map((r) => r.reachedSegment).sort((a, b) => a - b);
  const steps = results.map((r) => r.steps).sort((a, b) => a - b);
  const pick = (xs: number[], q: number): number =>
    xs[Math.min(xs.length - 1, Math.floor(q * xs.length))]!;
  return (
    `reached ${results.filter((r) => r.outcome === 'reached').length}/${results.length}, ` +
    `segments min ${segs[0]} / median ${pick(segs, 0.5)}, ` +
    `steps median ${pick(steps, 0.5)} / max ${steps[steps.length - 1]}`
  );
}

describe(`the reference bot at 3/4 speed, ${BOT_SEEDS} seeds × ${BOT_SEGMENTS} segments (§3)`, () => {
  for (const width of ['normal', 'wide'] as const) {
    it(`${width}: climbs to segment ${BOT_SEGMENTS} on every seed`, () => {
      const t0 = Date.now();
      const results: BotResult[] = [];
      for (let n = 0; n < BOT_SEEDS; n++) {
        results.push(
          runBot(`bot-${n}`, width, { targetSegment: BOT_SEGMENTS, stepLimit: BOT_STEP_LIMIT }),
        );
      }
      const total = results.reduce((sum, r) => sum + r.steps, 0);
      report(`bot ${width}`, summary(results));
      report(
        `bot ${width} work`,
        `${total} steps in all`,
        `most platforms held ${Math.max(...results.map((r) => r.maxPlatforms))}`,
        `most segments added in one step ${Math.max(...results.map((r) => r.maxGeneratedPerStep))}`,
        `generation cap hits ${results.reduce((sum, r) => sum + r.genCapHits, 0)}`,
      );
      report(
        `bot ${width} score at segment ${BOT_SEGMENTS}`,
        `min ${Math.min(...results.map((r) => r.score))} / max ${Math.max(...results.map((r) => r.score))}`,
      );
      report(`bot ${width} wall clock (printed only)`, `${Date.now() - t0} ms`);
      expect(results.filter((r) => r.outcome !== 'reached')).toEqual([]);
      for (const r of results) {
        expect(r.genCapHits).toBe(0);
        expect(r.maxGeneratedPerStep).toBeLessThanOrEqual(GEN_PER_STEP_LIMIT);
      }
    }, 120_000);
  }
});

/**
 * One link of the chain, alone on the board: the body bounces on `from` and
 * moves straight (no wrap) at `percent` of RUN_SPEED toward `to`'s centre.
 * True when it lands on `to`.
 */
function linkLands(
  base: RunState,
  from: Platform,
  to: Platform,
  percent: number,
  tick = 0,
  delay = 0,
  offset = 0,
): boolean {
  const cap = Math.floor((RUN_SPEED * percent) / 100);
  const fromCentre = platformLeft(from, tick) + Math.floor(from.width / 2) + offset;
  let s: RunState = {
    ...base,
    platforms: from.id === to.id ? [from] : [from, to].sort((a, b) => a.top - b.top),
    tick,
    x: fromCentre,
    target: fromCentre,
    y: from.top,
    vy: JUMP_SPEED,
    // The highest ordinary camera position from already bouncing here.
    // Recovery must survive the real viewport, including its pruning/over.
    cameraBottom: Math.max(base.cameraBottom, from.top + apexUnits() - CAMERA_ANCHOR),
    maxHeight: from.top + apexUnits(),
  };
  for (let k = 0; k < 800; k++) {
    const centre = platformLeft(to, s.tick + 1) + Math.floor(to.width / 2);
    const want = s.x + Math.max(-cap, Math.min(cap, centre - s.x));
    s = step(s, { drag: k < delay ? 0 : want - s.target, dir: 0 });
    if (s.event === 'bounce') {
      if (s.y === to.top) return true;
      // Forward and same-platform proofs require the FIRST landing. Only
      // returning to a lower surface may wait for the moving platform to pass.
      if (to.top >= from.top) return false;
    }
    if (s.status === 'over') return false;
  }
  return false;
}

describe('every link of the safety chain, alone, at 70 % speed and no wrap (§3 invariant 3)', () => {
  it('lands on the next chain platform from the centre of the last, for 20 seeds × 2 widths × 2,000 links', () => {
    const base: RunState = {
      ...start(createRun('link', 'normal')),
      gen: { next: 1_000_000, chainTop: Number.MAX_SAFE_INTEGER, chainCenterPx: 180 },
    };
    let links = 0;
    const misses: string[] = [];
    for (const width of ['normal', 'wide'] as PlatformWidth[]) {
      for (let n = 0; n < 20; n++) {
        const tower = generateTower(`link-${n}`, width, 2000);
        // The first link starts from the floor's middle: the floor (segment 0)
        // spans the board, so a 64 px stand-in at its centre is the same jump.
        let prev: Platform = { ...base.platforms[0]!, left: (180 - 32) * 120, width: 64 * 120 };
        for (const s of tower) {
          if (!linkLands(base, prev, s.chain, CHAIN_SPEED_PERCENT)) {
            misses.push(`link-${n}/${width}/${s.segment}`);
          }
          links += 1;
          prev = s.chain;
        }
      }
    }
    report('chain links jumped alone at 70 %', links, `misses ${misses.length}`);
    expect(misses).toEqual([]);
  }, 60_000);
});

describe('moving-route phase and recovery evidence', () => {
  it('enters, exits, returns and re-bounces through every movement tick, in both widths', () => {
    const base: RunState = {
      ...start(createRun('phases', 'normal')),
      gen: { next: 1_000_000, chainTop: Number.MAX_SAFE_INTEGER, chainCenterPx: 180 },
    };
    const period = (2 * CHAIN_MOVE_SPAN_PX * SUB) / CHAIN_MOVE_SPEED;
    let checks = 0;
    const failures: string[] = [];
    // Synthetic extremes cover the entire legal range, independently of
    // generated seeds: the largest gap and full 170 px phase-wide distance.
    for (const widthPx of [64, 96]) {
      for (const side of [-1, 1]) {
        for (const gap of [90, 128]) {
          const moving: Platform = {
            id: 4,
            segment: 2,
            kind: 'moving',
            chain: true,
            top: gap * SUB,
            left: (180 - widthPx / 2 - 48) * SUB,
            width: widthPx * SUB,
            motion: {
              lo: (180 - widthPx / 2 - 48) * SUB,
              span: CHAIN_MOVE_SPAN_PX * SUB,
              speed: CHAIN_MOVE_SPEED,
              phase: 0,
            },
          };
          const lower: Platform = {
            ...moving,
            id: 2,
            segment: 1,
            kind: 'static',
            top: 0,
            left: (180 + side * 122 - widthPx / 2) * SUB,
            motion: null,
          };
          const upper: Platform = { ...lower, id: 6, segment: 3, top: 2 * gap * SUB };
          for (let tick = 0; tick < period; tick++) {
            // A 150 ms reaction delay is additional evidence, not the safety
            // proof. Starting at the centre still leaves all phases reachable.
            for (const [label, from, to] of [
              ['enter', lower, moving],
              ['exit', moving, upper],
              ['return', moving, lower],
              ['wait', moving, moving],
            ] as const) {
              if (!linkLands(base, from, to, CHAIN_SPEED_PERCENT, tick, 18)) {
                failures.push(`${widthPx}/${side}/${gap}/${tick}/${label}`);
              }
              checks++;
            }
            // An edge landing must also leave a viable next jump. This uses
            // no reaction delay, keeping the original 70 % safety guarantee.
            for (const edge of [-1, 1]) {
              if (
                !linkLands(
                  base,
                  moving,
                  upper,
                  CHAIN_SPEED_PERCENT,
                  tick,
                  0,
                  edge * (widthPx / 2 + 10) * SUB,
                )
              ) {
                failures.push(`${widthPx}/${side}/${gap}/${tick}/edge-${edge}`);
              }
              checks++;
            }
          }
        }
      }
    }
    report('moving-route phase / recovery jumps', checks, `failures ${failures.length}`);
    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toHaveLength(0);
  }, 60_000);
});
