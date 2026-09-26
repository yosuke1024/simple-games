/**
 * Session rules of docs/SHAPE_REGIONS_RULES.md §3, §4, §6, §9 and §11: what a
 * stroke and a tap do to a session, what undo takes back, the order the hint
 * answers in, and the two ways a session comes into being.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dayDifference, localDateString } from './daily';
import { initialAssignment } from './engine';
import {
  UNDO_HISTORY_LIMIT,
  canUndo,
  createDailySession,
  createDifficultySession,
  difficultySeed,
  doHintUse,
  doRemove,
  doStroke,
  doUndo,
  hintFor,
  newSeedToken,
  restartSession,
  restoreSession,
  violationsOf,
  withElapsedSeconds,
  type ShapeRegionsSession,
} from './session';
import { UNASSIGNED, neighbors } from './types';

/** Paints the answer the way a player would: one stroke per region, cell by cell. */
function solveByPainting(session: ShapeRegionsSession): ShapeRegionsSession {
  let current = session;
  for (let region = 0; region < session.clues.length; region++) {
    // Offer the region's cells until they all join; a cell joins only once a
    // neighbour has, so several passes may be needed.
    const cells = session.solution.flatMap((r, cell) => (r === region ? [cell] : []));
    for (let pass = 0; pass < cells.length; pass++) {
      const next = doStroke(current, region, cells, pass > 0);
      if (next !== null) current = next;
    }
  }
  return current;
}

/** A neighbour of region 0's clue that the answer gives to region 0. */
function ownNeighbour(session: ShapeRegionsSession): number {
  const clue = session.clues[0]!.index;
  const candidates = [clue - 1, clue + 1, clue - session.width, clue + session.width];
  return candidates.find(
    (cell) =>
      cell >= 0 &&
      cell < session.solution.length &&
      Math.abs((cell % session.width) - (clue % session.width)) <= 1 &&
      session.solution[cell] === 0,
  )!;
}

describe('sessions (§9)', () => {
  it('creates a difficulty session sized by its preset', () => {
    const easy = createDifficultySession('easy', 'shape-regions-easy-test');
    expect(easy.mode).toBe('difficulty');
    expect(easy.width).toBe(5);
    expect(easy.height).toBe(5);
    expect(easy.dailyDate).toBeNull();
    expect(easy.status).toBe('playing');
    expect(easy.hintCount).toBe(0);
    expect(easy.elapsedSeconds).toBe(0);
    expect(easy.history).toEqual([]);
    expect(easy.assignment).toEqual(initialAssignment(easy));
    expect(createDifficultySession('medium', 'shape-regions-medium-test').width).toBe(6);
    expect(createDifficultySession('hard', 'shape-regions-hard-test').width).toBe(7);
  });

  it('creates a daily session for a date, medium every day', () => {
    const session = createDailySession('2026-08-01');
    expect(session.mode).toBe('daily');
    expect(session.difficulty).toBe('medium');
    expect(session.width).toBe(6);
    expect(session.dailyDate).toBe('2026-08-01');
    expect(session.seed).toBe('shape-regions-daily-2026-08-01');
  });

  it('gives different days different boards, and the same day the same board', () => {
    expect(createDailySession('2026-08-03').solution).not.toEqual(
      createDailySession('2026-08-04').solution,
    );
    expect(createDailySession('2026-08-03').clues).toEqual(createDailySession('2026-08-03').clues);
  });

  it('names its seeds, and never lets a token collide with a daily', () => {
    const token = newSeedToken(1, () => 0.25);
    expect(difficultySeed('hard', token)).toBe(`shape-regions-hard-${token}`);
    expect(difficultySeed('hard', token)).not.toMatch(/^shape-regions-daily-/);
    const a = createDifficultySession('easy');
    const b = createDifficultySession('easy');
    expect(a.seed.startsWith('shape-regions-easy-')).toBe(true);
    expect(a.seed).not.toBe(b.seed);
  });

  it('formats, shifts and subtracts local dates', () => {
    expect(localDateString(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayDifference('2026-08-03', '2026-08-04')).toBe(1);
    expect(dayDifference('2026-08-04', '2026-08-03')).toBe(-1);
  });

  it('restarts to the same puzzle with a clean board', () => {
    const session = createDifficultySession('easy', 'shape-regions-easy-restart');
    const played = doStroke(session, 0, [ownNeighbour(session)])!;
    const restarted = restartSession(played);
    expect(restarted.seed).toBe(session.seed);
    expect(restarted.solution).toEqual(session.solution);
    expect(restarted.clues).toEqual(session.clues);
    expect(restarted.assignment).toEqual(initialAssignment(session));
    expect(restarted.history).toEqual([]);

    const daily = restartSession(createDailySession('2026-08-05'));
    expect(daily.mode).toBe('daily');
    expect(daily.dailyDate).toBe('2026-08-05');
  });

  it('restores from persisted state and re-derives the win (§11)', () => {
    const solved = solveByPainting(createDifficultySession('easy', 'shape-regions-easy-restore'));
    expect(solved.status).toBe('solved');
    const { status: _status, history: _history, ...persisted } = solved;
    const restored = restoreSession(persisted);
    expect(restored.status).toBe('solved');
    expect(restored.history).toEqual([]);

    const { status: _fresh, history: _none, ...unplayed } = createDifficultySession('easy');
    expect(restoreSession(unplayed).status).toBe('playing');
  });
});

describe('strokes and taps (§4)', () => {
  const session = createDifficultySession('easy', 'shape-regions-easy-moves');

  it('grows a region with a stroke and says nothing when nothing joins', () => {
    const cell = ownNeighbour(session);
    const next = doStroke(session, 0, [cell])!;
    expect(next.assignment[cell]).toBe(0);
    // The same stroke again adds nothing: already in the region.
    expect(doStroke(next, 0, [cell])).toBeNull();
    // A cell nowhere near the region does not join either.
    const far = session.assignment.findIndex(
      (r, i) =>
        r === UNASSIGNED &&
        Math.abs(Math.floor(i / session.width) - Math.floor(cell / session.width)) > 1 &&
        Math.abs((i % session.width) - (cell % session.width)) > 1,
    );
    expect(doStroke(session, 0, [far])).toBeNull();
  });

  it('takes a cell back with a tap, and never the clue', () => {
    const cell = ownNeighbour(session);
    const grown = doStroke(session, 0, [cell])!;
    const shrunk = doRemove(grown, cell)!;
    expect(shrunk.assignment).toEqual(session.assignment);
    expect(doRemove(grown, session.clues[0]!.index)).toBeNull();
    expect(doRemove(session, cell)).toBeNull();
  });

  it('keeps the violation display readable from the session (§5)', () => {
    expect(violationsOf(session).any).toBe(false);
  });
});

describe('undo (§6)', () => {
  const session = createDifficultySession('easy', 'shape-regions-easy-undo');

  it('counts one stroke as one step, however many moves it took', () => {
    const cell = ownNeighbour(session);
    const first = doStroke(session, 0, [cell])!;
    expect(first.history).toHaveLength(1);
    // A second move of the same stroke extends the step rather than opening one.
    const more = session.solution.flatMap((r, i) => (r === 0 ? [i] : []));
    const second = doStroke(first, 0, more, true) ?? first;
    expect(second.history).toHaveLength(1);
    const undone = doUndo(second)!;
    expect(undone.assignment).toEqual(session.assignment);
    expect(canUndo(undone)).toBe(false);
    expect(doUndo(undone)).toBeNull();
  });

  it('counts one tap as one step, cascade included', () => {
    const cells = session.solution.flatMap((r, i) => (r === 0 ? [i] : []));
    let grown = session;
    for (let pass = 0; pass < cells.length; pass++)
      grown = doStroke(grown, 0, cells, pass > 0) ?? grown;
    const cell = ownNeighbour(session);
    const removed = doRemove(grown, cell)!;
    expect(removed.history).toHaveLength(2);
    expect(doUndo(removed)!.assignment).toEqual(grown.assignment);
  });

  it('leaves the hint count alone, and is capped', () => {
    const cell = ownNeighbour(session);
    let current = doHintUse(session);
    for (let i = 0; i < UNDO_HISTORY_LIMIT + 5; i++) {
      current = doStroke(current, 0, [cell])!;
      current = doRemove(current, cell)!;
    }
    expect(current.history.length).toBeLessThanOrEqual(UNDO_HISTORY_LIMIT);
    expect(doUndo(current)!.hintCount).toBe(1);
  });

  it('cannot take a solved board back to playing', () => {
    const solved = solveByPainting(session);
    expect(solved.status).toBe('solved');
    expect(canUndo(solved)).toBe(false);
    expect(doUndo(solved)).toBeNull();
    expect(doStroke(solved, 0, [1])).toBeNull();
    expect(doRemove(solved, ownNeighbour(session))).toBeNull();
  });
});

describe('the hint (§6)', () => {
  const session = createDifficultySession('easy', 'shape-regions-easy-hint');

  it('names a region that disagrees with the answer first', () => {
    // The first clue with a free neighbour the answer gives to someone else.
    let wrong: ShapeRegionsSession | null = null;
    let region = -1;
    for (let r = 0; r < session.clues.length && wrong === null; r++) {
      for (const cell of neighbors(session.clues[r]!.index, session.width, session.height)) {
        if (session.solution[cell] === r || session.clues.some((c) => c.index === cell)) continue;
        wrong = doStroke(session, r, [cell]);
        region = r;
        break;
      }
    }
    expect(wrong).not.toBeNull();
    const hint = hintFor(wrong!);
    expect(hint?.kind).toBe('wrong');
    if (hint?.kind === 'wrong') expect(hint.region).toBe(region);
  });

  it('gives a deduction on a board that agrees, and never writes it', () => {
    const before = [...session.assignment];
    const hint = hintFor(session);
    expect(hint?.kind).toBe('step');
    expect(session.assignment).toEqual(before);
    expect(doHintUse(session).hintCount).toBe(1);
    expect(doHintUse(session).assignment).toEqual(before);
  });

  it('has nothing to say once the board is solved', () => {
    expect(hintFor(solveByPainting(session))).toBeNull();
  });
});

describe('the clock (§10)', () => {
  it('only ever moves forward', () => {
    const session = createDifficultySession('easy', 'shape-regions-easy-clock');
    const later = withElapsedSeconds(session, 42.9);
    expect(later.elapsedSeconds).toBe(42);
    expect(withElapsedSeconds(later, 10)).toBe(later);
  });
});
