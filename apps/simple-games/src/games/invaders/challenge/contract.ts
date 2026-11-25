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

const between = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;

/**
 * The score is the axis (club.md §16). The bound is the saved score's own cap
 * (storage/schemas.ts SCORE_CAP): today's twenty stages top out at 10,960, but
 * a run begun on the published v1 build — twenty full blocks of 700 — is
 * resumed as it was and can honestly reach 14,000 (docs/INVADERS_RULES.md §3,
 * §7). Written as numbers because this file imports nothing; the test holds
 * them to the game's. Rows already stored are read back through here, so the
 * bounds may widen but never shrink.
 */
const MAX_SCORE = 14_000;
/** The stage the run reached, 1 to the last of the twenty (game STAGE_COUNT). */
const MAX_STAGE = 20;

export const INVADERS_CHALLENGE = {
  contractVersion: 1 as const,
  /**
   * The score is the axis — higher is better. One table with no mode: every
   * run flies the same twenty stages (INVADERS_RULES.md §1), and the table
   * ranks the score, not the board (club.md §16).
   */
  order: 'score',
  direction: 'desc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    return isRecord(raw) ? {} : null;
  },
  /** The card's two figures: the score and the stage the run reached (INVADERS_RULES.md §8). */
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const score = between(raw.score, 0, MAX_SCORE);
    const stage = between(raw.stage, 1, MAX_STAGE);
    if (score === null || stage === null) return null;
    return { score, stage };
  },
  paramsKey(_params: Record<string, unknown>): string {
    return 'standard';
  },
};
