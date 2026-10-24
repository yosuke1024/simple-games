/**
 * Sets of car-centre positions as sorted, disjoint closed intervals, stored
 * flat ([lo0, hi0, lo1, hi1, …]) — the sets the route sweep and the planner
 * pass along (docs/OVERTAKE_RULES.md §5 "確かめる", §6). Integers only.
 */
export type Intervals = number[];

export function single(lo: number, hi: number): Intervals {
  return lo <= hi ? [lo, hi] : [];
}

export function isEmpty(set: Intervals): boolean {
  return set.length === 0;
}

/** Removes the open interval (a, b): its end points stay (touching is not overlapping, §4). */
export function subtractOpen(set: Intervals, a: number, b: number): Intervals {
  const out: Intervals = [];
  for (let i = 0; i < set.length; i += 2) {
    const lo = set[i]!;
    const hi = set[i + 1]!;
    if (hi <= a || lo >= b) {
      out.push(lo, hi);
      continue;
    }
    if (lo <= a) out.push(lo, a);
    if (hi >= b) out.push(b, hi);
  }
  return out;
}

export function intersect(a: Intervals, b: Intervals): Intervals {
  const out: Intervals = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i]!, b[j]!);
    const hi = Math.min(a[i + 1]!, b[j + 1]!);
    if (lo <= hi) out.push(lo, hi);
    if (a[i + 1]! < b[j + 1]!) i += 2;
    else j += 2;
  }
  return out;
}

/** Appends [lo, hi] to a sorted set, merging with the last interval when they meet. */
function pushMerged(out: Intervals, lo: number, hi: number): void {
  const n = out.length;
  if (n > 0 && lo <= out[n - 1]!) {
    if (hi > out[n - 1]!) out[n - 1] = hi;
    return;
  }
  out.push(lo, hi);
}

/**
 * Every position reachable from `set` by moving at most `reach` sideways
 * without leaving the component of `free` each start point lies in. Points of
 * `set` outside `free` are dropped.
 */
export function expandWithin(set: Intervals, reach: number, free: Intervals): Intervals {
  const out: Intervals = [];
  let j = 0;
  for (let i = 0; i < set.length; i += 2) {
    const lo = set[i]!;
    const hi = set[i + 1]!;
    while (j < free.length && free[j + 1]! < lo) j += 2;
    // An interval of `set` may straddle several components of `free`.
    let k = j;
    while (k < free.length && free[k]! <= hi) {
      const flo = free[k]!;
      const fhi = free[k + 1]!;
      const slo = Math.max(lo, flo);
      const shi = Math.min(hi, fhi);
      if (slo <= shi) pushMerged(out, Math.max(flo, slo - reach), Math.min(fhi, shi + reach));
      k += 2;
    }
  }
  return out;
}

export function contains(set: Intervals, x: number): boolean {
  for (let i = 0; i < set.length; i += 2) {
    if (x < set[i]!) return false;
    if (x <= set[i + 1]!) return true;
  }
  return false;
}

/** The point of a non-empty set nearest to x (ties go to the lower point). */
export function nearest(set: Intervals, x: number): number {
  let best = set[0]!;
  let bestDistance = Math.abs(best - x);
  for (let i = 0; i < set.length; i += 2) {
    const p = Math.min(set[i + 1]!, Math.max(set[i]!, x));
    const d = Math.abs(p - x);
    if (d < bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return best;
}

/** The smallest |a − b| over a ∈ A, b ∈ B (0 when they meet); Infinity when either is empty. */
export function distance(a: Intervals, b: Intervals): number {
  let best = Infinity;
  for (let i = 0; i < a.length; i += 2) {
    for (let j = 0; j < b.length; j += 2) {
      const gap = Math.max(b[j]! - a[i + 1]!, a[i]! - b[j + 1]!, 0);
      if (gap < best) best = gap;
    }
  }
  return best;
}

/** The interval of `set` containing x, or null. */
export function componentOf(set: Intervals, x: number): [number, number] | null {
  for (let i = 0; i < set.length; i += 2) {
    if (x >= set[i]! && x <= set[i + 1]!) return [set[i]!, set[i + 1]!];
  }
  return null;
}
