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
 * The score is the axis (club.md §16). The same bound the saved best is held
 * to (storage/schemas.ts, 10⁹) — a count no run reaches.
 */
const MAX_SCORE = 1_000_000_000;

/** The platform width the run was climbed at (docs/BOUNCE_UP_RULES.md §4「幅」). */
const WIDTHS = ['normal', 'wide'] as const;
type Width = (typeof WIDTHS)[number];
const isWidth = (value: unknown): value is Width => WIDTHS.includes(value as Width);

export const BOUNCE_UP_CHALLENGE = {
  contractVersion: 1 as const,
  /**
   * The score is the axis — higher is better; the tower differs on every seed
   * and that is fine (club.md §16). One table per width (BOUNCE_UP_RULES.md
   * §13): Wide is the easier climb, so the two are never ranked together.
   */
  order: 'score',
  direction: 'desc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isWidth(raw.width)) return null;
    return { width: raw.width };
  },
  /** Only the score: the best and the totals are the player's own record, not this run. */
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const score = count(raw.score, MAX_SCORE);
    if (score === null) return null;
    return { score };
  },
  paramsKey(params: Record<string, unknown>): string {
    return String(params.width);
  },
};
