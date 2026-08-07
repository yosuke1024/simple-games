/**
 * Golden question sets. These literals pin released behaviour: a player's
 * fastest time for level 37 is a time against *those ten questions*, and a
 * record standing against a set that no longer exists is a lie the app tells
 * quietly. The saved-game record makes it sharper still — it stores a seed and
 * a question index, so a generator that drifts would resume somebody onto a
 * different question than the one they left.
 *
 * If this test is red, either a migration plan exists and this file changes in
 * the same commit, or the generator has drifted. Do not "fix" the expectation
 * to make it pass.
 */
import { describe, expect, it } from 'vitest';
import { questionText } from './questions';
import { questionsForDaily, questionsForLevel } from './session';

/** `tokens = answer`, which is the whole question in one readable string. */
const spell = (level: number): string[] =>
  questionsForLevel(level).map((q) => `${questionText(q)} = ${q.answer}`);

describe('generated questions never drift (docs/QUICK_MATH_RULES.md §5, §6)', () => {
  it('pins the first level of each band', () => {
    expect(spell(1)).toEqual([
      '6 − 4 = ? = 2',
      '9 − 2 = ? = 7',
      '6 − 1 = ? = 5',
      '3 + 2 = ? = 5',
      '8 + 3 = ? = 11',
      '5 + 2 = ? = 7',
      '3 + 3 = ? = 6',
      '2 + 1 = ? = 3',
      '7 + 2 = ? = 9',
      '3 + 4 = ? = 7',
    ]);
    expect(spell(21)).toEqual([
      '5 × 6 = ? = 30',
      '2 × 5 = ? = 10',
      '2 × 3 = ? = 6',
      '8 × 2 = ? = 16',
      '3 × 7 = ? = 21',
      '5 × 5 = ? = 25',
      '2 × 6 = ? = 12',
      '6 × 6 = ? = 36',
      '4 × 3 = ? = 12',
      '9 × 4 = ? = 36',
    ]);
    expect(spell(41)).toEqual([
      '18 ÷ 9 = ? = 2',
      '24 ÷ 8 = ? = 3',
      '48 ÷ 6 = ? = 8',
      '28 ÷ 7 = ? = 4',
      '63 ÷ 7 = ? = 9',
      '32 ÷ 8 = ? = 4',
      '4 ÷ 2 = ? = 2',
      '56 ÷ 8 = ? = 7',
      '16 ÷ 2 = ? = 8',
      '6 ÷ 3 = ? = 2',
    ]);
    expect(spell(61)).toEqual([
      '5 − ? = 2 = 3',
      '11 − ? = 6 = 5',
      '9 + ? = 14 = 5',
      '10 + ? = 12 = 2',
      '3 + ? = 7 = 4',
      '9 − ? = 6 = 3',
      '3 + ? = 4 = 1',
      '2 + ? = 3 = 1',
      '11 + ? = 14 = 3',
      '4 − ? = 2 = 2',
    ]);
    expect(spell(91)).toEqual([
      '20 + 1 − 3 = ? = 18',
      '18 − 4 − 3 = ? = 11',
      '17 + 2 = ? = 19',
      '3 + 2 + 1 = ? = 6',
      '6 − 3 − 3 = ? = 0',
      '20 + 3 − 2 = ? = 21',
      '15 + 2 − 3 = ? = 14',
      '17 − 1 = ? = 16',
      '12 + 1 + 1 = ? = 14',
      '11 + 2 − 5 = ? = 8',
    ]);
  });

  it('pins a daily set', () => {
    expect(questionsForDaily('2026-08-07').map((q) => `${questionText(q)} = ${q.answer}`)).toEqual([
      '14 ÷ ? = 2 = 7',
      '11 + ? = 14 = 3',
      '22 × ? = 154 = 7',
      '26 × 7 = ? = 182',
      '17 × 4 = ? = 68',
      '42 ÷ 7 = ? = 6',
      '16 − 8 = ? = 8',
      '11 + ? = 12 = 1',
      '2 × 3 = ? = 6',
      '176 ÷ ? = 22 = 8',
      '27 × ? = 108 = 4',
      '2 − 1 = ? = 1',
      '9 + 3 = ? = 12',
      '29 + 3 = ? = 32',
      '29 − ? = 24 = 5',
      '8 − ? = 0 = 8',
      '20 + ? = 22 = 2',
      '15 × ? = 75 = 5',
      '13 × ? = 52 = 4',
      '30 + 6 = ? = 36',
    ]);
  });

  it('keeps the opening bands free of questions that ask nothing', () => {
    // The floors of §5 exist because the first draft did not have them: the
    // opening division level answered 1 to three of its ten questions
    // (`9 ÷ 9`, `2 ÷ 2`, `3 ÷ 3`), and the times-table level asked `1 × 3`.
    for (let level = 21; level <= 40; level++) {
      for (const q of questionsForLevel(level)) {
        expect(q.tokens[0], `level ${level}`).not.toBe(1);
        expect(q.tokens[2], `level ${level}`).not.toBe(1);
      }
    }
    for (let level = 41; level <= 60; level++) {
      for (const q of questionsForLevel(level)) {
        expect(q.answer, `level ${level}`).toBeGreaterThan(1);
        expect(q.tokens[2], `level ${level}`).not.toBe(1);
      }
    }
  });
});
