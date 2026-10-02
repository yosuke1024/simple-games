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

/** Result-screen figures: a day of seconds, and counts no board reaches. */
const MAX_SECONDS = 86_400;
const MAX_COUNT = 100_000;

const SUIT_COUNTS = [1, 2, 4] as const;
type SuitCount = (typeof SUIT_COUNTS)[number];
const isSuitCount = (value: unknown): value is SuitCount =>
  SUIT_COUNTS.includes(value as SuitCount);

export const SPIDER_SOLITAIRE_CHALLENGE = {
  contractVersion: 1 as const,
  /** Moves are the axis; time and hints are shown, never ranked (club.md §6-1, §16). One table per suit count. */
  order: 'moves',
  direction: 'asc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isSuitCount(raw.suitCount)) return null;
    return { suitCount: raw.suitCount };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const moves = count(raw.moves, MAX_COUNT);
    const elapsedSeconds = count(raw.elapsedSeconds, MAX_SECONDS);
    const hints = count(raw.hints, MAX_COUNT);
    if (moves === null || elapsedSeconds === null || hints === null) return null;
    return { moves, elapsedSeconds, hints };
  },
  paramsKey(params: Record<string, unknown>): string {
    return params.suitCount === 1 ? '1-suit' : `${String(params.suitCount)}-suits`;
  },
};
