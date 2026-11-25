/**
 * Zero-import leaf, like storage/keys.ts: what the Club House needs to know
 * about this game's challenges without loading the game (docs/architecture/
 * club.md §6-1). The shape is `GameChallengeContract` in app/registry.ts,
 * written out here rather than imported so the file tows nothing
 * (src/test/importBoundaries.test.ts). Validation never throws: a challenge or
 * result the shape does not fit is null, and the Club simply does not list it.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;

/** The save's defensive cap on a board's actions (storage/schemas.ts); no real clear comes near it. */
const MAX_MOVES = 100_000;

/** The board sizes of game/index.ts, repeated here so the leaf imports nothing. */
const SIZES = [3, 4, 5] as const;
type Size = (typeof SIZES)[number];
const isSize = (value: unknown): value is Size => SIZES.includes(value as Size);

export const LIGHT_GRID_CHALLENGE = {
  contractVersion: 1 as const,
  /** Moves are the only figure on the clear card (docs/LIGHT_GRID_RULES.md, Club House). One table per board size. */
  order: 'moves',
  direction: 'asc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isSize(raw.size)) return null;
    return { size: raw.size };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const moves = count(raw.moves, MAX_MOVES);
    if (moves === null) return null;
    return { moves };
  },
  paramsKey(params: Record<string, unknown>): string {
    return `${String(params.size)}x${String(params.size)}`;
  },
};
