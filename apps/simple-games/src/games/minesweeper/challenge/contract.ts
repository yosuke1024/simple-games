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

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];
const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);
/** The largest board is hard, 14 × 18 (game/types.ts PRESETS). */
const MAX_FIRST_INDEX = 14 * 18 - 1;

export const MINESWEEPER_CHALLENGE = {
  contractVersion: 1 as const,
  seedPrefix: 'mines-club-',
  order: 'elapsedSeconds',
  /**
   * The first tap is part of the challenge: the same seed with a different
   * first cell is a different minefield (club.md §6-0), so every player's
   * board opens on this cell with the clock at zero.
   */
  validateParams(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw) || !isDifficulty(raw.difficulty)) return null;
    const firstIndex = count(raw.firstIndex, MAX_FIRST_INDEX);
    if (firstIndex === null) return null;
    return { difficulty: raw.difficulty, firstIndex };
  },
  /** A win carries its time and hints; a loss carries nothing (`{}`), and still counts as played. */
  validateFacts(raw: unknown): Record<string, unknown> | null {
    if (!isRecord(raw)) return null;
    if (raw.elapsedSeconds === undefined && raw.hints === undefined) return {};
    const elapsedSeconds = count(raw.elapsedSeconds, MAX_SECONDS);
    const hints = count(raw.hints, MAX_COUNT);
    if (elapsedSeconds === null || hints === null) return null;
    return { elapsedSeconds, hints };
  },
  paramsKey(params: Record<string, unknown>): string {
    return String(params.difficulty);
  },
};
