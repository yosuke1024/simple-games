/**
 * The invariants of §5, checked over the whole generation domain rather than
 * on a handful of samples.
 *
 * This matters more here than in any other title in the collection. Every
 * other game can be looked at: a bad Sudoku board is visibly bad. A question
 * whose answer is negative looks exactly like a question whose answer is not,
 * right up until a player with a keypad that has no minus sign is asked for
 * one — and then the level cannot be finished at all.
 *
 * So: every level, many draws each, every question checked by an independent
 * evaluator that knows nothing about how the question was built.
 */
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, QUESTIONS_PER_LEVEL, specForLevel } from './levels';
import { generateQuestions, questionText } from './questions';
import { createRng } from './rng';
import { questionsForDaily, questionsForLevel } from './session';
import { BLANK, MAX_ANSWER_DIGITS, type Question, type Token } from './types';

/**
 * Evaluates a token run strictly left to right, reporting every intermediate.
 * Deliberately naive: it applies precedence to nothing, which is exactly the
 * rule §5-4 says questions must be built for.
 */
function runSide(tokens: readonly Token[]): { value: number; steps: number[] } {
  const steps: number[] = [];
  let value = tokens[0] as number;
  steps.push(value);
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const term = tokens[i + 1] as number;
    if (op === '+') value += term;
    else if (op === '−') value -= term;
    else if (op === '×') value *= term;
    else if (op === '÷') value = term === 0 ? NaN : value / term;
    steps.push(value);
  }
  return { value, steps };
}

/** Both sides of the equation with `candidate` put in the blank. */
function evaluate(question: Question, candidate: number) {
  const filled = question.tokens.map((token) => (token === BLANK ? candidate : token));
  const split = filled.indexOf('=');
  const left = runSide(filled.slice(0, split));
  const right = runSide(filled.slice(split + 1));
  return { left, right, holds: left.value === right.value };
}

/** Every question the generator can produce for a level, many draws deep. */
function sample(level: number, draws = 200): Question[] {
  // A seed unlike the level's own, so this samples the *domain* rather than
  // re-checking the ten questions the level happens to ship.
  return generateQuestions(createRng(`probe-${level}`), specForLevel(level), draws);
}

function checkInvariants(question: Question, where: string) {
  const label = `${where}: ${questionText(question)} = ${question.answer}`;

  // 1 & 6: a whole number the keypad can express, and never negative.
  expect(Number.isInteger(question.answer), label).toBe(true);
  expect(question.answer, label).toBeGreaterThanOrEqual(0);
  expect(String(question.answer).length, label).toBeLessThanOrEqual(MAX_ANSWER_DIGITS);

  // Exactly one blank, and exactly one equals.
  expect(question.tokens.filter((t) => t === BLANK).length, label).toBe(1);
  expect(
    question.tokens.filter((t) => t === '='),
    label,
  ).toHaveLength(1);

  // The stated answer actually solves it.
  const { left, right, holds } = evaluate(question, question.answer);
  expect(holds, label).toBe(true);

  // 2 & 4: nothing goes negative on the way, on either side.
  for (const step of [...left.steps, ...right.steps]) {
    expect(Number.isInteger(step), label).toBe(true);
    expect(step, label).toBeGreaterThanOrEqual(0);
  }

  // 3: a division that did not divide would have produced a fraction above.
  // Checked again explicitly so the failure message names the reason.
  for (let i = 1; i < question.tokens.length; i += 2) {
    if (question.tokens[i] !== '÷') continue;
    const divisor = question.tokens[i + 1];
    if (typeof divisor === 'number') expect(divisor, label).not.toBe(0);
  }

  // 4: chains never mix in × or ÷.
  if (question.form === 'chain') {
    expect(
      question.tokens.filter((t) => t === '×' || t === '÷'),
      label,
    ).toHaveLength(0);
  }
}

describe('every generated question obeys §5, at every level', () => {
  it('answers are whole, non-negative and at most three digits', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      for (const question of sample(level)) checkInvariants(question, `level ${level}`);
    }
  });

  it('the questions each level actually ships obey them too', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const questions = questionsForLevel(level);
      expect(questions).toHaveLength(QUESTIONS_PER_LEVEL);
      for (const question of questions) checkInvariants(question, `shipped level ${level}`);
    }
  });

  it('the daily obeys them, on any date', () => {
    for (const date of ['2026-01-01', '2026-08-07', '2027-02-28', '2028-02-29']) {
      const questions = questionsForDaily(date);
      expect(questions).toHaveLength(20);
      for (const question of questions) checkInvariants(question, `daily ${date}`);
    }
  });

  it('a missing operand has exactly one solution (§5-5)', () => {
    // Brute force over every value the keypad can enter: if two of them solve
    // the question, the question is broken however reasonable it looks.
    for (let level = 61; level <= 80; level++) {
      for (const question of sample(level, 60)) {
        expect(question.form).toBe('missing');
        const solutions: number[] = [];
        for (let candidate = 0; candidate <= 999; candidate++) {
          if (evaluate(question, candidate).holds) solutions.push(candidate);
        }
        expect(solutions, `${questionText(question)}`).toEqual([question.answer]);
      }
    }
  });

  it('never asks to divide by one — that is not a question', () => {
    for (let level = 41; level <= 60; level++) {
      for (const question of sample(level)) {
        const divisorIndex = question.tokens.indexOf('÷') + 1;
        expect(question.tokens[divisorIndex]).not.toBe(1);
      }
    }
  });
});

describe('the shape of each band (§6)', () => {
  it('holds the times table flat across levels 21 to 30', () => {
    for (let level = 21; level <= 30; level++) {
      for (const question of sample(level, 50)) {
        const [a, op, b] = question.tokens;
        expect(op).toBe('×');
        expect(a as number).toBeLessThanOrEqual(9);
        expect(b as number).toBeLessThanOrEqual(9);
      }
    }
  });

  it('draws only the shapes and signs its band allows', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const spec = specForLevel(level);
      for (const question of sample(level, 40)) {
        expect(spec.forms).toContain(question.form);
        for (const token of question.tokens) {
          if (token === '=' || token === BLANK || typeof token === 'number') continue;
          // A chain is built from + and − whatever the band's signs are (§5-4).
          if (question.form === 'chain') expect(['+', '−']).toContain(token);
          else expect(spec.ops).toContain(token);
        }
      }
    }
  });

  it('brings three-term chains in at level 91 and not before (§6)', () => {
    for (let level = 1; level <= 90; level++) {
      expect(specForLevel(level).forms).not.toContain('chain');
    }
    expect(specForLevel(91).forms).toContain('chain');
    expect(specForLevel(100).forms).toContain('chain');
  });

  it('steps the numbers back down only where the questions step up (§6)', () => {
    // The ladder is allowed to shrink its numbers — it does so at level 71,
    // where × and ÷ join the missing-operand band, and at 91, where chains
    // arrive. What it may never do is make both harder at once, because then
    // one level is two jumps and the player feels a wall rather than a slope.
    for (let level = 2; level <= MAX_LEVEL; level++) {
      const here = specForLevel(level);
      const before = specForLevel(level - 1);
      // Three ways the question itself can get harder: a different kind of
      // arithmetic, more signs to expect, or a new shape of question.
      const askHarder =
        here.track !== before.track ||
        here.ops.length > before.ops.length ||
        here.forms.length > before.forms.length;
      const numbersBigger = here.maxA > before.maxA;

      expect(askHarder && numbersBigger, `level ${level} raises both at once`).toBe(false);
      if (here.maxA < before.maxA) {
        expect(askHarder, `level ${level} shrinks its numbers for no reason`).toBe(true);
      }
    }
  });
});

describe('sets are reproducible and not repetitive', () => {
  it('gives the same level the same ten questions every time', () => {
    expect(questionsForLevel(37)).toEqual(questionsForLevel(37));
    expect(questionsForDaily('2026-08-07')).toEqual(questionsForDaily('2026-08-07'));
  });

  it('gives different levels different sets', () => {
    const seen = new Set<string>();
    for (let level = 1; level <= MAX_LEVEL; level++) {
      seen.add(questionsForLevel(level).map(questionText).join(' | '));
    }
    expect(seen.size).toBe(MAX_LEVEL);
  });

  it('does not repeat a question inside one set', () => {
    // Not guaranteed by the generator — the de-duplication is bounded (§5) —
    // but with the shipped seeds no set should need the escape hatch.
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const texts = questionsForLevel(level).map(questionText);
      expect(new Set(texts).size, `level ${level}`).toBe(texts.length);
    }
    const daily = questionsForDaily('2026-08-07').map(questionText);
    expect(new Set(daily).size).toBe(daily.length);
  });
});
