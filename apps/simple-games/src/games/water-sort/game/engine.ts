/**
 * Board state transitions (docs/WATER_SORT_RULES.md §2, §3).
 *
 * Pure and immutable: a pour returns a new board, or null when the tap does
 * nothing. A pour moves the source's top run onto a matching color or into an
 * empty tube, as much as fits (§3) — pours can dead-end a board, which is why
 * Undo exists and why the solver can say "no way forward" honestly (§8).
 */
import { TUBE_CAPACITY, type Tube, type Tubes } from './types';

export const topColor = (tube: Tube): number | null =>
  tube.length === 0 ? null : tube[tube.length - 1]!;

/** How many units of the top color sit consecutively on top. */
export function topRunLength(tube: Tube): number {
  if (tube.length === 0) return 0;
  const color = tube[tube.length - 1]!;
  let run = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === color; i--) run++;
  return run;
}

/** Full of a single color — this tube is finished (§2). */
export function isTubeComplete(tube: Tube): boolean {
  return tube.length === TUBE_CAPACITY && tube.every((color) => color === tube[0]);
}

/** Every tube is empty or complete: the board is sorted (§2). */
export function isSolved(tubes: Tubes): boolean {
  return tubes.every((tube) => tube.length === 0 || isTubeComplete(tube));
}

/**
 * Whether a pour is legal (§3): different tubes, a non-empty source, room in
 * the destination, and a matching top color unless the destination is empty.
 */
export function canPour(tubes: Tubes, from: number, to: number): boolean {
  if (from === to) return false;
  const source = tubes[from];
  const dest = tubes[to];
  if (!source || !dest) return false;
  if (source.length === 0 || dest.length >= TUBE_CAPACITY) return false;
  return dest.length === 0 || topColor(dest) === topColor(source);
}

export interface PourResult {
  readonly tubes: Tubes;
  /** Units that travelled — a pour moves as much of the run as fits (§3). */
  readonly moved: number;
}

/** Applies a pour. Returns null for an illegal pour, which changes nothing. */
export function applyPour(tubes: Tubes, from: number, to: number): PourResult | null {
  if (!canPour(tubes, from, to)) return null;
  const source = tubes[from]!;
  const dest = tubes[to]!;
  const moved = Math.min(topRunLength(source), TUBE_CAPACITY - dest.length);
  if (moved === 0) return null;

  const color = topColor(source)!;
  const next = tubes.map((tube, index) => {
    if (index === from) return tube.slice(0, tube.length - moved);
    if (index === to) return [...tube, ...new Array<number>(moved).fill(color)];
    return tube;
  });
  return { tubes: next, moved };
}

/**
 * A canonical key for a board. Tubes are interchangeable containers, so two
 * boards that differ only by tube order are the same position — sorting
 * collapses them, which is what keeps the solver's visited set small.
 */
export function canonicalKey(tubes: Tubes): string {
  return tubes
    .map((tube) => tube.map((color) => color.toString(36)).join(''))
    .sort()
    .join('|');
}
