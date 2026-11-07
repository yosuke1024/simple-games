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

/**
 * The tables a game's contract makes now, for a game whose contract once made
 * others (club.md「Spiderette への切り替え」, 2026-11-07). The server keeps
 * every table it was ever sent, and an older build still sends to its own, but
 * their results were played on another game: this build neither lists nor
 * opens them. A game not here has never retired a table. `titles.test.ts`
 * holds every key of every contract to this.
 */
const CURRENT_KEYS: Readonly<Record<string, (paramsKey: string) => boolean>> = {
  // 52-card Spiderette from 1.8.3; `1-suit` / `2-suits` / `4-suits` are 104-card Spider's.
  'spider-solitaire': (key) => key.startsWith('spiderette-'),
};

/** False for a table whose `paramsKey` the game's contract no longer makes; true otherwise. */
export function isCurrentTable(gameId: string, paramsKey: string): boolean {
  // Own keys only: the id comes from the server, and `__proto__` must not reach a prototype.
  const isCurrent = Object.prototype.hasOwnProperty.call(CURRENT_KEYS, gameId)
    ? CURRENT_KEYS[gameId]
    : undefined;
  return isCurrent ? isCurrent(paramsKey) : true;
}

/** The rows of `rows` whose table this build still makes (`isCurrentTable`), in their order. */
export function currentTables<R extends { gameId: string; paramsKey: string }>(
  rows: readonly R[],
): R[] {
  return rows.filter((row) => isCurrentTable(row.gameId, row.paramsKey));
}

/**
 * False for a board another version of a known game made: the game's contract
 * refuses its params (club.md §6-0, 2026-11-07 — a 104-card Spider daily from
 * 1.8.2). This build does not deal that board, so a result of its own would go
 * to another challenge. True for every other board, a game with no contract
 * here included (whether such a game is listed is the caller's own rule).
 */
export function isCurrentBoard(gameId: string, params: unknown): boolean {
  const contract = contractFor(gameId);
  return contract === null || contract.validateParams(params) !== null;
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
