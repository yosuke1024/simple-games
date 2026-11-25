/**
 * Zero-import leaf, like storage/keys.ts: what the Club House needs to know
 * about this game's results without loading the game (docs/architecture/
 * club.md §6-1). The shape is `GameChallengeContract` in app/registry.ts,
 * written out here rather than imported so the file tows nothing
 * (src/test/importBoundaries.test.ts). Validation never throws: a result the
 * shape does not fit is null, and the Club simply does not list it.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;

/** A count no game reaches (a game ends within 256 placements, so 128 of the player's). */
const MAX_COUNT = 100_000;

const MODES = ['easy', 'normal', 'hard'] as const;
type Mode = (typeof MODES)[number];
const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode);

export const CHAIN_TERRITORY_CHALLENGE = {
  contractVersion: 1 as const,
  /**
   * The player's moves in a won game are the axis — fewer is better. Only a
   * win is sent; a loss is `played` (CHAIN_TERRITORY_RULES「Club House」).
   * One table per CPU strength; the games differ and that is fine (club.md §16).
   */
  order: 'moves',
  direction: 'asc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isMode(raw.difficulty)) return null;
    return { difficulty: raw.difficulty };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const moves = count(raw.moves, MAX_COUNT);
    if (moves === null) return null;
    return { moves };
  },
  paramsKey(params: Record<string, unknown>): string {
    return String(params.difficulty);
  },
};
