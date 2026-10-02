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

const LAYOUTS = [
  'sprout',
  'steps',
  'terrace',
  'courtyard',
  'pagoda',
  'lantern',
  'bridge',
  'keep',
  'garden',
  'turtle',
] as const;
type Layout = (typeof LAYOUTS)[number];
const isLayout = (value: unknown): value is Layout => LAYOUTS.includes(value as Layout);

export const MAHJONG_SOLITAIRE_CHALLENGE = {
  contractVersion: 1 as const,
  /** Time is the axis; hints is shown, never ranked (club.md §6-1). */
  order: 'elapsedSeconds',
  direction: 'asc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isLayout(raw.layout)) return null;
    return { layout: raw.layout };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const elapsedSeconds = count(raw.elapsedSeconds, MAX_SECONDS);
    const hints = count(raw.hints, MAX_COUNT);
    if (elapsedSeconds === null || hints === null) return null;
    return { elapsedSeconds, hints };
  },
  paramsKey(params: Record<string, unknown>): string {
    return String(params.layout);
  },
};
