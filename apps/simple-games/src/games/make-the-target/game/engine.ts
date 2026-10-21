/**
 * The rules of docs/MAKE_THE_TARGET_RULES.md §1–§2: which moves are legal,
 * what a move does to the slots, and how a finished board stands. Pure
 * functions over plain arrays; the session (session.ts) and the restore path
 * (restore.ts) both go through `isLegalMove`, the one place that says what
 * a move may be — the slot conditions included, because a keyboard or a
 * stored move string can name any slot (§2, §10).
 */
import type { Move, Operator, Slots } from './types';

/** What the board draws for each stored operator (§1). Not translated. */
export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

/**
 * `x op y`, or null when the rules refuse it (§2): every intermediate value
 * is a whole number of at least 1. `−` needs x > y (no 0, no negative), `÷`
 * needs y to divide x (no fraction). `+` and `×` are always legal, and so are
 * `×1`, `÷1` and `x ÷ x`. The order is the order the tiles were chosen in.
 */
export function applyOperator(op: Operator, x: number, y: number): number | null {
  switch (op) {
    case '+':
      return x + y;
    case '-':
      return x > y ? x - y : null;
    case '*':
      return x * y;
    case '/':
      return x % y === 0 ? x / y : null;
  }
}

/** The slots as dealt (§1): the numbers in ascending order, slot 0 first. */
export function initialSlots(numbers: readonly number[]): (number | null)[] {
  return [...numbers].sort((a, b) => a - b);
}

const holdsNumber = (slots: Slots, slot: number): boolean =>
  Number.isInteger(slot) && slot >= 0 && slot < slots.length && slots[slot] !== null;

/**
 * Whether `move` is legal on `slots` (§2): two different slots, both on the
 * board and both holding a number, and an operator whose result the rules
 * allow.
 */
export function isLegalMove(slots: Slots, move: Move): boolean {
  if (move.left === move.right) return false;
  if (!holdsNumber(slots, move.left) || !holdsNumber(slots, move.right)) return false;
  return applyOperator(move.op, slots[move.left]!, slots[move.right]!) !== null;
}

/**
 * The slots after `move` (§1): the result in the right term's slot, the left
 * term's slot empty, nothing else moved. Null when the move is not legal.
 */
export function applyMove(slots: Slots, move: Move): (number | null)[] | null {
  if (!isLegalMove(slots, move)) return null;
  const next = [...slots];
  next[move.right] = applyOperator(move.op, slots[move.left]!, slots[move.right]!);
  next[move.left] = null;
  return next;
}

/** One line of the expression list (§4): `left op right = result`, as values. */
export interface Expression {
  readonly left: number;
  readonly op: Operator;
  readonly right: number;
  readonly result: number;
}

/**
 * Plays `moves` from the dealt numbers (§10): the slots at the end and one
 * expression per move. Null as soon as a move is not legal where it is
 * played. The work is one step per move — at most n−1.
 */
export function replay(
  numbers: readonly number[],
  moves: readonly Move[],
): { slots: (number | null)[]; expressions: Expression[] } | null {
  let slots = initialSlots(numbers);
  const expressions: Expression[] = [];
  for (const move of moves) {
    const next = applyMove(slots, move);
    if (next === null) return null;
    expressions.push({
      left: slots[move.left]!,
      op: move.op,
      right: slots[move.right]!,
      result: next[move.right]!,
    });
    slots = next;
  }
  return { slots, expressions };
}

/** How many numbers are still on the board. */
export function tileCount(slots: Slots): number {
  return slots.reduce<number>((count, value) => (value === null ? count : count + 1), 0);
}

/**
 * How the board stands (§2): `playing` while two or more numbers are left;
 * with one left, `solved` when it equals the target and `missed` when it
 * does not. A number equal to the target while others remain is nothing.
 */
export function outcomeOf(slots: Slots, target: number): 'playing' | 'missed' | 'solved' {
  if (tileCount(slots) > 1) return 'playing';
  const last = slots.find((value) => value !== null);
  return last === target ? 'solved' : 'missed';
}

/** The number left on a finished board, or null while two or more remain. */
export function lastNumber(slots: Slots): number | null {
  if (tileCount(slots) !== 1) return null;
  return slots.find((value) => value !== null) ?? null;
}
