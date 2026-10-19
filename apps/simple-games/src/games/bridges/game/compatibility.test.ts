/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * A seed is a promise. A daily is the same puzzle for everyone who opens it,
 * and Retry hands back the board on screen — so any change to the rng, to
 * the growth, to the loop closing, to the grading or to the tier bands that
 * moves a board fails here. That is the point: changing these strings is a
 * decision, not a side effect.
 *
 * **Fix the implementation, not the test** — unless the change is meant. A
 * saved game holds its board and its answer verbatim (docs/BRIDGES_RULES.md
 * §10), so a suspended game survives a generator change; what a change costs
 * is that the same seed (and the same daily date) gives another board. While
 * Bridges is in the browser's early release (docs/WEB_VERSION.md「先行公開」)
 * that is allowed, but say so in the commit message. The bundled fallback
 * boards are pinned by guarantee.test.ts in the same way.
 */
import { describe, expect, it } from 'vitest';
import { buildGraph, isSolved } from './engine';
import { encodeBoard, encodeBridges } from './serialize';
import {
  createDailySession,
  createDifficultySession,
  doCycle,
  fromRecord,
  toRecord,
} from './session';

const rows = (text: string, width: number): string[] => {
  const out: string[] = [];
  for (let at = 0; at < text.length; at += width) out.push(text.slice(at, at + width));
  return out;
};

describe('golden puzzles (v1)', () => {
  it('the easy board for seed bridges-easy-golden is unchanged', () => {
    const session = createDifficultySession('easy', 'bridges-easy-golden');
    expect(rows(encodeBoard(session), session.width)).toEqual([
      '.4..6.2',
      '.......',
      '...1.1.',
      '....2..',
      '.4.3.3.',
      '.......',
      '.1...1.',
    ]);
    expect(encodeBridges(session.solution)).toBe('222201111110');
  });

  it('the medium board for seed bridges-medium-golden is unchanged', () => {
    const session = createDifficultySession('medium', 'bridges-medium-golden');
    expect(rows(encodeBoard(session), session.width)).toEqual([
      '.........',
      '3...1...1',
      '.........',
      '4..3....3',
      '.........',
      '2....2.2.',
      '........1',
      '2.1..1...',
      '.2.4...2.',
    ]);
    expect(encodeBridges(session.solution)).toBe('120111111011111021');
  });

  it('the hard board for seed bridges-hard-golden is unchanged', () => {
    const session = createDifficultySession('hard', 'bridges-hard-golden');
    expect(rows(encodeBoard(session), session.width)).toEqual([
      '.1.2.3..1.',
      '....1.....',
      '.....3.2.1',
      '..........',
      '....2..2..',
      '.2.3.2..3.',
      '.........2',
      '....1...2.',
      '.2.3.....2',
      '..........',
    ]);
    expect(encodeBridges(session.solution)).toBe('0111021110011100111111111');
  });

  it('the daily for 2026-10-17 is unchanged', () => {
    const session = createDailySession('2026-10-17');
    expect(session.difficulty).toBe('medium');
    expect(rows(encodeBoard(session), session.width)).toEqual([
      '.........',
      '3.3...3.3',
      '....1....',
      '.........',
      '....3...4',
      '3.....3..',
      '.........',
      '..2.3.2..',
      '1..1....3',
    ]);
    expect(encodeBridges(session.solution)).toBe('121111210220121001');
  });

  it('ships boards whose answer wins in the first place', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `bridges-${difficulty}-golden`);
      expect(isSolved(buildGraph(session), session.solution), difficulty).toBe(true);
    }
  });
});

/**
 * The saved record of §10, v1: the board as one character per cell, the
 * answer and the player's bridges as one digit per edge, plus the counters.
 */
describe('the saved record (v1)', () => {
  const played = () => {
    let session = createDifficultySession('easy', 'bridges-easy-golden');
    // A double on the first edge, a single on the third.
    session = doCycle(session, 0)!;
    session = doCycle(session, 0)!;
    return doCycle(session, 2)!;
  };

  it('writes exactly these fields', () => {
    expect(toRecord(played())).toEqual({
      mode: 'difficulty',
      seed: 'bridges-easy-golden',
      difficulty: 'easy',
      dailyDate: null,
      width: 7,
      height: 7,
      board: '.4..6.2' + '.......' + '...1.1.' + '....2..' + '.4.3.3.' + '.......' + '.1...1.',
      solution: '222201111110',
      bridges: '201000000000',
      hintCount: 0,
      elapsedSeconds: 0,
    });
  });

  it('reads back exactly what it wrote', () => {
    const session = played();
    const restored = fromRecord(JSON.parse(JSON.stringify(toRecord(session))));
    expect(restored).not.toBeNull();
    expect(restored!.islands).toEqual(session.islands);
    expect(restored!.solution).toEqual([...session.solution]);
    expect(restored!.bridges).toEqual([...session.bridges]);
    expect(restored!.history).toEqual([]);
  });
});
