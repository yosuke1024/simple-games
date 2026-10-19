/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * A seed is a promise. A daily is the same puzzle for everyone who opens it,
 * and the retry offers the same board back — so any change to the rng, to
 * the region growth, to the thinning order, to the techniques or to the
 * tiers that moves a board fails here. That is the point: changing these
 * strings is a decision, not a side effect.
 *
 * Loop Puzzle is in the web-beta channel (docs/WEB_VERSION.md「先行公開」):
 * its save schema is not frozen yet, and a saved game carries its own clues
 * (docs/LOOP_PUZZLE_RULES.md §12), so a board change does not strand a game
 * in progress — but it does retire every daily already played and every
 * bundled fallback (bundled.test.ts fails with this one). If a change here is
 * intended, regenerate the strings and the bundled boards, and say so in the
 * commit message.
 */
import { describe, expect, it } from 'vitest';
import { isSolved } from './engine';
import { generatePuzzle } from './generator';
import { cluesDigest, decodeBoard, decodeMarks, encodeClues, encodeMarks } from './serialize';
import { createDailySession, createDifficultySession, doCycle, doSet } from './session';
import { CROSS, PRESETS } from './types';

describe('golden puzzles (v1)', () => {
  it('the easy board for seed loop-puzzle-easy-golden is unchanged', () => {
    const session = createDifficultySession('easy', 'loop-puzzle-easy-golden');
    expect(encodeClues(session.clues)).toBe('0.2.' + '0.1.' + '0211' + '...2');
    expect(encodeMarks(session.solution)).toBe('XXLLXXXXXXXXXLXXXLLLXXLXLXXLXLXXLXLXLXXL');
  });

  it('the medium board for seed loop-puzzle-medium-golden is unchanged', () => {
    const session = createDifficultySession('medium', 'loop-puzzle-medium-golden');
    expect(encodeClues(session.clues)).toBe('0.0.1' + '..0..' + '1...1' + '..31.' + '12.12');
    expect(encodeMarks(session.solution)).toBe(
      'XXXXXXXXXLXLXLXXXXXXXXLXXXLLLLXXXXXXXXXXLLXLLLXLXLLLXLXLXXXL',
    );
  });

  it('the hard board for seed loop-puzzle-hard-golden is unchanged', () => {
    const session = createDifficultySession('hard', 'loop-puzzle-hard-golden');
    expect(encodeClues(session.clues)).toBe(
      '01....' + '.012.1' + '......' + '.0..3.' + '...0..' + '.3..1.',
    );
    expect(encodeMarks(session.solution)).toBe(
      'XXLLLLXXLLXXXXXXLXXXXLXXXXLXLXXLXXXXXLLLLLXXLXXXLXXXXLXLXXXXXLLXXXLLLLXXLXXXLXLXXXXL',
    );
  });

  it('the daily for 2026-10-17 is unchanged', () => {
    const session = createDailySession('2026-10-17');
    expect(session.difficulty).toBe('medium');
    expect(encodeClues(session.clues)).toBe('0.2.3' + '.....' + '.22.3' + '.20..' + '3.112');
    expect(encodeMarks(session.solution)).toBe(
      'XXLLLXXXLLXXXXLXLXLXLXXXXLLLLLXXLXXLXXLLXXXXLLLLXLXXXLLXXXXL',
    );
  });

  it('pins the grade and the cost of each golden board', () => {
    const easy = generatePuzzle('loop-puzzle-easy-golden', 'easy');
    expect([easy.grade, easy.trials, easy.attempts, easy.work]).toEqual([1, 0, 2, 2772]);
    const medium = generatePuzzle('loop-puzzle-medium-golden', 'medium');
    expect([medium.grade, medium.trials, medium.attempts, medium.work]).toEqual([2, 0, 1, 5179]);
    const hard = generatePuzzle('loop-puzzle-hard-golden', 'hard');
    expect([hard.grade, hard.trials, hard.attempts, hard.work]).toEqual([3, 5, 1, 45723]);
  });

  it('ships boards whose answer is a legal loop in the first place', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `loop-puzzle-${difficulty}-golden`);
      expect(isSolved(session, session.solution), difficulty).toBe(true);
    }
  });
});

/**
 * The save format of §12, v1: the clues and the marks as strings, the answer
 * re-derived. Nothing here derives a clue from the marks, so nothing can drift
 * between what was written and what is read.
 */
describe('the saved board format (v1)', () => {
  const played = () => {
    let session = createDifficultySession('easy', 'loop-puzzle-easy-golden');
    session = doCycle(session, 2)!; // LINE
    session = doSet(session, 0, CROSS)!;
    return doCycle(doCycle(session, 5)!, 5)!; // LINE, then CROSS
  };

  it('writes the digest a save holds beside its clues', () => {
    expect(cluesDigest(played().clues)).toBe('lp1:410b0a80');
  });

  it('writes the marks a save holds', () => {
    expect(encodeMarks(played().marks)).toBe('X.L..X' + '.'.repeat(34));
    expect(decodeMarks('X.L..X' + '.'.repeat(34), 40)).toEqual([...played().marks]);
  });

  it('reads back exactly what it wrote, answer included', () => {
    const session = played();
    const decoded = decodeBoard(
      {
        width: 4,
        height: 4,
        clues: encodeClues(session.clues),
        digest: cluesDigest(session.clues),
        marks: encodeMarks(session.marks),
      },
      PRESETS.easy,
    );
    expect(decoded?.clues).toEqual([...session.clues]);
    expect(decoded?.marks).toEqual([...session.marks]);
    expect(decoded?.solution).toEqual([...session.solution]);
  });
});
