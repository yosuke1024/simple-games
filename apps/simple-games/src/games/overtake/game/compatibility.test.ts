// @vitest-environment node
/**
 * Golden courses and races: pinned exactly (docs/OVERTAKE_RULES.md §5, §16).
 *
 * A level is a promise. Every player meets the same traffic on the same
 * level, and a retry is the same race (§5). Any change to the rng, the order
 * the generator draws in, the level levers, the geometry, the physics or the
 * planner moves something here — and, through the planner, the rivals' pace
 * — so it has to be a decision rather than a side effect. If one is
 * intended, regenerate these values and RIVAL_PACE (game/rivalPace.test.ts,
 * `OT_REGEN_PACE=1`) in the same commit and say so in the message.
 *
 * 2026-10-23: every pair now allows delayed centre-to-centre steering (§5).
 * This intentionally changes every level, including Lv1–5's opening pair.
 * Courses, inputs, results and the replay are regenerated together with the
 * 100-level rival pace table. Existing local progress and records stay intact.
 *
 * Rival goal steps are pinned from the rivals-only run (§6), because a race
 * stops when the player finishes and may not see every rival home.
 *
 * The bot races pin a digest of the inputs the bot produced together with the
 * outcome, so a change to the physics and a change to the planner fail them
 * alike. The replay golden below feeds a stored input list straight to the
 * step: it moves only when the physics (or the course) does.
 */
import { describe, expect, it } from 'vitest';
import { controllerFor, placeFor, runBot } from './bots';
import { PLAYER_START, ROLLING_START_SPEED, SUB } from './constants';
import { generateCourse } from './course';
import { newCar, stepCar } from './physics';
import { simulateRivals } from './rivals';
import { courseDigest, fnv1a, rowToString } from './test-helpers';
import type { BotKind } from './bots';
import type { CarState } from './types';

/** level → [rows, digest of every row, the first five rows]. */
const COURSES: Record<number, [number, string, string[]]> = {
  '1': [
    44,
    '44e58995',
    [
      'easy1/wall/g1/u83400/L6960/D0:s3360-7440,s11440-15520,s27680-31760,s35760-39840',
      'easy2/wall/g2/u116520/L6960/D19200:s3360-7440,s11440-15520,s15520-19600,s23600-27680',
      'normal/single/g2/u155976/L6960/D25536:s7400-11480',
      'normal/two/g2/u195432/L6960/D25536:s7400-11480,s19560-23640',
      'normal/single/g1/u234888/L6960/D25536:s7400-11480',
    ],
  ],
  '10': [
    61,
    '74772404',
    [
      'easy1/wall/g0/u78000/L6960/D0:s15520-19600,s23600-27680,s27680-31760,s35760-39840',
      'easy2/wall/g1/u111120/L6960/D19200:s3360-7440,s11440-15520,s27680-31760,s35760-39840',
      'normal/single/g1/u149578/L6960/D24538:s31720-35800',
      'normal/two/g2/u188036/L6960/D24538:s7400-11480,s19560-23640',
      'normal/single/g1/u226494/L6960/D24538:s7400-11480',
    ],
  ],
  '11': [
    48,
    '26c4ebbb',
    [
      'easy1/wall/g0/u72960/L6960/D0:s15520-19600,s23600-27680,s27680-31760,s35760-39840',
      'easy2/wall/g1/u106080/L6960/D19200:s3360-7440,s11440-15520,s27680-31760,s35760-39840',
      'normal/single/g2/u144434/L8400/D24434:v7160-11720',
      'normal/single/g2/u184228/L8400/D24434:v19320-23880',
      'normal/single/g1/u224022/L8400/D24434:v31480-36040',
    ],
  ],
  '21': [
    57,
    'd6b20029',
    [
      'easy1/wall/g1/u79920/L8400/D0:v3360-7920,v7920-12480,v21600-26160,v26160-30720,v30720-35280,v35280-39840',
      'easy2/wall/g2/u112408/L12480/D17128:t3360-8400,t7440-12480,t12480-17520,t16560-21600,t30720-35760,t34800-39840',
      'gate1/wall/g1/u149338/L8400/D17490:v3360-7920,v7920-12480,v21600-26160,v26160-30720,v30720-35280,v35280-39840',
      'gate2/wall/g0/u181826/L12480/D17128:t12480-17520,t16560-21600,t21600-26640,t25680-30720,t30720-35760,t34800-39840',
      'normal/single/g2/u236245/L8400/D34979:v33000-37560',
    ],
  ],
  '31': [
    62,
    'fd099e4c',
    [
      'easy1/wall/g1/u72840/L12480/D0:t3360-8400,t7440-12480,t21600-26640,t25680-30720,t30720-35760,t34800-39840',
      'easy2/wall/g0/u109408/L6960/D17128:s12480-16560,s17520-21600,s21600-25680,s26640-30720,s30720-34800,s35760-39840',
      'gate1/wall/g1/u139982/L8400/D16654:v3360-7920,v7920-12480,v21600-26160,v26160-30720,v30720-35280,v35280-39840',
      'gate2/wall/g2/u172470/L6960/D17128:s3360-7440,s8400-12480,s12480-16560,s17520-21600,s30720-34800,s35760-39840',
      'normal/single/g2/u203044/L8400/D16654:v33000-37560',
    ],
  ],
  '50': [
    88,
    '3653c967',
    [
      'easy1/wall/g1/u81720/L6960/D0:s3360-7440,s8400-12480,s21600-25680,s26640-30720,s30720-34800,s35760-39840',
      'easy2/wall/g0/u112768/L6960/D17128:s12480-16560,s17520-21600,s21600-25680,s26640-30720,s30720-34800,s35760-39840',
      'normal/truck/g1/u141749/L12480/D15061:t32760-37800',
      'gate1/wall/g0/u176250/L12480/D15061:t12480-17520,t16560-21600,t21600-26640,t25680-30720,t30720-35760,t34800-39840',
      'gate2/wall/g1/u212818/L8400/D17128:v3360-7920,v7920-12480,v21600-26160,v26160-30720,v30720-35280,v35280-39840',
    ],
  ],
  '51': [
    72,
    'd9b7e3f0',
    [
      'easy1/wall/g1/u84840/L12480/D0:t4488-9528,t19080-24120,t26376-31416,t33672-38712',
      'easy2/wall/g3/u125139/L12480/D20859:t4488-9528,t11784-16824,t19080-24120,t33672-38712',
      'gate1/wall/g3/u156565/L8400/D11986:v4728-9288,v12024-16584,v19320-23880,v33912-38472',
      'gate2/wall/g1/u192784/L8400/D20859:v4728-9288,v19320-23880,v26616-31176,v33912-38472',
      'gate1/wall/g3/u232116/L8400/D23972:v4728-9288,v12024-16584,v19320-23880,v33912-38472',
    ],
  ],
  '100': [
    123,
    '7483e674',
    [
      'easy1/wall/g2/u84600/L6960/D0:s4968-9048,s12264-16344,s26856-30936,s34152-38232',
      'easy2/wall/g4/u119379/L8400/D20859:v4728-9288,v12024-16584,v19320-23880,v26616-31176',
      'normal/single/g4/u143445/L8400/D8706:v26616-31176',
      'normal/sand/g4/u167511/L21720/D8706:zs3360-10656/167511-189231',
      'gate1/wall/g3/u204897/L12480/D8706:t4488-9528,t11784-16824,t19080-24120,t33672-38712',
    ],
  ],
};

/** Lv1–5 also change: their opening wall pairs now leave human reaction room. */
const OPENING_COURSES: Record<number, [number, string]> = {
  '1': [44, '44e58995'],
  '2': [45, 'c9b8fb80'],
  '3': [45, 'caec0ba1'],
  '4': [47, '08328fa5'],
  '5': [45, '84efa0b9'],
};

describe('Lv1–5 opening courses remain deterministic and have no zones (§5)', () => {
  for (const [level, [rows, digest]] of Object.entries(OPENING_COURSES)) {
    it(`Lv${level}`, () => {
      const course = generateCourse(Number(level));
      expect(course.zones).toEqual([]);
      expect([course.rows.length, courseDigest(course)]).toEqual([rows, digest]);
    });
  }
});

/** level → the rivals-only run's goal steps [rival 1, 2, 3]. */
const RIVAL_GOALS: Record<number, [number, number, number]> = {
  '1': [5767, 6001, 6274],
  '11': [6228, 6477, 6799],
  '51': [7284, 7581, 7939],
  '100': [10108, 10495, 11021],
};

/** [level, bot] → [goal step, Bumps, place, digest of its whole input sequence]. */
const RACES: Array<[number, BotKind, number, number, number, string]> = [
  [1, 'A', 4610, 0, 1, 'efe8400c'],
  [1, 'rusher', 4610, 0, 1, 'efe8400c'],
  [11, 'A', 4899, 0, 1, '193b0840'],
  [11, 'rusher', 4899, 0, 1, '193b0840'],
  [51, 'A', 6053, 0, 1, 'd10767d6'],
  [51, 'rusher', 6053, 0, 1, 'd10767d6'],
  [100, 'A', 9325, 0, 1, '170a6518'],
  [100, 'rusher', 9325, 0, 1, '170a6518'],
];

describe('courses that must never change (§5)', () => {
  for (const [level, [rows, digest, firstFive]] of Object.entries(COURSES)) {
    it(`Lv${level}`, () => {
      const course = generateCourse(Number(level));
      expect(course.rows.length).toBe(rows);
      expect(course.rows.slice(0, 5).map(rowToString)).toEqual(firstFive);
      expect(courseDigest(course)).toBe(digest);
    });
  }
});

describe('races that must never change (§6, §16)', () => {
  for (const [level, goals] of Object.entries(RIVAL_GOALS)) {
    it(`rivals-only run, Lv${level}`, () => {
      const l = Number(level);
      expect(simulateRivals(generateCourse(l), l).finish).toEqual(goals);
    });
  }

  for (const [level, bot, goal, bumps, place, inputs] of RACES) {
    it(`${bot} on Lv${level}: the same inputs, the same result`, () => {
      const course = generateCourse(level);
      const seen: string[] = [];
      const run = runBot(course, controllerFor(course, bot), {
        onStep: (_step, _car, input) => seen.push(`${input.steerX},${input.brake}`),
      });
      expect([run.finishStep, run.bumps, placeFor(run.finishStep!, RIVAL_GOALS[level]!)]).toEqual([
        goal,
        bumps,
        place,
      ]);
      expect(fnv1a(seen.join(';'))).toBe(inputs);
    });
  }
});

/**
 * A stored input list, run-length encoded: [steps, steerX in px or null, brake ‰].
 * Hand-written (not from a bot) so the planner plays no part: it weaves across
 * Lv11, brakes, runs into traffic and pushes on through the Bumps.
 */
const REPLAY_LEVEL = 11;
const REPLAY: Array<[number, number | null, number]> = [
  [120, null, 0],
  [90, 60, 0],
  [150, 300, 250],
  [60, 180, 1000],
  [240, 100, 0],
  [120, null, 600],
  [300, 260, 0],
  [90, 40, 800],
  [400, 200, 0],
  [200, 320, 100],
  [300, 120, 0],
];
/** [final car, Bumps, steps with an overlap, digest of every state]. */
const REPLAY_RESULT: [CarState, number, number, string] = [
  {
    r: 393506,
    x: 14400,
    w: 420,
    target: 14400,
    hold: 0,
    lock: 0,
    blink: 0,
    bumps: 8,
    coneCap: 0,
  },
  8,
  319,
  '5365e841',
];

describe('a stored input list replayed through the step (§1, §16)', () => {
  it(`Lv${REPLAY_LEVEL}: the same inputs, the same states`, () => {
    const course = generateCourse(REPLAY_LEVEL);
    let car = newCar(PLAYER_START.r, PLAYER_START.x, ROLLING_START_SPEED);
    const states: string[] = [];
    let overlaps = 0;
    for (const [steps, steer, brake] of REPLAY) {
      for (let i = 0; i < steps; i++) {
        const next = stepCar(course, car, { steerX: steer === null ? null : steer * SUB, brake });
        car = next.car;
        if (next.report.overlapped) overlaps += 1;
        states.push(
          `${car.r},${car.x},${car.w},${car.target},${car.hold},${car.lock},${car.blink},${car.coneCap}`,
        );
      }
    }
    expect([car, car.bumps, overlaps, fnv1a(states.join(';'))]).toEqual(REPLAY_RESULT);
  });
});
