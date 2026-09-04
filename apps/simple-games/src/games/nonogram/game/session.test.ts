/**
 * Session rules of docs/NONOGRAM_RULES.md §2, §3, §6, §7, §10.
 */
import { describe, expect, it } from 'vitest';
import {
  countHintUse,
  createDailySession,
  createFreeSession,
  createLevelSession,
  crossCell,
  freeSeed,
  hintFor,
  markCells,
  newSeedToken,
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

describe('createFreeSession (§6 フリープレイ)', () => {
  it('draws a board at the tier asked for, with no level and no date', () => {
    const easy = createFreeSession('easy');
    expect(easy.mode).toBe('free');
    expect(easy.freeTier).toBe('easy');
    expect(easy.size).toBe(5);
    expect(easy.level).toBeNull();
    expect(easy.dailyDate).toBeNull();
    expect(easy.seed.startsWith('nono-free-')).toBe(true);
    expect(easy.status).toBe('playing');

    expect(createFreeSession('medium').size).toBe(10);
    expect(createFreeSession('hard').size).toBe(10);
  });

  it('gives a new board each time, and the same board for the same seed', () => {
    const a = createFreeSession('medium', freeSeed(newSeedToken(1, () => 0.25)));
    const b = createFreeSession('medium', freeSeed(newSeedToken(2, () => 0.5)));
    expect(b.solution).not.toEqual(a.solution);
    const again = createFreeSession('medium', a.seed);
    expect(again.solution).toEqual(a.solution);
    expect(again.clues).toEqual(a.clues);
  });

  it('restart rebuilds the identical free board', () => {
    const session = createFreeSession('hard');
    const restarted = restartSession(paintCell(session, 0)!);
    expect(restarted.seed).toBe(session.seed);
    expect(restarted.freeTier).toBe('hard');
    expect(restarted.solution).toEqual(session.solution);
    expect(restarted.marks.every((mark) => mark === UNKNOWN)).toBe(true);
  });

  it('never collides with a level or a daily seed', () => {
    const token = newSeedToken(1, () => 0);
    expect(freeSeed(token)).not.toBe('nono-level-1');
    expect(freeSeed(token)).not.toMatch(/^nono-daily-/);
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

  it('marks a stroke of cells at once, and refuses one after the win (§3)', () => {
    const session = createLevelSession(1);
    const stroke = markCells(session, [0, 1, 2], FILLED)!;
    expect(stroke.marks.slice(0, 4)).toEqual([FILLED, FILLED, FILLED, UNKNOWN]);
    // The same stroke crossing its own path again changes nothing.
    expect(markCells(stroke, [0, 1, 2], FILLED)).toBeNull();

    const solved = solveByPainting(session);
    expect(markCells(solved, [0], UNKNOWN)).toBeNull();
  });

  it('finishes the board when the stroke is the last thing it needed (§2)', () => {
    const session = createLevelSession(3);
    const painted: number[] = [];
    session.solution.forEach((cell, index) => {
      if (cell === PAINTED) painted.push(index);
    });
    expect(markCells(session, painted, FILLED)?.status).toBe('solved');
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
