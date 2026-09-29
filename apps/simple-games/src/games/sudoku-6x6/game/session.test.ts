/**
 * One game as the session layer plays it (docs/SUDOKU_6X6_RULES.md §3, §4,
 * §5, §9, §10): digits and notes, undo that takes back moves but never the
 * counters, a hint that never writes, and seeds that pin a board down.
 */
import { describe, expect, it } from 'vitest';
import { valueAt } from './engine';
import {
  canUndo,
  countHintUse,
  createDailySession,
  createDifficultySession,
  difficultySeed,
  eraseCell,
  hintFor,
  newSeedToken,
  placeDigit,
  restartSession,
  toggleCellNote,
  undo,
  UNDO_HISTORY_LIMIT,
  withElapsedSeconds,
  type Sudoku6x6Session,
} from './session';
import { CELLS, type Digit } from './types';

const fresh = () => createDifficultySession('easy', 'sudoku-6x6-easy-session');
const firstEmpty = (s: Sudoku6x6Session) => s.board.givens.findIndex((value) => value === 0);
const wrongDigit = (s: Sudoku6x6Session, index: number) => ((s.solution[index]! % 6) + 1) as Digit;

/** Fills every empty cell with its answer. */
function solveAll(session: Sudoku6x6Session): Sudoku6x6Session {
  let s = session;
  for (let i = 0; i < CELLS; i++) {
    if (s.board.givens[i] !== 0) continue;
    s = placeDigit(s, i, s.solution[i] as Digit)!;
  }
  return s;
}

describe('seeds (§9)', () => {
  it('names difficulty boards and dailies by the pattern §9 states', () => {
    expect(difficultySeed('hard', 'abc')).toBe('sudoku-6x6-hard-abc');
    expect(createDailySession('2026-08-01').seed).toBe('sudoku-6x6-daily-2026-08-01');
    expect(newSeedToken(36, () => 0.5)).toBe('10-4zsov');
  });

  it('plays the daily at medium, every day', () => {
    const daily = createDailySession('2026-09-29');
    expect(daily).toMatchObject({ mode: 'daily', difficulty: 'medium', dailyDate: '2026-09-29' });
  });

  it('retries the same board from a clean slate', () => {
    const s = placeDigit(fresh(), firstEmpty(fresh()), 1)!;
    const again = restartSession(s);
    expect(again.board.givens).toEqual(s.board.givens);
    expect(again.board.entries.every((value) => value === 0)).toBe(true);
    expect(again.mistakeCount).toBe(0);
    expect(restartSession(createDailySession('2026-08-02')).dailyDate).toBe('2026-08-02');
  });
});

describe('mistakes, undo and hints (§4, §5)', () => {
  it('counts every wrong digit and never blocks the board', () => {
    let s = fresh();
    const cell = firstEmpty(s);
    s = placeDigit(s, cell, wrongDigit(s, cell))!;
    expect(s.mistakeCount).toBe(1);
    s = placeDigit(s, cell, (((s.solution[cell]! + 1) % 6) + 1) as Digit) ?? s;
    s = placeDigit(s, cell, s.solution[cell] as Digit)!;
    expect(s.status).toBe('playing');
    expect(s.mistakeCount).toBeGreaterThanOrEqual(1);
  });

  it('undoes placements, erasures and notes, but never the counters', () => {
    let s = fresh();
    const cell = firstEmpty(s);
    s = toggleCellNote(s, cell, 2)!;
    s = placeDigit(s, cell, wrongDigit(s, cell))!;
    s = countHintUse(s);
    s = eraseCell(s, cell)!;
    expect(s.history).toHaveLength(3);

    s = undo(s)!;
    expect(valueAt(s.board, cell)).toBe(wrongDigit(s, cell));
    s = undo(s)!;
    expect(s.board.notes[cell]).toBe(0b10);
    s = undo(s)!;
    expect(s.board.notes[cell]).toBe(0);
    expect(canUndo(s)).toBe(false);
    expect(undo(s)).toBeNull();
    expect(s.mistakeCount).toBe(1);
    expect(s.hintCount).toBe(1);
  });

  it('keeps at most the history limit', () => {
    let s = fresh();
    const cell = firstEmpty(s);
    for (let i = 0; i < UNDO_HISTORY_LIMIT + 5; i++) s = toggleCellNote(s, cell, 1)!;
    expect(s.history).toHaveLength(UNDO_HISTORY_LIMIT);
  });

  it('hints without writing anything', () => {
    const s = fresh();
    const hint = hintFor(s)!;
    expect(hint.target).toBeDefined();
    expect(s.board.entries.every((value) => value === 0)).toBe(true);
  });
});

describe('finishing (§2, §10)', () => {
  it('solves once, and refuses every move after', () => {
    const s = solveAll(fresh());
    expect(s.status).toBe('solved');
    expect(placeDigit(s, firstEmpty(fresh()), 1)).toBeNull();
    expect(undo(s)).toBeNull();
    expect(hintFor(s)).toBeNull();
  });

  it('carries the clock forward, never back', () => {
    const s = withElapsedSeconds(fresh(), 12.7);
    expect(s.elapsedSeconds).toBe(12);
    expect(withElapsedSeconds(s, 3).elapsedSeconds).toBe(12);
  });
});
