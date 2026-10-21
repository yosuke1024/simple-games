/**
 * The counting enumeration of docs/MAKE_THE_TARGET_RULES.md §6「数え方」 —
 * for the generator and the tests only. Nothing on screen calls it: there is
 * no Hint and no "can this still be made?" badge (§5), the barrel
 * (index.ts) does not re-export it, and searchBoundary.test.ts keeps every
 * other layer from importing it.
 *
 * What it counts:
 * - a *value move* is a pair of values from the multiset and an operator.
 *   `+` and `×` do not care about order; `−` and `÷` have one legal order
 *   (the larger on the left, §2). Two tiles with the same value are not told
 *   apart.
 * - a *procedure* is a sequence of n−1 value moves that ends on the target.
 *   `ways` counts them, `waysWithoutDivision` counts the ones that never use
 *   `÷`. Two independent merges in either order are two procedures; two
 *   expressions that give the same sequence of value moves are one.
 *
 * How: a depth-first walk over the multiset of values left (an ascending
 * array, joined as the memo key), memoised per problem. The work is the
 * number of multisets expanded — two or more values, not yet in the memo —
 * and it never exceeds `budget`: the walk stops before an expansion that
 * would take it past `budget` (so a fractional budget acts as its whole
 * part), and reports `capped` with no counts (a count cut short is not an
 * answer).
 */

export type CountResult =
  | {
      readonly capped: false;
      readonly ways: number;
      readonly waysWithoutDivision: number;
      /** Multisets expanded — the work (§6). */
      readonly states: number;
    }
  | { readonly capped: true; readonly states: number };

/** Thrown inside the walk only, and always caught before `countWays` returns. */
const CAPPED: unique symbol = Symbol('capped');

/** The ascending array `rest` with `value` inserted in order. */
function withValue(rest: readonly number[], value: number): number[] {
  const out: number[] = [];
  let placed = false;
  for (const v of rest) {
    if (!placed && value <= v) {
      out.push(value);
      placed = true;
    }
    out.push(v);
  }
  if (!placed) out.push(value);
  return out;
}

/**
 * Counts the procedures that make `target` from `numbers` (§6), spending at
 * most `budget` expansions. A budget below 1, or NaN, counts nothing and
 * reports `capped`.
 */
export function countWays(numbers: readonly number[], target: number, budget: number): CountResult {
  if (!(budget >= 1)) return { capped: true, states: 0 };
  // [ways, waysWithoutDivision] from a multiset, keyed by its ascending values.
  const memo = new Map<string, readonly [number, number]>();
  let states = 0;

  const walk = (values: readonly number[]): readonly [number, number] => {
    if (values.length === 1) return values[0] === target ? [1, 1] : [0, 0];
    const key = values.join(',');
    const known = memo.get(key);
    if (known !== undefined) return known;
    if (states + 1 > budget) throw CAPPED;
    states++;
    let ways = 0;
    let withoutDivision = 0;
    const n = values.length;
    for (let i = 0; i < n; i++) {
      if (i > 0 && values[i] === values[i - 1]) continue;
      for (let j = i + 1; j < n; j++) {
        if (j > i + 1 && values[j] === values[j - 1]) continue;
        const y = values[i]!; // the smaller (ascending order)
        const x = values[j]!;
        const rest = values.filter((_, k) => k !== i && k !== j);
        const add = walk(withValue(rest, x + y));
        ways += add[0];
        withoutDivision += add[1];
        const times = walk(withValue(rest, x * y));
        ways += times[0];
        withoutDivision += times[1];
        if (x > y) {
          const minus = walk(withValue(rest, x - y));
          ways += minus[0];
          withoutDivision += minus[1];
        }
        if (x % y === 0) {
          ways += walk(withValue(rest, x / y))[0];
        }
      }
    }
    const counted = [ways, withoutDivision] as const;
    memo.set(key, counted);
    return counted;
  };

  try {
    const sorted = [...numbers].sort((a, b) => a - b);
    const [ways, waysWithoutDivision] = walk(sorted);
    return { capped: false, ways, waysWithoutDivision, states };
  } catch (error) {
    if (error === CAPPED) return { capped: true, states };
    throw error;
  }
}
