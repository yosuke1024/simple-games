/**
 * Depth-first solver (docs/WATER_SORT_RULES.md §5, §8).
 *
 * Two callers, one contract:
 * - generation accepts a board only when this search PROVES it solvable (§5),
 * - Hint plays the first move of a found solution, or says honestly that no
 *   way forward was found (§8).
 *
 * The search is exact, not heuristic — a "hint" that guessed could point into
 * a dead end, which is worse than no hint. Guards keep it fast:
 * - the visited set uses the canonical key (tube order collapsed), so the
 *   permutation explosion never happens;
 * - useless pours are never generated: out of a finished tube, a lone-run
 *   relabel into another empty, or a pour that undoes nothing;
 * - a node cap keeps the worst case bounded. A capped search reports
 *   'capped', never 'unsolvable' — the two must not be confused, because
 *   generation retries on either while the Hint wording stays truthful
 *   ("no way forward found") for both.
 */
import { applyPour, canonicalKey, isSolved, isTubeComplete, topColor, topRunLength } from './engine';
import { TUBE_CAPACITY, type Pour, type Tubes } from './types';

/**
 * Comfortable headroom over the hardest shipped boards (§6): observed peaks
 * are thousands of nodes, and the cap only exists so a pathological position
 * ends in 'capped' instead of a stalled device.
 */
export const DEFAULT_NODE_CAP = 120_000;

export type SolveResult =
  | { readonly status: 'solved'; readonly moves: readonly Pour[] }
  | { readonly status: 'unsolvable' }
  | { readonly status: 'capped' };

/** Legal pours worth trying, best-looking first (move ordering). */
function candidatePours(tubes: Tubes): Pour[] {
  const completes: Pour[] = [];
  const merges: Pour[] = [];
  const opens: Pour[] = [];
  const partials: Pour[] = [];

  for (let from = 0; from < tubes.length; from++) {
    const source = tubes[from]!;
    if (source.length === 0 || isTubeComplete(source)) continue;
    const run = topRunLength(source);
    const color = topColor(source)!;
    const wholeTubeIsRun = run === source.length;
    let pouredIntoEmpty = false;

    for (let to = 0; to < tubes.length; to++) {
      if (to === from) continue;
      const dest = tubes[to]!;
      const space = TUBE_CAPACITY - dest.length;
      if (space === 0) continue;

      if (dest.length === 0) {
        // Moving a lone run between empty tubes only renames the board (the
        // canonical key would catch it, but not generating it is cheaper) —
        // and one empty destination is enough, the rest are identical.
        if (wholeTubeIsRun || pouredIntoEmpty) continue;
        pouredIntoEmpty = true;
        opens.push({ from, to });
        continue;
      }
      if (topColor(dest) !== color) continue;

      const pour = { from, to };
      if (run <= space) {
        if (dest.length + run === TUBE_CAPACITY && wholeTubeIsRun) completes.push(pour);
        else merges.push(pour);
      } else {
        partials.push(pour);
      }
    }
  }
  return [...completes, ...merges, ...opens, ...partials];
}

/** Exact search from this position. See the contract above. */
export function solve(tubes: Tubes, nodeCap: number = DEFAULT_NODE_CAP): SolveResult {
  if (isSolved(tubes)) return { status: 'solved', moves: [] };

  const visited = new Set<string>([canonicalKey(tubes)]);
  const path: Pour[] = [];
  let nodes = 0;
  let capped = false;

  const dfs = (current: Tubes): boolean => {
    if (nodes++ >= nodeCap) {
      capped = true;
      return false;
    }
    for (const pour of candidatePours(current)) {
      const result = applyPour(current, pour.from, pour.to);
      if (!result) continue;
      const key = canonicalKey(result.tubes);
      if (visited.has(key)) continue;
      visited.add(key);
      path.push(pour);
      if (isSolved(result.tubes) || dfs(result.tubes)) return true;
      path.pop();
      if (capped) return false;
    }
    return false;
  };

  if (dfs(tubes)) return { status: 'solved', moves: [...path] };
  return capped ? { status: 'capped' } : { status: 'unsolvable' };
}

/**
 * The Hint's move (§8): the first step of a proven solution from here, or
 * null when none was found — the caller words that honestly ("no way forward
 * found"), covering both the proven dead end and the capped search.
 */
export function findWinningPour(tubes: Tubes, nodeCap: number = DEFAULT_NODE_CAP): Pour | null {
  const result = solve(tubes, nodeCap);
  return result.status === 'solved' ? (result.moves[0] ?? null) : null;
}
