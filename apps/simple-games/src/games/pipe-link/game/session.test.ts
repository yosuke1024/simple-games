/**
 * Session rules of docs/PIPE_LINK_RULES.md §2, §3, §6–§8: what a turn does,
 * what Undo takes back, how a Hint is counted, Restart, the two ways a
 * session begins, and the saved record — round trip and every fail-closed
 * refusal.
 */
import { describe, expect, it } from 'vitest';
import { isSolved } from './board';
import { DAILY_DIFFICULTY, addDays, dailySeed, localDateString } from './daily';
import { generatePuzzle } from './generator';
import { encodeOrientations } from './serialize';
import {
  MAX_COUNTER,
  UNDO_HISTORY_LIMIT,
  askHint,
  canUndo,
  createDailySession,
  createDifficultySession,
  difficultySeed,
  fromRecord,
  litOf,
  newSeedToken,
  restartSession,
  toRecord,
  turnTile,
  undo,
  withElapsedSeconds,
  type PipeLinkSession,
} from './session';
import { periodOf } from './tiles';
import { PRESETS } from './types';

const session = createDifficultySession('easy', 'pipe-link-easy-session');

/** Turns every tile clockwise into its answer orientation. */
function solveByTapping(s: PipeLinkSession): PipeLinkSession {
  let current = s;
  for (let cell = 0; cell < s.current.length; cell++) {
    while (current.status === 'playing' && current.current[cell] !== s.solution[cell]) {
      current = turnTile(current, cell, 'cw')!;
    }
  }
  return current;
}

describe('creating a session (§8)', () => {
  it('starts from the generated board’s scramble with nothing counted', () => {
    const puzzle = generatePuzzle('pipe-link-easy-session', 'easy');
    expect(session.board).toEqual(puzzle.board);
    expect(session.current).toEqual(puzzle.initial);
    expect(session.initial).toEqual(puzzle.initial);
    expect(session).toMatchObject({
      mode: 'difficulty',
      difficulty: 'easy',
      dailyDate: null,
      status: 'playing',
      hintCount: 0,
      elapsedSeconds: 0,
      history: [],
      lastHint: null,
      techniques: null,
    });
  });

  it('seeds difficulty games with a token and dailies with the date, medium every day', () => {
    expect(difficultySeed('hard', 'abc')).toBe('pipe-link-hard-abc');
    expect(newSeedToken(36 ** 3, () => 0)).toBe('1000-0');
    const daily = createDailySession('2026-10-22');
    expect(daily.seed).toBe(dailySeed('2026-10-22'));
    expect(daily.seed).toBe('pipe-link-daily-2026-10-22');
    expect(daily.difficulty).toBe(DAILY_DIFFICULTY);
    expect(daily.board.width).toBe(PRESETS.medium.width);
    expect(daily.mode).toBe('daily');
    expect(daily.dailyDate).toBe('2026-10-22');
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('turning a tile (§3)', () => {
  it('turns clockwise and counter-clockwise, one step each, and lights from the source', () => {
    const cell = session.board.types.findIndex((t) => t !== 'straight');
    const cw = turnTile(session, cell, 'cw')!;
    expect(cw.current[cell]).toBe((session.current[cell]! + 1) % 4);
    expect(cw.history).toEqual([{ cell, previous: session.current[cell] }]);
    const back = turnTile(cw, cell, 'ccw')!;
    expect(back.current).toEqual(session.current);
    expect(back.history).toHaveLength(2);
    expect(litOf(session)[session.board.source]).toBe(true);
  });

  it('refuses a cell off the board', () => {
    expect(turnTile(session, -1, 'cw')).toBeNull();
    expect(turnTile(session, 25, 'cw')).toBeNull();
    expect(turnTile(session, 1.5, 'cw')).toBeNull();
  });

  it('solves once, by lighting, and then takes no turn, no undo and no hint', () => {
    const solved = solveByTapping(session);
    expect(solved.status).toBe('solved');
    expect(isSolved(solved.board, solved.current)).toBe(true);
    expect(litOf(solved).every(Boolean)).toBe(true);
    expect(turnTile(solved, 0, 'cw')).toBeNull();
    expect(canUndo(solved)).toBe(false);
    expect(undo(solved)).toBeNull();
    expect(askHint(solved)).toEqual({ session: solved, hint: null });
  });
});

describe('Undo (§6)', () => {
  it('takes turns back one at a time, either direction, and keeps the hint count', () => {
    const cell = session.board.types.findIndex((t) => t !== 'straight');
    let s = turnTile(session, cell, 'cw')!;
    s = turnTile(s, cell, 'cw')!;
    s = turnTile(s, 3, 'ccw')!;
    s = askHint(s).session;
    expect(s.hintCount).toBe(1);
    s = undo(s)!;
    expect(s.current[3]).toBe(session.current[3]);
    s = undo(s)!;
    s = undo(s)!;
    expect(s.current).toEqual(session.current);
    expect(canUndo(s)).toBe(false);
    expect(undo(s)).toBeNull();
    expect(s.hintCount).toBe(1);
  });

  it('keeps at most UNDO_HISTORY_LIMIT steps, dropping the oldest', () => {
    const straight = session.board.types.indexOf('straight');
    const cell = straight >= 0 ? straight : 0;
    let s = session;
    for (let i = 0; i < UNDO_HISTORY_LIMIT + 3; i++) {
      // Turn the same tile back and forth so the board never solves.
      s = turnTile(s, cell, i % 2 === 0 ? 'cw' : 'ccw') ?? s;
    }
    expect(s.history).toHaveLength(UNDO_HISTORY_LIMIT);
  });
});

describe('Hint (§6)', () => {
  it('shows a tile that differs from the answer, with the answer’s orientation, and never writes it', () => {
    const { session: after, hint } = askHint(session);
    expect(hint).not.toBeNull();
    expect(hint!.kind).toBe('technique');
    expect(session.current[hint!.cell]).not.toBe(session.solution[hint!.cell]);
    expect(hint!.orientation).toBe(session.solution[hint!.cell]);
    expect(after.current).toEqual(session.current);
    expect(after.hintCount).toBe(1);
    expect(after.techniques).not.toBeNull();
  });

  it('counts a hint asked again on an unchanged board once, and a hint after a change again', () => {
    const first = askHint(session);
    const second = askHint(first.session);
    expect(second.hint).toEqual(first.hint);
    expect(second.session.hintCount).toBe(1);
    const turned = turnTile(second.session, first.hint!.cell, 'cw')!;
    expect(turned.lastHint).toBeNull();
    const third = askHint(turned);
    expect(third.session.hintCount).toBe(2);
    // The solver ran once: the result stays on the session.
    expect(third.session.techniques).toBe(first.session.techniques);
  });

  it('solves every tile by following hints alone, never reaching the answer stage', () => {
    let s = session;
    let hints = 0;
    while (s.status === 'playing') {
      const { session: next, hint } = askHint(s);
      expect(hint!.kind).toBe('technique');
      expect(next.current[hint!.cell]).not.toBe(next.solution[hint!.cell]);
      s = next;
      while (s.current[hint!.cell] !== hint!.orientation) s = turnTile(s, hint!.cell, 'cw')!;
      hints++;
      expect(hints).toBeLessThanOrEqual(25);
    }
    expect(s.hintCount).toBe(hints);
  });

  it('falls to the answer stage only on a board the techniques cannot decide', () => {
    // Shipped boards never get here (bundled.test.ts / guarantee.test.ts walk them). Hand the
    // session a technique result that decided nothing — what a board the techniques cannot
    // decide would leave — and the hint reads the stored answer, first differing tile row-major.
    const stuck: PipeLinkSession = {
      ...session,
      techniques: {
        status: 'stuck',
        level: 1,
        domains: session.board.types.map((t) => (1 << periodOf(t)) - 1),
        order: [],
        stageOf: session.board.types.map(() => 0),
        l2Rounds: 0,
        l3: 0,
        work: 0,
      },
    };
    const { hint } = askHint(stuck);
    expect(hint!.kind).toBe('solution');
    const first = session.current.findIndex((o, i) => o !== session.solution[i]);
    expect(hint).toEqual({ cell: first, orientation: session.solution[first], kind: 'solution' });
  });
});

describe('Restart and the clock (§8)', () => {
  it('Restart brings back the starting orientations with no history, hints or seconds', () => {
    let s = turnTile(session, 0, 'cw')!;
    s = askHint(s).session;
    s = withElapsedSeconds(s, 42);
    const r = restartSession(s);
    expect(r.current).toEqual(session.initial);
    expect(r).toMatchObject({ history: [], hintCount: 0, elapsedSeconds: 0, lastHint: null });
    expect(r.board).toBe(s.board);
    const solved = restartSession(solveByTapping(session));
    expect(solved.status).toBe('playing');
  });

  it('only moves seconds forward, ignores non-finite values and stops at the ceiling', () => {
    const s = withElapsedSeconds(session, 10.7);
    expect(s.elapsedSeconds).toBe(10);
    expect(withElapsedSeconds(s, 5).elapsedSeconds).toBe(10);
    expect(withElapsedSeconds(s, Number.NaN)).toBe(s);
    expect(withElapsedSeconds(s, Number.POSITIVE_INFINITY)).toBe(s);
    expect(withElapsedSeconds(s, 1e12).elapsedSeconds).toBe(MAX_COUNTER);
  });
});

describe('the saved record (§7)', () => {
  const played = withElapsedSeconds(askHint(turnTile(session, 0, 'cw')!).session, 77);
  const record = toRecord(played);

  it('round-trips everything but the history and the hint memory', () => {
    expect(record).toMatchObject({
      mode: 'difficulty',
      seed: 'pipe-link-easy-session',
      difficulty: 'easy',
      dailyDate: null,
      width: 5,
      height: 5,
      hintCount: 1,
      elapsedSeconds: 77,
    });
    const back = fromRecord(JSON.parse(JSON.stringify(record)))!;
    expect(back.board).toEqual(played.board);
    expect(back.solution).toEqual(played.solution);
    expect(back.initial).toEqual(played.initial);
    expect(back.current).toEqual(played.current);
    expect(back).toMatchObject({
      history: [],
      lastHint: null,
      techniques: null,
      status: 'playing',
    });
    expect(toRecord(back)).toEqual(record);
  });

  it('round-trips a daily', () => {
    const daily = createDailySession('2026-10-22');
    const back = fromRecord(toRecord(daily))!;
    expect(back.mode).toBe('daily');
    expect(back.dailyDate).toBe('2026-10-22');
  });

  const refused: [string, Record<string, unknown>][] = [
    ['not an object', { __replace: 'x' }],
    ['unknown mode', { mode: 'arcade' }],
    ['empty seed', { seed: '' }],
    ['seed too long', { seed: 'x'.repeat(201) }],
    ['seed not a string', { seed: 5 }],
    ['unknown difficulty', { difficulty: 'expert' }],
    ['difficulty game with a date', { dailyDate: '2026-10-22' }],
    ['daily without a date', { mode: 'daily', difficulty: 'medium', dailyDate: null }],
    ['size not the preset', { width: 6 }],
    ['height not the preset', { height: 4 }],
    ['types too short', { types: record.types.slice(1) }],
    ['unknown type letter', { types: `q${record.types.slice(1)}` }],
    ['source off the board', { source: 25 }],
    ['source not an integer', { source: 2.5 }],
    ['answer not solved', { solution: record.initial }],
    ['orientation outside the period', { current: `9${record.current.slice(1)}` }],
    ['initial too long', { initial: `${record.initial}0` }],
    ['hint count negative', { hintCount: -1 }],
    ['hint count fractional', { hintCount: 1.5 }],
    ['seconds over the ceiling', { elapsedSeconds: MAX_COUNTER + 1 }],
    ['seconds missing', { elapsedSeconds: undefined }],
    ['already solved', { current: record.solution }],
  ];
  for (const [name, change] of refused) {
    it(`refuses a record with ${name}`, () => {
      const raw = '__replace' in change ? change.__replace : { ...record, ...change };
      expect(fromRecord(raw)).toBeNull();
    });
  }

  it('refuses a daily that is not medium, even with a valid medium-sized board elsewhere', () => {
    const daily = toRecord(createDailySession('2026-10-22'));
    expect(fromRecord({ ...daily, difficulty: 'hard' })).toBeNull();
    expect(fromRecord({ ...daily, dailyDate: '2026-1-2' })).toBeNull();
    expect(fromRecord(null)).toBeNull();
  });

  it('keeps a scramble that the generator would refuse — the scramble rule is not a load rule', () => {
    // Every tile but one in place: never generated (over 60 %), still a board to resume.
    const near = [...played.solution];
    const cell = played.board.types.findIndex((t) => t !== 'straight');
    near[cell] = (near[cell]! + 1) % 4;
    const raw = { ...record, initial: encodeOrientations(near), current: encodeOrientations(near) };
    expect(fromRecord(raw)).not.toBeNull();
  });
});
