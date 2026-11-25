/**
 * Zero-import leaf, like storage/keys.ts: what the Club House needs to know
 * about this game's challenges without loading the game (docs/architecture/
 * club.md §6-1, docs/TANGRAM_RULES.md §14). The shape is
 * `GameChallengeContract` in app/registry.ts, written out here rather than
 * imported so the file tows nothing (src/test/importBoundaries.test.ts).
 * Validation never throws: a challenge or result the shape does not fit is
 * null, and the Club simply does not list it.
 *
 * This game ranks by time alone (club.md §16): the contract names the table
 * (`params`, the tier the figure belongs to) and the one figure the result
 * card shows. The daily is Medium (§6), so its params are a tier like any
 * other; it goes to Today with its date and board digest instead of the
 * Medium table.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;

/** The result card's time: a day of seconds. */
const MAX_SECONDS = 86_400;

const TIERS = ['easy', 'medium', 'hard'] as const;
type Tier = (typeof TIERS)[number];
const isTier = (value: unknown): value is Tier => TIERS.includes(value as Tier);

export const TANGRAM_CHALLENGE = {
  contractVersion: 1 as const,
  /** Time is the axis and the only figure (club.md §6-1). */
  order: 'elapsedSeconds',
  direction: 'asc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isTier(raw.tier)) return null;
    return { tier: raw.tier };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const elapsedSeconds = count(raw.elapsedSeconds, MAX_SECONDS);
    if (elapsedSeconds === null) return null;
    return { elapsedSeconds };
  },
  paramsKey(params: Record<string, unknown>): string {
    return String(params.tier);
  },
};
