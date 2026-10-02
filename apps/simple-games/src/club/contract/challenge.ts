/**
 * The game-side challenge contract seen through the registry (club.md §6-1,
 * §6-2). The Club layer never imports a game: it reaches each contract leaf
 * only through `GAMES`.
 */
import { GAMES, type GameChallengeContract } from '@/app/registry';
import type { Result } from '../api/types';

export function contractFor(gameId: string): GameChallengeContract | null {
  return GAMES.find((g) => g.id === gameId)?.challenge ?? null;
}

export function gameTitle(gameId: string): string | null {
  return GAMES.find((g) => g.id === gameId)?.title ?? null;
}

export interface RankedResult {
  result: Result;
  rank: number | null;
  value: number | null;
}

/**
 * Completed results first, ascending by the contract's `order` (ties keep
 * submission order and still get successive ranks); `played` last in
 * submission order with no rank (club.md §6-1). A result whose facts fail the
 * contract goes to the end, unranked.
 */
/** `GET /challenges/:id/results` sends at most this many best rows (server limits.resultsPage). */
export const RESULTS_PAGE = 200;

export function rankResults(
  contract: GameChallengeContract | null,
  results: readonly Result[],
): RankedResult[] {
  const ranked: { result: Result; value: number; index: number }[] = [];
  const rest: RankedResult[] = [];
  results.forEach((result, index) => {
    let value: number | null = null;
    if (contract !== null && result.outcome === 'completed') {
      const facts = contract.validateFacts(result.facts);
      const axis = facts?.[contract.order];
      if (typeof axis === 'number') value = axis;
    }
    if (value === null) {
      rest.push({ result, rank: null, value: null });
    } else {
      ranked.push({ result, value, index });
    }
  });
  // The contract's direction decides which end is best; ties stay in arrival order.
  const sign = contract?.direction === 'desc' ? -1 : 1;
  ranked.sort((a, b) => sign * (a.value - b.value) || a.index - b.index);
  // The server sends the best RESULTS_PAGE and then the asker's own row when
  // it is not among them; that row's place is somewhere below, not right
  // after, so it carries no number.
  const top = ranked.map((r, i) => ({
    result: r.result,
    rank: i < RESULTS_PAGE ? i + 1 : null,
    value: r.value,
  }));
  // `played` results, then unreadable completed ones, each in submission order.
  const played = rest.filter((r) => r.result.outcome === 'played');
  const other = rest.filter((r) => r.result.outcome !== 'played');
  return [...top, ...played, ...other];
}
