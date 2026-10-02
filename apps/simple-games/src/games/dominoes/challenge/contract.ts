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

/** The score is the axis (club.md §16); other figures are counts no run reaches. */
const MAX_SCORE = 1_000_000_000;
const MAX_COUNT = 1_000_000_000;

export const DOMINOES_CHALLENGE = {
  contractVersion: 1 as const,
  /** The score is the axis — higher is better; the boards differ and that is fine (club.md §16). */
  order: 'score',
  direction: 'desc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    return isRecord(raw) ? {} : null;
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    // A lost or drawn match (`played`) carries the pips but no score of the player's.
    const score = raw.score === undefined ? undefined : count(raw.score, MAX_SCORE);
    const playerPips = count(raw.playerPips, MAX_COUNT);
    const cpuPips = count(raw.cpuPips, MAX_COUNT);
    if (score === null || playerPips === null || cpuPips === null) return null;
    return score === undefined ? { playerPips, cpuPips } : { score, playerPips, cpuPips };
  },
  paramsKey(_params: Record<string, unknown>): string {
    return 'standard';
  },
};
