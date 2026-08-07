/**
 * Question generation — implements docs/QUICK_MATH_RULES.md §5.
 *
 * Every question is *built* to satisfy the invariants rather than generated
 * and then checked: a subtraction is drawn from a pair that cannot go
 * negative, a division is drawn from the product it divides, and a missing
 * operand is drawn last from the two terms that pin it. Nothing is rejected
 * and redrawn, so no shape of question is quietly rarer than another, and
 * there is no loop that could fail to terminate on a bad band.
 *
 * The player's keypad has ten digits and no minus sign and no point. That is
 * not a limitation this file works around — it is the same decision, seen from
 * the other side (§3).
 */
import type { LevelSpec } from './levels';
import { BLANK, type Operator, type Question, type QuestionForm, type Token } from './types';

/** An integer in [min, max], inclusive. */
function pick(rng: () => number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pickOne<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)] ?? values[0]!;
}

/**
 * `a ∘ b = ?`.
 *
 * Subtraction picks its right-hand term no larger than its left, and division
 * builds the dividend from the divisor and the answer, so §5's invariants 2
 * and 3 hold by construction.
 */
function binary(rng: () => number, op: Operator, maxA: number, maxB: number): Question {
  let a: number;
  let b: number;
  let answer: number;

  switch (op) {
    case '+':
      a = pick(rng, 1, maxA);
      b = pick(rng, 1, maxB);
      answer = a + b;
      break;
    case '−':
      a = pick(rng, 1, maxA);
      // Never more than there is to take away.
      b = pick(rng, 1, Math.min(maxB, a));
      answer = a - b;
      break;
    case '×':
      a = pick(rng, 1, maxA);
      b = pick(rng, 1, maxB);
      answer = a * b;
      break;
    case '÷':
    default:
      // Built from the answer out, so it always divides exactly. The divisor
      // starts at 2: "n ÷ 1" is not a question.
      b = pick(rng, 2, Math.max(2, maxB));
      answer = pick(rng, 1, maxA);
      a = b * answer;
      break;
  }

  return { form: 'binary', tokens: [a, op, b, '=', BLANK], answer };
}

/**
 * `a ∘ ? = c`, where the blank is the right-hand term.
 *
 * The solution is unique for all four signs, because `a` and `c` are both
 * fixed: `? = c − a`, `a − c`, `c ÷ a` and `a ÷ c` respectively (§5-5). The
 * degenerate left-hand terms are excluded — `1 × ? = c` and `a ÷ ? = 0` would
 * both be questions with nothing in them.
 */
function missing(rng: () => number, op: Operator, maxA: number, maxB: number): Question {
  let a: number;
  let c: number;
  let answer: number;

  switch (op) {
    case '+':
      a = pick(rng, 1, maxA);
      answer = pick(rng, 1, maxB);
      c = a + answer;
      break;
    case '−':
      a = pick(rng, 2, Math.max(2, maxA));
      answer = pick(rng, 1, Math.min(maxB, a));
      c = a - answer;
      break;
    case '×':
      a = pick(rng, 2, Math.max(2, maxA));
      answer = pick(rng, 1, maxB);
      c = a * answer;
      break;
    case '÷':
    default:
      answer = pick(rng, 2, Math.max(2, maxB));
      c = pick(rng, 1, maxA);
      a = answer * c;
      break;
  }

  return { form: 'missing', tokens: [a, op, BLANK, '=', c], answer };
}

/**
 * `a ∘ b ∘ c = ?`, evaluated strictly left to right.
 *
 * Only `+` and `−` appear (§5-4): mixing in `×` or `÷` would turn the question
 * into "do you know the precedence rules", which is a different thing to ask
 * than "can you do the arithmetic". Every intermediate result is kept at zero
 * or above by taking away no more than there is.
 */
function chain(rng: () => number, maxA: number, maxB: number): Question {
  let value = pick(rng, 1, maxA);
  const tokens: Token[] = [value];

  for (let step = 0; step < 2; step++) {
    // With nothing left to take away, the only honest move is to add.
    const op: Operator = value === 0 ? '+' : pickOne(rng, ['+', '−'] as const);
    const term = op === '+' ? pick(rng, 1, maxB) : pick(rng, 1, Math.min(maxB, value));
    value = op === '+' ? value + term : value - term;
    tokens.push(op, term);
  }

  tokens.push('=', BLANK);
  return { form: 'chain', tokens, answer: value };
}

function build(rng: () => number, form: QuestionForm, spec: LevelSpec): Question {
  const op = pickOne(rng, spec.ops);
  if (form === 'chain') return chain(rng, spec.maxA, spec.maxB);
  if (form === 'missing') return missing(rng, op, spec.maxA, spec.maxB);
  return binary(rng, op, spec.maxA, spec.maxB);
}

/** The question as it reads on screen — the identity used for de-duplication. */
export function questionText(question: Question): string {
  return question.tokens.join(' ');
}

/**
 * How many attempts are made to avoid repeating a question inside one set.
 *
 * Bounded rather than looping until success: the early bands hold only a few
 * hundred distinct questions, so a set can legitimately run out of fresh ones,
 * and a repeat is a far smaller problem than a generator that never returns.
 */
const DEDUPE_ATTEMPTS = 20;

/**
 * One set of questions, deterministic per seed.
 *
 * Repeats inside a set are avoided where they can be. At level 1 the whole
 * space is small enough that ten draws would otherwise show the same sum twice
 * more often than not, and a level that asks `3 + 4` three times reads as a
 * bug whether or not it is one.
 */
export function generateQuestions(rng: () => number, spec: LevelSpec, count: number): Question[] {
  const questions: Question[] = [];
  const seen = new Set<string>();

  for (let n = 0; n < count; n++) {
    let question = build(rng, pickOne(rng, spec.forms), spec);
    for (
      let attempt = 1;
      attempt < DEDUPE_ATTEMPTS && seen.has(questionText(question));
      attempt++
    ) {
      question = build(rng, pickOne(rng, spec.forms), spec);
    }
    seen.add(questionText(question));
    questions.push(question);
  }

  return questions;
}
