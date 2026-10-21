/**
 * The suspended-game record of docs/MAKE_THE_TARGET_RULES.md §10 (§15
 * 「復元」): the round trip, Undo after resuming, and every fail-closed
 * condition — each one refused for its own reason, never by a throw.
 */
import { describe, expect, it } from 'vitest';
import {
  checkRecord,
  ELAPSED_SECONDS_MAX,
  restoreSession,
  SAVED_AT_MAX,
  toRecord,
  wholeInRange,
  type RestoreRejection,
  type SessionRecord,
} from './restore';
import {
  createSession,
  dailyOrigin,
  freeOrigin,
  restartSession,
  revealSolution,
  tapOperator,
  tapTile,
  undo,
  withElapsed,
  type MakeTheTargetSession,
} from './session';
import type { Problem } from './types';

const PROBLEM: Problem = {
  difficulty: 'easy',
  numbers: [1, 2, 3, 4],
  target: 21,
  solution: [
    { left: 0, op: '+', right: 1 },
    { left: 2, op: '+', right: 3 },
    { left: 1, op: '*', right: 3 },
  ],
};
const SEED = 'make-the-target-easy-lq1x2-abc';
const NOW = 1_790_000_000_000;

function taps(session: MakeTheTargetSession, ...steps: (number | '+' | '-' | '*' | '/')[]) {
  return steps.reduce<MakeTheTargetSession>(
    (s, step) => (typeof step === 'number' ? tapTile(s, step) : tapOperator(s, step)),
    session,
  );
}

const fresh = () => createSession(PROBLEM, freeOrigin(SEED));
const twoMoves = () => withElapsed(taps(fresh(), 0, '+', 1, 2, '+', 3), 37);
const record = (): SessionRecord => toRecord(twoMoves(), NOW)!;

const reasonOf = (value: unknown): RestoreRejection | 'ok' => {
  const result = checkRecord(value);
  return result.ok ? 'ok' : result.reason;
};

describe('the round trip (§10)', () => {
  it('writes the record of §10', () => {
    expect(record()).toEqual({
      schemaVersion: 1,
      mode: 'free',
      seed: SEED,
      difficulty: 'easy',
      dailyDate: null,
      numbers: [1, 2, 3, 4],
      target: 21,
      solution: '0+12+31*3',
      moves: '0+12+3',
      repeat: false,
      elapsedSeconds: 37,
      savedAt: NOW,
    });
  });

  it('reads back the same game, through JSON, Undo history included', () => {
    const saved = JSON.parse(JSON.stringify(record())) as unknown;
    const restored = restoreSession(saved)!;
    const original = twoMoves();
    expect(restored.slots).toEqual(original.slots);
    expect(restored.moves).toEqual(original.moves);
    expect(restored.problem).toEqual(original.problem);
    expect(restored).toMatchObject({
      status: 'playing',
      elapsedSeconds: 37,
      repeat: false,
      seed: SEED,
    });
    // Undo reaches the first position after a resume (§5).
    const once = undo(restored)!;
    const twice = undo(once)!;
    expect(twice.slots).toEqual([1, 2, 3, 4]);
    expect(undo(twice)).toBeNull();
  });

  it('keeps `repeat` through a save', () => {
    const solved = taps(fresh(), 0, '+', 1, 2, '+', 3, 1, '*', 3);
    const retry = taps(restartSession(solved)!, 0, '+', 1);
    expect(retry.repeat).toBe(true);
    const back = restoreSession(JSON.parse(JSON.stringify(toRecord(retry, NOW))))!;
    expect(back.repeat).toBe(true);
  });

  it('reads a missed board as a game to resume, at the panel', () => {
    const missed = taps(fresh(), 0, '+', 1, 2, '+', 3, 1, '+', 3);
    expect(missed.status).toBe('missed');
    const back = restoreSession(toRecord(missed, NOW))!;
    expect(back.status).toBe('missed');
    expect(undo(back)!.status).toBe('playing');
  });

  it('reads a fresh game with no moves', () => {
    expect(restoreSession(toRecord(fresh(), NOW))!.moves).toEqual([]);
  });

  it('reads the daily', () => {
    const daily = createSession({ ...PROBLEM, difficulty: 'medium' }, dailyOrigin('2026-10-21'));
    const back = restoreSession(toRecord(tapTile(daily, 0), NOW))!;
    expect(back).toMatchObject({ mode: 'daily', dailyDate: '2026-10-21', difficulty: 'medium' });
    expect(back.selectedTile).toBeNull(); // the selection is not saved
  });

  it('does not write a solved or a revealed game', () => {
    const solved = taps(fresh(), 0, '+', 1, 2, '+', 3, 1, '*', 3);
    expect(toRecord(solved, NOW)).toBeNull();
    const revealed = revealSolution(taps(fresh(), 0, '+', 1, 2, '+', 3, 1, '+', 3))!;
    expect(toRecord(revealed, NOW)).toBeNull();
  });

  it('writes only what it reads: the counters clamped into range', () => {
    for (const [elapsed, written] of [
      [12.9, 12],
      [-4, 0],
      [NaN, 0],
      [Infinity, ELAPSED_SECONDS_MAX],
      [1e300, ELAPSED_SECONDS_MAX],
    ] as const) {
      const session = { ...twoMoves(), elapsedSeconds: elapsed };
      const out = toRecord(session, NOW)!;
      expect(out.elapsedSeconds, String(elapsed)).toBe(written);
      expect(restoreSession(out), String(elapsed)).not.toBeNull();
    }
    for (const savedAt of [-1, NaN, 1e300, 1.5]) {
      const out = toRecord(twoMoves(), savedAt)!;
      expect(out.savedAt).toBe(wholeInRange(savedAt, SAVED_AT_MAX));
      expect(restoreSession(out), String(savedAt)).not.toBeNull();
    }
  });
});

describe('fail-closed (§10)', () => {
  const daily = (): SessionRecord =>
    toRecord(createSession({ ...PROBLEM, difficulty: 'medium' }, dailyOrigin('2026-10-21')), NOW)!;
  const cases: [string, unknown, RestoreRejection][] = [
    ['null', null, 'not-a-record'],
    ['an array', [record()], 'not-a-record'],
    ['a string', 'record', 'not-a-record'],
    ['schemaVersion 2', { ...record(), schemaVersion: 2 }, 'bad-version'],
    ['no schemaVersion', { ...record(), schemaVersion: undefined }, 'bad-version'],
    ['an unknown mode', { ...record(), mode: 'zen' }, 'bad-mode'],
    ['an empty seed', { ...record(), seed: '' }, 'bad-seed'],
    ['a seed that is not a string', { ...record(), seed: 7 }, 'bad-seed'],
    ['an unknown difficulty', { ...record(), difficulty: 'expert' }, 'bad-difficulty'],
    ['Free Play with a date', { ...record(), dailyDate: '2026-10-21' }, 'bad-daily-date'],
    [
      'Free Play, a seed of another difficulty',
      { ...record(), seed: 'make-the-target-hard-x' },
      'bad-seed',
    ],
    ['Free Play, an empty token', { ...record(), seed: 'make-the-target-easy-' }, 'bad-seed'],
    [
      'Free Play, a daily seed',
      { ...record(), seed: 'make-the-target-daily-2026-10-21' },
      'bad-seed',
    ],
    ['a daily with no date', { ...daily(), dailyDate: null }, 'bad-daily-date'],
    [
      'a daily on no real day',
      { ...daily(), dailyDate: '2026-02-30', seed: 'make-the-target-daily-2026-02-30' },
      'bad-daily-date',
    ],
    ['a daily that is not Medium', { ...daily(), difficulty: 'easy' }, 'bad-difficulty'],
    [
      'a daily with another day’s seed',
      { ...daily(), seed: 'make-the-target-daily-2026-10-22' },
      'bad-seed',
    ],
    ['a daily with repeat true', { ...daily(), repeat: true }, 'bad-repeat'],
    ['numbers that are not an array', { ...record(), numbers: '1,2,3,4' }, 'not-dealable'],
    ['a non-integer number', { ...record(), numbers: [1, 2, 3, 4.5] }, 'not-dealable'],
    ['numbers out of order', { ...record(), numbers: [2, 1, 3, 4] }, 'not-dealable'],
    ['a number out of range', { ...record(), numbers: [1, 2, 3, 11] }, 'not-dealable'],
    [
      'a tile count the tier does not deal',
      { ...record(), numbers: [1, 2, 3, 4, 5] },
      'not-dealable',
    ],
    [
      'six tiles',
      {
        ...record(),
        difficulty: 'medium',
        numbers: [1, 1, 2, 3, 4, 5],
        seed: 'make-the-target-medium-x',
      },
      'not-dealable',
    ],
    ['a target outside the band', { ...record(), target: 25 }, 'not-dealable'],
    ['a target that is not a number', { ...record(), target: '21' }, 'not-dealable'],
    ['a solution that is not a string', { ...record(), solution: ['0+1'] }, 'bad-solution'],
    ['a solution too short', { ...record(), solution: '0+12+3' }, 'bad-solution'],
    ['a solution not in triples', { ...record(), solution: '0+12+31*' }, 'bad-solution'],
    ['a solution with the same slot twice', { ...record(), solution: '0+02+31*3' }, 'bad-solution'],
    ['a solution off the board', { ...record(), solution: '0+12+31*5' }, 'bad-solution'],
    ['a solution on an empty slot', { ...record(), solution: '0+10+31*3' }, 'bad-solution'],
    ['a solution the rules refuse', { ...record(), solution: '0-12+31*3' }, 'bad-solution'],
    ['a solution that misses the target', { ...record(), solution: '0+12+31+3' }, 'bad-solution'],
    ['moves that are not a string', { ...record(), moves: null }, 'bad-moves'],
    ['moves not in triples', { ...record(), moves: '0+12+' }, 'bad-moves'],
    ['too many moves', { ...record(), moves: '0+12+31*33+3' }, 'bad-moves'],
    ['a move with the same slot twice', { ...record(), moves: '1+1' }, 'bad-moves'],
    ['a move off the board', { ...record(), moves: '0+4' }, 'bad-moves'],
    ['a move on an empty slot', { ...record(), moves: '0+10+2' }, 'bad-moves'],
    ['a move the rules refuse', { ...record(), moves: '0-1' }, 'bad-moves'],
    ['a solved board', { ...record(), moves: '0+12+31*3' }, 'finished'],
    ['repeat that is not a boolean', { ...record(), repeat: 'no' }, 'bad-repeat'],
    ['elapsed NaN', { ...record(), elapsedSeconds: NaN }, 'bad-elapsed'],
    ['elapsed negative', { ...record(), elapsedSeconds: -1 }, 'bad-elapsed'],
    ['elapsed fractional', { ...record(), elapsedSeconds: 1.5 }, 'bad-elapsed'],
    ['elapsed infinite', { ...record(), elapsedSeconds: Infinity }, 'bad-elapsed'],
    ['elapsed past the bound', { ...record(), elapsedSeconds: 1e9 + 1 }, 'bad-elapsed'],
    ['elapsed 1e300', { ...record(), elapsedSeconds: 1e300 }, 'bad-elapsed'],
    ['savedAt missing', { ...record(), savedAt: undefined }, 'bad-saved-at'],
    ['savedAt negative', { ...record(), savedAt: -1 }, 'bad-saved-at'],
    ['savedAt 1e300', { ...record(), savedAt: 1e300 }, 'bad-saved-at'],
    ['savedAt fractional', { ...record(), savedAt: 0.5 }, 'bad-saved-at'],
  ];

  for (const [name, value, reason] of cases) {
    it(`refuses ${name}`, () => {
      expect(reasonOf(value)).toBe(reason);
      expect(restoreSession(value)).toBeNull();
    });
  }

  it('accepts the bounds themselves', () => {
    expect(
      reasonOf({ ...record(), elapsedSeconds: ELAPSED_SECONDS_MAX, savedAt: SAVED_AT_MAX }),
    ).toBe('ok');
    expect(reasonOf({ ...record(), elapsedSeconds: 0, savedAt: 0 })).toBe('ok');
    expect(reasonOf({ ...record(), elapsedSeconds: -0 })).toBe('ok');
    expect(Object.is(restoreSession({ ...record(), elapsedSeconds: -0 })!.elapsedSeconds, 0)).toBe(
      true,
    );
  });

  it('reads each field once: a getter cannot pass with one value and play with another', () => {
    /** `record()` with `field` answering `first` on its first read and `later` after. */
    const flipping = (field: keyof SessionRecord, first: unknown, later: unknown) => {
      const base = record() as unknown as Record<string, unknown>;
      let reads = 0;
      return Object.defineProperty({ ...base }, field, {
        enumerable: true,
        get: () => (reads++ === 0 ? first : later),
      });
    };
    const repeat = checkRecord(flipping('repeat', false, 'yes'));
    expect(repeat.ok && repeat.session.repeat).toBe(false);
    const elapsed = checkRecord(flipping('elapsedSeconds', 37, -1e300));
    expect(elapsed.ok && elapsed.session.elapsedSeconds).toBe(37);
    for (const [field, first, later] of [
      ['repeat', 'yes', false],
      ['elapsedSeconds', NaN, 37],
      ['savedAt', -1, NOW],
      ['solution', 'xyz', record().solution],
      ['moves', '0+0', record().moves],
      ['target', 99, 21],
    ] as const) {
      // Refused on the first read is refused, whatever later reads would say.
      expect(checkRecord(flipping(field, first, later)).ok, field).toBe(false);
    }
  });

  it('copies `numbers` before checking it: an array that changes is played as checked', () => {
    let reads = 0;
    const shifting = new Proxy([1, 2, 3, 4], {
      get(target, key, receiver) {
        // Every index reads true the first time, 0 after.
        if (typeof key === 'string' && /^\d+$/.test(key)) return reads++ < 4 ? target[+key] : 0;
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    const result = checkRecord({ ...record(), numbers: shifting });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.problem.numbers).toEqual([1, 2, 3, 4]);
      expect(result.session.slots.every((v) => v === null || v >= 1)).toBe(true);
    }
  });

  it('never throws, whatever it is handed', () => {
    const base = record() as unknown as Record<string, unknown>;
    const junk: unknown[] = [
      undefined,
      0,
      true,
      Symbol('x'),
      () => 1,
      new Date(),
      { __proto__: null },
    ];
    const fields = Object.keys(base);
    for (const field of fields) {
      for (const value of [undefined, null, 0, -1, 1e300, NaN, '', 'x', [], {}, [1, 2], true]) {
        junk.push({ ...base, [field]: value });
      }
    }
    const throwing = new Proxy(
      {},
      {
        get() {
          throw new Error('getter');
        },
      },
    );
    junk.push(throwing);
    for (const value of junk) expect(() => restoreSession(value)).not.toThrow();
    expect(restoreSession(throwing)).toBeNull();
  });
});
