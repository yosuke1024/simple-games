/**
 * Yacht's own persisted records, under the `yt.` prefix declared in ./keys.
 * Isolated from the shared records and from every other game: corruption
 * here can never take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/YACHT_RULES.md §7).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import { CATEGORY_COUNT, DICE_COUNT, FACES, MAX_TOTAL, ROLLS_PER_TURN } from '../game';
import { YT_STORAGE_KEYS } from './keys';

export { YT_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: YT_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

/**
 * One record for the whole game, and no streak (§6). `played` counts games
 * started; `completed` the sheets filled, which are the only ones with a
 * score. A game abandoned for a new one adds its play time and nothing else.
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  completed: number;
  /** The best finished sheet, or null before the first one (§6). */
  bestScore: number | null;
  /** Every finished sheet's total added up: the average's numerator. */
  totalScore: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: YT_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    completed: 0,
    bestScore: null,
    totalScore: 0,
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const completed = asInt(raw.completed, 0, 1e9);
    const bestScore = raw.bestScore === null ? null : asInt(raw.bestScore, 0, MAX_TOTAL);
    const totalScore = asInt(raw.totalScore, 0, 1e12);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (
      played === null ||
      completed === null ||
      (raw.bestScore !== null && bestScore === null) ||
      totalScore === null ||
      totalPlaySeconds === null
    ) {
      return null;
    }
    return { schemaVersion: 1, played, completed, bestScore, totalScore, totalPlaySeconds };
  },
};

// ---------- saved game ----------

/**
 * One slot, holding a game mid-sheet (§7). The turn, the status and the total
 * are not part of it: the sheet says all three (game/session.ts).
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  rollIndex: number;
  /** Five faces, 1..6. */
  dice: number[];
  /** Five flags: which dice the next throw leaves alone. */
  held: boolean[];
  rollsUsed: 0 | 1 | 2 | 3;
  /** Twelve boxes in the sheet's order; null while open. */
  scores: (number | null)[];
  elapsedSeconds: number;
  savedAt: number;
}

/** An array of exactly `length` items, each passing `item`, or null. */
function asArrayOf<T>(
  raw: unknown,
  length: number,
  item: (value: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(raw) || raw.length !== length) return null;
  const out: T[] = [];
  for (const value of raw as unknown[]) {
    const parsed = item(value);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

/** A filled box's points (0..50, the most any box holds), or an open box. */
type BoxValue = { points: number | null };
const asBox = (value: unknown): BoxValue | null => {
  if (value === null) return { points: null };
  const points = asInt(value, 0, 50);
  return points === null ? null : { points };
};

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: YT_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed);
    const rollIndex = asInt(raw.rollIndex, 0, ROLLS_PER_TURN * CATEGORY_COUNT);
    const dice = asArrayOf(raw.dice, DICE_COUNT, (value) => asInt(value, 1, FACES));
    const held = asArrayOf(raw.held, DICE_COUNT, asBool);
    const rollsUsed = asInt(raw.rollsUsed, 0, ROLLS_PER_TURN);
    const boxes = asArrayOf(raw.scores, CATEGORY_COUNT, asBox);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    if (
      seed === null ||
      seed.length === 0 ||
      rollIndex === null ||
      dice === null ||
      held === null ||
      rollsUsed === null ||
      boxes === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }
    return {
      schemaVersion: 1,
      seed,
      rollIndex,
      dice,
      held,
      rollsUsed: rollsUsed as PersistedGame['rollsUsed'],
      scores: boxes.map((box) => box.points),
      elapsedSeconds,
      savedAt,
    };
  },
};
