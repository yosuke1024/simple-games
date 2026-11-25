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
 * The most a round could ever score: 30 swaps, each at most 64 stages of at
 * most 64 cells — `MAX_ROUND_SCORE` in game/records.ts (docs/GEM_SWAP_RULES.md
 * §5, §7). Written as a literal because this file imports nothing;
 * contract.test.ts holds it equal to the game's constant.
 */
const MAX_SCORE = 122_880;

/** The gem counts the home offers: 5 = Easy, 6 = Normal (docs/GEM_SWAP_RULES.md §2). */
const COLOR_COUNTS = [5, 6] as const;
type ColorCount = (typeof COLOR_COUNTS)[number];
const isColorCount = (value: unknown): value is ColorCount =>
  COLOR_COUNTS.includes(value as ColorCount);

export const GEM_SWAP_CHALLENGE = {
  contractVersion: 1 as const,
  /**
   * The score is the axis — higher is better; the boards differ from seed to
   * seed and that is fine (club.md §16). One table per gem count
   * (docs/GEM_SWAP_RULES.md §16).
   */
  order: 'score',
  direction: 'desc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isColorCount(raw.colors)) return null;
    return { colors: raw.colors };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const score = count(raw.score, MAX_SCORE);
    if (score === null) return null;
    return { score };
  },
  /** The words the home's switch puts beside the count: 5 · Easy, 6 · Normal. */
  paramsKey(params: Record<string, unknown>): string {
    return params.colors === 5 ? 'easy' : 'normal';
  },
};
