/**
 * Zero-import leaf, like storage/keys.ts: what the Club House needs to know
 * about this game's challenges without loading the game (docs/architecture/
 * club.md §6-1, docs/UNBLOCK_PUZZLE_RULES.md §18). The shape is
 * `GameChallengeContract` in app/registry.ts, written out here rather than
 * imported so the file tows nothing (src/test/importBoundaries.test.ts).
 * Validation never throws: a challenge or result the shape does not fit is
 * null, and the Club simply does not list it.
 *
 * Free Play ranks by time alone per difficulty and needs no shared board
 * (club.md §16); the daily — one bundled board for everyone — goes to Today
 * with a board digest instead (game/challenge.ts). The contract names the
 * table (`params`) and the figures the result card shows.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;

/** Result-card figures: a day of seconds, and counts no board reaches. */
const MAX_SECONDS = 86_400;
const MAX_COUNT = 100_000;

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];
const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

export const UNBLOCK_PUZZLE_CHALLENGE = {
  contractVersion: 1 as const,
  /** Time is the axis; moves and hints are shown, never ranked (club.md §6-1). */
  order: 'elapsedSeconds',
  direction: 'asc' as const,
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isDifficulty(raw.difficulty)) return null;
    return { difficulty: raw.difficulty };
  },
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    const elapsedSeconds = count(raw.elapsedSeconds, MAX_SECONDS);
    const moves = count(raw.moves, MAX_COUNT);
    const hints = count(raw.hints, MAX_COUNT);
    if (elapsedSeconds === null || moves === null || hints === null) return null;
    return { elapsedSeconds, moves, hints };
  },
  paramsKey(params: Record<string, unknown>): string {
    return String(params.difficulty);
  },
};
