/**
 * Golden runs: one seed, pinned exactly (docs/SNAKE_RULES.md §8).
 *
 * A best score is a promise, and so is a suspended run: the record on the
 * statistics screen was set on food this draw produced, and a saved run
 * comes back with its food and its random state only if the same seed and the
 * same body still draw the same cell (§11). Any change to the rng, to the
 * order of the draws, to the board, to the opening snake or to the collision
 * order fails here — which is the point: it has to be a decision rather than
 * a side effect.
 *
 * This pins the behaviour these strings were generated from, at the first
 * commit of the game (2026-10-17). Do not edit them to go green. If a change
 * is intended, regenerate them and say so in the commit message, along with
 * what it costs existing records and suspended runs.
 */
import { describe, expect, it } from 'vitest';
import { encodeBody } from './serialize';
import { createSession, start, tick, turn, type TickEvent } from './session';
import { cyclePilot, cycleSuccessors } from './test-helpers';
import {
  BOARD_SIZE,
  INITIAL_BODY,
  INITIAL_DIRECTION,
  INPUT_QUEUE_LIMIT,
  TICK_MS,
  cellAt,
  type Direction,
} from './types';

const SEED = 'snake-golden';

const LETTER: Readonly<Record<TickEvent, string>> = {
  none: '.',
  move: 'm',
  eat: 'e',
  wall: 'w',
  self: 's',
  clear: 'c',
};

describe('runs that must never change', () => {
  it('puts the first food in the same cell', () => {
    // Row 7, column 4: straight below the opening head.
    expect(createSession(SEED).food).toBe(cellAt(7, 4));
  });

  it('plays a fixed script the same way: eat, a tail chase, the wall', () => {
    // Down onto the food, left, up, right, then down into the cell the tail
    // is leaving (§3), and on down to the bottom wall.
    const presses: Readonly<Record<number, Direction>> = {
      0: 'down',
      1: 'left',
      3: 'up',
      4: 'right',
      5: 'down',
    };
    let session = start(createSession(SEED));
    let events = '';
    for (let t = 0; session.status === 'running' && t < 100; t++) {
      const press = presses[t];
      if (press) session = turn(session, press);
      const outcome = tick(session);
      session = outcome.session;
      events += LETTER[outcome.event];
    }
    expect(events).toBe('emmmmmmmmmmmw');
    expect(encodeBody(session.body)).toBe('554r4d3z');
    expect(session.food).toBe(92);
    expect(session.score).toBe(1);
    expect(session.ticks).toBe(12);
    expect(session.crash).toBe('wall');
  });

  it('draws the same twelve foods for the cycle pilot, and ends the same way on itself', () => {
    const pilot = cyclePilot(cycleSuccessors());
    let session = createSession(SEED);
    const foods = [session.food];
    while (session.score < 11) {
      const outcome = tick(turn(session, pilot(session)));
      session = outcome.session;
      if (outcome.event === 'eat') foods.push(session.food);
    }
    expect(foods.join(',')).toBe('102,89,112,111,8,167,22,164,73,152,55,0');
    expect(session.ticks).toBe(1134);
    expect(encodeBody(session.body)).toBe('1j1514131211100z0y0x0w0v0u0t');
    expect(session.direction).toBe('down');

    // Off the cycle: left, then up into the row the body lies along.
    session = tick(turn(session, 'left')).session;
    const crash = tick(turn(session, 'up'));
    expect(crash.event).toBe('self');
    expect(encodeBody(crash.session.body)).toBe('1i1j1514131211100z0y0x0w0v0u');
    expect(crash.session.ticks).toBe(1135);
  });

  it('takes the same number of moves to clear the board on the cycle', () => {
    const pilot = cyclePilot(cycleSuccessors());
    let session = createSession(SEED);
    while (session.status === 'ready' || session.status === 'running') {
      session = tick(turn(session, pilot(session))).session;
    }
    expect(session.status).toBe('cleared');
    expect(session.ticks).toBe(9132);
  });

  it('keeps the numbers the runs above were made with', () => {
    // Named here as well as in types.ts: changing any of them changes every
    // run above, every saved run's meaning, or every recorded best.
    expect(BOARD_SIZE).toBe(14);
    expect(INITIAL_BODY).toEqual([cellAt(6, 4), cellAt(6, 3), cellAt(6, 2)]);
    expect(INITIAL_DIRECTION).toBe('right');
    expect(INPUT_QUEUE_LIMIT).toBe(3);
    expect(TICK_MS).toEqual({ slow: 220, normal: 150, fast: 100 });
  });
});
