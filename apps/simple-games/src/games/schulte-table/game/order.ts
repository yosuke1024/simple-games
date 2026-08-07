/**
 * The tap order — implements docs/SCHULTE_TABLE_RULES.md §5.
 *
 * An order is a permutation of 1..count, but it is never built as an array:
 * both directions are closed-form, so "what comes next" and "has this cell
 * been tapped" are O(1) lookups that allocate nothing. A round asks the second
 * question on every render, once per cell.
 *
 * `targetAt` and `rankOf` are inverses over the whole domain, which is the
 * property the tests pin — get one of the two formulas wrong and a board
 * becomes unfinishable rather than merely odd.
 */
import type { Order } from './types';

/** How many odd values 1..count holds — where `oddThenEven` turns over. */
const oddCount = (count: number): number => Math.ceil(count / 2);

/** The value the player must tap at `index` (0-based) under this order. */
export function targetAt(order: Order, count: number, index: number): number {
  switch (order) {
    case 'descending':
      return count - index;
    case 'oddThenEven': {
      const odds = oddCount(count);
      return index < odds ? 2 * index + 1 : 2 * (index - odds + 1);
    }
    case 'ascending':
    default:
      return index + 1;
  }
}

/** Where `value` sits in this order's sequence (0-based). */
export function rankOf(order: Order, count: number, value: number): number {
  switch (order) {
    case 'descending':
      return count - value;
    case 'oddThenEven':
      return value % 2 === 1 ? (value - 1) / 2 : oddCount(count) + value / 2 - 1;
    case 'ascending':
    default:
      return value - 1;
  }
}

/**
 * The whole sequence, for tests and for the tutorial figure. Play never calls
 * this — it asks `targetAt` for one value at a time.
 */
export function orderSequence(order: Order, count: number): number[] {
  const out: number[] = [];
  for (let index = 0; index < count; index++) out.push(targetAt(order, count, index));
  return out;
}
