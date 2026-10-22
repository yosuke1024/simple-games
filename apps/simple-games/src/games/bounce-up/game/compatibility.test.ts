/**
 * A golden tower and golden runs: one seed, pinned exactly
 * (docs/BOUNCE_UP_RULES.md §3「決定性」, §10).
 *
 * A height is only a record if the tower it was climbed on still exists. Any
 * change to the rng, the ramps, the draw order, the step or the input model
 * moves these strings — failing here is the point: it has to be a decision
 * rather than a side effect. If a change is intended, regenerate the strings
 * and say so in the commit, with what it costs the records already kept.
 */
import { describe, expect, it } from 'vitest';
import { runBot } from './bot';
import { generateTower, platformLeft } from './generate';
import { createRun, start, step } from './physics';
import { Fnv, expandInputs, platformToString, stepToString } from './test-helpers';
import type { PlatformWidth, RunState, StepInput } from './types';

const GOLDEN = 'bounce-golden';

function towerDigest(width: PlatformWidth, count: number): string {
  const h = new Fnv();
  for (const s of generateTower(GOLDEN, width, count)) {
    h.add(platformToString(s.chain));
    if (s.extra !== null) h.add(platformToString(s.extra));
  }
  return h.hex();
}

/** A run of hand-written inputs: no bot, so only the step and the tower can move it. */
const SCRIPT: readonly (readonly [number, number, number])[] = [
  [100, 0, 0],
  [40, 0, 1],
  [60, 0, 0],
  [30, 300, 0],
  [80, 0, 0],
  [25, 0, -1],
  [90, -200, 0],
  [120, 0, 0],
  [45, 0, 1],
  [150, 120, 0],
  [60, 0, -1],
  [200, 0, 0],
  [80, 450, 0],
  [300, 0, 0],
];

function runScript(
  seed: string,
  width: PlatformWidth,
  inputs: readonly StepInput[],
): { state: RunState; trace: string } {
  let s = start(createRun(seed, width));
  const h = new Fnv();
  for (const input of inputs) {
    s = step(s, input);
    h.add(stepToString(s));
  }
  return { state: s, trace: h.hex() };
}

describe('the golden tower', () => {
  it(`the first segments of '${GOLDEN}' are unchanged`, () => {
    const opening = generateTower(GOLDEN, 'normal', 6)
      .map((s) =>
        [s.chain, s.extra]
          .filter((p) => p !== null)
          .map((p) => platformToString(p!))
          .join(' '),
      )
      .join(' | ');
    expect(opening).toBe(
      '2:sc@7800/4920/7680 3:s@3840/22080/7680 | 4:sc@15600/11760/7680 5:s@11640/29040/7680 | ' +
        '6:sc@21720/3360/7680 7:s@18600/30960/7680 | 8:sc@30240/240/7680 9:s@25920/3720/7680 | ' +
        '10:sc@37080/7320/7680 | 12:sc@43200/480/7680',
    );
  });

  it('2,000 segments at each width are unchanged', () => {
    expect(towerDigest('normal', 2000)).toBe('70b48d1e');
    expect(towerDigest('wide', 2000)).toBe('221e0b49');
  });

  it('where each moving platform is at fixed ticks is unchanged (the triangle wave of §3)', () => {
    // The tower digest pins the motion parameters; this pins the wave itself —
    // its direction, its phase and its turns — at ticks on both legs.
    const h = new Fnv();
    let moving = 0;
    for (const s of generateTower(GOLDEN, 'wide', 1000)) {
      const e = s.extra;
      if (e === null || e.motion === null) continue;
      moving += 1;
      for (const t of [0, 1, 7, 333, 1000, 12345]) h.add(`${e.id}@${t}=${platformLeft(e, t)}`);
    }
    expect(`${moving}/${h.hex()}`).toBe('84/2271f2ce');
  });
});

describe('golden runs', () => {
  it('a hand-written input script on the golden tower is unchanged', () => {
    const { state, trace } = runScript(GOLDEN, 'normal', expandInputs(SCRIPT));
    expect(
      `${state.status}/${state.tick}/${state.maxHeight}/${state.reachedSegment}/${trace}`,
    ).toBe('running/1380/144035/18/6538acdf');
  });

  it('the reference bot on the golden tower is unchanged, landing on all three kinds', () => {
    // To segment 1,000: past 300 (moving) and 600 (vanishing), so the run
    // itself touches the later kinds and any change to how they move or go
    // moves this string.
    const r = runBot(GOLDEN, 'wide', { targetSegment: 1000, stepLimit: 100_000 });
    const l = r.landings;
    expect(l.static + l.moving + l.vanishing).toBe(r.bounces);
    expect(l.moving).toBeGreaterThan(0);
    expect(l.vanishing).toBeGreaterThan(0);
    expect(
      `${r.outcome}/${r.steps}/${r.score}/${r.bounces}/${l.static}/${l.moving}/${l.vanishing}`,
    ).toBe('reached/58609/7692/747/716/23/8');
  });
});

describe('determinism (§3)', () => {
  it('the same seed and the same inputs give the same run, step for step', () => {
    const inputs = expandInputs(SCRIPT);
    const a = runScript('det-run', 'wide', inputs);
    const b = runScript('det-run', 'wide', inputs);
    expect(b.trace).toBe(a.trace);
    expect(b.state).toEqual(a.state);
    expect(runScript('det-run-2', 'wide', inputs).trace).not.toBe(a.trace);
  });
});
