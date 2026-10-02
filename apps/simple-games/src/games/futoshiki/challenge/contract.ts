/**
 * Zero-import leaf, like storage/keys.ts: what the Club House needs to know
 * about this game's challenges without loading the game (docs/architecture/
 * club.md §6-1). The shape is `GameChallengeContract` in app/registry.ts,
 * written out here rather than imported so the file tows nothing
 * (src/test/importBoundaries.test.ts). Validation never throws: a challenge or
 * result the shape does not fit is null, and the Club simply does not list it.
 *
 * This game ranks by time alone and needs no shared board (club.md §16): the
 * contract names the table (`params`) and the figures the result screen shows.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;

/** Result-screen figures: a day of seconds, and counts no board reaches. */
const MAX_SECONDS = 86_400;
const MAX_COUNT = 100_000;

const SIZES = [4, 5, 6, 7] as const;
type Size = (typeof SIZES)[number];
const isSize = (value: unknown): value is Size => SIZES.includes(value as Size);

export const FUTOSHIKI_CHALLENGE = {
  contractVersion: 1 as const,
  /** Time is the axis; mistakes and hints are shown, never ranked (club.md §6-1). */
  order: 'elapsedSeconds',
  direction: 'asc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isSize(raw.size)) return null;
    return { size: raw.size };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const elapsedSeconds = count(raw.elapsedSeconds, MAX_SECONDS);
    const mistakes = count(raw.mistakes, MAX_COUNT);
    const hints = count(raw.hints, MAX_COUNT);
    if (elapsedSeconds === null || mistakes === null || hints === null) return null;
    return { elapsedSeconds, mistakes, hints };
  },
  paramsKey(params: Record<string, unknown>): string {
    return `${params.size}x${params.size}`;
  },
};
