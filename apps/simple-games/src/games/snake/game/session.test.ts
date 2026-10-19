/**
 * The run's states and transitions (docs/SNAKE_RULES.md §2–§7): starting,
 * the input queue, pause and resume, what a stray tick does on a stopped
 * board, eating, the two ways a run ends and the full-board clear.
 */
import { describe, expect, it } from 'vitest';
import { drawFood } from './food';
import {
  createSession,
  isFinished,
  isSuspendable,
  newSeedToken,
  pause,
  pendingHeading,
  resume,
  snakeSeed,
  start,
  tick,
  turn,
  type SnakeSession,
} from './session';
import { TEST_VECTORS, hamiltonianCycle, invariantViolations, stepBetween } from './test-helpers';
import {
  CELL_COUNT,
  DEFAULT_SPEED,
  DIRECTIONS,
  INITIAL_BODY,
  INITIAL_LENGTH,
  INPUT_QUEUE_LIMIT,
  MAX_SCORE,
  OPPOSITE,
  SPEEDS,
  TICK_MS,
  cellAt,
  type Direction,
} from './types';

/** A running session on a body of the test's choosing, head first, facing neck → head. */
function runningOn(
  body: readonly number[],
  food: number,
  overrides: Partial<SnakeSession> = {},
): SnakeSession {
  const direction = stepBetween(body[1]!, body[0]!)!;
  return {
    ...createSession('fixture'),
    status: 'running',
    body,
    direction,
    food,
    score: body.length - INITIAL_LENGTH,
    foodDraws: body.length - INITIAL_LENGTH + 1,
    ...overrides,
  };
}

/** A straight snake of `length` ending at (row, col), heading `direction`. */
function straight(row: number, col: number, direction: Direction, length: number): number[] {
  const [dr, dc] = TEST_VECTORS[direction];
  const body: number[] = [];
  for (let i = 0; i < length; i++) body.push(cellAt(row - dr * i, col - dc * i));
  return body;
}

const FAR_FOOD = cellAt(0, 0);

describe('a fresh run (§2)', () => {
  it('lies still on the board with one food, nothing counted', () => {
    const session = createSession('fresh');
    expect(session.status).toBe('ready');
    expect(session.body).toEqual(INITIAL_BODY);
    expect(session.body).toEqual([cellAt(6, 4), cellAt(6, 3), cellAt(6, 2)]);
    expect(session.direction).toBe('right');
    expect(session.queue).toEqual([]);
    expect(INITIAL_BODY).not.toContain(session.food);
    expect(session.food).toBe(drawFood('fresh', 0, INITIAL_BODY));
    expect(session.foodDraws).toBe(1);
    expect(session.score).toBe(0);
    expect(session.ticks).toBe(0);
    expect(session.crash).toBeNull();
    expect(session.elapsedSeconds).toBe(0);
    expect(session.speed).toBe(DEFAULT_SPEED);
    expect(DEFAULT_SPEED).toBe('normal');
    expect(invariantViolations(session)).toEqual([]);
  });

  it('keeps the speed it was made with', () => {
    expect(createSession('s', 'slow').speed).toBe('slow');
    expect(createSession('s', 'fast').speed).toBe('fast');
  });

  it('gives the same seed the same food, and other seeds other food', () => {
    expect(createSession('same').food).toBe(createSession('same').food);
    const foods = new Set(Array.from({ length: 30 }, (_, i) => createSession(`other-${i}`).food));
    expect(foods.size).toBeGreaterThan(15);
  });

  it('does not move until the first input, however many ticks arrive', () => {
    const session = createSession('waiting');
    for (let i = 0; i < 100; i++) {
      const outcome = tick(session);
      expect(outcome.event).toBe('none');
      expect(outcome.session).toBe(session);
    }
  });

  it('shares one frozen opening body, so no caller can bend it for the next run', () => {
    const a = createSession('a');
    const b = createSession('b');
    expect(a.body).toBe(INITIAL_BODY);
    expect(b.body).toBe(INITIAL_BODY);
    expect(Object.isFrozen(INITIAL_BODY)).toBe(true);
    expect(() => (a.body as number[]).reverse()).toThrow(TypeError);
    expect(INITIAL_BODY).toEqual([cellAt(6, 4), cellAt(6, 3), cellAt(6, 2)]);
    for (const table of [DIRECTIONS, SPEEDS, OPPOSITE, TICK_MS]) {
      expect(Object.isFrozen(table)).toBe(true);
    }
  });

  it('makes a seed per run from the clock and a random number', () => {
    expect(newSeedToken(36 ** 3, () => 0.5)).toBe(
      `1000-${Math.floor(0.5 * 0xffffff).toString(36)}`,
    );
    expect(snakeSeed('abc')).toBe('snake-abc');
    expect(snakeSeed(newSeedToken(Date.now(), Math.random))).toMatch(/^snake-[0-9a-z]+-[0-9a-z]+$/);
  });
});

describe('the speeds (§7)', () => {
  it('ticks every 220 / 150 / 100 ms, slowest to fastest', () => {
    expect(TICK_MS).toEqual({ slow: 220, normal: 150, fast: 100 });
  });
});

describe('starting (§5, §6)', () => {
  it('starts on Start, once', () => {
    const ready = createSession('go');
    const running = start(ready);
    expect(running.status).toBe('running');
    expect(running.queue).toEqual([]);
    expect(start(running)).toBe(running);
  });

  it('starts on a direction, which the first move then takes', () => {
    const running = turn(createSession('go'), 'up');
    expect(running.status).toBe('running');
    expect(running.queue).toEqual(['up']);
    // The press is for the next tick, not for now (§5).
    expect(running.direction).toBe('right');
    expect(running.body).toEqual(INITIAL_BODY);
    const moved = tick(running).session;
    expect(moved.body[0]).toBe(cellAt(5, 4));
    expect(moved.direction).toBe('up');
  });

  it('starts straight ahead on the heading it already has', () => {
    const running = turn(createSession('go'), 'right');
    expect(running.status).toBe('running');
    expect(running.queue).toEqual([]);
    expect(tick(running).session.body[0]).toBe(cellAt(6, 5));
  });

  it('ignores straight back over the body, and keeps waiting', () => {
    const ready = createSession('go');
    expect(turn(ready, 'left')).toBe(ready);
  });

  it('counts the first move and nothing before it', () => {
    const running = start(createSession('count'));
    expect(running.ticks).toBe(0);
    expect(tick(running).session.ticks).toBe(1);
  });
});

describe('the input queue (§5)', () => {
  const heading = (direction: Direction) =>
    runningOn(straight(7, 7, direction, 5), FAR_FOOD, { status: 'running' });

  it('waits for the next tick: a press changes nothing on the board', () => {
    const session = heading('right');
    const pressed = turn(session, 'up');
    expect(pressed.queue).toEqual(['up']);
    expect(pressed.direction).toBe('right');
    expect(pressed.body).toBe(session.body);
  });

  it('uses one queued turn per tick, oldest first', () => {
    let session = turn(turn(heading('right'), 'up'), 'left');
    expect(session.queue).toEqual(['up', 'left']);
    session = tick(session).session;
    expect(session.direction).toBe('up');
    expect(session.queue).toEqual(['left']);
    session = tick(session).session;
    expect(session.direction).toBe('left');
    expect(session.queue).toEqual([]);
    session = tick(session).session;
    expect(session.direction).toBe('left');
    expect(session.status).toBe('running');
  });

  it('turns a quick up-then-left into a U-turn, never into a reversal', () => {
    // The classic bug: the second press checked against the heading instead of
    // the first press would be accepted *instead of* it, sending the head
    // back into its neck. Queued, the two happen on two ticks.
    const session = heading('right');
    const head = session.body[0]!;
    const after = tick(tick(turn(turn(session, 'up'), 'left')).session).session;
    expect(after.status).toBe('running');
    expect(after.body[0]).toBe(head - 14 - 1);
  });

  it('ignores straight back from the heading', () => {
    const session = heading('right');
    expect(turn(session, 'left')).toBe(session);
    expect(tick(session).session.direction).toBe('right');
  });

  it('ignores straight back from the turn queued before it', () => {
    const session = turn(heading('right'), 'up');
    expect(turn(session, 'down')).toBe(session);
  });

  it('ignores the same way again, so mashing one key does not fill the queue', () => {
    const session = heading('right');
    expect(turn(session, 'right')).toBe(session);
    const up = turn(session, 'up');
    expect(turn(up, 'up')).toBe(up);
  });

  it(`holds at most ${INPUT_QUEUE_LIMIT} turns and drops the rest`, () => {
    let session = heading('right');
    for (const direction of ['up', 'left', 'down', 'right'] as const) {
      session = turn(session, direction);
    }
    expect(session.queue).toEqual(['up', 'left', 'down']);
    expect(INPUT_QUEUE_LIMIT).toBe(3);
  });

  it('checks a turn pressed after a tick against the heading that tick took', () => {
    const moved = tick(turn(heading('right'), 'up')).session;
    expect(moved.direction).toBe('up');
    expect(moved.queue).toEqual([]);
    expect(turn(moved, 'down')).toBe(moved);
  });

  /**
   * Every burst of up to four presses between two ticks, from every heading,
   * followed by five ticks: no two consecutive moves are ever opposite. The
   * snake is five long in the middle of the board, so a U-turn of three
   * presses can still run it into its own body further back — a crash, but
   * never one into the neck it just left (that would be a reversal, which the
   * first check rules out). 1 + 4 + 16 + 64 + 256 = 341 bursts per heading.
   */
  it('never reverses, for every burst of up to four presses (exhaustive)', () => {
    const bursts: Direction[][] = [[]];
    for (let length = 1; length <= 4; length++) {
      for (const prefix of bursts.filter((burst) => burst.length === length - 1)) {
        for (const direction of DIRECTIONS) bursts.push([...prefix, direction]);
      }
    }
    expect(bursts).toHaveLength(1 + 4 + 16 + 64 + 256);

    for (const initial of DIRECTIONS) {
      for (const burst of bursts) {
        let session = heading(initial);
        for (const press of burst) session = turn(session, press);
        let previous = session.direction;
        for (let t = 0; t < 5 && session.status === 'running'; t++) {
          session = tick(session).session;
          // On a crash `direction` is the way it tried to go, so this also
          // covers a fatal attempt at the neck.
          expect(session.direction).not.toBe(OPPOSITE[previous]);
          if (session.status === 'over') expect(session.crash).toBe('self');
          previous = session.direction;
        }
      }
    }
  });
});

describe('pause and resume (§6)', () => {
  const running = () => turn(turn(start(createSession('pause')), 'up'), 'left');

  it('pauses a running run and empties its queue', () => {
    const session = running();
    expect(session.queue).toEqual(['up', 'left']);
    const paused = pause(session);
    expect(paused.status).toBe('paused');
    expect(paused.queue).toEqual([]);
    expect(paused.body).toBe(session.body);
    expect(paused.direction).toBe(session.direction);
  });

  it('only pauses a running run', () => {
    const ready = createSession('pause');
    expect(pause(ready)).toBe(ready);
    const paused = pause(running());
    expect(pause(paused)).toBe(paused);
    const over: SnakeSession = { ...running(), status: 'over', crash: 'wall' };
    expect(pause(over)).toBe(over);
  });

  it('moves nothing while paused, however many ticks land', () => {
    const paused = pause(running());
    for (let i = 0; i < 100; i++) {
      const outcome = tick(paused);
      expect(outcome.event).toBe('none');
      expect(outcome.session).toBe(paused);
    }
  });

  it('resumes only a paused run', () => {
    const paused = pause(running());
    const resumed = resume(paused);
    expect(resumed.status).toBe('running');
    expect(resume(resumed)).toBe(resumed);
    const ready = createSession('pause');
    expect(resume(ready)).toBe(ready);
  });

  it('carries the running seconds through pause and resume untouched', () => {
    const session = { ...running(), elapsedSeconds: 42 };
    expect(resume(pause(session)).elapsedSeconds).toBe(42);
    expect(tick(session).session.elapsedSeconds).toBe(42);
  });

  it('does not resume on a direction', () => {
    const paused = pause(running());
    for (const direction of DIRECTIONS) expect(turn(paused, direction).status).toBe('paused');
  });

  it('lets a paused run choose its first heading after Resume — the last press wins', () => {
    const paused = pause(start(createSession('choose')));
    expect(paused.direction).toBe('right');
    expect(turn(paused, 'left')).toBe(paused);
    const up = turn(paused, 'up');
    expect(up.queue).toEqual(['up']);
    expect(turn(up, 'up')).toBe(up);
    // Changing one's mind is not a queue of two; down replaces up.
    const down = turn(up, 'down');
    expect(down.queue).toEqual(['down']);
    // The current heading cancels the choice.
    expect(turn(down, 'right').queue).toEqual([]);
    expect(turn(paused, 'right')).toBe(paused);

    const moved = tick(resume(down)).session;
    expect(moved.direction).toBe('down');
    expect(moved.body[0]).toBe(cellAt(7, 4));
  });

  it('shows the chosen heading of a paused run and of nothing else (§13)', () => {
    const paused = pause(start(createSession('shown')));
    expect(pendingHeading(paused)).toBeNull();
    expect(pendingHeading(turn(paused, 'up'))).toBe('up');
    expect(pendingHeading(turn(turn(paused, 'up'), 'right'))).toBeNull();
    // A burst in flight is not a choice on display.
    const running = turn(resume(paused), 'up');
    expect(running.queue).toEqual(['up']);
    expect(pendingHeading(running)).toBeNull();
    expect(pendingHeading(createSession('shown'))).toBeNull();
    expect(pendingHeading({ ...paused, status: 'over', crash: 'wall', queue: ['up'] })).toBeNull();
  });

  it('drops the turn a run was started with if it stops before its first move (§6)', () => {
    const started = turn(createSession('dropped'), 'up');
    expect(started.status).toBe('running');
    expect(started.queue).toEqual(['up']);
    const stopped = pause(started);
    expect(stopped.queue).toEqual([]);
    expect(stopped.direction).toBe('right');
    expect(pendingHeading(stopped)).toBeNull();
  });

  it('comes back from the background stopped, and survives a wall one cell ahead', () => {
    // Heading right one cell from the right wall when the app goes away.
    let session = runningOn(straight(5, 12, 'right', 4), FAR_FOOD);
    session = pause(session); // the background handler
    for (let i = 0; i < 20; i++) session = tick(session).session; // late timers
    expect(session.status).toBe('paused');
    expect(session.body[0]).toBe(cellAt(5, 12));
    // Back in the app: still paused. The player points it away, then resumes.
    session = resume(turn(session, 'down'));
    const outcome = tick(session);
    expect(outcome.event).toBe('move');
    expect(outcome.session.body[0]).toBe(cellAt(6, 12));
  });
});

describe('eating and growing (§3, §7)', () => {
  it('grows by one, scores one, keeps the tail and puts down the next food', () => {
    const body = straight(5, 5, 'right', 3);
    const session = runningOn(body, cellAt(5, 6), { seed: 'grow' });
    const outcome = tick(session);
    expect(outcome.event).toBe('eat');
    const after = outcome.session;
    expect(after.score).toBe(1);
    expect(after.body).toEqual([cellAt(5, 6), ...body]);
    expect(after.foodDraws).toBe(2);
    expect(after.food).toBe(drawFood('grow', 1, after.body));
    expect(after.body).not.toContain(after.food);
    expect(after.ticks).toBe(1);
  });

  it('moves without growing when the head misses the food', () => {
    const session = runningOn(straight(5, 5, 'right', 3), cellAt(9, 9));
    const after = tick(session).session;
    expect(after.score).toBe(0);
    expect(after.body).toHaveLength(3);
    expect(after.food).toBe(cellAt(9, 9));
    expect(after.foodDraws).toBe(1);
  });
});

describe('the end of a run (§4)', () => {
  it('ends at the wall without moving, facing the wall', () => {
    const body = straight(5, 13, 'right', 3);
    const session = runningOn(body, FAR_FOOD, { ticks: 9 });
    const outcome = tick(session);
    expect(outcome.event).toBe('wall');
    expect(outcome.session.status).toBe('over');
    expect(outcome.session.crash).toBe('wall');
    expect(outcome.session.body).toBe(body);
    expect(outcome.session.ticks).toBe(9);
    expect(outcome.session.direction).toBe('right');
    expect(isFinished(outcome.session)).toBe(true);
    expect(isSuspendable(outcome.session)).toBe(false);
  });

  it('ends on its own body, facing the way it tried to go', () => {
    const hook = [cellAt(5, 5), cellAt(5, 6), cellAt(6, 6), cellAt(6, 5), cellAt(6, 4)];
    const session = turn(runningOn(hook, FAR_FOOD), 'down');
    const outcome = tick(session);
    expect(outcome.event).toBe('self');
    expect(outcome.session.crash).toBe('self');
    expect(outcome.session.direction).toBe('down');
    expect(outcome.session.queue).toEqual([]);
  });

  it('chases its own tail round a loop of four for as long as it likes', () => {
    let session = runningOn([cellAt(5, 5), cellAt(6, 5), cellAt(6, 6), cellAt(5, 6)], FAR_FOOD);
    const lap: readonly Direction[] = ['right', 'down', 'left', 'up'];
    for (let i = 0; i < 400; i++) {
      session = tick(turn(session, lap[i % 4]!)).session;
      expect(session.status).toBe('running');
    }
    expect(session.ticks).toBe(400);
    expect(session.body).toHaveLength(4);
  });

  it('accepts nothing once over', () => {
    const over = tick(runningOn(straight(5, 13, 'right', 3), FAR_FOOD)).session;
    for (const direction of DIRECTIONS) expect(turn(over, direction)).toBe(over);
    expect(start(over)).toBe(over);
    expect(pause(over)).toBe(over);
    expect(resume(over)).toBe(over);
    expect(tick(over)).toEqual({ session: over, event: 'none' });
  });

  it('clears the run when the snake fills the board', () => {
    // 195 cells along the cycle of §4, the food on the 196th, one step ahead.
    const order = hamiltonianCycle();
    const body = order.slice(0, CELL_COUNT - 1).reverse();
    const last = order[CELL_COUNT - 1]!;
    expect(drawFood('anything', 7, body)).toBe(last);
    const session = runningOn(body, last, { seed: 'full', ticks: 5000 });
    expect(invariantViolations(session)).toEqual([]);

    const outcome = tick(turn(session, stepBetween(body[0]!, last)!));
    expect(outcome.event).toBe('clear');
    const cleared = outcome.session;
    expect(cleared.status).toBe('cleared');
    expect(cleared.body).toHaveLength(CELL_COUNT);
    expect(new Set(cleared.body).size).toBe(CELL_COUNT);
    expect(cleared.score).toBe(MAX_SCORE);
    expect(MAX_SCORE).toBe(193);
    expect(cleared.food).toBe(-1);
    expect(cleared.foodDraws).toBe(session.foodDraws);
    expect(cleared.crash).toBeNull();
    expect(cleared.ticks).toBe(5001);
    expect(invariantViolations(cleared)).toEqual([]);
    expect(isFinished(cleared)).toBe(true);
    expect(tick(cleared)).toEqual({ session: cleared, event: 'none' });
    expect(turn(cleared, 'up')).toBe(cleared);
  });

  it('is not a clear one cell short of the board', () => {
    const order = hamiltonianCycle();
    const body = order.slice(0, CELL_COUNT - 2).reverse();
    const session = runningOn(body, order[CELL_COUNT - 2]!, { seed: 'short' });
    const outcome = tick(turn(session, stepBetween(body[0]!, order[CELL_COUNT - 2]!)!));
    expect(outcome.event).toBe('eat');
    expect(outcome.session.status).toBe('running');
    expect(outcome.session.food).toBe(order[CELL_COUNT - 1]);
  });
});

describe('a session nobody could have made (defence)', () => {
  it('will not steer into its neck even if a reversal sits in the queue', () => {
    const session = runningOn(straight(7, 7, 'right', 4), FAR_FOOD, { queue: ['left'] });
    const outcome = tick(session);
    expect(outcome.event).toBe('move');
    expect(outcome.session.direction).toBe('right');
    expect(outcome.session.queue).toEqual([]);
  });
});
