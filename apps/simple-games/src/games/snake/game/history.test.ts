/**
 * The history checks of the restore (docs/SNAKE_RULES.md §11, history.ts):
 * the replay of a fully known path, the walk search for a partly lost one,
 * and — exhaustively over the first moves — that together they refuse no
 * position play reaches and accept no position it cannot, wherever §11 says
 * the check is exact.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { drawFood } from './food';
import { WALK_LAYER_LIMIT, canReachTail, replayMatches, walkLayer } from './history';
import { encodeBody, restoreSession, type SnakeSnapshot } from './serialize';
import { createSession, start, tick, turn, type SnakeSession } from './session';
import { TEST_REVERSE, TEST_VECTORS } from './test-helpers';
import {
  BOARD_SIZE,
  CELL_COUNT,
  DIRECTIONS,
  INITIAL_BODY,
  INITIAL_HEAD,
  cellAt,
  colOf,
  rowOf,
  type Direction,
} from './types';

const SEED = 'snake-history';
const FIRST_FOOD = drawFood(SEED, 0, INITIAL_BODY);

const record = (
  body: readonly number[],
  score: number,
  food: number,
  ticks: number,
  seed = SEED,
): SnakeSnapshot => ({
  seed,
  speed: 'normal',
  body: encodeBody(body),
  food,
  score,
  ticks,
  elapsedSeconds: 0,
});

const key = (body: readonly number[], score: number, food: number): string =>
  `${body.join('.')}|${score}|${food}`;

/** Every record real play with `seed` reaches in exactly t moves, t = 0 … maxTicks. */
function reachable(seed: string, maxTicks: number): Map<string, SnakeSession>[] {
  const opening = start(createSession(seed));
  let level = new Map([[key(opening.body, opening.score, opening.food), opening]]);
  const levels = [level];
  for (let t = 1; t <= maxTicks; t++) {
    const next = new Map<string, SnakeSession>();
    for (const session of level.values()) {
      for (const direction of DIRECTIONS) {
        const outcome = tick(turn(session, direction));
        if (outcome.event !== 'move' && outcome.event !== 'eat') continue;
        const after = outcome.session;
        next.set(key(after.body, after.score, after.food), after);
      }
    }
    level = next;
    levels.push(level);
  }
  return levels;
}

/**
 * Every body of length 3 + score (score ≤ ticks) that is a path on the board
 * and whose i-th cell lies where ticks − i moves can take the opening head
 * (Manhattan distance and checkerboard parity), with cells older than the
 * first move equal to the opening snake's. Anything restoreSession accepts is
 * among these — the replay and the walk both put the i-th cell on a walk of
 * ticks − i moves — so enumerating only these misses no acceptance.
 */
function candidates(ticks: number): { body: number[]; score: number }[] {
  const out: { body: number[]; score: number }[] = [];
  const startRow = rowOf(INITIAL_HEAD);
  const startCol = colOf(INITIAL_HEAD);
  for (let score = 0; score <= ticks; score++) {
    const length = 3 + score;
    const path: number[] = [];
    const used = new Set<number>();
    const extend = (): void => {
      const i = path.length;
      if (i === length) {
        out.push({ body: [...path], score });
        return;
      }
      const options: number[] = [];
      if (i === 0) for (let cell = 0; cell < CELL_COUNT; cell++) options.push(cell);
      else {
        const row = rowOf(path[i - 1]!);
        const col = colOf(path[i - 1]!);
        for (const [dr, dc] of Object.values(TEST_VECTORS)) {
          const r = row + dr;
          const c = col + dc;
          if (r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE) options.push(cellAt(r, c));
        }
      }
      for (const cell of options) {
        if (used.has(cell)) continue;
        const movesAgo = ticks - i;
        if (movesAgo >= 0) {
          const distance = Math.abs(rowOf(cell) - startRow) + Math.abs(colOf(cell) - startCol);
          if (distance > movesAgo || (movesAgo - distance) % 2 !== 0) continue;
        } else if (cell !== INITIAL_BODY[-movesAgo]) continue;
        used.add(cell);
        path.push(cell);
        extend();
        path.pop();
        used.delete(cell);
      }
    };
    extend();
  }
  return out;
}

describe('replaying a fully known path (§11)', () => {
  it('matches the opening, before any move, only as it is', () => {
    expect(replayMatches(SEED, INITIAL_BODY, 0, FIRST_FOOD, 0)).toBe(true);
    expect(replayMatches(SEED, INITIAL_BODY, 0, (FIRST_FOOD + 1) % CELL_COUNT, 0)).toBe(false);
    expect(replayMatches(SEED, [cellAt(6, 5), cellAt(6, 4), cellAt(6, 3)], 0, FIRST_FOOD, 0)).toBe(
      false,
    );
  });

  it('matches what real play produced, and nothing next to it', () => {
    let session = start(createSession(SEED));
    for (const direction of ['up', 'up', 'left'] as Direction[]) {
      session = tick(turn(session, direction)).session;
    }
    const { body, score, food, ticks } = session;
    expect(replayMatches(SEED, body, score, food, ticks)).toBe(true);
    expect(replayMatches(`${SEED}-other`, body, score, food, ticks)).toBe(false);
    expect(replayMatches(SEED, body, score, food, ticks + 1)).toBe(false);
  });

  it('refuses a path that turns straight back, even on its first move', () => {
    // (6,4) → (6,3) is straight back over the neck.
    expect(replayMatches(SEED, [cellAt(5, 3), cellAt(6, 3), cellAt(6, 4)], 0, FIRST_FOOD, 2)).toBe(
      false,
    );
    expect(replayMatches(SEED, [cellAt(6, 2), cellAt(6, 3), cellAt(6, 4)], 0, FIRST_FOOD, 2)).toBe(
      false,
    );
  });

  it('refuses a path that steps on the food without eating it', () => {
    const body = [cellAt(5, 5), cellAt(6, 5), cellAt(6, 4)];
    const onTheWay = cellAt(6, 5);
    const seed = findSeed((s) => drawFood(s, 0, INITIAL_BODY) === onTheWay);
    // The real run ate it on move 1, so it is one longer and scored.
    expect(replayMatches(seed, body, 0, onTheWay, 2)).toBe(false);
  });
});

/** The first seed `snake-find-<n>` that satisfies `test`. */
function findSeed(test: (seed: string) => boolean): string {
  for (let n = 0; n < 100_000; n++) if (test(`snake-find-${n}`)) return `snake-find-${n}`;
  throw new Error('no seed found');
}

/**
 * All end states (cell, heading) of walks of exactly n moves from the opening
 * head heading right that never turn straight back and never enter `avoid`,
 * by plain enumeration — no layers, no engine.
 */
function bruteWalkEnds(n: number, avoid: number): Set<string> {
  const ends = new Set<string>();
  const walk = (row: number, col: number, heading: Direction, left: number): void => {
    if (left === 0) {
      ends.add(`${cellAt(row, col)}:${heading}`);
      return;
    }
    for (const direction of DIRECTIONS) {
      if (TEST_REVERSE[heading] === direction) continue;
      const [dr, dc] = TEST_VECTORS[direction];
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE || cellAt(r, c) === avoid) continue;
      walk(r, c, direction, left - 1);
    }
  };
  walk(rowOf(INITIAL_HEAD), colOf(INITIAL_HEAD), 'right', n);
  return ends;
}

/** The same end states, one set per move count, built layer by layer from strings. */
function setLayers(moves: number, avoid: number): Set<string>[] {
  let layer = new Set([`${INITIAL_HEAD}:right`]);
  const layers = [layer];
  for (let n = 1; n <= moves; n++) {
    const next = new Set<string>();
    for (const state of layer) {
      const [cellText, heading] = state.split(':') as [string, Direction];
      const cell = Number(cellText);
      for (const direction of DIRECTIONS) {
        if (TEST_REVERSE[heading] === direction) continue;
        const [dr, dc] = TEST_VECTORS[direction];
        const r = rowOf(cell) + dr;
        const c = colOf(cell) + dc;
        if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) continue;
        if (cellAt(r, c) === avoid) continue;
        next.add(`${cellAt(r, c)}:${direction}`);
      }
    }
    layer = next;
    layers.push(layer);
  }
  return layers;
}

const layerEnds = (n: number, avoid: number): Set<string> => {
  const layer = walkLayer(n, avoid)!;
  const ends = new Set<string>();
  layer.states.forEach((on, state) => {
    if (on === 1) ends.add(`${Math.floor(state / 4)}:${DIRECTIONS[state % 4]}`);
  });
  return ends;
};

describe('the walk before the tail (§11)', () => {
  it('starts on the opening head and never takes the neck first', () => {
    expect(layerEnds(0, -1)).toEqual(new Set([`${INITIAL_HEAD}:right`]));
    expect(layerEnds(1, -1)).toEqual(
      new Set([`${cellAt(6, 5)}:right`, `${cellAt(5, 4)}:up`, `${cellAt(7, 4)}:down`]),
    );
  });

  it('agrees with plain enumeration of every walk up to nine moves', () => {
    for (const avoid of [-1, cellAt(6, 5), cellAt(5, 4), cellAt(4, 4)]) {
      for (let n = 0; n <= 9; n++) {
        expect(layerEnds(n, avoid), `n=${n} avoid=${avoid}`).toEqual(bruteWalkEnds(n, avoid));
      }
    }
  });

  it('reads any number of moves off the two layers it settles into', () => {
    // Built one layer at a time with sets and no shortcut, the layers repeat
    // with period 2 well before move 44; past that, any count is its parity.
    for (const avoid of [-1, cellAt(0, 0), cellAt(6, 5), cellAt(13, 13)]) {
      const layers = setLayers(45, avoid);
      for (let n = 0; n <= 45; n++) {
        expect(layerEnds(n, avoid), `n=${n} avoid=${avoid}`).toEqual(layers[n]);
      }
      expect(layers[44]).toEqual(layers[42]);
      expect(layers[45]).toEqual(layers[43]);
      for (const n of [1000, 1001, 999_999_998, 999_999_999]) {
        expect(layerEnds(n, avoid)).toEqual(layers[n % 2 === 0 ? 44 : 45]);
      }
    }
  });

  it(`settles within 19 layers for every cell it may have to avoid — the limit of ${WALK_LAYER_LIMIT} is never reached`, () => {
    let most = 0;
    for (let avoid = -1; avoid < CELL_COUNT; avoid++) {
      if (INITIAL_BODY.includes(avoid)) continue;
      const layer = walkLayer(1_000_000_000, avoid);
      expect(layer, `avoid ${avoid}`).not.toBeNull();
      most = Math.max(most, layer!.layers);
    }
    expect(most).toBe(19);
    expect(most).toBeLessThan(WALK_LAYER_LIMIT);
  });

  it('asks the junction not to turn straight back either', () => {
    // After two moves the head can be on (6,6) heading right, never heading left.
    expect(canReachTail(cellAt(6, 6), 'right', 2, -1)).toBe(true);
    expect(canReachTail(cellAt(6, 6), 'up', 2, -1)).toBe(true);
    // Leaving left from (6,6) would need to have arrived heading other than right.
    expect(canReachTail(cellAt(6, 6), 'left', 2, -1)).toBe(false);
  });

  it('keeps off the cell it is told to avoid', () => {
    expect(canReachTail(cellAt(6, 6), 'right', 2, -1)).toBe(true);
    expect(canReachTail(cellAt(6, 6), 'right', 2, cellAt(6, 5))).toBe(false);
  });

  it('refuses when it runs out of layers — never a guess (fail-closed)', () => {
    // The real limit is never reached (above), so the refusal is run with a
    // tighter one. Unsettled after 3 layers, a far walk gives up …
    expect(walkLayer(1_000, -1, 3)).toBeNull();
    // … and a tail it finds at the real limit is answered no.
    const tail = cellAt(6, 6);
    expect(canReachTail(tail, 'right', 1_000, -1)).toBe(true);
    expect(canReachTail(tail, 'right', 1_000, -1, 3)).toBe(false);
    // A walk short enough to finish inside the limit still answers.
    expect(walkLayer(2, -1, 3)).not.toBeNull();
    expect(canReachTail(tail, 'right', 2, -1, 3)).toBe(true);
  });
});

describe('the restore against every position of the first moves (§11, §16)', () => {
  // One case per seed and per move count, each a few hundred milliseconds at
  // most: the work is deterministic, and splitting it keeps every case far
  // inside the per-test budget rather than widening it (docs/ARCHITECTURE.md
  // 「CI / リリース」).
  it.each(Array.from({ length: 12 }, (_, s) => `snake-reach-${s}`))(
    'accepts every position real play with %s reaches in up to 8 moves, as it was',
    (seed) => {
      let checked = 0;
      reachable(seed, 8).forEach((level, ticks) => {
        for (const session of level.values()) {
          const restored = restoreSession(
            record(session.body, session.score, session.food, ticks, seed),
          );
          expect(restored, `${seed} ${ticks}`).toEqual({ ...session, status: 'paused' });
          checked++;
        }
      });
      expect(checked).toBeGreaterThan(500);
    },
  );

  let levels: Map<string, SnakeSession>[] = [];
  const foodsOf = new Map<string, number[]>();
  beforeAll(() => {
    levels = reachable(SEED, 6);
    levels.forEach((level, ticks) => {
      for (const session of level.values()) {
        const at = `${key(session.body, session.score, -1)}@${ticks}`;
        foodsOf.set(at, [...(foodsOf.get(at) ?? []), session.food]);
      }
    });
  });

  it.each([0, 1, 2, 3, 4, 5, 6])(
    'accepts nothing else after %i moves where §11 calls the check exact: no food eaten, or every move on the body',
    (ticks) => {
      let exact = 0;
      for (const { body, score } of candidates(ticks)) {
        if (score > 0 && ticks > body.length) continue; // the inexact class, below
        const free = Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(
          (cell) => !body.includes(cell),
        );
        const real = foodsOf.get(`${key(body, score, -1)}@${ticks}`) ?? [];
        const wrong = free.filter((cell) => !real.includes(cell));
        // With no food eaten only the first draw gets past the food check (its
        // own test is in serialize.test.ts). With food eaten: every free cell
        // up to three moves; past that the real food and three wrong ones —
        // the first, the middle and the last free cell it is not.
        const foods =
          score === 0
            ? [FIRST_FOOD]
            : ticks <= 3
              ? free
              : [
                  ...real,
                  wrong[0]!,
                  wrong[Math.floor(wrong.length / 2)]!,
                  wrong[wrong.length - 1]!,
                ];
        for (const food of foods) {
          if (body.includes(food)) continue;
          const accepted = restoreSession(record(body, score, food, ticks)) !== null;
          expect(accepted, `${key(body, score, food)} at ${ticks}`).toBe(
            levels[ticks]!.has(key(body, score, food)),
          );
          exact++;
        }
      }
      expect(exact).toBeGreaterThan(0);
    },
  );

  it('refuses, where it cannot be exact, the bodies no walk explains', () => {
    // Food eaten and moves lost: the check is the walk alone. Every body it
    // refuses here is one the old distance-and-parity test let through.
    let refused = 0;
    let accepted = 0;
    for (const { body, score } of candidates(6)) {
      if (score === 0 || 6 <= body.length) continue;
      let food = 0;
      while (body.includes(food)) food++;
      if (restoreSession(record(body, score, food, 6)) === null) refused++;
      else accepted++;
    }
    expect(refused).toBeGreaterThan(0);
    expect(accepted).toBeGreaterThan(0);
  });
});
