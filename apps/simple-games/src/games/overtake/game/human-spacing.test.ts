// @vitest-environment node
import { expect, it } from 'vitest';
import { FULL_SPEED, SUB } from './constants';
import { generateCourse } from './course';
import { delayedPairRun } from './pair-test-helpers';
import { LEVELS, report } from './test-helpers';

it('every wall pair admits a centred driver after 200 ms reaction + a 30 Hz input phase, with ±8 px aim error', () => {
  let pairs = 0;
  let runs = 0;
  let minimum = Infinity;
  let maximum = 0;
  for (const level of LEVELS) {
    const course = generateCourse(level);
    for (const second of course.rows) {
      if (second.kind !== 'easy2' && second.kind !== 'gate2') continue;
      pairs += 1;
      minimum = Math.min(minimum, second.lead / SUB);
      maximum = Math.max(maximum, second.lead / SUB);
      for (const phase of [0, 1, 2, 3]) {
        for (const firstOffset of [-8, 8]) {
          for (const secondOffset of [-8, 8]) {
            const run = delayedPairRun(course, second, {
              reactionSteps: 24 + phase,
              firstOffset,
              secondOffset,
            });
            expect(
              run.overlaps,
              `Lv${level} row${second.index}, phase${phase}, ${firstOffset}→${secondOffset}`,
            ).toBe(0);
            expect(run.bumps + run.scrapes).toBe(0);
            runs += 1;
          }
        }
      }
    }
  }
  report(
    'delayed human geometry: pairs / runs / clear gap px',
    pairs,
    runs,
    minimum.toFixed(2),
    maximum.toFixed(2),
  );
}, 60_000);

it('braking retains a practical benefit: 250 ms delayed full-throttle steering hits walls that the moderate run clears', () => {
  let rushHits = 0;
  for (let level = 11; level <= 100; level++) {
    const course = generateCourse(level);
    const second = course.rows
      .filter((r) => r.kind === 'gate2')
      .sort((a, b) => b.lead - a.lead)[0]!;
    const moderate = delayedPairRun(course, second);
    const rush = delayedPairRun(course, second, { speed: FULL_SPEED });
    expect(moderate.overlaps, `Lv${level}`).toBe(0);
    expect(rush.bumps, `Lv${level}`).toBeGreaterThan(0);
    expect(rush.steps, `Lv${level}`).toBeGreaterThan(moderate.steps);
    rushHits += 1;
  }
  report('delayed full-throttle runs improved by braking (one widest pair / level)', rushHits);
}, 60_000);

it('the shipped binary brake also clears every pair: hold ▼ before the first wall clears, release, then react and steer', () => {
  let runs = 0;
  for (const level of LEVELS) {
    const course = generateCourse(level);
    for (const second of course.rows) {
      if (second.kind !== 'easy2' && second.kind !== 'gate2') continue;
      for (const firstOffset of [-8, 8]) {
        for (const secondOffset of [-8, 8]) {
          const run = delayedPairRun(course, second, {
            buttonBrake: true,
            reactionSteps: 27,
            firstOffset,
            secondOffset,
          });
          expect(
            run.overlaps,
            `Lv${level} row${second.index}, ${firstOffset}→${secondOffset}`,
          ).toBe(0);
          runs += 1;
        }
      }
    }
  }
  report('binary brake, 200 ms + worst 30 Hz phase, ±8 px, no-contact runs', runs);
}, 60_000);
