/**
 * Session rules of docs/CROWN_GRID_RULES.md §2, §4, §6, §9 and §11.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dayDifference, localDateString } from './daily';
import { marksOf } from './engine';
import {
  createDailySession,
  createDifficultySession,
  difficultySeed,
  doHintUse,
  doMarkCross,
  doTap,
  hintFor,
  newSeedToken,
  restartSession,
  restoreSession,
  violationsOf,
  withElapsedSeconds,
  type CrownGridSession,
} from './session';
import { CROSS, CROWN, EMPTY } from './types';

/** Writes the answer the only way a player can: two taps per crown. */
function solveByTapping(session: CrownGridSession): CrownGridSession {
  let current = session;
  session.solution.forEach((col, row) => {
    const index = row * session.size + col;
    for (let tap = 0; tap < 2; tap++) {
      const next = doTap(current, index);
      if (next !== null) current = next;
    }
  });
  return current;
}

describe('sessions (§9)', () => {
  it('creates a difficulty session sized by its tier, with a clean board', () => {
    const easy = createDifficultySession('easy', 'crown-grid-easy-s1');
    expect(easy.size).toBe(6);
    expect(easy.mode).toBe('difficulty');
    expect(easy.dailyDate).toBeNull();
    expect(easy.marks.every((mark) => mark === EMPTY)).toBe(true);
    expect(easy.status).toBe('playing');
    expect(easy.hintCount).toBe(0);
    expect(easy.elapsedSeconds).toBe(0);
    expect(easy.regions).toHaveLength(36);
    expect(easy.solution).toHaveLength(6);
    expect(createDifficultySession('medium', 'crown-grid-medium-s1').size).toBe(8);
    expect(createDifficultySession('hard', 'crown-grid-hard-s1').size).toBe(9);
  });

  it('creates a daily session for a date, medium every day', () => {
    const session = createDailySession('2026-08-01');
    expect(session.mode).toBe('daily');
    expect(session.difficulty).toBe('medium');
    expect(session.size).toBe(8);
    expect(session.dailyDate).toBe('2026-08-01');
    expect(session.seed).toBe('crown-grid-daily-2026-08-01');
  });

  it('gives different days different boards', () => {
    expect(createDailySession('2026-08-03').regions).not.toEqual(
      createDailySession('2026-08-04').regions,
    );
  });

  it('formats, shifts and subtracts local dates', () => {
    expect(localDateString(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayDifference('2026-08-03', '2026-08-04')).toBe(1);
    expect(dayDifference('2026-08-04', '2026-08-03')).toBe(-1);
  });

  it('is a pure function of its seed, and a new token is a new board', () => {
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
    expect(b.regions).not.toEqual(a.regions);
    const again = createDifficultySession('easy', a.seed);
    expect(again.regions).toEqual(a.regions);
    expect(again.solution).toEqual(a.solution);
    expect(a.seed.startsWith('crown-grid-easy-')).toBe(true);
    expect(a.seed).not.toMatch(/^crown-grid-daily-/);
  });

  it('restarts to the same puzzle with a clean board', () => {
    const session = createDifficultySession('medium', 'crown-grid-medium-restart');
    const played = doTap(session, 3)!;
    const restarted = restartSession(played);
    expect(restarted.seed).toBe(session.seed);
    expect(restarted.regions).toEqual(session.regions);
    expect(restarted.solution).toEqual(session.solution);
    expect(restarted.marks.every((mark) => mark === EMPTY)).toBe(true);
    const daily = restartSession(doTap(createDailySession('2026-08-02'), 0)!);
    expect(daily.dailyDate).toBe('2026-08-02');
    expect(daily.marks.every((mark) => mark === EMPTY)).toBe(true);
  });

  it('restores from persisted state and re-derives the win (§11)', () => {
    const solved = solveByTapping(createDifficultySession('easy', 'crown-grid-easy-restore'));
    expect(solved.status).toBe('solved');
    const { status: _status, ...persisted } = solved;
    expect(restoreSession(persisted).status).toBe('solved');
    const { status: _fresh, ...unplayed } = createDifficultySession(
      'easy',
      'crown-grid-easy-restore',
    );
    expect(restoreSession(unplayed).status).toBe('playing');
  });
});

describe('taps, strokes and the win (§2, §4)', () => {
  const session = createDifficultySession('easy', 'crown-grid-easy-taps');

  it('cycles a cell empty → × → crown → empty', () => {
    const crossed = doTap(session, 5)!;
    expect(crossed.marks[5]).toBe(CROSS);
    const crowned = doTap(crossed, 5)!;
    expect(crowned.marks[5]).toBe(CROWN);
    expect(doTap(crowned, 5)!.marks[5]).toBe(EMPTY);
    expect(doTap(session, -1)).toBeNull();
    expect(doTap(session, 999)).toBeNull();
  });

  it('writes × along a stroke onto empty cells only', () => {
    const crowned = doTap(doTap(session, 0)!, 0)!;
    const stroked = doMarkCross(crowned, [0, 1, 2])!;
    expect(stroked.marks[0]).toBe(CROWN);
    expect(stroked.marks[1]).toBe(CROSS);
    expect(stroked.marks[2]).toBe(CROSS);
    // Nothing left to write: null, so nothing is saved for it.
    expect(doMarkCross(stroked, [0, 1, 2])).toBeNull();
  });

  it('turns solved once, and then refuses every move', () => {
    const solved = solveByTapping(session);
    expect(solved.status).toBe('solved');
    expect(violationsOf(solved).any).toBe(false);
    for (let index = 0; index < solved.marks.length; index++) {
      expect(doTap(solved, index)).toBeNull();
    }
    expect(doMarkCross(solved, [0])).toBeNull();
  });

  it('is won by the rules, ×s and all, never by matching the answer', () => {
    // The answer with every other cell crossed out is still the answer.
    const crossed = doMarkCross(
      { ...session, marks: marksOf(session.solution, session.size) },
      Array.from({ length: 36 }, (_, index) => index),
    )!;
    expect(restoreSession(crossed).status).toBe('solved');
  });

  it('does not call a board solved while a crown is missing', () => {
    const solved = solveByTapping(session);
    const { status: _status, ...persisted } = solved;
    const marks = [...persisted.marks];
    marks[marks.indexOf(CROWN)] = EMPTY;
    expect(restoreSession({ ...persisted, marks }).status).toBe('playing');
  });
});

describe('hints (§6)', () => {
  it('offers a step on a fresh board that agrees with the answer', () => {
    const session = createDifficultySession('medium', 'crown-grid-medium-hint');
    const hint = hintFor(session);
    expect(hint?.kind).toBe('step');
    if (hint?.kind === 'step') {
      const answer = new Set(session.solution.map((col, row) => row * session.size + col));
      if (hint.step.kind === 'place') expect(answer.has(hint.step.cells[0]!)).toBe(true);
      else for (const cell of hint.step.cells) expect(answer.has(cell)).toBe(false);
    }
  });

  it('counts uses without limiting them', () => {
    let session = createDifficultySession('easy', 'crown-grid-easy-hintcount');
    for (let use = 1; use <= 5; use++) {
      session = doHintUse(session);
      expect(session.hintCount).toBe(use);
      expect(hintFor(session)).not.toBeNull();
    }
  });

  it('offers nothing once the puzzle is solved', () => {
    expect(
      hintFor(solveByTapping(createDifficultySession('easy', 'crown-grid-easy-h2'))),
    ).toBeNull();
  });
});

describe('the clock is carried, never read (§10)', () => {
  it('takes the owner’s seconds and only ever moves forward', () => {
    const session = createDifficultySession('easy', 'crown-grid-easy-clock');
    const ticked = withElapsedSeconds(session, 42.7);
    expect(ticked.elapsedSeconds).toBe(42);
    expect(withElapsedSeconds(ticked, 10).elapsedSeconds).toBe(42);
    expect(withElapsedSeconds(ticked, 42)).toBe(ticked);
    expect(withElapsedSeconds(ticked, 100).elapsedSeconds).toBe(100);
  });

  it('carries the seconds across a tap, and drops them on a restart', () => {
    const session = withElapsedSeconds(
      createDifficultySession('easy', 'crown-grid-easy-clock2'),
      90,
    );
    const played = doTap(session, 0)!;
    expect(played.elapsedSeconds).toBe(90);
    expect(restartSession(played).elapsedSeconds).toBe(0);
  });
});
