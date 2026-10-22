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
 * Sand and cones (2026-10-22) moved every course from Lv6 on, by decision
 * (§5 "決定性"): their template weights sit at the tail of the draw, so Lv1
 * (and Lv1–5) still draws exactly as before — the Lv1 course, its rivals and
 * its bot input digests below are the pre-sand values, unchanged. The other
 * levels and the replay (whose state string now carries coneCap) are pinned
 * again: the courses on the new generator, the rival goals and bot races on
 * the two-stage planner (§6 "砂とコーン") and the RIVAL_PACE regenerated on it.
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
  1: [
    44,
    '629447ab',
    [
      'easy1/wall/g1/u83400/L6960/D0:s3360-7440,s11440-15520,s27680-31760,s35760-39840',
      'easy2/wall/g2/u101604/L6960/D4284:s3360-7440,s11440-15520,s15520-19600,s23600-27680',
      'normal/single/g2/u141060/L6960/D25536:s7400-11480',
      'normal/two/g2/u180516/L6960/D25536:s7400-11480,s19560-23640',
      'normal/single/g1/u219972/L6960/D25536:s7400-11480',
    ],
  ],
  10: [
    61,
    'dce340ce',
    [
      'easy1/wall/g0/u78000/L6960/D0:s15520-19600,s23600-27680,s27680-31760,s35760-39840',
      'easy2/wall/g1/u96204/L6960/D4284:s3360-7440,s11440-15520,s27680-31760,s35760-39840',
      'normal/single/g1/u134662/L6960/D24538:s31720-35800',
      'normal/two/g2/u173120/L6960/D24538:s7400-11480,s19560-23640',
      'normal/single/g1/u211578/L6960/D24538:s7400-11480',
    ],
  ],
  11: [
    61,
    '38479872',
    [
      'easy1/wall/g0/u72960/L6960/D0:s15520-19600,s23600-27680,s27680-31760,s35760-39840',
      'easy2/wall/g1/u91164/L6960/D4284:s3360-7440,s11440-15520,s27680-31760,s35760-39840',
      'gate1/wall/g2/u129518/L6960/D24434:s3360-7440,s11440-15520,s15520-19600,s23600-27680',
      'gate2/wall/g1/u146359/L8400/D2921:v3360-7920,v10960-15520,v27680-32240,v35280-39840',
      'normal/single/g2/u186153/L8400/D24434:v19320-23880',
    ],
  ],
  21: [
    65,
    'b3d02e5e',
    [
      'easy1/wall/g1/u79920/L8400/D0:v3360-7920,v7920-12480,v21600-26160,v26160-30720,v30720-35280,v35280-39840',
      'easy2/wall/g2/u99564/L12480/D4284:t3360-8400,t7440-12480,t12480-17520,t16560-21600,t30720-35760,t34800-39840',
      'gate1/wall/g1/u136494/L8400/D17490:v3360-7920,v7920-12480,v21600-26160,v26160-30720,v30720-35280,v35280-39840',
      'gate2/wall/g0/u154690/L12480/D2836:t12480-17520,t16560-21600,t21600-26640,t25680-30720,t30720-35760,t34800-39840',
      'gate1/wall/g2/u209109/L6960/D34979:s3360-7440,s8400-12480,s12480-16560,s17520-21600,s30720-34800,s35760-39840',
    ],
  ],
  31: [
    69,
    'e8b08c80',
    [
      'easy1/wall/g1/u72840/L12480/D0:t3360-8400,t7440-12480,t21600-26640,t25680-30720,t30720-35760,t34800-39840',
      'easy2/wall/g0/u96564/L6960/D4284:s12480-16560,s17520-21600,s21600-25680,s26640-30720,s30720-34800,s35760-39840',
      'gate1/wall/g1/u127138/L8400/D16654:v3360-7920,v7920-12480,v21600-26160,v26160-30720,v30720-35280,v35280-39840',
      'gate2/wall/g2/u145248/L6960/D2750:s3360-7440,s8400-12480,s12480-16560,s17520-21600,s30720-34800,s35760-39840',
      'normal/single/g2/u175822/L8400/D16654:v33000-37560',
    ],
  ],
  50: [
    93,
    '9f1aa379',
    [
      'easy1/wall/g1/u81720/L6960/D0:s3360-7440,s8400-12480,s21600-25680,s26640-30720,s30720-34800,s35760-39840',
      'easy2/wall/g0/u99924/L6960/D4284:s12480-16560,s17520-21600,s21600-25680,s26640-30720,s30720-34800,s35760-39840',
      'normal/truck/g1/u128905/L12480/D15061:t32760-37800',
      'gate1/wall/g0/u163406/L12480/D15061:t12480-17520,t16560-21600,t21600-26640,t25680-30720,t30720-35760,t34800-39840',
      'gate2/wall/g1/u185429/L8400/D2583:v3360-7920,v7920-12480,v21600-26160,v26160-30720,v30720-35280,v35280-39840',
    ],
  ],
  51: [
    76,
    '75c74e06',
    [
      'easy1/wall/g1/u84840/L12480/D0:t4488-9528,t19080-24120,t26376-31416,t33672-38712',
      'easy2/wall/g3/u113856/L12480/D9576:t4488-9528,t11784-16824,t19080-24120,t33672-38712',
      'gate1/wall/g3/u145282/L8400/D11986:v4728-9288,v12024-16584,v19320-23880,v33912-38472',
      'gate2/wall/g1/u166094/L8400/D5452:v4728-9288,v19320-23880,v26616-31176,v33912-38472',
      'normal/two/g3/u205426/L6960/D23972:s4968-9048,s12264-16344',
    ],
  ],
  100: [
    131,
    '38419cf3',
    [
      'easy1/wall/g2/u84600/L6960/D0:s4968-9048,s12264-16344,s26856-30936,s34152-38232',
      'easy2/wall/g4/u107340/L8400/D8820:v4728-9288,v12024-16584,v19320-23880,v26616-31176',
      'normal/single/g4/u131406/L8400/D8706:v26616-31176',
      'normal/sand/g4/u155472/L21720/D8706:zs3360-10656/155472-177192',
      'normal/works/g3/u192858/L60000/D8706:w3360-10656',
    ],
  ],
};

/**
 * Lv1–5: [rows, digest] measured on the generator as it was before sand and
 * cones (HEAD 8aedecb). Cones and sand weigh 0 there and sit at the tail of
 * the template draw, so these courses must stay byte-identical (§5, §16).
 */
const BEFORE_ZONES: Record<number, [number, string]> = {
  1: [44, '629447ab'],
  2: [45, '46d2aa75'],
  3: [45, '06db4353'],
  4: [47, 'fe89d659'],
  5: [45, 'a249c97f'],
};

describe('Lv1–5 draw exactly as before sand and cones (§5)', () => {
  for (const [level, [rows, digest]] of Object.entries(BEFORE_ZONES)) {
    it(`Lv${level}`, () => {
      const course = generateCourse(Number(level));
      expect(course.zones).toEqual([]);
      expect([course.rows.length, courseDigest(course)]).toEqual([rows, digest]);
    });
  }
});

/** level → the rivals-only run's goal steps [rival 1, 2, 3]. */
const RIVAL_GOALS: Record<number, [number, number, number]> = {
  1: [5785, 6001, 6295],
  11: [7256, 7559, 7902],
  51: [8279, 8619, 9028],
  100: [10886, 11328, 11858],
};

/** [level, bot] → [goal step, Bumps, place, digest of its whole input sequence]. */
const RACES: Array<[number, BotKind, number, number, number, string]> = [
  [1, 'A', 4621, 0, 1, 'f6c9d9da'],
  [1, 'rusher', 4740, 1, 1, '55e01e6c'],
  [11, 'A', 5704, 0, 1, 'b1b4293c'],
  [11, 'rusher', 8149, 25, 4, '0ed6209a'],
  [51, 'A', 6879, 0, 1, '984fd2b5'],
  [51, 'rusher', 8913, 22, 3, '08668421'],
  [100, 'A', 10047, 0, 1, '4a53a187'],
  [100, 'rusher', 11145, 14, 2, '133e1eeb'],
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
    r: 152521,
    x: 17560,
    w: 0,
    target: 14400,
    hold: 9,
    lock: 0,
    blink: 45,
    bumps: 17,
    coneCap: 0,
  },
  17,
  567,
  'dc874dae',
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
