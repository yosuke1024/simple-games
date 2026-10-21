// @vitest-environment node
/**
 * One race's states (docs/OVERTAKE_RULES.md §2): ready waits, the first input
 * rolls everyone at 240, pause freezes, the race ends only at the player's
 * line, and the place counts rivals home strictly earlier.
 */
import { describe, expect, it } from 'vitest';
import { PLAYER_START, RIVAL_STARTS, ROLLING_START_SPEED, SUB } from './constants';
import { controllerFor } from './bots';
import { generateCourse } from './course';
import { toMutable } from './physics';
import {
  createRace,
  livePlace,
  pauseRace,
  progressPermille,
  resumeRace,
  startRace,
  stepRace,
  type RaceState,
} from './race';
import { simulateRivals } from './rivals';
import { COAST } from './types';

const course = generateCourse(12);

describe('ready → running ⇄ paused → finished (§2)', () => {
  it('ready shows the grid and does not move', () => {
    const ready = createRace(12);
    expect(ready.status).toBe('ready');
    expect([ready.player.r, ready.player.x]).toEqual([PLAYER_START.r, PLAYER_START.x]);
    expect(ready.rivals.map((r) => [r.car.r, r.car.x])).toEqual(
      RIVAL_STARTS.map((s) => [s.r, s.x]),
    );
    expect(stepRace(course, ready, COAST)).toBe(ready);
    expect(pauseRace(ready)).toBe(ready);
  });

  it('the first input rolls all four at 240 px/s', () => {
    const running = startRace(createRace(12));
    expect(running.status).toBe('running');
    // The literal 240 of §1 / §2, not the constant: changing it has to fail here.
    expect(ROLLING_START_SPEED).toBe(240);
    expect([running.player.w, ...running.rivals.map((r) => r.car.w)]).toEqual([240, 240, 240, 240]);
    expect(startRace(running)).toBe(running);
  });

  it('pause freezes everything; only resume runs it again', () => {
    let s = startRace(createRace(12));
    for (let i = 0; i < 50; i++) s = stepRace(course, s, COAST);
    const paused = pauseRace(s);
    expect(paused.status).toBe('paused');
    expect(stepRace(course, paused, COAST)).toBe(paused);
    const resumed = resumeRace(paused);
    expect(resumed.status).toBe('running');
    expect(stepRace(course, resumed, COAST).step).toBe(51);
  });

  it("runs to the player's line even after every rival is home, and places by goal step", () => {
    const finish = simulateRivals(course, 12).finish as number[];
    let s: RaceState = startRace(createRace(12));
    // A crawl: hardest brake, steering by the planner — every rival is home first.
    const bot = controllerFor(course, 'crawler');
    while (s.status === 'running') s = stepRace(course, s, bot.next(s.step, toMutable(s.player)));
    expect(s.status).toBe('finished');
    expect(s.finish).toBe(s.step);
    expect(s.finish!).toBeGreaterThan(Math.max(...finish));
    expect(s.place).toBe(4);
    expect(s.rivals.map((r) => r.finish)).toEqual(finish);
    expect(stepRace(course, s, COAST)).toBe(s);
  });

  it('first place when the player is home first; a tie on the step goes to the player', () => {
    const finish = simulateRivals(course, 12).finish as number[];
    let s: RaceState = startRace(createRace(12));
    const bot = controllerFor(course, 'A');
    while (s.status === 'running') s = stepRace(course, s, bot.next(s.step, toMutable(s.player)));
    expect(s.place).toBe(1);
    expect(s.finish!).toBeLessThan(finish[0]!);
    // The tie rule, on a hand-made state: a rival home on the same step is behind.
    const tied = {
      ...s,
      status: 'running' as const,
      finish: null,
      place: null,
      step: finish[0]! - 1,
    };
    const near = { ...tied, player: { ...tied.player, r: course.length - 1, w: 400 } };
    const rivals = tied.rivals.map((r, i) =>
      i === 0 ? { ...r, finish: null, car: { ...r.car, r: course.length - 1, w: 400 } } : r,
    );
    const done = stepRace(course, { ...near, rivals }, COAST);
    expect(done.rivals[0]!.finish).toBe(done.finish);
    expect(done.place).toBe(1);
  });

  it("live place counts rivals ahead of the player's front, ties to the player", () => {
    const s = startRace(createRace(12));
    // Grid: rivals 2 and 3 start 90 px ahead, rival 1 level with the player.
    expect(livePlace(s)).toBe(3);
    const ahead = { ...s, player: { ...s.player, r: 10 * SUB } };
    expect(livePlace(ahead)).toBe(1);
    expect(progressPermille(course, course.length / 2)).toBe(500);
    expect(progressPermille(course, -90 * SUB)).toBe(0);
  });

  it('reports a Bump and the lock release on the player for the board (sound, re-anchoring)', () => {
    let s = startRace(createRace(12));
    let bumpedAt = -1;
    let releasedAt = -1;
    for (let i = 0; i < 4000 && releasedAt < 0; i++) {
      s = stepRace(course, s, COAST);
      if (s.bumped && bumpedAt < 0) bumpedAt = s.step;
      if (s.lockReleased) releasedAt = s.step;
    }
    expect(bumpedAt).toBeGreaterThan(0);
    expect(releasedAt - bumpedAt).toBe(36);
  });
});
