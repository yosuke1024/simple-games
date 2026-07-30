/**
 * Session rules of docs/NONOGRAM_RULES.md §2, §3, §6, §7, §10.
 */
import { describe, expect, it } from 'vitest';
import {
  countHintUse,
  createDailySession,
  createLevelSession,
  crossCell,
  hintFor,
  paintCell,
  restartSession,
  restoreSession,
  type NonogramSession,
} from './session';
import { CROSSED, FILLED, PAINTED, UNKNOWN } from './types';

/** Paints exactly the solution — the honest way to finish any session. */
function solveByPainting(session: NonogramSession): NonogramSession {
  let current = session;
  session.solution.forEach((cell, index) => {
    if (cell !== PAINTED) return;
    const next = paintCell(current, index);
    if (next !== null) current = next;
  });
  return current;
}

describe('sessions (§6)', () => {
  it('creates a level session sized by its band', () => {
    const early = createLevelSession(1);
    expect(early.size).toBe(5);
    expect(early.level).toBe(1);
    expect(early.marks.every((mark) => mark === UNKNOWN)).toBe(true);

    const late = createLevelSession(700);
    expect(late.size).toBe(10);
  });

  it('creates a daily session for a date, 10×10 every day', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(10);
    expect(session.dailyDate).toBe('2026-08-01');
    expect(session.seed).toBe('nono-daily-2026-08-01');
  });

  it('restarts to the same puzzle with clean marks', () => {
    const session = createLevelSession(5);
    const painted = paintCell(session, 0)!;
    const restarted = restartSession(painted);
    expect(restarted.solution).toEqual(session.solution);
    expect(restarted.marks.every((mark) => mark === UNKNOWN)).toBe(true);
  });

  it('restores from persisted state and re-derives the win (§10)', () => {
    const solved = solveByPainting(createLevelSession(3));
    expect(solved.status).toBe('solved');
    const { clues: _clues, status: _status, ...persisted } = solved;
    const restored = restoreSession(persisted);
    expect(restored.status).toBe('solved');
    expect(restored.clues).toEqual(solved.clues);
  });
});

describe('marks and the win (§2, §3)', () => {
  it('paints, crosses, and refuses moves after the win', () => {
    const session = createLevelSession(1);
    const painted = paintCell(session, 0)!;
    expect(painted.marks[0]).toBe(FILLED);
    const crossed = crossCell(painted, 0)!;
    expect(crossed.marks[0]).toBe(CROSSED);

    const solved = solveByPainting(session);
    expect(solved.status).toBe('solved');
    expect(paintCell(solved, 0)).toBeNull();
    expect(crossCell(solved, 0)).toBeNull();
  });

  it('wins without a single cross — crosses are aids, not answers (§2)', () => {
    const solved = solveByPainting(createLevelSession(2));
    expect(solved.status).toBe('solved');
    expect(solved.marks.some((mark) => mark === CROSSED)).toBe(false);
  });
});

describe('hints (§7)', () => {
  it('offers a decided cell on a fresh board, and counts uses', () => {
    const session = createLevelSession(1);
    const hint = hintFor(session);
    expect(hint).not.toBeNull();
    expect(countHintUse(session).hintCount).toBe(1);
  });

  it('agrees with the solution on a fresh board', () => {
    const session = createLevelSession(123);
    const hint = hintFor(session);
    expect(hint?.kind).toBe('cell');
    if (hint?.kind === 'cell') {
      const truth = session.solution[hint.index] === PAINTED ? FILLED : CROSSED;
      expect(hint.mark).toBe(truth);
    }
  });

  it('offers nothing once the puzzle is solved', () => {
    const solved = solveByPainting(createLevelSession(4));
    expect(hintFor(solved)).toBeNull();
  });
});
