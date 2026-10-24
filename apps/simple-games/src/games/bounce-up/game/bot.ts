/**
 * The reference bot (docs/BOUNCE_UP_RULES.md §3「踏破」, §10): tests only,
 * never the app — index.ts leaves it out.
 *
 * Greedy and honest about its limits: after every bounce it aims at the
 * safety-chain platform of the next segment above where it bounced, and
 * moves straight at its centre (no wrap) at no more than `speedPercent` of
 * RUN_SPEED — the body itself never moves faster than that, not just the
 * target. It has no reaction time and perfect aim, so what it measures is
 * the tower's reachability, not a person's.
 */
import { RUN_SPEED } from './constants';
import { platformLeft } from './generate';
import { createRun, start, step } from './physics';
import { scoreOf } from './score';
import type { Platform, PlatformKind, PlatformWidth, RunState } from './types';

export interface BotOptions {
  /** Stop once a platform of this segment is landed on. */
  readonly targetSegment: number;
  /** The body's speed cap, % of RUN_SPEED (75 = 450 px/s). */
  readonly speedPercent?: number;
  /** Work bound: steps per run (§11). */
  readonly stepLimit: number;
}

export interface BotResult {
  readonly reachedSegment: number;
  readonly steps: number;
  readonly outcome: 'reached' | 'over' | 'unfinished';
  readonly score: number;
  /** Most platforms the state held at once. */
  readonly maxPlatforms: number;
  /** Most segments one step generated. */
  readonly maxGeneratedPerStep: number;
  readonly genCapHits: number;
  readonly bounces: number;
  /**
   * Bounces by the kind of platform landed on. Tops are unique heights (the
   * chain rises every segment, an extra sits strictly between two chain
   * tops), so the platform is the one whose top the foot was set on.
   */
  readonly landings: Readonly<Record<PlatformKind, number>>;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** The lowest chain platform above `top`, or null. */
function nextChain(platforms: readonly Platform[], top: number): Platform | null {
  for (const p of platforms) {
    if (p.chain && p.top > top) return p;
  }
  return null;
}

export function runBot(seed: string, width: PlatformWidth, opts: BotOptions): BotResult {
  const cap = Math.floor((RUN_SPEED * (opts.speedPercent ?? 75)) / 100);
  let s: RunState = start(createRun(seed, width));
  let landedTop = 0;
  let goal = nextChain(s.platforms, landedTop);
  let steps = 0;
  let maxPlatforms = s.platforms.length;
  let maxGenerated = 0;
  let bounces = 0;
  const landings: Record<PlatformKind, number> = { static: 0, moving: 0, vanishing: 0 };
  while (
    s.status === 'running' &&
    s.reachedSegment < opts.targetSegment &&
    steps < opts.stepLimit
  ) {
    let drag = 0;
    if (goal !== null) {
      const centre = platformLeft(goal, s.tick + 1) + Math.floor(goal.width / 2);
      const want = s.x + clamp(centre - s.x, -cap, cap);
      drag = want - s.target;
    }
    const before = s;
    s = step(s, { drag, dir: 0 });
    steps += 1;
    if (s.event === 'bounce' || s.event === 'vanish') {
      bounces += 1;
      // `before` still holds a vanishing platform that this step removed.
      const landed = before.platforms.find((p) => p.top === s.y);
      if (landed !== undefined) landings[landed.kind] += 1;
      landedTop = s.y;
      goal = nextChain(s.platforms, landedTop);
    } else if (goal === null) {
      goal = nextChain(s.platforms, landedTop);
    }
    if (s.platforms.length > maxPlatforms) maxPlatforms = s.platforms.length;
    if (s.generatedLastStep > maxGenerated) maxGenerated = s.generatedLastStep;
  }
  return {
    reachedSegment: s.reachedSegment,
    steps,
    outcome:
      s.reachedSegment >= opts.targetSegment
        ? 'reached'
        : s.status === 'over'
          ? 'over'
          : 'unfinished',
    score: scoreOf(s.maxHeight),
    maxPlatforms,
    maxGeneratedPerStep: maxGenerated,
    genCapHits: s.genCapHits,
    bounces,
    landings,
  };
}
