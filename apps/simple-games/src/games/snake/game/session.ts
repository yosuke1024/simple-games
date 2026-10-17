/**
 * SnakeSession — a pure, immutable snapshot of one run: the snake, its food,
 * the turns waiting for their ticks, and where the run stands
 * (docs/SNAKE_RULES.md §2–§7). The React layer only dispatches into these
 * functions and owns the clock; every rule lives here and in engine.ts.
 *
 * Every function returns the very same object when it changes nothing — an
 * ignored input, a tick that arrives while paused, a second pause — so a
 * stray timer or a key mashed on a stopped board is visibly a no-op, and the
 * view has nothing to re-render (§6, §13).
 */
import { moveSnake } from './engine';
import { drawFood } from './food';
import {
  CELL_COUNT,
  DEFAULT_SPEED,
  INITIAL_BODY,
  INITIAL_DIRECTION,
  INPUT_QUEUE_LIMIT,
  isReverse,
  type Crash,
  type Direction,
  type RunStatus,
  type Speed,
} from './types';

export interface SnakeSession {
  readonly seed: string;
  /** Fixed when the run is created; the preference only reaches the next run (§7). */
  readonly speed: Speed;
  readonly status: RunStatus;
  /** Cells the snake covers, head first (§1). */
  readonly body: readonly number[];
  /**
   * The way the snake last moved — from the neck to the head — or, once a run
   * has crashed, the way it was trying to move (§3). Queued turns are not in
   * here: an input applies on the next tick, never on the press (§5).
   */
  readonly direction: Direction;
  /** Turns waiting for their ticks, oldest first, each checked against the one before (§5). */
  readonly queue: readonly Direction[];
  /** The food's cell, or -1 once the board is full (§4). */
  readonly food: number;
  /**
   * How many foods this run has drawn — the second half of the draw's seed
   * (§8). Always score + 1 while a food is on the board, which is why a saved
   * run does not need to carry it (§11).
   */
  readonly foodDraws: number;
  /** Foods eaten: one point each (§7). */
  readonly score: number;
  /** Moves made. A crash is not a move (§3). */
  readonly ticks: number;
  readonly crash: Crash | null;
  /**
   * Running time in **whole seconds**, for the statistics only; the
   * provider's clock writes it (§10). Whole because the record holds whole
   * seconds (§11) — `toSnapshot` floors whatever it is given, so a fraction
   * here can never make a save unreadable.
   */
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one run's food its own. There are no levels and no dates
 * to seed from, so every new run gets a new one — while the seed still pins the
 * food down completely, which is what the golden test rests on (§8).
 *
 * Both inputs are the caller's: the clock and the entropy are read in state/
 * (the provider passes `Date.now()` and `Math.random`), never in here, so
 * nothing in game/ can come out differently for the same arguments (§8).
 */
export function newSeedToken(now: number, random: () => number): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const snakeSeed = (token: string): string => `snake-${token}`;

/**
 * A fresh run, standing still on the board until the first input (§2, §6).
 * The seed is required for the same reason as `newSeedToken`'s inputs.
 */
export function createSession(seed: string, speed: Speed = DEFAULT_SPEED): SnakeSession {
  return {
    seed,
    speed,
    status: 'ready',
    body: INITIAL_BODY,
    direction: INITIAL_DIRECTION,
    queue: [],
    food: drawFood(seed, 0, INITIAL_BODY),
    foodDraws: 1,
    score: 0,
    ticks: 0,
    crash: null,
    elapsedSeconds: 0,
  };
}

/** Start (§6): the board was showing; now it moves. Anything but `ready` is unchanged. */
export function start(session: SnakeSession): SnakeSession {
  return session.status === 'ready' ? { ...session, status: 'running' } : session;
}

/**
 * Pause (§6). The queue is emptied: turns pressed before the stop belong to
 * the board as it was moving, and carrying them across a pause would make
 * the first ticks after Resume act on a press the player has forgotten. That
 * includes the turn a run was started with when it is stopped before its
 * first move: the stopped board then shows the opening heading and no chosen
 * one (§13), which is the state it is really in.
 */
export function pause(session: SnakeSession): SnakeSession {
  return session.status === 'running' ? { ...session, status: 'paused', queue: [] } : session;
}

/** Resume (§6) — only ever by the player's own action; nothing in here resumes by itself. */
export function resume(session: SnakeSession): SnakeSession {
  return session.status === 'paused' ? { ...session, status: 'running' } : session;
}

/**
 * The heading a paused run will take on its first move after Resume, chosen
 * while it stood still (§5), or null when none is chosen — and always null
 * for a run that is not paused: a running run's queue is a burst in flight,
 * not a choice on display. The view draws this on the head and announces it
 * (§13); the save carries it (§11). It is the only part of the queue that
 * outlives a stop.
 */
export function pendingHeading(session: SnakeSession): Direction | null {
  return session.status === 'paused' ? (session.queue[0] ?? null) : null;
}

/** A started, unfinished run: what a save holds and a Resume continues (§11). */
export const isSuspendable = (session: SnakeSession): boolean =>
  session.status === 'running' || session.status === 'paused';

export const isFinished = (session: SnakeSession): boolean =>
  session.status === 'over' || session.status === 'cleared';

/**
 * A direction pressed (§5). What it does depends on where the run stands:
 *
 * - `ready`: starts the run, heading that way from the first tick. Straight
 *   back over the body is ignored and the board keeps waiting.
 * - `running`: joins the queue, checked against the turn queued before it (or
 *   the current heading when none is). Straight back, the same way again, or a
 *   full queue: ignored. Checking against the previous *queued* turn is what
 *   keeps any burst of presses, inside one tick or across several, from ever
 *   making two consecutive moves opposite.
 * - `paused`: does not resume. It chooses the heading the run will take on the
 *   first tick after Resume — the last press wins, straight back is ignored and
 *   the current heading cancels the choice — so a run that stopped one cell
 *   from a wall can be pointed away from it before it starts moving again.
 *   The choice is never hidden: the board shows it and the save keeps it
 *   (`pendingHeading`, §11, §13).
 * - `over` / `cleared`: nothing.
 */
export function turn(session: SnakeSession, direction: Direction): SnakeSession {
  switch (session.status) {
    case 'ready': {
      if (isReverse(session.direction, direction)) return session;
      return {
        ...session,
        status: 'running',
        queue: direction === session.direction ? [] : [direction],
      };
    }
    case 'paused': {
      if (isReverse(session.direction, direction)) return session;
      if (direction === session.direction) {
        return session.queue.length === 0 ? session : { ...session, queue: [] };
      }
      if (session.queue.length === 1 && session.queue[0] === direction) return session;
      return { ...session, queue: [direction] };
    }
    case 'running': {
      const last = session.queue[session.queue.length - 1] ?? session.direction;
      if (direction === last || isReverse(last, direction)) return session;
      if (session.queue.length >= INPUT_QUEUE_LIMIT) return session;
      return { ...session, queue: [...session.queue, direction] };
    }
    case 'over':
    case 'cleared':
      return session;
  }
}

/** What one tick did, for the view's sound and announcements (§13). */
export type TickEvent = 'none' | 'move' | 'eat' | 'wall' | 'self' | 'clear';

export interface TickOutcome {
  readonly session: SnakeSession;
  readonly event: TickEvent;
}

/**
 * One tick (§3): take the next queued turn, move one cell, and settle what
 * that move did. Anything but a running run is returned untouched with
 * `event: 'none'` — a timer that lands after a pause, a background or the end
 * of the run moves nothing (§6).
 */
export function tick(session: SnakeSession): TickOutcome {
  if (session.status !== 'running') return { session, event: 'none' };

  let direction = session.direction;
  let queue = session.queue;
  const next = queue[0];
  if (next !== undefined) {
    queue = queue.slice(1);
    // Every queued turn was checked against the one before it, so this cannot
    // be a reversal; the check stays so that a hand-made session (a test, a
    // future caller) cannot steer the head into its own neck either.
    if (!isReverse(direction, next)) direction = next;
  }

  const result = moveSnake(session.body, direction, session.food);
  if (result.kind === 'wall' || result.kind === 'self') {
    return {
      session: { ...session, status: 'over', direction, queue: [], crash: result.kind },
      event: result.kind,
    };
  }

  const ticks = session.ticks + 1;
  if (result.kind === 'move') {
    return { session: { ...session, body: result.body, direction, queue, ticks }, event: 'move' };
  }

  const score = session.score + 1;
  if (result.body.length === CELL_COUNT) {
    // The last free cell was the food: there is nowhere to put another (§4).
    return {
      session: {
        ...session,
        status: 'cleared',
        body: result.body,
        direction,
        queue: [],
        food: -1,
        score,
        ticks,
      },
      event: 'clear',
    };
  }
  return {
    session: {
      ...session,
      body: result.body,
      direction,
      queue,
      food: drawFood(session.seed, session.foodDraws, result.body),
      foodDraws: session.foodDraws + 1,
      score,
      ticks,
    },
    event: 'eat',
  };
}
