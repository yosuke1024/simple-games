/**
 * Test fixtures for the rules of docs/SNAKE_RULES.md, kept out of the engine
 * so the engine never checks itself.
 *
 * - `hamiltonianCycle` and `cyclePilot`: the constructive argument of §4 made
 *   runnable. An even-by-even board has a cycle through every cell; a snake
 *   that lies on it and follows it can never hit itself or a wall, and passes
 *   every free cell once a lap — so it eats every food, wherever the draw puts
 *   it, until the board is full.
 * - `Reference*`: a second implementation of §3 and §8 written from the rules
 *   text in a deliberately different shape (row/column pairs, tail-first, an
 *   occupancy grid, the free cells collected into a list), sharing only the
 *   PRNG. The engine is checked against it move for move (guarantee.test.ts).
 * - `invariantViolations`: everything a live session must satisfy, checked
 *   from first principles rather than through engine.ts.
 *
 * Imported by tests only.
 */
import { createRng } from './rng';
import { tick, turn, type SnakeSession, type TickEvent } from './session';
import {
  BOARD_SIZE,
  CELL_COUNT,
  INITIAL_BODY,
  INITIAL_DIRECTION,
  INITIAL_LENGTH,
  INPUT_QUEUE_LIMIT,
  type Direction,
} from './types';

// ---------- small geometry, independent of engine.ts ----------

const VECTORS: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const REVERSE: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const ALL: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** The direction from cell a to an orthogonal neighbour b, or null. */
export function stepBetween(a: number, b: number): Direction | null {
  const [ar, ac] = [Math.floor(a / BOARD_SIZE), a % BOARD_SIZE];
  const [br, bc] = [Math.floor(b / BOARD_SIZE), b % BOARD_SIZE];
  for (const direction of ALL) {
    const [dr, dc] = VECTORS[direction];
    if (ar + dr === br && ac + dc === bc) return direction;
  }
  return null;
}

// ---------- the cycle of §4 ----------

/**
 * One Hamiltonian cycle of the board, in visiting order: row 0 left to right,
 * then rows 1.. as a serpentine over columns 1.., then column 0 back up. Row 6
 * runs left to right through columns 2–4, so the opening snake lies on it
 * tail-to-head in visiting order (§2) — the pilot can take over from the very
 * first move.
 */
export function hamiltonianCycle(): number[] {
  const order: number[] = [];
  for (let col = 0; col < BOARD_SIZE; col++) order.push(col);
  for (let row = 1; row < BOARD_SIZE; row++) {
    if (row % 2 === 1) {
      for (let col = BOARD_SIZE - 1; col >= 1; col--) order.push(row * BOARD_SIZE + col);
    } else {
      for (let col = 1; col < BOARD_SIZE; col++) order.push(row * BOARD_SIZE + col);
    }
  }
  for (let row = BOARD_SIZE - 1; row >= 1; row--) order.push(row * BOARD_SIZE);
  return order;
}

/** cell → the next cell on the cycle. */
export function cycleSuccessors(order: readonly number[] = hamiltonianCycle()): number[] {
  const next = new Array<number>(CELL_COUNT).fill(-1);
  for (let i = 0; i < order.length; i++) next[order[i]!] = order[(i + 1) % order.length]!;
  return next;
}

/** The turn the cycle pilot presses before a tick: the way to the head's successor. */
export function cyclePilot(successors: readonly number[]): (session: SnakeSession) => Direction {
  return (session) => {
    const head = session.body[0]!;
    const direction = stepBetween(head, successors[head]!);
    if (direction === null) throw new Error(`cycle broken at ${head}`);
    return direction;
  };
}

export interface PlayedRun {
  readonly session: SnakeSession;
  readonly events: Readonly<Record<TickEvent, number>>;
  /** Ticks asked for, including the one that ended the run. */
  readonly steps: number;
}

/**
 * Plays a run from where it stands: before every tick the policy presses one
 * direction (through `turn`, as a player would), then the tick runs. Stops
 * when the run ends or after `maxSteps` ticks. `check` sees every session.
 */
export function playRun(
  session: SnakeSession,
  policy: (session: SnakeSession) => Direction | null,
  maxSteps: number,
  check?: (session: SnakeSession, event: TickEvent) => void,
): PlayedRun {
  const events: Record<TickEvent, number> = {
    none: 0,
    move: 0,
    eat: 0,
    wall: 0,
    self: 0,
    clear: 0,
  };
  let current = session;
  let steps = 0;
  while (steps < maxSteps && (current.status === 'running' || current.status === 'ready')) {
    const press = policy(current);
    if (press !== null) current = turn(current, press);
    if (current.status !== 'running') break;
    const outcome = tick(current);
    steps++;
    events[outcome.event]++;
    current = outcome.session;
    check?.(current, outcome.event);
  }
  return { session: current, events, steps };
}

// ---------- the reference model (§3, §8 from the text) ----------

export interface ReferenceState {
  /** [row, col] pairs, tail first. */
  readonly snake: ReadonlyArray<readonly [number, number]>;
  readonly occupied: readonly (readonly boolean[])[];
  readonly direction: Direction;
  readonly food: readonly [number, number] | null;
  readonly draws: number;
  readonly score: number;
  readonly outcome: 'alive' | 'wall' | 'self' | 'full';
}

function referenceFood(
  seed: string,
  draw: number,
  occupied: readonly (readonly boolean[])[],
): [number, number] | null {
  const free: [number, number][] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) if (!occupied[row]![col]) free.push([row, col]);
  }
  if (free.length === 0) return null;
  const r = createRng(`${seed}:food:${draw}`)();
  return free[Math.floor(r * free.length)]!;
}

export function referenceStart(seed: string): ReferenceState {
  const occupied = Array.from({ length: BOARD_SIZE }, () =>
    new Array<boolean>(BOARD_SIZE).fill(false),
  );
  const snake: [number, number][] = [];
  for (let i = INITIAL_BODY.length - 1; i >= 0; i--) {
    const cell = INITIAL_BODY[i]!;
    const pair: [number, number] = [Math.floor(cell / BOARD_SIZE), cell % BOARD_SIZE];
    snake.push(pair);
    occupied[pair[0]]![pair[1]] = true;
  }
  return {
    snake,
    occupied,
    direction: INITIAL_DIRECTION,
    food: referenceFood(seed, 0, occupied),
    draws: 1,
    score: 0,
    outcome: 'alive',
  };
}

/**
 * One move by the rules text: a wanted direction straight back is ignored;
 * the new head is found; off the board is the wall; if it is not the food the
 * tail leaves first; then a head on an occupied square is the snake itself.
 */
export function referenceStep(
  seed: string,
  state: ReferenceState,
  wanted: Direction | null,
): ReferenceState {
  if (state.outcome !== 'alive') return state;
  const direction =
    wanted !== null && REVERSE[state.direction] !== wanted ? wanted : state.direction;
  const [hr, hc] = state.snake[state.snake.length - 1]!;
  const [dr, dc] = VECTORS[direction];
  const nr = hr + dr;
  const nc = hc + dc;
  if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
    return { ...state, direction, outcome: 'wall' };
  }
  const occupied = state.occupied.map((row) => [...row]);
  const snake = [...state.snake];
  const eats = state.food !== null && state.food[0] === nr && state.food[1] === nc;
  if (!eats) {
    const [tr, tc] = snake.shift()!;
    occupied[tr]![tc] = false;
  }
  if (occupied[nr]![nc]) return { ...state, direction, outcome: 'self' };
  occupied[nr]![nc] = true;
  snake.push([nr, nc]);
  if (!eats) return { ...state, snake, occupied, direction };
  const score = state.score + 1;
  if (snake.length === BOARD_SIZE * BOARD_SIZE) {
    return { ...state, snake, occupied, direction, food: null, score, outcome: 'full' };
  }
  return {
    ...state,
    snake,
    occupied,
    direction,
    food: referenceFood(seed, state.draws, occupied),
    draws: state.draws + 1,
    score,
  };
}

/** The reference snake as the engine spells it: cell indices, head first. */
export const referenceBody = (state: ReferenceState): number[] =>
  state.snake.map(([row, col]) => row * BOARD_SIZE + col).reverse();

export const referenceFoodCell = (state: ReferenceState): number =>
  state.food === null ? -1 : state.food[0] * BOARD_SIZE + state.food[1];

// ---------- invariants ----------

/** Every rule a session must keep, checked without engine.ts. Empty when all hold. */
export function invariantViolations(session: SnakeSession): string[] {
  const problems: string[] = [];
  const { body, food, queue } = session;
  const seen = new Set<number>();
  for (let i = 0; i < body.length; i++) {
    const cell = body[i]!;
    if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) problems.push(`cell ${cell}`);
    if (seen.has(cell)) problems.push(`cell ${cell} twice`);
    seen.add(cell);
    if (i > 0 && stepBetween(body[i - 1]!, cell) === null) problems.push(`gap before ${cell}`);
  }
  if (body.length !== INITIAL_LENGTH + session.score) problems.push('length ≠ 3 + score');
  if (session.status === 'cleared') {
    if (body.length !== CELL_COUNT) problems.push('cleared without a full board');
    if (food !== -1) problems.push('food on a full board');
    if (session.foodDraws !== session.score) problems.push('draws ≠ score when cleared');
  } else {
    if (!Number.isInteger(food) || food < 0 || food >= CELL_COUNT) problems.push(`food ${food}`);
    if (seen.has(food)) problems.push('food under the snake');
    if (session.foodDraws !== session.score + 1) problems.push('draws ≠ score + 1');
  }
  if (session.status !== 'over' && session.status !== 'cleared') {
    if (stepBetween(body[1]!, body[0]!) !== session.direction) problems.push('heading ≠ neck→head');
  }
  if (queue.length > INPUT_QUEUE_LIMIT) problems.push('queue over its limit');
  let last = session.direction;
  for (const queued of queue) {
    if (queued === last) problems.push('queue repeats a heading');
    if (REVERSE[last] === queued) problems.push('queue holds a reversal');
    last = queued;
  }
  return problems;
}

/** A seeded stream of directions, for policies that need their own randomness. */
export function directionStream(seed: string): () => Direction {
  const rng = createRng(seed);
  return () => ALL[Math.floor(rng() * ALL.length)]!;
}

/**
 * A seeded player that wanders: before each tick it keeps going with
 * probability `keep`, otherwise picks at random among the moves that do not
 * hit a wall or the body (the tail counts as free, §3), heading for the food
 * one time in three. Lives until it traps itself, which takes a while — long
 * enough runs to reach real lengths without the pilot's regularity. Checked
 * with its own geometry, not engine.ts.
 */
export function wanderer(seed: string, keep = 0.6): (session: SnakeSession) => Direction {
  const rng = createRng(`${seed}:wanderer`);
  return (session) => {
    const head = session.body[0]!;
    const blocked = new Set(session.body.slice(0, -1));
    const [hr, hc] = [Math.floor(head / BOARD_SIZE), head % BOARD_SIZE];
    const safe = ALL.filter((direction) => {
      if (REVERSE[session.direction] === direction) return false;
      const [dr, dc] = VECTORS[direction];
      const [nr, nc] = [hr + dr, hc + dc];
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) return false;
      return !blocked.has(nr * BOARD_SIZE + nc);
    });
    if (safe.length === 0) return session.direction;
    if (safe.includes(session.direction) && rng() < keep) return session.direction;
    if (rng() < 1 / 3) {
      const [fr, fc] = [Math.floor(session.food / BOARD_SIZE), session.food % BOARD_SIZE];
      const towards = safe.filter((direction) => {
        const [dr, dc] = VECTORS[direction];
        return (
          Math.abs(hr + dr - fr) + Math.abs(hc + dc - fc) < Math.abs(hr - fr) + Math.abs(hc - fc)
        );
      });
      if (towards.length > 0) return towards[Math.floor(rng() * towards.length)]!;
    }
    return safe[Math.floor(rng() * safe.length)]!;
  };
}

export { REVERSE as TEST_REVERSE, VECTORS as TEST_VECTORS };
