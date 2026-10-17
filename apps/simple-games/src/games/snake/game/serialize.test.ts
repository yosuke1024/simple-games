/**
 * The suspended run (docs/SNAKE_RULES.md §11): the record round-trips, a
 * restored run continues exactly where it stopped — same food, because the
 * random state comes back with it (§8) — every position play can reach is
 * accepted, and records play could not have produced are refused.
 */
import { describe, expect, it } from 'vitest';
import { drawFood } from './food';
import {
  MAX_RECORD_COUNT,
  decodeBody,
  encodeBody,
  restoreSession,
  toSnapshot,
  type SnakeSnapshot,
} from './serialize';
import { createSession, pause, resume, start, tick, turn, type SnakeSession } from './session';
import {
  cyclePilot,
  cycleSuccessors,
  hamiltonianCycle,
  invariantViolations,
  playRun,
  wanderer,
} from './test-helpers';
import { CELL_COUNT, INITIAL_BODY, cellAt, colOf } from './types';

const pilot = cyclePilot(cycleSuccessors());

/** A real position: the cycle pilot's run `ticks` moves in, paused. */
function pilotedTo(seed: string, ticks: number): SnakeSession {
  const run = playRun(createSession(seed), pilot, ticks);
  expect(run.session.status).toBe('running');
  return pause(run.session);
}

/** Through JSON and back, the way storage will carry it. */
const viaJson = (snapshot: SnakeSnapshot): SnakeSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as SnakeSnapshot;

describe('the body encoding (§11)', () => {
  it('spells the opening snake as three base-36 pairs, head first', () => {
    expect(encodeBody(INITIAL_BODY)).toBe('2g2f2e');
    expect(decodeBody('2g2f2e')).toEqual([...INITIAL_BODY]);
  });

  it('round-trips every cell and a whole board', () => {
    const order = hamiltonianCycle();
    expect(decodeBody(encodeBody(order))).toEqual(order);
    expect(encodeBody([0])).toBe('00');
    expect(encodeBody([CELL_COUNT - 1])).toBe('5f');
  });

  it('refuses text that is not a body', () => {
    for (const bad of [
      '',
      '2',
      '2g2',
      '2G2f2e', // upper case is not the encoding
      ' 12g2f', // parseInt would skip the space
      '-12g2f',
      '5g2f2e', // 196 is off the board
      'zz2f2e',
      '2g.f2e',
      '00'.repeat(CELL_COUNT + 1),
    ]) {
      expect(decodeBody(bad), bad).toBeNull();
    }
    for (const bad of [null, undefined, 12, ['2g'], {}]) expect(decodeBody(bad)).toBeNull();
  });
});

describe('what is saved (§11)', () => {
  it('saves a started run, running or paused', () => {
    const running = start(createSession('save'));
    expect(toSnapshot(running)).not.toBeNull();
    expect(toSnapshot(pause(running))).not.toBeNull();
  });

  it('saves nothing for a board never started, or a run that is over', () => {
    expect(toSnapshot(createSession('save'))).toBeNull();
    const over = {
      ...start(createSession('save')),
      status: 'over' as const,
      crash: 'wall' as const,
    };
    expect(toSnapshot(over)).toBeNull();
    expect(toSnapshot({ ...over, status: 'cleared', crash: null })).toBeNull();
  });

  it('keeps only what the rules cannot work out', () => {
    const session = { ...pilotedTo('fields', 300), elapsedSeconds: 45 };
    expect(toSnapshot(session)).toStrictEqual({
      seed: 'fields',
      speed: 'normal',
      body: encodeBody(session.body),
      food: session.food,
      score: session.score,
      ticks: session.ticks,
      elapsedSeconds: 45,
    });
  });

  it('keeps a heading chosen while paused, and nothing of a running queue (§5, §6)', () => {
    const paused = pilotedTo('chosen', 300);
    const side = paused.direction === 'up' || paused.direction === 'down' ? 'left' : 'up';
    expect(toSnapshot(turn(paused, side))!.next).toBe(side);
    expect('next' in toSnapshot(paused)!).toBe(false);
    const running = turn(resume(paused), side);
    expect(running.queue).toEqual([side]);
    expect('next' in toSnapshot(running)!).toBe(false);
  });

  it('writes whole seconds, whatever fraction the clock left (§10)', () => {
    const session = { ...pilotedTo('seconds', 120), elapsedSeconds: 41.97 };
    const snapshot = toSnapshot(session)!;
    expect(snapshot.elapsedSeconds).toBe(41);
    expect(restoreSession(viaJson(snapshot))).toEqual({ ...session, elapsedSeconds: 41 });
  });
});

describe('coming back (§6, §11)', () => {
  it('brings a run back exactly, and always paused', () => {
    const paused = { ...pilotedTo('back', 700), elapsedSeconds: 105 };
    const restored = restoreSession(viaJson(toSnapshot(paused)!));
    expect(restored).toEqual(paused);
    expect(restored!.status).toBe('paused');
  });

  it('brings a running run back paused with an empty queue', () => {
    const running = turn(turn(start(createSession('queued')), 'up'), 'left');
    expect(running.queue).toHaveLength(2);
    const restored = restoreSession(viaJson(toSnapshot(running)!))!;
    expect(restored.status).toBe('paused');
    expect(restored.queue).toEqual([]);
  });

  it('continues with the same food as the run that never stopped (§8)', () => {
    const paused = pilotedTo('continue', 900);
    const restored = restoreSession(viaJson(toSnapshot(paused)!))!;
    let a = resume(paused);
    let b = resume(restored);
    let eaten = 0;
    for (let t = 0; t < 4000 && a.status === 'running'; t++) {
      const outA = tick(turn(a, pilot(a)));
      const outB = tick(turn(b, pilot(b)));
      expect(outB.event).toBe(outA.event);
      a = outA.session;
      b = outB.session;
      if (outA.event === 'eat') eaten++;
      expect(b.food).toBe(a.food);
      expect(b.body).toEqual(a.body);
    }
    expect(eaten).toBeGreaterThan(10);
    expect(b).toEqual(a);
  });

  // Six cases of ten runs: each restore now replays or searches the history
  // (history.ts), and one case for all sixty would trade the per-test budget
  // for a wider timeout (docs/ARCHITECTURE.md「CI / リリース」).
  it.each([0, 1, 2, 3, 4, 5].map((group) => ({ first: group * 10, last: group * 10 + 9 })))(
    'accepts every position play reaches (wandering runs $first–$last, a save every 25 moves)',
    ({ first, last }) => {
      let checked = 0;
      for (let s = first; s <= last; s++) {
        const seed = `reach-${s}`;
        const wander = wanderer(seed);
        let session = start(createSession(seed));
        for (let t = 0; t < 3000 && session.status === 'running'; t++) {
          session = tick(turn(session, wander(session))).session;
          if (session.status === 'running' && t % 25 === 7) {
            const restored = restoreSession(viaJson(toSnapshot(session)!));
            expect(restored, `${seed} at ${t}`).not.toBeNull();
            expect(restored!.body).toEqual(session.body);
            expect(invariantViolations(restored!)).toEqual([]);
            checked++;
          }
        }
      }
      expect(checked).toBeGreaterThan(100);
    },
  );

  it('accepts a run saved before its first move', () => {
    const started = pause(start(createSession('early')));
    expect(restoreSession(toSnapshot(started)!)).toEqual(started);
  });

  it('keeps the heading chosen while paused: the run goes on as if it never left (§5)', () => {
    // Heading right one cell from the right wall when the app went away; the
    // player turned it up while paused, and then the system closed the app.
    let live = start(createSession('wall-ahead'));
    while (colOf(live.body[0]!) < 13) live = tick(live).session;
    expect(live.status).toBe('running');
    live = turn(pause(live), 'up');
    expect(live.queue).toEqual(['up']);

    const restored = restoreSession(viaJson(toSnapshot(live)!))!;
    expect(restored).toEqual(live);

    let a = resume(live);
    let b = resume(restored);
    const wander = wanderer('wall-ahead');
    for (let t = 0; t < 400 && a.status === 'running'; t++) {
      const direction = t === 0 ? 'up' : wander(a);
      const outA = tick(t === 0 ? a : turn(a, direction));
      const outB = tick(t === 0 ? b : turn(b, direction));
      if (t === 0) expect(outA.event).toBe('move');
      expect(outB.event).toBe(outA.event);
      a = outA.session;
      b = outB.session;
    }
    expect(b).toEqual(a);
  });

  it('accepts a piloted run one food short of full', () => {
    // The cycle pilot (§4), run until a single free cell is left: the food.
    const nearlyFull = (() => {
      let session = createSession('long');
      while (session.score < CELL_COUNT - 4) session = tick(turn(session, pilot(session))).session;
      return pause(session);
    })();
    expect(restoreSession(viaJson(toSnapshot(nearlyFull)!))).toEqual(nearlyFull);
  });
});

describe('refusing what play could not have produced (§11)', () => {
  const good = (): SnakeSnapshot => toSnapshot(pilotedTo('refuse', 400))!;
  const refuse = (change: Partial<Record<keyof SnakeSnapshot, unknown>>) =>
    restoreSession({ ...good(), ...change } as SnakeSnapshot);
  /** A record of the seed 'refuse' with nothing eaten: its food is the first draw. */
  const young = (body: readonly number[], ticks: number, seed = 'refuse'): SnakeSnapshot => ({
    seed,
    speed: 'normal',
    body: encodeBody(body),
    food: drawFood(seed, 0, INITIAL_BODY),
    score: 0,
    ticks,
    elapsedSeconds: 0,
  });

  it('starts from a record it accepts', () => {
    expect(restoreSession(good())).not.toBeNull();
  });

  it('refuses what is not a record at all, without throwing', () => {
    for (const bad of [null, undefined, 0, 7, 'record', true, [], [good()]]) {
      expect(() => restoreSession(bad), String(bad)).not.toThrow();
      expect(restoreSession(bad), String(bad)).toBeNull();
    }
  });

  it('refuses a missing or malformed seed or speed', () => {
    expect(refuse({ seed: '' })).toBeNull();
    expect(refuse({ seed: 'x'.repeat(201) })).toBeNull();
    expect(refuse({ seed: 7 })).toBeNull();
    expect(refuse({ speed: 'turbo' })).toBeNull();
    expect(refuse({ speed: undefined })).toBeNull();
  });

  it('refuses counts that are not whole, non-negative numbers', () => {
    for (const bad of [-1, 1.5, Number.NaN, Infinity, '3', null]) {
      expect(refuse({ score: bad })).toBeNull();
      expect(refuse({ ticks: bad })).toBeNull();
      expect(refuse({ elapsedSeconds: bad })).toBeNull();
      expect(refuse({ food: bad })).toBeNull();
    }
  });

  it(`refuses counts past ${MAX_RECORD_COUNT}, the bound the schema shares`, () => {
    const { ticks } = good();
    expect(refuse({ elapsedSeconds: MAX_RECORD_COUNT })).not.toBeNull();
    expect(refuse({ elapsedSeconds: MAX_RECORD_COUNT + 1 })).toBeNull();
    expect(refuse({ elapsedSeconds: Number.MAX_SAFE_INTEGER })).toBeNull();
    // Same parity as the real count, so only the bound can refuse it.
    const far = MAX_RECORD_COUNT - ((MAX_RECORD_COUNT - ticks) % 2);
    expect(refuse({ ticks: far })).not.toBeNull();
    expect(refuse({ ticks: far + 2 })).toBeNull();
    expect(refuse({ ticks: Number.MAX_SAFE_INTEGER - 1 })).toBeNull();
  });

  it('refuses a body that is not a path on the board', () => {
    const { body, score } = good();
    const cells = decodeBody(body)!;
    // A gap: the tail cell swapped for one two steps away.
    const gap = [...cells.slice(0, -1), cells[cells.length - 3]!];
    expect(refuse({ body: encodeBody(gap) })).toBeNull();
    // A repeat.
    expect(refuse({ body: encodeBody([...cells.slice(0, -1), cells[0]!]) })).toBeNull();
    // Unreadable text.
    expect(refuse({ body: 'not a body' })).toBeNull();
    expect(refuse({ body: 42 })).toBeNull();
    // Too short to be a snake at all.
    expect(
      refuse({ body: encodeBody(cells.slice(0, 2)), score: score - (cells.length - 2) }),
    ).toBeNull();
  });

  it('refuses a row that wraps into the next', () => {
    const wrapped = [cellAt(4, 0), cellAt(3, 13), cellAt(3, 12)];
    expect(restoreSession(young(wrapped, 99))).toBeNull();
  });

  it('refuses a length that is not the opening three plus the score', () => {
    const { score } = good();
    expect(refuse({ score: score + 1 })).toBeNull();
    expect(refuse({ score: score - 1 })).toBeNull();
  });

  it('refuses food under the snake or off the board', () => {
    const { body } = good();
    const cells = decodeBody(body)!;
    expect(refuse({ food: cells[0] })).toBeNull();
    expect(refuse({ food: cells[cells.length - 1] })).toBeNull();
    expect(refuse({ food: CELL_COUNT })).toBeNull();
    expect(refuse({ food: -1 })).toBeNull();
  });

  it('refuses, with nothing eaten, any food but the first draw (§8)', () => {
    const body = [cellAt(3, 4), cellAt(4, 4), cellAt(5, 4)];
    const record = young(body, 3);
    expect(restoreSession(record)).not.toBeNull();
    let others = 0;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (cell === record.food || body.includes(cell)) continue;
      expect(restoreSession({ ...record, food: cell }), `food ${cell}`).toBeNull();
      others++;
    }
    expect(others).toBe(CELL_COUNT - 4);
    // The opening head is never a first draw: it was under the snake.
    expect(restoreSession({ ...record, food: cellAt(6, 4) })).toBeNull();
  });

  it('refuses a full board: that run is over (§4)', () => {
    const order = hamiltonianCycle();
    const full = order.slice().reverse();
    expect(
      refuse({ body: encodeBody(full), score: CELL_COUNT - 3, food: 0, ticks: 50_000 }),
    ).toBeNull();
  });

  it('refuses a head further from the start than its moves could take it', () => {
    const { ticks } = good();
    expect(refuse({ ticks: 0 })).toBeNull();
    // The opening head is (6,4); a snake whose head is at (0,13) needs 15 moves.
    const far = [cellAt(0, 13), cellAt(0, 12), cellAt(0, 11)];
    expect(restoreSession(young(far, 13))).toBeNull();
    expect(restoreSession(young(far, 15))).not.toBeNull();
    expect(ticks).toBeGreaterThan(0);
  });

  it('refuses a move count of the wrong parity — every move flips the checkerboard colour', () => {
    const { ticks } = good();
    expect(refuse({ ticks: ticks + 1 })).toBeNull();
    expect(refuse({ ticks: ticks + 2 })).not.toBeNull();
  });

  it('refuses more points than moves', () => {
    // A long body at the opening head after very few moves.
    const order = hamiltonianCycle();
    const start = order.indexOf(INITIAL_BODY[0]!);
    const body = Array.from({ length: 8 }, (_, i) => order[(start - i + CELL_COUNT) % CELL_COUNT]!);
    expect(refuse({ body: encodeBody(body), score: 5, ticks: 4, food: 0 })).toBeNull();
  });

  it('refuses a young run whose tail is not the opening snake', () => {
    // One move in, the body must be [new head, (6,4), (6,3)].
    expect(restoreSession(young([cellAt(5, 4), cellAt(6, 4), cellAt(6, 3)], 1))).not.toBeNull();
    expect(restoreSession(young([cellAt(5, 4), cellAt(6, 4), cellAt(7, 4)], 1))).toBeNull();
    // Before the first move it must be the opening snake exactly.
    expect(restoreSession(young([cellAt(6, 4), cellAt(5, 4), cellAt(5, 3)], 0))).toBeNull();
  });

  /**
   * Records both reviews of the first version found accepted: every cell
   * passes the distance-and-parity test, but the moves they imply turn
   * straight back — on the first move, or later — or the food is one the
   * seed never drew. Each is shown next to the nearest record play does
   * reach, so the refusal is for the history and not for something else.
   */
  it('refuses histories that turn straight back, however each cell looks on its own', () => {
    const cases: [string, readonly number[], number][] = [
      // A first move left, into the opening neck (6,3), then up.
      ['first move left', [cellAt(5, 3), cellAt(6, 3), cellAt(6, 4)], 2],
      // The opening snake turned round on the spot.
      ['reversed in place', [cellAt(6, 2), cellAt(6, 3), cellAt(6, 4)], 2],
      // Left into the neck, then up twice.
      ['left first, then up', [cellAt(4, 3), cellAt(5, 3), cellAt(6, 3)], 3],
      // Up, then straight back down past the opening head.
      ['up and straight back', [cellAt(7, 4), cellAt(6, 4), cellAt(5, 4)], 3],
      // Back on the opening head after two moves, then up twice: needs a U-turn.
      ['home again in two', [cellAt(4, 4), cellAt(5, 4), cellAt(6, 4)], 4],
    ];
    for (const [label, body, ticks] of cases) {
      expect(restoreSession(young(body, ticks, 'snake-x')), label).toBeNull();
    }
    // The same shapes with histories that never turn back: up, up; up three
    // times; and right, down, left, up, up, up — home again in four, not two.
    expect(
      restoreSession(young([cellAt(4, 4), cellAt(5, 4), cellAt(6, 4)], 2, 'snake-x')),
    ).not.toBeNull();
    expect(
      restoreSession(young([cellAt(3, 4), cellAt(4, 4), cellAt(5, 4)], 3, 'snake-x')),
    ).not.toBeNull();
    expect(
      restoreSession(young([cellAt(4, 4), cellAt(5, 4), cellAt(6, 4)], 6, 'snake-x')),
    ).not.toBeNull();
  });

  it('refuses a chosen heading that turn would never have kept (§5)', () => {
    const paused = pilotedTo('refuse', 400);
    const record = toSnapshot(paused)!;
    const heading = paused.direction;
    const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' }[heading];
    const side = heading === 'up' || heading === 'down' ? 'left' : 'up';
    expect(restoreSession({ ...record, next: side })!.queue).toEqual([side]);
    for (const bad of [heading, reverse, 'north', '', null, 0, ['up']]) {
      expect(restoreSession({ ...record, next: bad } as unknown), String(bad)).toBeNull();
    }
  });
});
