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

/** Result-screen figures: counts no board reaches. */
const MAX_COUNT = 100_000;

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];
const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

export const HIT_AND_BLOW_CHALLENGE = {
  contractVersion: 1 as const,
  /** The number of guesses is the axis (club.md §6-1, §16). One table per difficulty. */
  order: 'attempts',
  direction: 'asc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isDifficulty(raw.difficulty)) return null;
    return { difficulty: raw.difficulty };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const attempts = count(raw.attempts, MAX_COUNT);
    if (attempts === null) return null;
    return { attempts };
  },
  paramsKey(params: Record<string, unknown>): string {
    return String(params.difficulty);
  },
};
