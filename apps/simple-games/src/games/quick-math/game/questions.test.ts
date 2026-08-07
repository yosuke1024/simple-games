/**
 * The invariants of §5, checked by broad deterministic sampling across every
 * level — 200 draws each — rather than on a handful of examples.
 *
 * **It is sampling, not a proof.** What makes the invariants hold is that
 * questions.ts *builds* questions that satisfy them rather than generating and
 * filtering; this file is the check that the construction actually does what
 * it claims, across the operand ranges every band reaches. Do not read a green
 * run here as "no such question can exist".
 *
 * It matters more here than in any other title in the collection. Every other
 * game can be looked at: a bad Sudoku board is visibly bad. A question whose
 * answer is negative looks exactly like a question whose answer is not, right
 * up until a player with a keypad that has no minus sign is asked for one —
 * and then the level cannot be finished at all.
 *
 * Every sweep below collects findings and asserts once, for the reason given
 * on `violationsOf`.
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

/**
 * Every way `question` breaks §5, as plain strings.
 *
 * It returns findings rather than calling `expect` per check, and that is a
 * requirement rather than a style: the sweep below covers 100 levels x 200
 * draws, and one `expect` per invariant per question is 200,000 assertion
 * contexts — enough to blow Vitest's five-second default on a CI runner while
 * passing locally, which is exactly what happened. Plain comparisons cost
 * nothing, the caller asserts once, and a failure now lists *every* violation
 * instead of stopping at the first.
 */
function violationsOf(question: Question, where: string): string[] {
  const found: string[] = [];
  const label = `${where}: ${questionText(question)} = ${question.answer}`;
  const fail = (why: string) => found.push(`${label} — ${why}`);

  // 1 & 6: a whole number the keypad can express, and never negative.
  if (!Number.isInteger(question.answer)) fail('answer is not a whole number');
  if (question.answer < 0) fail('answer is negative');
  if (String(question.answer).length > MAX_ANSWER_DIGITS) fail('answer is over three digits');

  // Exactly one blank, and exactly one equals.
  if (question.tokens.filter((t) => t === BLANK).length !== 1) fail('not exactly one blank');
  if (question.tokens.filter((t) => t === '=').length !== 1) fail('not exactly one equals');

  // The stated answer actually solves it.
  const { left, right, holds } = evaluate(question, question.answer);
  if (!holds) fail('the stated answer does not solve it');

  // 2 & 4: nothing goes negative on the way, on either side.
  for (const step of [...left.steps, ...right.steps]) {
    if (!Number.isInteger(step)) fail(`an intermediate result is not whole (${step})`);
    else if (step < 0) fail(`an intermediate result is negative (${step})`);
  }

  // 3: a division that did not divide would have produced a fraction above.
  // Checked again explicitly so the failure message names the reason.
  for (let i = 1; i < question.tokens.length; i += 2) {
    if (question.tokens[i] === '÷' && question.tokens[i + 1] === 0) fail('divides by zero');
  }

  // 4: chains never mix in × or ÷.
  if (question.form === 'chain' && question.tokens.some((t) => t === '×' || t === '÷')) {
    fail('a chain mixes in × or ÷');
  }

  return found;
}

describe('every generated question obeys §5, at every level', () => {
  it('answers are whole, non-negative and at most three digits', () => {
    const violations: string[] = [];
    for (let level = 1; level <= MAX_LEVEL; level++) {
      for (const question of sample(level)) {
        violations.push(...violationsOf(question, `level ${level}`));
      }
    }
    expect(violations).toEqual([]);
  });

  it('the questions each level actually ships obey them too', () => {
    const violations: string[] = [];
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const questions = questionsForLevel(level);
      expect(questions).toHaveLength(QUESTIONS_PER_LEVEL);
      for (const question of questions) {
        violations.push(...violationsOf(question, `shipped level ${level}`));
      }
    }
    expect(violations).toEqual([]);
  });

  it('the daily obeys them, on any date', () => {
    const violations: string[] = [];
    for (const date of ['2026-01-01', '2026-08-07', '2027-02-28', '2028-02-29']) {
      const questions = questionsForDaily(date);
      expect(questions).toHaveLength(20);
      for (const question of questions) {
        violations.push(...violationsOf(question, `daily ${date}`));
      }
    }
    expect(violations).toEqual([]);
  });

  it('a missing operand has exactly one solution (§5-5)', () => {
    // Brute force over every value the keypad can enter: if two of them solve
    // the question, the question is broken however reasonable it looks.
    //
    // The scan runs on the tokens directly instead of through `evaluate`,
    // because a thousand candidates per question times twelve hundred
    // questions is a million evaluations — cheap as arithmetic, expensive as
    // array slicing.
    const apply = (a: number, op: Token, x: number): number => {
      if (op === '+') return a + x;
      if (op === '−') return a - x;
      if (op === '×') return a * x;
      return x === 0 ? NaN : a / x;
    };

    const violations: string[] = [];
    for (let level = 61; level <= 80; level++) {
      for (const question of sample(level, 60)) {
        if (question.form !== 'missing') {
          violations.push(`level ${level}: ${questionText(question)} is not a missing form`);
          continue;
        }
        const [a, op, , , c] = question.tokens as [number, Token, Token, Token, number];
        const solutions: number[] = [];
        for (let candidate = 0; candidate <= 999; candidate++) {
          if (apply(a, op, candidate) === c) solutions.push(candidate);
        }
        if (solutions.length !== 1 || solutions[0] !== question.answer) {
          violations.push(
            `${questionText(question)} = ${question.answer} — solved by [${solutions.join(', ')}]`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('never asks to divide by one or by itself — neither is a question', () => {
    const violations: string[] = [];
    for (let level = 41; level <= 60; level++) {
      for (const question of sample(level)) {
        const divisor = question.tokens[question.tokens.indexOf('÷') + 1];
        if (divisor === 1) violations.push(`level ${level}: ${questionText(question)} divides by 1`);
        if (question.answer <= 1) {
          violations.push(`level ${level}: ${questionText(question)} answers ${question.answer}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('the shape of each band (§6)', () => {
  it('holds the times table flat across levels 21 to 30', () => {
    const violations: string[] = [];
    for (let level = 21; level <= 30; level++) {
      for (const question of sample(level, 50)) {
        const [a, op, b] = question.tokens as [number, Token, number];
        // The times table is 2 to 9 in both directions (§5-7).
        if (op !== '×' || a < 2 || a > 9 || b < 2 || b > 9) {
          violations.push(`level ${level}: ${questionText(question)}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('draws only the shapes and signs its band allows', () => {
    const violations: string[] = [];
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const spec = specForLevel(level);
      for (const question of sample(level, 40)) {
        if (!spec.forms.includes(question.form)) {
          violations.push(`level ${level}: ${questionText(question)} is a ${question.form}`);
        }
        for (const token of question.tokens) {
          if (token === '=' || token === BLANK || typeof token === 'number') continue;
          // A chain is built from + and − whatever the band's signs are (§5-4).
          const allowed =
            question.form === 'chain' ? (['+', '−'] as readonly Token[]) : spec.ops;
          if (!allowed.includes(token)) {
            violations.push(`level ${level}: ${questionText(question)} uses ${token}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
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
