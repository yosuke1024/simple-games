/**
 * Session rules of docs/BOX_REGIONS_RULES.md §3, §4, §6, §9 and §11: what a
 * stroke and a tap do to a session, what undo takes back, the order the hint
 * answers in, and the two ways a session comes into being.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dailySeed, dayDifference, localDateString } from './daily';
import { initialAssignment, regionCells } from './engine';
import {
  UNDO_HISTORY_LIMIT,
  canUndo,
  createDailySession,
  createDifficultySession,
  difficultySeed,
  doDraw,
  doHintUse,
  doTap,
  doUndo,
  hintFor,
  newSeedToken,
  restartSession,
  restoreSession,
  violationsOf,
  withElapsedSeconds,
  type BoxRegionsSession,
} from './session';
import { UNASSIGNED } from './types';

/** Draws one region of the answer the way a player would. */
function drawRegion(session: BoxRegionsSession, region: number): BoxRegionsSession | null {
  const cells = regionCells(session.solution, region);
  return cells.length === 1
    ? doTap(session, cells[0]!)
    : doDraw(session, cells[0]!, cells[cells.length - 1]!);
}

/** Draws the whole answer, box by box. */
function solveByDrawing(session: BoxRegionsSession): BoxRegionsSession {
  let current = session;
  for (let region = 0; region < session.clues.length; region++) {
    current = drawRegion(current, region) ?? current;
  }
  return current;
}

/** A region of the answer with more than one cell. */
const bigRegion = (session: BoxRegionsSession): number =>
  session.clues.findIndex((_, region) => regionCells(session.solution, region).length > 1);

describe('sessions (§9)', () => {
  it('creates a difficulty session sized by its preset, with nothing drawn', () => {
    const easy = createDifficultySession('easy', 'box-regions-easy-test');
    expect(easy.mode).toBe('difficulty');
    expect([easy.width, easy.height]).toEqual([5, 5]);
    expect(easy.assignment).toEqual(initialAssignment(easy));
    expect(easy.assignment.every((region) => region === UNASSIGNED)).toBe(true);
    expect(createDifficultySession('hard', 'box-regions-hard-test').width).toBe(7);
  });

  it('seeds difficulty games per token, and the daily per date, medium every day', () => {
    expect(difficultySeed('medium', 'abc')).toBe('box-regions-medium-abc');
    expect(dailySeed('2026-08-01')).toBe('box-regions-daily-2026-08-01');
    const daily = createDailySession('2026-08-02');
    expect(daily.difficulty).toBe('medium');
    expect(daily.dailyDate).toBe('2026-08-02');
    expect(daily.seed).toBe('box-regions-daily-2026-08-02');
    expect(newSeedToken(0, () => 0)).toBe('0-0');
  });

  it('restarts the same board clean', () => {
    const session = createDifficultySession('easy', 'box-regions-easy-test');
    const played = drawRegion(session, bigRegion(session))!;
    const again = restartSession(played);
    expect(again.clues).toEqual(session.clues);
    expect(again.assignment).toEqual(session.assignment);
    expect(restartSession(createDailySession('2026-08-03')).dailyDate).toBe('2026-08-03');
  });
});

describe('drawing and tapping (§4)', () => {
  it('solves once every box is drawn, and refuses moves after', () => {
    const session = createDifficultySession('medium', 'box-regions-medium-test');
    const solved = solveByDrawing(session);
    expect(solved.status).toBe('solved');
    expect(doDraw(solved, 0, 0)).toBeNull();
    expect(doTap(solved, 0)).toBeNull();
    expect(canUndo(solved)).toBe(false);
    expect(hintFor(solved)).toBeNull();
  });

  it('records nothing for a stroke that draws nothing', () => {
    const session = createDifficultySession('easy', 'box-regions-easy-test');
    // Corner to corner of the whole board holds every clue: nothing happens.
    expect(doDraw(session, 0, session.width * session.height - 1)).toBeNull();
  });

  it('shows a box that breaks its clue, and nothing about one that does not', () => {
    const session = createDifficultySession('easy', 'box-regions-easy-test');
    const region = bigRegion(session);
    const good = drawRegion(session, region)!;
    expect(violationsOf(good).any).toBe(false);
    // The clue cell alone, tapped: a 1×1 for a clue whose box is bigger.
    const tapped = doTap(session, session.clues[region]!.index)!;
    expect(tapped.assignment[session.clues[region]!.index]).toBe(region);
    const clue = session.clues[region]!;
    if (clue.size !== null || clue.kind === 'tall' || clue.kind === 'wide') {
      expect(violationsOf(tapped).regions[region]).toBe(true);
    }
  });
});

describe('undo (§6)', () => {
  it('takes back one stroke or one tap at a time, and never the hint count', () => {
    const session = createDifficultySession('easy', 'box-regions-easy-test');
    const region = bigRegion(session);
    const drawn = drawRegion(session, region)!;
    const cell = regionCells(drawn.solution, region)[1]!;
    const removed = doHintUse(doTap(drawn, cell)!);
    expect(removed.assignment[cell]).toBe(UNASSIGNED);

    const back = doUndo(removed)!;
    expect(back.assignment).toEqual(drawn.assignment);
    expect(back.hintCount).toBe(1);
    const start = doUndo(back)!;
    expect(start.assignment).toEqual(session.assignment);
    expect(canUndo(start)).toBe(false);
    expect(doUndo(start)).toBeNull();
  });

  it('keeps at most the history limit', () => {
    let session = createDifficultySession('easy', 'box-regions-easy-test');
    const clue = session.clues[0]!.index;
    for (let i = 0; i < UNDO_HISTORY_LIMIT + 5; i++) session = doTap(session, clue) ?? session;
    expect(session.history.length).toBe(UNDO_HISTORY_LIMIT);
  });
});

describe('hints (§6)', () => {
  it('names a wrong box before anything else, and a step otherwise', () => {
    const session = createDifficultySession('easy', 'box-regions-easy-test');
    const step = hintFor(session);
    expect(step?.kind).toBe('step');
    const region = bigRegion(session);
    const wrong = doTap(session, session.clues[region]!.index)!;
    expect(hintFor(wrong)).toMatchObject({ kind: 'wrong', region });
  });
});

describe('restore and the clock (§10, §11)', () => {
  it('re-derives the status from the board, and starts with no history', () => {
    const session = createDifficultySession('easy', 'box-regions-easy-test');
    const solved = solveByDrawing(session);
    const { history: _history, status: _status, ...data } = solved;
    const restored = restoreSession(data);
    expect(restored.status).toBe('solved');
    expect(restored.history).toEqual([]);
  });

  it('only ever moves the clock forward', () => {
    const session = withElapsedSeconds(createDailySession('2026-08-04'), 30.7);
    expect(session.elapsedSeconds).toBe(30);
    expect(withElapsedSeconds(session, 10).elapsedSeconds).toBe(30);
  });

  it('walks local dates without skipping a day', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayDifference('2026-08-01', '2026-09-01')).toBe(31);
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
