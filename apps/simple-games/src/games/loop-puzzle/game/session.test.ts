/**
 * Session rules of docs/LOOP_PUZZLE_RULES.md §4, §6, §9, §10 and §12: what a
 * tap does, what undo takes back, the hint's order, how a session begins and
 * is restored, and the clock.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dailySeed, dayDifference, isLocalDateString, localDateString } from './daily';
import { emptyMarks, isSolved } from './engine';
import { cluesDigest, decodeBoard, decodeClues, encodeClues, encodeMarks } from './serialize';
import { hintEdge, hintMark, solverWork, uniqueSolution } from './solver';
import {
  ELAPSED_SECONDS_MAX,
  HINT_COUNT_MAX,
  UNDO_HISTORY_LIMIT,
  askHint,
  canUndo,
  conflictsOf,
  createDailySession,
  createDifficultySession,
  difficultySeed,
  doCycle,
  doHintUse,
  doSet,
  doUndo,
  hintFor,
  metCluesOf,
  newSeedToken,
  restartSession,
  restoreSession,
  withElapsedSeconds,
  type LoopPuzzleSession,
} from './session';
import { CROSS, LINE, PRESETS, UNKNOWN } from './types';

/** Taps every loop edge of the answer once (UNKNOWN → LINE): the way a player would finish. */
function solveByTapping(session: LoopPuzzleSession): LoopPuzzleSession {
  let current = session;
  session.solution.forEach((mark, edge) => {
    if (mark === LINE && current.marks[edge] === UNKNOWN)
      current = doCycle(current, edge) ?? current;
  });
  return current;
}

const firstLoopEdge = (session: LoopPuzzleSession): number =>
  session.solution.findIndex((m) => m === LINE);
const firstOffEdge = (session: LoopPuzzleSession): number =>
  session.solution.findIndex((m) => m === CROSS);

describe('sessions (§9)', () => {
  it('creates a difficulty session sized by its preset, with nothing drawn', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `loop-puzzle-${difficulty}-test`);
      expect(session.mode).toBe('difficulty');
      expect([session.width, session.height]).toEqual([
        PRESETS[difficulty].width,
        PRESETS[difficulty].height,
      ]);
      expect(session.marks).toEqual(emptyMarks(session));
      expect(session.status).toBe('playing');
      expect(session.dailyDate).toBeNull();
    }
  });

  it('seeds difficulty games per token, and the daily per date, medium every day', () => {
    expect(difficultySeed('hard', 'abc')).toBe('loop-puzzle-hard-abc');
    expect(dailySeed('2026-10-17')).toBe('loop-puzzle-daily-2026-10-17');
    const daily = createDailySession('2026-10-18');
    expect(daily).toMatchObject({ mode: 'daily', difficulty: 'medium', dailyDate: '2026-10-18' });
    expect(daily.seed).toBe('loop-puzzle-daily-2026-10-18');
    // The caller mints the token from the clock and a random source it passes in.
    expect(newSeedToken(0, () => 0)).toBe('0-0');
    expect(newSeedToken(36 ** 3, () => 0.5)).toBe('1000-4zsov');
    expect(
      difficultySeed(
        'easy',
        newSeedToken(1_792_000_000_000, () => 0.25),
      ),
    ).toMatch(/^loop-puzzle-easy-[0-9a-z]+-[0-9a-z]+$/);
  });

  it('restarts the same board clean: clock, hints and history back to zero', () => {
    const session = createDifficultySession('easy', 'loop-puzzle-easy-test');
    const played = withElapsedSeconds(doHintUse(doCycle(session, firstLoopEdge(session))!), 75);
    const again = restartSession(played);
    expect(again.clues).toEqual(session.clues);
    expect(again.solution).toEqual(session.solution);
    expect(again.marks).toEqual(session.marks);
    expect(again.history).toEqual([]);
    expect(again).toMatchObject({ status: 'playing', elapsedSeconds: 0, hintCount: 0 });
    expect(again.seed).toBe(session.seed);
    const daily = restartSession(createDailySession('2026-10-03'));
    expect(daily).toMatchObject({ mode: 'daily', dailyDate: '2026-10-03', difficulty: 'medium' });
  });

  it('restarts the board that was played, not what the seed makes today, and runs no search', () => {
    // A restored game whose clues are not the seed's board — as after a
    // generator change (§12). Retry must give back these clues.
    const clues = decodeClues('22....320......232.022.1.', 5, 5)!;
    const solution = uniqueSolution({ width: 5, height: 5, clues })!;
    const marks = emptyMarks({ width: 5, height: 5 });
    marks[solution.indexOf(LINE)] = LINE;
    const restored = restoreSession({
      mode: 'difficulty',
      seed: 'loop-puzzle-medium-some-other-seed',
      difficulty: 'medium',
      dailyDate: null,
      width: 5,
      height: 5,
      clues,
      solution,
      marks,
      elapsedSeconds: 40,
      hintCount: 2,
    });
    const before = solverWork.read();
    const again = restartSession(restored);
    expect(solverWork.read()).toBe(before);
    expect(again.clues).toEqual(clues);
    expect(again.solution).toEqual(solution);
    expect(again.marks).toEqual(emptyMarks(again));
    expect(again.seed).toBe(restored.seed);
    // Restarting a solved game gives the same board back to play.
    const solved = solveByTapping(restored);
    expect(solved.status).toBe('solved');
    const replay = restartSession(solved);
    expect(replay.status).toBe('playing');
    expect(isSolved(replay, replay.marks)).toBe(false);
    expect(replay.clues).toEqual(clues);
  });
});

describe('tapping (§4)', () => {
  it('cycles one edge per tap and records one step each', () => {
    const session = createDifficultySession('easy', 'loop-puzzle-easy-test');
    const edge = 3;
    const a = doCycle(session, edge)!;
    const b = doCycle(a, edge)!;
    const c = doCycle(b, edge)!;
    expect([a.marks[edge], b.marks[edge], c.marks[edge]]).toEqual([LINE, CROSS, UNKNOWN]);
    expect(c.history).toHaveLength(3);
    expect(doCycle(session, -1)).toBeNull();
    expect(doCycle(session, session.marks.length)).toBeNull();
  });

  it('sets a mark directly, and records nothing when it changes nothing', () => {
    const session = createDifficultySession('easy', 'loop-puzzle-easy-test');
    const set = doSet(session, 2, CROSS)!;
    expect(set.marks[2]).toBe(CROSS);
    expect(doSet(set, 2, CROSS)).toBeNull();
    expect(doSet(session, 2, UNKNOWN)).toBeNull();
  });

  it('solves once the loop is drawn, and refuses every move after', () => {
    const session = createDifficultySession('medium', 'loop-puzzle-medium-test');
    const solved = solveByTapping(session);
    expect(solved.status).toBe('solved');
    expect(doCycle(solved, 0)).toBeNull();
    expect(doSet(solved, 0, CROSS)).toBeNull();
    expect(canUndo(solved)).toBe(false);
    expect(doUndo(solved)).toBeNull();
    expect(hintFor(solved)).toBeNull();
  });

  it('wins on LINEs alone: no CROSS is needed anywhere', () => {
    const session = createDifficultySession('hard', 'loop-puzzle-hard-test');
    const solved = solveByTapping(session);
    expect(solved.status).toBe('solved');
    expect(solved.marks.includes(CROSS)).toBe(false);
  });

  it('shows conflicts and met numbers from the rules, not from the answer', () => {
    const session = createDifficultySession('easy', 'loop-puzzle-easy-test');
    expect(conflictsOf(session).any).toBe(false);
    const wrongButLegal = doCycle(session, firstOffEdge(session))!;
    expect(conflictsOf(wrongButLegal).cells.every((c) => !c)).toBe(true);
    const solved = solveByTapping(session);
    expect(metCluesOf(solved).filter(Boolean).length).toBe(
      session.clues.filter((c) => c !== null).length,
    );
  });
});

describe('undo (§6)', () => {
  it('takes back one tap at a time, and never the hint count', () => {
    const session = createDifficultySession('easy', 'loop-puzzle-easy-test');
    const one = doCycle(session, 4)!;
    const two = doHintUse(doCycle(one, 4)!);
    const back = doUndo(two)!;
    expect(back.marks).toEqual(one.marks);
    expect(back.hintCount).toBe(1);
    const start = doUndo(back)!;
    expect(start.marks).toEqual(session.marks);
    expect(canUndo(start)).toBe(false);
    expect(doUndo(start)).toBeNull();
  });

  it('keeps at most the history limit, dropping the oldest steps', () => {
    let session = createDifficultySession('easy', 'loop-puzzle-easy-test');
    const edge = firstOffEdge(session);
    for (let i = 0; i < UNDO_HISTORY_LIMIT + 7; i++) session = doCycle(session, edge)!;
    expect(session.history).toHaveLength(UNDO_HISTORY_LIMIT);
  });
});

describe('hints (§6)', () => {
  it('names a wrong mark before anything else, and a step otherwise', () => {
    const session = createDifficultySession('easy', 'loop-puzzle-easy-test');
    const hint = hintFor(session);
    expect(hint?.kind).toBe('step');
    const off = firstOffEdge(session);
    const wrong = doCycle(session, off)!;
    expect(hintFor(wrong)).toEqual({ kind: 'wrong', edge: off, mark: LINE });
    // Asking for a hint changes nothing on the board.
    expect(wrong.marks).toEqual(doCycle(session, off)!.marks);
  });

  it('counts a hint once: asked again with nothing changed, it is the same hint', () => {
    let session = createDifficultySession('medium', 'loop-puzzle-medium-test');
    // Follow the hints (writing every LINE, leaving every × unwritten) until a LINE comes up.
    let asked = askHint(session);
    while (asked.hint !== null && hintMark(asked.hint) !== LINE) {
      session = asked.session;
      asked = askHint(session);
    }
    expect(asked.hint).not.toBeNull();
    const line = asked.session;
    const again = askHint(line);
    expect(again.hint).toEqual(asked.hint);
    expect(again.session).toBe(line);
    expect(line.hintCount).toBe(session.hintCount + 1);
    // A move spends it: the same question then counts again.
    const moved = doUndo(doCycle(line, firstOffEdge(line))!)!;
    expect(moved.marks).toEqual(line.marks);
    expect(moved.lastHint).toBeNull();
    expect(askHint(moved).session.hintCount).toBe(line.hintCount + 1);
  });

  it('remembers every × it showed and moves on from it, written or not (§6)', () => {
    let session = createDifficultySession('hard', 'loop-puzzle-hard-test');
    const shown: number[] = [];
    for (let i = 0; i < session.marks.length && session.status === 'playing'; i++) {
      const asked = askHint(session);
      expect(asked.hint?.kind).toBe('step');
      const edge = hintEdge(asked.hint!);
      expect(asked.session.hintCount).toBe(session.hintCount + 1);
      expect(shown, `edge ${edge} was shown twice`).not.toContain(edge);
      shown.push(edge);
      session = asked.session;
      if (hintMark(asked.hint!) === LINE) session = doCycle(session, edge)!;
      else expect(session.hinted).toContain(edge);
    }
    expect(session.status).toBe('solved');
    expect(session.hinted.length).toBeGreaterThan(0);
    expect(session.marks.includes(CROSS)).toBe(false);
    // A clean board forgets what was said, and so does a restored one.
    const fresh = restartSession(session);
    expect([fresh.hinted, fresh.lastHint]).toEqual([[], null]);
  });
});

describe('restore and the clock (§10, §12)', () => {
  it('round-trips through the save format and carries on as before', () => {
    let session = createDifficultySession('hard', 'loop-puzzle-hard-test');
    session = doCycle(session, firstLoopEdge(session))!;
    session = doSet(session, firstOffEdge(session), CROSS)!;
    session = withElapsedSeconds(doHintUse(session), 42);
    const decoded = decodeBoard(
      {
        width: session.width,
        height: session.height,
        clues: encodeClues(session.clues),
        digest: cluesDigest(session.clues),
        marks: encodeMarks(session.marks),
      },
      PRESETS.hard,
    )!;
    const { history: _history, status: _status, ...rest } = session;
    const restored = restoreSession({ ...rest, ...decoded });
    expect(restored.clues).toEqual(session.clues);
    expect(restored.solution).toEqual(session.solution);
    expect(restored.marks).toEqual(session.marks);
    expect(restored.history).toEqual([]);
    expect([restored.hinted, restored.lastHint]).toEqual([[], null]);
    expect(restored.status).toBe('playing');
    expect(restored.hintCount).toBe(1);
    expect(restored.elapsedSeconds).toBe(42);
    expect(solveByTapping(restored).status).toBe('solved');
  });

  it('re-derives the status from the marks', () => {
    const session = createDifficultySession('easy', 'loop-puzzle-easy-test');
    const { history: _h, status: _s, ...data } = solveByTapping(session);
    expect(restoreSession(data).status).toBe('solved');
  });

  it('only ever moves the clock forward', () => {
    const session = withElapsedSeconds(createDailySession('2026-10-04'), 30.7);
    expect(session.elapsedSeconds).toBe(30);
    expect(withElapsedSeconds(session, 10).elapsedSeconds).toBe(30);
    expect(withElapsedSeconds(session, 30)).toBe(session);
  });

  it('ignores a clock that is not a finite number, and stops where the save schema stops', () => {
    const session = withElapsedSeconds(
      createDifficultySession('easy', 'loop-puzzle-easy-test'),
      12,
    );
    // NaN would otherwise stick for good (Math.max(NaN, x) is NaN) and fail the schema on save.
    expect(withElapsedSeconds(session, Number.NaN)).toBe(session);
    expect(withElapsedSeconds(session, Number.POSITIVE_INFINITY)).toBe(session);
    expect(withElapsedSeconds(session, Number.NEGATIVE_INFINITY)).toBe(session);
    expect(withElapsedSeconds(withElapsedSeconds(session, Number.NaN), 20).elapsedSeconds).toBe(20);
    expect(withElapsedSeconds(session, 5e12).elapsedSeconds).toBe(ELAPSED_SECONDS_MAX);
    expect(Number.isInteger(withElapsedSeconds(session, 5e12).elapsedSeconds)).toBe(true);
  });

  it('counts hints up to the schema’s ceiling and no further', () => {
    const session = createDifficultySession('easy', 'loop-puzzle-easy-test');
    expect(doHintUse(session).hintCount).toBe(1);
    const atCeiling = { ...session, hintCount: HINT_COUNT_MAX };
    expect(doHintUse(atCeiling).hintCount).toBe(HINT_COUNT_MAX);
    expect(doHintUse({ ...session, hintCount: HINT_COUNT_MAX - 1 }).hintCount).toBe(HINT_COUNT_MAX);
  });

  it('walks local dates without skipping a day', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dayDifference('2026-10-01', '2026-11-01')).toBe(31);
    expect(dayDifference('2026-11-01', '2026-10-01')).toBe(-31);
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('refuses a malformed date instead of answering NaN-NaN-NaN', () => {
    for (const bad of [
      'bad',
      '',
      '2026-1-05',
      '2026-13-01',
      '2026-02-30',
      '2026-10-17T00:00',
      ' 2026-10-17',
    ]) {
      expect(addDays(bad, 1), bad).toBeNull();
      expect(dayDifference(bad, '2026-10-17'), bad).toBeNull();
      expect(dayDifference('2026-10-17', bad), bad).toBeNull();
      expect(isLocalDateString(bad), bad).toBe(false);
    }
    expect(addDays('2026-10-17', 0.5)).toBeNull();
    expect(addDays('2026-10-17', Number.NaN)).toBeNull();
    expect(isLocalDateString('2026-10-17')).toBe(true);
    expect(isLocalDateString(20261017)).toBe(false);
  });
});
