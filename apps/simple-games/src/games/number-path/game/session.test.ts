/**
 * Session rules of docs/NUMBER_PATH_RULES.md §2, §4, §5, §7 and §9: how a
 * board is seeded, what a trace, a tap, a step and a backtrack do to the
 * path, how undo groups them, what the hint says, and how a save comes back.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dayDifference, localDateString } from './daily';
import { buildBoard, directionBetween, endCell, startCell } from './engine';
import {
  canUndo,
  createDailySession,
  createDifficultySession,
  difficultySeed,
  doBacktrack,
  doHintUse,
  doStep,
  doTap,
  doTrace,
  doUndo,
  hintFor,
  newSeedToken,
  restartSession,
  restoreSession,
  UNDO_HISTORY_LIMIT,
  withElapsedSeconds,
  type NumberPathSession,
} from './session';
import { DOWN, LEFT, UP, type Direction } from './types';

const SEED = 'number-path-easy-session';
const fresh = () => createDifficultySession('easy', SEED);

/** Draws the road the only way a player can: one cell at a time from the end. */
function solveByTapping(session: NumberPathSession): NumberPathSession {
  let current = session;
  for (const cell of session.solution.slice(current.path.length)) {
    const next = doTap(current, cell);
    if (next !== null) current = next;
  }
  return current;
}

/** The arrow that takes the path's end onto `to`. */
function arrowTo(session: NumberPathSession, to: number): Direction {
  const end = session.path[session.path.length - 1]!;
  return directionBetween(end, to, session.board.width)!;
}

/**
 * A tiny 3×3 with two walls that leave the road one way to go (the same board
 * engine.test.ts reads by eye), used below to make an arrow actually refused:
 * off the grid, into a wall, and into a number not yet due.
 *
 *   1 . .        road: 0 1 2 5 4 3 6 7 8
 *   ─ 2 .        walls: below cell 1, below cell 4
 *   . ─ 3
 */
const WALLED_NUMBERS = [
  [0, 1],
  [4, 2],
  [8, 3],
] as const;
const WALLED_BOARD = buildBoard({
  width: 3,
  height: 3,
  numbers: WALLED_NUMBERS,
  walls: ['h1', 'h4'],
})!;
const WALLED_ROAD = [0, 1, 2, 5, 4, 3, 6, 7, 8];

/** A session on that board with the given path — restored, never tapped out. */
function walledSession(path: number[]): NumberPathSession {
  return restoreSession({
    mode: 'difficulty',
    seed: 'session-walled-test',
    difficulty: 'easy',
    dailyDate: null,
    board: WALLED_BOARD,
    solution: WALLED_ROAD,
    path,
    elapsedSeconds: 0,
    hintCount: 0,
  });
}

describe('sessions (§7)', () => {
  it('creates a difficulty game sized by its tier, starting on 1', () => {
    const session = fresh();
    expect(session.mode).toBe('difficulty');
    expect(session.seed).toBe(SEED);
    expect(session.board.width).toBe(5);
    expect(session.board.height).toBe(5);
    expect(session.path).toEqual([startCell(session.board)]);
    expect(session.history).toEqual([]);
    expect(session.status).toBe('playing');
    expect(session.hintCount).toBe(0);
    expect(session.elapsedSeconds).toBe(0);
    expect(createDifficultySession('medium', 'number-path-medium-x').board.width).toBe(6);
    expect(createDifficultySession('hard', 'number-path-hard-x').board.width).toBe(7);
  });

  it('seeds a new game with a token, and the same seed is the same board', () => {
    const a = createDifficultySession(
      'easy',
      difficultySeed(
        'easy',
        newSeedToken(1, () => 0.25),
      ),
    );
    const b = createDifficultySession(
      'easy',
      difficultySeed(
        'easy',
        newSeedToken(2, () => 0.5),
      ),
    );
    expect(a.seed.startsWith('number-path-easy-')).toBe(true);
    expect(b.solution).not.toEqual(a.solution);
    const again = createDifficultySession('easy', a.seed);
    expect(again.solution).toEqual(a.solution);
    expect(again.board.walls).toEqual(a.board.walls);
    expect(again.board.numbers).toEqual(a.board.numbers);
  });

  it('creates a daily for a date, medium every day', () => {
    const session = createDailySession('2026-09-26');
    expect(session.mode).toBe('daily');
    expect(session.difficulty).toBe('medium');
    expect(session.dailyDate).toBe('2026-09-26');
    expect(session.seed).toBe('number-path-daily-2026-09-26');
    expect(session.board.width).toBe(6);
    expect(createDailySession('2026-09-27').solution).not.toEqual(session.solution);
  });

  it('formats, shifts and subtracts local dates', () => {
    expect(localDateString(new Date(2026, 8, 26))).toBe('2026-09-26');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(dayDifference('2026-09-25', '2026-09-26')).toBe(1);
    expect(dayDifference('2026-09-26', '2026-09-25')).toBe(-1);
  });

  it('restarts to the same board with a clean path and no history', () => {
    const played = doTrace(fresh(), [fresh().solution[1]!], true)!;
    const restarted = restartSession(played);
    expect(restarted.seed).toBe(SEED);
    expect(restarted.solution).toEqual(played.solution);
    expect(restarted.path).toEqual([startCell(played.board)]);
    expect(restarted.history).toEqual([]);
    const daily = restartSession(doHintUse(createDailySession('2026-09-26')));
    expect(daily.dailyDate).toBe('2026-09-26');
    expect(daily.hintCount).toBe(0);
  });

  it('restores from persisted state, re-derives the win and drops the undo stack (§9)', () => {
    const solved = solveByTapping(fresh());
    expect(solved.status).toBe('solved');
    const { status: _status, history: _history, ...persisted } = solved;
    expect(restoreSession(persisted).status).toBe('solved');
    expect(restoreSession(persisted).history).toEqual([]);

    const { status: _fresh, history: _none, ...unplayed } = fresh();
    expect(restoreSession(unplayed).status).toBe('playing');
  });
});

describe('traces, taps, steps (§4)', () => {
  it('extends along the road one trace at a time, and cuts back on a revisit', () => {
    const session = fresh();
    const [a, b, c] = session.solution as [number, number, number, ...number[]];
    const drawn = doTrace(session, [b, c], true)!;
    expect(drawn.path).toEqual([a, b, c]);
    // Dragging back over the previous cell steps back; over the start, all the way.
    expect(doTrace(drawn, [b], false)!.path).toEqual([a, b]);
    expect(doTrace(drawn, [a], false)!.path).toEqual([a]);
  });

  it('returns null when a trace changes nothing', () => {
    const session = fresh();
    expect(doTrace(session, [session.path[0]!], true)).toBeNull();
    // A cell out of reach, or a number that is not due yet.
    const far = session.solution[session.solution.length - 1]!;
    expect(doTrace(session, [far], true)).toBeNull();
  });

  it('taps a cell beside the end to extend, and a cell on the path to cut back', () => {
    const session = fresh();
    const [a, b, c] = session.solution as [number, number, number, ...number[]];
    const one = doTap(session, b)!;
    expect(one.path).toEqual([a, b]);
    const two = doTap(one, c)!;
    expect(two.path).toEqual([a, b, c]);
    expect(doTap(two, a)!.path).toEqual([a]);
    expect(doTap(two, c)).toBeNull();
  });

  it('steps back one cell with Backspace, never below the start', () => {
    const session = fresh();
    expect(doBacktrack(session)).toBeNull();
    const [a, b] = session.solution as [number, number, ...number[]];
    const back = doBacktrack(doTap(session, b)!)!;
    expect(back.path).toEqual([a]);
  });

  it('steps with an arrow from the end, and back over the previous cell', () => {
    const session = fresh();
    const [a, b] = session.solution as [number, number, ...number[]];
    const stepped = doStep(session, arrowTo(session, b))!;
    expect(stepped.path).toEqual([a, b]);
    // The arrow back onto the cell it came from is a step back (§4).
    expect(doStep(stepped, arrowTo(stepped, a))!.path).toEqual([a]);
  });

  it('refuses an arrow off the grid, into a wall, or into a cell not yet due', () => {
    // Cell 0 is the walled board's top-left corner: both changes nothing.
    const corner = walledSession([0]);
    expect(doStep(corner, UP)).toBeNull();
    expect(doStep(corner, LEFT)).toBeNull();
    // The wall below cell 1 (h1) blocks the only other way down from it.
    expect(doStep(walledSession([0, 1]), DOWN)).toBeNull();
    // From 5, down reaches 8 (number 3, K) before 2 is due: refused (§3).
    expect(doStep(walledSession([0, 1, 2, 5]), DOWN)).toBeNull();
  });

  /**
   * The transition into 'solved' happens exactly once, because there is no
   * way back out of it: every later move is refused, undo included.
   */
  it('turns solved once the road is drawn, and then refuses every move', () => {
    const solved = solveByTapping(fresh());
    expect(solved.status).toBe('solved');
    expect(solved.path).toEqual(solved.solution);
    expect(doTap(solved, solved.solution[0]!)).toBeNull();
    expect(doTrace(solved, [solved.solution[1]!], true)).toBeNull();
    expect(doBacktrack(solved)).toBeNull();
    expect(doUndo(solved)).toBeNull();
    expect(doStep(solved, UP)).toBeNull();
    expect(hintFor(solved)).toBeNull();
  });

  it('is not solved by a full path that left the road', () => {
    // Every cell but drawn in some other legal order cannot end on K in
    // order, so the last legal prefix short of the road is not a win.
    const solved = solveByTapping(fresh());
    const { status: _s, history: _h, ...persisted } = solved;
    const short = { ...persisted, path: solved.solution.slice(0, -1) };
    expect(restoreSession(short).status).toBe('playing');
  });
});

describe('undo (§5)', () => {
  it('has nothing to undo on a fresh board', () => {
    expect(canUndo(fresh())).toBe(false);
    expect(doUndo(fresh())).toBeNull();
  });

  it('takes back one stroke, however many cells it drew', () => {
    const session = fresh();
    const [a, b, c, d] = session.solution as [number, number, number, number, ...number[]];
    // A drag: the first trace opens the step, the later ones join it.
    let stroke = doTrace(session, [b], true)!;
    stroke = doTrace(stroke, [c], false)!;
    stroke = doTrace(stroke, [d], false)!;
    expect(stroke.path).toEqual([a, b, c, d]);
    expect(stroke.history).toHaveLength(1);
    const undone = doUndo(stroke)!;
    expect(undone.path).toEqual([a]);
    expect(canUndo(undone)).toBe(false);
  });

  it('takes back a tap, a cut and a step each on their own', () => {
    const session = fresh();
    const [a, b, c] = session.solution as [number, number, number, ...number[]];
    const tapped = doTap(doTap(session, b)!, c)!;
    expect(tapped.history).toHaveLength(2);
    const cut = doTap(tapped, a)!;
    expect(cut.path).toEqual([a]);
    expect(cut.history).toHaveLength(3);
    expect(doUndo(cut)!.path).toEqual([a, b, c]);
    const backed = doBacktrack(tapped)!;
    expect(doUndo(backed)!.path).toEqual([a, b, c]);
    const stepped = doStep(session, arrowTo(session, b))!;
    expect(doUndo(stepped)!.path).toEqual([a]);
  });

  it('leaves the hint count where it was', () => {
    const session = doHintUse(fresh());
    const played = doTap(session, session.solution[1]!)!;
    expect(doUndo(played)!.hintCount).toBe(1);
  });

  it('keeps at most the limit', () => {
    let session = fresh();
    const [a, b] = session.solution as [number, number, ...number[]];
    for (let i = 0; i < UNDO_HISTORY_LIMIT + 5; i++) {
      session = doTap(session, i % 2 === 0 ? b : a)!;
    }
    expect(session.history.length).toBe(UNDO_HISTORY_LIMIT);
  });
});

describe('hint (§5)', () => {
  it('points at the next cell of the road while the path follows it', () => {
    const session = fresh();
    const hint = hintFor(session);
    expect(hint).toEqual({ kind: 'next', cell: session.solution[1] });
    const two = doTap(session, session.solution[1]!)!;
    expect(hintFor(two)).toEqual({ kind: 'next', cell: session.solution[2] });
  });

  it('points back to the last cell that was on the road once the path has strayed', () => {
    const session = fresh();
    const start = session.path[0]!;
    const wrong = session.board.adjacent[start]!.find((cell) => cell !== session.solution[1]);
    if (wrong === undefined) return; // a corner with one way out has nowhere to stray
    const strayed = doTap(session, wrong);
    if (strayed === null) return; // the other way out was a wall or a number not due
    expect(hintFor(strayed)).toEqual({ kind: 'back', cell: start });
    // And never writes to the path.
    expect(strayed.path).toEqual([start, wrong]);
  });

  it('counts uses without limiting them', () => {
    let session = fresh();
    for (let use = 1; use <= 5; use++) {
      session = doHintUse(session);
      expect(session.hintCount).toBe(use);
      expect(hintFor(session)).not.toBeNull();
    }
  });
});

describe('the clock is carried, never read (§8)', () => {
  it('takes the owner’s seconds and only ever moves forward', () => {
    const session = fresh();
    const ticked = withElapsedSeconds(session, 42.7);
    expect(ticked.elapsedSeconds).toBe(42);
    expect(withElapsedSeconds(ticked, 10).elapsedSeconds).toBe(42);
    expect(withElapsedSeconds(ticked, 42)).toBe(ticked);
    expect(withElapsedSeconds(ticked, 100).elapsedSeconds).toBe(100);
  });

  it('carries the seconds across a move, and drops them on a restart', () => {
    const session = withElapsedSeconds(fresh(), 90);
    const played = doTap(session, session.solution[1]!)!;
    expect(played.elapsedSeconds).toBe(90);
    expect(restartSession(played).elapsedSeconds).toBe(0);
    expect(endCell(played.board)).toBe(played.solution[played.solution.length - 1]);
  });
});
