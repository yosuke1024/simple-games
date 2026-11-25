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

/**
 * One point per food, so the highest score is the board filled:
 * `MAX_SCORE = CELL_COUNT − INITIAL_LENGTH` = 14 × 14 − 3 in game/types.ts
 * (docs/SNAKE_RULES.md §4, §7). Written as a literal because this file imports
 * nothing; contract.test.ts holds it equal to the game's constant.
 */
const MAX_SCORE = 193;

const SPEEDS = ['slow', 'normal', 'fast'] as const;
type Speed = (typeof SPEEDS)[number];
const isSpeed = (value: unknown): value is Speed => SPEEDS.includes(value as Speed);

export const SNAKE_CHALLENGE = {
  contractVersion: 1 as const,
  /**
   * The score is the axis — higher is better; the food falls differently on
   * every seed and that is fine (club.md §16). One table per speed (§7).
   */
  order: 'score',
  direction: 'desc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isSpeed(raw.speed)) return null;
    return { speed: raw.speed };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const score = count(raw.score, MAX_SCORE);
    if (score === null) return null;
    return { score };
  },
  paramsKey(params: Record<string, unknown>): string {
    return String(params.speed);
  },
};
