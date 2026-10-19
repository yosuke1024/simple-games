/**
 * The session (docs/PEG_SOLITAIRE_RULES.md §3, §6, §11): playing jumps,
 * refusing the ones the rules do not allow, Undo and Restart, the three ways
 * a game can end, and the save — a record that replays through the rules, and
 * every way a record can fail to.
 */
import { describe, expect, it } from 'vitest';
import { ENGLISH, ENGLISH_CENTER, TRIANGLE, geometryOf, holeIndex } from './boards';
import { initialPegs, legalJumps, pegCount } from './engine';
import { ENGLISH_SOLUTION, parseEnglishJumps } from './fixtures';
import { ENGLISH_PROBLEM, TRIANGLE_PROBLEMS, findProblem } from './problems';
import {
  MAX_ELAPSED_SECONDS,
  applyMove,
  canUndo,
  createSession,
  restartSession,
  restoreSession,
  toRecord,
  undo,
  wholeElapsedSeconds,
  type PegSolitaireSession,
  type UntrustedRecord,
} from './session';
import { solve } from './solver';
import type { Problem } from './types';

const E = (row: number, col: number) => holeIndex(ENGLISH, row, col);
const apexToApex = findProblem('triangle', 0, 0)!;

/** Plays [from, to] pairs, failing loudly on the first one the rules refuse. */
function play(session: PegSolitaireSession, jumps: readonly (readonly [number, number])[]) {
  return jumps.reduce((current, [from, to], i) => {
    const next = applyMove(current, from, to);
    if (!next) throw new Error(`jump ${i} (${from}>${to}) was refused`);
    return next;
  }, session);
}

/** Always takes the first legal jump in board order — a fixed, unlucky player. */
function playFirstJumps(problem: Problem): PegSolitaireSession {
  let session = createSession(problem);
  while (session.status === 'playing') {
    const [jump] = legalJumps(geometryOf(problem.kind), session.pegs);
    session = applyMove(session, jump!.from, jump!.to)!;
  }
  return session;
}

const solutionTo = (problem: Problem, target: number): [number, number][] => {
  const geometry = geometryOf(problem.kind);
  const result = solve(geometry, initialPegs(geometry, problem.start), target);
  if (result.status !== 'solved') throw new Error(`no solution to ${target}`);
  return result.jumps.map((jump) => [jump.from, jump.to]);
};

describe('a new game (§3)', () => {
  it('starts with every hole but the start filled, nothing played', () => {
    const session = createSession(ENGLISH_PROBLEM);
    expect(session.problem).toBe(ENGLISH_PROBLEM);
    expect(pegCount(session.pegs)).toBe(32);
    expect(session.pegs[ENGLISH_CENTER]).toBe(false);
    expect(session.jumps).toEqual([]);
    expect(session.status).toBe('playing');
    expect(session.outcome).toBeNull();
    expect(session.elapsedSeconds).toBe(0);
    expect(canUndo(session)).toBe(false);
  });

  it('starts every triangle problem in play', () => {
    for (const problem of TRIANGLE_PROBLEMS) {
      const session = createSession(problem);
      expect(session.status).toBe('playing');
      expect(pegCount(session.pegs)).toBe(14);
      expect(session.pegs[problem.start]).toBe(false);
    }
  });
});

describe('playing a jump (§2, §4)', () => {
  it('plays a legal jump and records it, leaving the old session as it was', () => {
    const before = createSession(ENGLISH_PROBLEM);
    const after = applyMove(before, E(1, 3), E(3, 3))!;
    expect(after.pegs[E(1, 3)]).toBe(false);
    expect(after.pegs[E(2, 3)]).toBe(false);
    expect(after.pegs[E(3, 3)]).toBe(true);
    expect(after.jumps).toEqual([{ from: E(1, 3), over: E(2, 3), to: E(3, 3) }]);
    expect(before.jumps).toEqual([]);
    expect(before.pegs[E(1, 3)]).toBe(true);
  });

  it('refuses what the rules refuse, and changes nothing', () => {
    const session = applyMove(createSession(ENGLISH_PROBLEM), E(1, 3), E(3, 3))!;
    const refused: [string, number, number][] = [
      ['diagonal', E(2, 2), E(4, 4)],
      ['into a peg', E(3, 1), E(3, 3)],
      ['from an empty hole', E(1, 3), E(3, 3)],
      ['over an empty hole', E(0, 3), E(2, 3)],
      ['one hole away', E(3, 2), E(3, 3)],
      ['off the board', E(3, 1), -1],
      ['not a hole index', E(3, 1), 33],
      ['to itself', E(3, 1), E(3, 1)],
    ];
    for (const [name, from, to] of refused) {
      expect(applyMove(session, from, to), name).toBeNull();
    }
  });

  it('plays the triangle’s six directions and refuses the cross’s diagonal there too', () => {
    let session = createSession(apexToApex);
    session = applyMove(session, 3, 0)!; // up an edge into the apex
    expect(session.pegs[0]).toBe(true);
    expect(session.pegs[1]).toBe(false);
    expect(session.pegs[3]).toBe(false);
    // (2,2) → (4,0) is evenly spaced on screen but not a line of the triangle.
    expect(applyMove(session, 5, 10)).toBeNull();
  });
});

describe('the end of the game (§3)', () => {
  it('is a perfect clear when the known solution is replayed', () => {
    const session = play(createSession(ENGLISH_PROBLEM), parseEnglishJumps(ENGLISH_SOLUTION));
    expect(session.jumps).toHaveLength(31);
    expect(session.status).toBe('over');
    expect(session.outcome).toEqual({ kind: 'perfect', remaining: 1 });
    expect(session.pegs[ENGLISH_CENTER]).toBe(true);
  });

  it('accepts nothing more once it is over', () => {
    const over = playFirstJumps(apexToApex);
    expect(over.status).toBe('over');
    for (let from = 0; from < TRIANGLE.holes.length; from++) {
      for (let to = 0; to < TRIANGLE.holes.length; to++) {
        expect(applyMove(over, from, to)).toBeNull();
      }
    }
  });

  it('tells one peg left off the target apart from the clear', () => {
    // Apex → apex, but steered to finish in (3,0): one peg, not in the ring.
    const session = play(createSession(apexToApex), solutionTo(apexToApex, 6));
    expect(session.status).toBe('over');
    expect(session.outcome).toEqual({ kind: 'single', remaining: 1 });
    expect(session.pegs[6]).toBe(true);
  });

  it('ends stuck with pegs left and no jump', () => {
    const triangle = playFirstJumps(apexToApex);
    expect(triangle.outcome).toEqual({ kind: 'stuck', remaining: 3 });
    expect(triangle.jumps).toHaveLength(11);
    const cross = playFirstJumps(ENGLISH_PROBLEM);
    expect(cross.outcome).toEqual({ kind: 'stuck', remaining: 7 });
    expect(cross.jumps).toHaveLength(25);
  });
});

describe('Undo (§6)', () => {
  it('takes back exactly the last jump', () => {
    const start = createSession(ENGLISH_PROBLEM);
    const one = applyMove(start, E(1, 3), E(3, 3))!;
    const two = applyMove(one, E(2, 1), E(2, 3))!;
    const back = undo(two)!;
    expect(back.pegs).toEqual(one.pegs);
    expect(back.jumps).toEqual(one.jumps);
    expect(undo(back)!.pegs).toEqual(start.pegs);
  });

  it('walks all the way back to the start, and no further', () => {
    let session = play(
      createSession(ENGLISH_PROBLEM),
      parseEnglishJumps(ENGLISH_SOLUTION).slice(0, 30),
    );
    const positions = [session.pegs];
    while (canUndo(session)) {
      session = undo(session)!;
      positions.push(session.pegs);
    }
    expect(positions).toHaveLength(31);
    expect(session.pegs).toEqual(createSession(ENGLISH_PROBLEM).pegs);
    expect(session.jumps).toEqual([]);
    expect(undo(session)).toBeNull();
  });

  it('is not a reroll: the same jump again gives the same game', () => {
    const one = applyMove(createSession(apexToApex), 3, 0)!;
    const two = applyMove(one, 10, 3)!;
    expect(applyMove(undo(two)!, 10, 3)).toEqual(two);
  });

  it('puts a stuck game back in play', () => {
    const stuck = playFirstJumps(apexToApex);
    expect(canUndo(stuck)).toBe(true);
    const back = undo(stuck)!;
    expect(back.status).toBe('playing');
    expect(back.outcome).toBeNull();
    expect(back.jumps).toHaveLength(stuck.jumps.length - 1);
  });

  it('puts a one-peg finish back in play, so the clear is still in reach', () => {
    const single = play(createSession(apexToApex), solutionTo(apexToApex, 6));
    expect(canUndo(single)).toBe(true);
    expect(undo(single)!.status).toBe('playing');
  });

  it('takes back a perfect clear too, to the position before the last jump', () => {
    const solution = parseEnglishJumps(ENGLISH_SOLUTION);
    const beforeLast = play(createSession(ENGLISH_PROBLEM), solution.slice(0, -1));
    const clear = play(beforeLast, solution.slice(-1));
    expect(clear.outcome).toEqual({ kind: 'perfect', remaining: 1 });
    expect(canUndo(clear)).toBe(true);
    const back = undo(clear)!;
    expect(back.status).toBe('playing');
    expect(back.outcome).toBeNull();
    expect(back.pegs).toEqual(beforeLast.pegs);
    expect(back.jumps).toEqual(beforeLast.jumps);
    expect(pegCount(back.pegs)).toBe(2);
    // The same jump again is the same clear.
    const again = play(back, solution.slice(-1));
    expect(again.pegs).toEqual(clear.pegs);
    expect(again.outcome).toEqual(clear.outcome);
  });

  it('remembers a clear through every Undo after it, and only a new game forgets it (§10)', () => {
    const solution = solutionTo(apexToApex, 0);
    const fresh = createSession(apexToApex);
    expect(fresh.cleared).toBe(false);
    const nearly = play(fresh, solution.slice(0, -1));
    expect(nearly.cleared).toBe(false);
    // A one-peg finish is not a clear.
    expect(play(createSession(apexToApex), solutionTo(apexToApex, 6)).cleared).toBe(false);

    const clear = play(nearly, solution.slice(-1));
    expect(clear.cleared).toBe(true);
    let session = clear;
    while (canUndo(session)) {
      session = undo(session)!;
      expect(session.cleared).toBe(true);
    }
    expect(session.pegs).toEqual(fresh.pegs);
    // Played again to a stuck end, it is still the game that was cleared.
    let replayed = session;
    while (replayed.status === 'playing') {
      const [jump] = legalJumps(TRIANGLE, replayed.pegs);
      replayed = applyMove(replayed, jump!.from, jump!.to)!;
    }
    expect(replayed.outcome?.kind).toBe('stuck');
    expect(replayed.cleared).toBe(true);
    expect(restartSession(replayed).cleared).toBe(false);
  });
});

describe('Restart (§6)', () => {
  it('goes back to the same problem’s first position, with nothing kept', () => {
    const played = {
      ...play(createSession(apexToApex), solutionTo(apexToApex, 0).slice(0, 5)),
      elapsedSeconds: 42,
    };
    const fresh = restartSession(played);
    expect(fresh).toEqual(createSession(apexToApex));
    expect(fresh.problem).toBe(apexToApex);
  });
});

describe('the save (§11)', () => {
  const midGame = () => ({
    ...play(createSession(ENGLISH_PROBLEM), parseEnglishJumps(ENGLISH_SOLUTION).slice(0, 12)),
    elapsedSeconds: 95,
  });

  it('records the problem, the jumps as [from, to] and the clock', () => {
    const record = toRecord(applyMove(createSession(ENGLISH_PROBLEM), E(1, 3), E(3, 3))!);
    expect(record).toEqual({
      board: 'english',
      start: ENGLISH_CENTER,
      target: ENGLISH_CENTER,
      jumps: [[E(1, 3), E(3, 3)]],
      elapsedSeconds: 0,
    });
  });

  it('restores the same game, with its whole Undo history', () => {
    const session = midGame();
    const restored = restoreSession(
      JSON.parse(JSON.stringify(toRecord(session))) as UntrustedRecord,
    );
    expect(restored).toEqual({ ok: true, session });
    if (!restored.ok) return;
    // History survived: Undo steps back through the same positions.
    expect(undo(restored.session)!.pegs).toEqual(undo(session)!.pegs);
    expect(restored.session.problem).toBe(ENGLISH_PROBLEM);
  });

  it('restores a game with no jump played yet, and every triangle problem', () => {
    for (const problem of [ENGLISH_PROBLEM, ...TRIANGLE_PROBLEMS]) {
      const session = createSession(problem);
      expect(restoreSession(toRecord(session))).toEqual({ ok: true, session });
    }
  });

  it('restores a game that was stuck and then undone', () => {
    const session = undo(playFirstJumps(apexToApex))!;
    expect(restoreSession(toRecord(session))).toEqual({ ok: true, session });
  });

  it('keeps a clear that was undone, and writes it only for such a game (§10)', () => {
    const clear = play(createSession(apexToApex), solutionTo(apexToApex, 0));
    const undone = { ...undo(clear)!, elapsedSeconds: 7 };
    const record = JSON.parse(JSON.stringify(toRecord(undone))) as UntrustedRecord;
    expect(record).toEqual({
      board: 'triangle',
      start: 0,
      target: 0,
      jumps: toRecord(undone).jumps,
      elapsedSeconds: 7,
      cleared: true,
    });
    expect(restoreSession(record)).toEqual({ ok: true, session: undone });
    // Every game that was never cleared is written without the field.
    expect(toRecord(midGame())).not.toHaveProperty('cleared');
    expect(toRecord(undo(playFirstJumps(apexToApex))!)).not.toHaveProperty('cleared');
  });

  it('writes the clock as whole seconds in range, so every record it writes restores', () => {
    // The state layer owns the clock; whatever it kept, the record holds a
    // value restoreSession accepts (§11), and the game is not lost on reload.
    const cases: [number, number][] = [
      [0, 0],
      [-0, 0],
      [61, 61],
      [61.9, 61],
      [-3, 0],
      [Number.NaN, 0],
      [MAX_ELAPSED_SECONDS, MAX_ELAPSED_SECONDS],
      [MAX_ELAPSED_SECONDS + 0.5, MAX_ELAPSED_SECONDS],
      [2e12, MAX_ELAPSED_SECONDS],
      [Number.POSITIVE_INFINITY, MAX_ELAPSED_SECONDS],
    ];
    for (const [kept, written] of cases) {
      expect(wholeElapsedSeconds(kept), String(kept)).toBe(written);
      const session = { ...midGame(), elapsedSeconds: kept };
      const record = JSON.parse(JSON.stringify(toRecord(session))) as UntrustedRecord;
      expect(record.elapsedSeconds, String(kept)).toBe(written);
      const restored = restoreSession(record);
      expect(restored.ok, String(kept)).toBe(true);
      if (restored.ok) expect(restored.session.elapsedSeconds).toBe(written);
    }
  });

  it('a finished game that could still be undone is not saved (§11)', () => {
    // Every finish can be undone from the result card (§6), but it is not a
    // game to resume: closing the app there gives that Undo up. Pinned so a
    // change to it is a decision, not an accident.
    const clear = play(createSession(apexToApex), solutionTo(apexToApex, 0));
    const single = play(createSession(apexToApex), solutionTo(apexToApex, 6));
    const stuck = playFirstJumps(apexToApex);
    for (const session of [clear, single, stuck]) {
      expect(canUndo(session)).toBe(true);
      expect(restoreSession(toRecord(session))).toEqual({ ok: false, reason: 'finished' });
    }
  });

  describe('fails closed (§11)', () => {
    const good = (): UntrustedRecord => toRecord(midGame());
    const reasonFor = (record: UntrustedRecord) => {
      const result = restoreSession(record);
      return result.ok ? 'restored' : result.reason;
    };

    it('on something that is not a record at all — without throwing', () => {
      for (const value of [null, undefined, 0, 'english', true, [], [good()]]) {
        expect(() => restoreSession(value), String(value)).not.toThrow();
        expect(restoreSession(value), String(value)).toEqual({ ok: false, reason: 'not-a-record' });
      }
      expect(restoreSession({})).toEqual({ ok: false, reason: 'unknown-board' });
    });

    it('on a board that does not exist', () => {
      for (const board of [
        'square',
        'English',
        '',
        null,
        undefined,
        0,
        {},
        // Names every object answers to: never a board, never a crash.
        'toString',
        'constructor',
        '__proto__',
        'hasOwnProperty',
      ]) {
        expect(reasonFor({ ...good(), board }), String(board)).toBe('unknown-board');
      }
    });

    it('on a start or target that is not a dealt problem', () => {
      const cases: [string, Partial<UntrustedRecord>][] = [
        ['cross, start in a corner', { start: 0 }],
        ['cross, target off the middle', { target: 0 }],
        ['cross, both moved', { start: 0, target: 0 }],
        ['not a whole number', { start: 16.5 }],
        ['out of range', { start: 33 }],
        ['negative', { target: -1 }],
        ['a string', { start: '16' }],
        ['missing', { target: undefined }],
      ];
      for (const [name, patch] of cases) {
        expect(reasonFor({ ...good(), ...patch }), name).toBe('unknown-problem');
      }
      // A triangle pairing the generator proved unsolvable: middle hole → itself.
      expect(
        reasonFor({ board: 'triangle', start: 4, target: 4, jumps: [], elapsedSeconds: 0 }),
      ).toBe('unknown-problem');
      // A cross index on the triangle.
      expect(
        reasonFor({ board: 'triangle', start: 16, target: 16, jumps: [], elapsedSeconds: 0 }),
      ).toBe('unknown-problem');
    });

    it('on a jump list of the wrong shape', () => {
      const cases: [string, unknown][] = [
        ['not an array', 'd2-d4'],
        ['null', null],
        ['an object', { 0: [4, 16] }],
        ['a triple', [[4, 10, 16]]],
        ['a single', [[4]]],
        ['a string pair', [['4', '16']]],
        ['a fraction', [[4.5, 16]]],
        ['off the board', [[4, 33]]],
        ['negative', [[-1, 16]]],
        ['too long to be one game', Array.from({ length: 32 }, () => [4, 16])],
      ];
      for (const [name, jumps] of cases) {
        expect(reasonFor({ ...good(), jumps }), name).toBe('malformed-jumps');
      }
    });

    it('on a jump the rules would not have allowed', () => {
      const valid = toRecord(midGame()).jumps;
      const cases: [string, unknown][] = [
        ['the first jump is diagonal', [[E(1, 2), E(3, 4)]]],
        ['the first jump lands on a peg', [[E(0, 3), E(2, 3)]]],
        ['the same jump twice', [valid[0], valid[0]]],
        ['a good game with one bad jump at the end', [...valid, [E(0, 2), E(0, 4)]]],
        ['two good jumps swapped', [valid[1], valid[0], ...valid.slice(2)]],
      ];
      for (const [name, jumps] of cases) {
        expect(reasonFor({ ...good(), jumps }), name).toBe('illegal-jump');
      }
    });

    it('on a finished game: a clear, a one-peg finish, or stuck', () => {
      const clear = play(createSession(ENGLISH_PROBLEM), parseEnglishJumps(ENGLISH_SOLUTION));
      const single = play(createSession(apexToApex), solutionTo(apexToApex, 6));
      const stuck = playFirstJumps(ENGLISH_PROBLEM);
      for (const [name, session] of [
        ['clear', clear],
        ['single', single],
        ['stuck', stuck],
      ] as const) {
        expect(reasonFor(toRecord(session)), name).toBe('finished');
      }
      // A jump past the end of a finished game is not a jump at all.
      expect(reasonFor({ ...toRecord(stuck), jumps: [...toRecord(stuck).jumps, [0, 2]] })).toBe(
        'illegal-jump',
      );
    });

    it('on a clock that is not a whole number of seconds in range', () => {
      for (const elapsedSeconds of [
        -1,
        1.5,
        '60',
        null,
        undefined,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        MAX_ELAPSED_SECONDS + 1,
      ]) {
        expect(reasonFor({ ...good(), elapsedSeconds }), String(elapsedSeconds)).toBe(
          'bad-elapsed',
        );
      }
      expect(reasonFor({ ...good(), elapsedSeconds: MAX_ELAPSED_SECONDS })).toBe('restored');
      // A stored −0 is accepted and held as 0.
      const restored = restoreSession({ ...good(), elapsedSeconds: -0 });
      expect(restored.ok).toBe(true);
      if (restored.ok) expect(Object.is(restored.session.elapsedSeconds, 0)).toBe(true);
    });

    it('on a `cleared` that is not a boolean — absent and false read as not cleared', () => {
      for (const cleared of [null, 'true', 1, 0, {}, []]) {
        expect(reasonFor({ ...good(), cleared }), String(cleared)).toBe('bad-cleared');
      }
      for (const cleared of [undefined, false]) {
        const restored = restoreSession({ ...good(), cleared });
        expect(restored.ok, String(cleared)).toBe(true);
        if (restored.ok) expect(restored.session.cleared).toBe(false);
      }
      const restored = restoreSession({ ...good(), cleared: true });
      expect(restored.ok).toBe(true);
      if (restored.ok) expect(restored.session.cleared).toBe(true);
    });
  });
});
