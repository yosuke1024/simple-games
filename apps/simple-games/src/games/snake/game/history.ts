/**
 * What a saved body says about the moves that made it (docs/SNAKE_RULES.md
 * §3, §11). The body is the head's own trail — its i-th cell is where the
 * head was i moves ago — so a record with `ticks` moves claims a head path
 * H_0 … H_ticks that starts at the opening head and ends with the body read
 * tail to head. Two checks follow from that, used by `restoreSession`:
 *
 * - **The whole path is on the body** (`ticks` ≤ body length): every move is
 *   known, so the run is played again from the opening with the record's seed
 *   (`replayMatches`). The engine is deterministic and stepping on food always
 *   eats it, so the replay is the only run that path can be: the record must
 *   come out of it exactly — body, score and food. Exact.
 * - **Part of the path is gone** (more moves than cells): the moves before the
 *   tail are unknown, but they were a walk on the board that never turned
 *   straight back, from the opening head heading right, and the move after
 *   them — tail to the next cell — did not turn straight back either
 *   (`canReachTail`). With no food eaten the run never moved its food, so the
 *   walk also never stepped on that cell, and for a snake of three this walk
 *   is the whole of the rules (its own body is only ever the two cells
 *   behind the head): exact. Longer snakes add rules the lost moves cannot be
 *   held to; what is left unchecked is written in §11.
 *
 * Both are bounded by the board: the replay is at most one move per body
 * cell (≤ 195), and the walk check is a layered search over the 784 (cell,
 * heading) states that stops once its layers repeat with period 2 — which the
 * tests show happens within 19 layers for every cell that can be left out,
 * far inside `WALK_LAYER_LIMIT`, so the limit is a guard, not a budget that
 * is ever spent.
 */
import { directionBetween, neighbour } from './engine';
import { createSession, tick, type SnakeSession } from './session';
import {
  CELL_COUNT,
  DIRECTIONS,
  INITIAL_DIRECTION,
  INITIAL_HEAD,
  OPPOSITE,
  isReverse,
  type Direction,
} from './types';

/**
 * Plays the record's head path again from the opening and reports whether it
 * comes out as the record: same body, same score, same food (§11). Only for
 * `ticks` ≤ `body.length`, where the head at move m (1 … ticks) is
 * `body[ticks − m]` and the head at move 0 is the opening head.
 */
export function replayMatches(
  seed: string,
  body: readonly number[],
  score: number,
  food: number,
  ticks: number,
): boolean {
  if (ticks > body.length) return false;
  let session: SnakeSession = { ...createSession(seed), status: 'running' };
  for (let move = 1; move <= ticks; move++) {
    const direction = directionBetween(session.body[0]!, body[ticks - move]!);
    if (direction === null || isReverse(session.direction, direction)) return false;
    const outcome = tick({ ...session, queue: [direction] });
    if (outcome.event !== 'move' && outcome.event !== 'eat') return false;
    session = outcome.session;
  }
  if (session.score !== score || session.food !== food) return false;
  if (session.body.length !== body.length) return false;
  for (let i = 0; i < body.length; i++) if (session.body[i] !== body[i]) return false;
  return true;
}

/** (cell, heading) pairs: the heading is the way the head moved into the cell. */
const STATE_COUNT = CELL_COUNT * DIRECTIONS.length;
const stateOf = (cell: number, heading: number): number => cell * DIRECTIONS.length + heading;

/**
 * The most layers the walk search may build before it gives up. The layers
 * repeat with period 2 long before this on a 14×14 board: by layer 19 at the
 * latest, for every cell that can be left out (history.test.ts checks them
 * all). Giving up refuses the record — fail-closed — and is never reached.
 */
export const WALK_LAYER_LIMIT = 64;

export interface WalkLayer {
  /** 1 for every (cell, heading) state some walk of the asked length ends in. */
  readonly states: Uint8Array;
  /** Layers built to find it: at most `WALK_LAYER_LIMIT`. */
  readonly layers: number;
}

/**
 * The states a walk of exactly `moves` moves can end in: from the opening
 * head heading right, never turning straight back, never leaving the board,
 * never entering `avoid` (a cell, or -1 for none). Null when the search hit
 * `limit` layers first (`WALK_LAYER_LIMIT` unless a test asks for less — the
 * one way to run the refusal, which no record can reach at the real limit).
 *
 * Layer n is the set of states after n moves. The step from one layer to the
 * next is a fixed function of the set, so once layer n equals layer n − 2 the
 * layers alternate between the last two forever after, and any `moves`, however
 * large, is read off by parity.
 */
export function walkLayer(
  moves: number,
  avoid: number,
  limit: number = WALK_LAYER_LIMIT,
): WalkLayer | null {
  let older: Uint8Array | null = null;
  let previous: Uint8Array | null = null;
  let current: Uint8Array = new Uint8Array(STATE_COUNT);
  current[stateOf(INITIAL_HEAD, DIRECTIONS.indexOf(INITIAL_DIRECTION))] = 1;
  let layer = 0;
  while (layer < moves) {
    if (older !== null && previous !== null && sameStates(current, older)) {
      return { states: (moves - layer) % 2 === 0 ? current : previous, layers: layer };
    }
    if (layer >= limit) return null;
    older = previous;
    previous = current;
    current = stepLayer(current, avoid);
    layer++;
  }
  return { states: current, layers: layer };
}

function stepLayer(from: Uint8Array, avoid: number): Uint8Array {
  const to = new Uint8Array(STATE_COUNT);
  for (let state = 0; state < STATE_COUNT; state++) {
    if (from[state] !== 1) continue;
    const cell = Math.floor(state / DIRECTIONS.length);
    const heading = DIRECTIONS[state % DIRECTIONS.length]!;
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const direction = DIRECTIONS[d]!;
      if (isReverse(heading, direction)) continue;
      const next = neighbour(cell, direction);
      if (next === null || next === avoid) continue;
      to[stateOf(next, d)] = 1;
    }
  }
  return to;
}

function sameStates(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < STATE_COUNT; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Could the head have been on `tail` after exactly `moves` moves, and then
 * left it towards `leaving` without turning straight back (§3, §5)? `avoid`
 * is a cell the walk never entered, or -1. A search that runs out of layers
 * answers no — the record is refused, never guessed at (§11).
 */
export function canReachTail(
  tail: number,
  leaving: Direction,
  moves: number,
  avoid: number,
  limit: number = WALK_LAYER_LIMIT,
): boolean {
  const reached = walkLayer(moves, avoid, limit);
  if (reached === null) return false;
  for (let heading = 0; heading < DIRECTIONS.length; heading++) {
    if (DIRECTIONS[heading] === OPPOSITE[leaving]) continue;
    if (reached.states[stateOf(tail, heading)] === 1) return true;
  }
  return false;
}
