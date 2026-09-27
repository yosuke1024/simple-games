/**
 * Yacht's own persisted records, under the `yt.` prefix declared in ./keys.
 * Isolated from the shared records and from every other game: corruption
 * here can never take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/YACHT_RULES.md §8).
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
 * One record for the whole match, and no streak (§7). `played` counts
 * matches started; `completed` the sheets filled, which are the only ones
 * with a score — and the only ones a result (`wins` / `losses` / `draws`)
 * can come from. A match abandoned for a new one adds its play time and
 * nothing else.
 *
 * v1 → v2: Yacht was a solitaire score attack before the CPU (play-test
 * feedback, 2026-09-27); a v1 record's finished sheets have no opponent to
 * have won or lost against, so they migrate with `wins` / `losses` / `draws`
 * at 0 — their `completed`, `totalScore` and `bestScore` still count, so the
 * average and the best survive, but `completed` can then run ahead of
 * `wins + losses + draws` for a record that carries migrated v1 games (§7).
 */
export interface Stats {
  schemaVersion: 2;
  played: number;
  completed: number;
  /** The best finished sheet, or null before the first one (§7). */
  bestScore: number | null;
  /** Every finished sheet's total added up: the average's numerator. */
  totalScore: number;
  totalPlaySeconds: number;
  wins: number;
  losses: number;
  draws: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: YT_STORAGE_KEYS.stats,
  version: 2,
  defaultValue: () => ({
    schemaVersion: 2,
    played: 0,
    completed: 0,
    bestScore: null,
    totalScore: 0,
    totalPlaySeconds: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    if (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) return null;
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
    // v1 predates the CPU: none of its finished sheets has a result (§7).
    if (raw.schemaVersion === 1) {
      return {
        schemaVersion: 2,
        played,
        completed,
        bestScore,
        totalScore,
        totalPlaySeconds,
        wins: 0,
        losses: 0,
        draws: 0,
      };
    }
    const wins = asInt(raw.wins, 0, 1e9);
    const losses = asInt(raw.losses, 0, 1e9);
    const draws = asInt(raw.draws, 0, 1e9);
    if (wins === null || losses === null || draws === null) return null;
    return {
      schemaVersion: 2,
      played,
      completed,
      bestScore,
      totalScore,
      totalPlaySeconds,
      wins,
      losses,
      draws,
    };
  },
};

// ---------- saved game ----------

/**
 * One slot, holding a match mid-sheet (§8). Both sheets are part of it; whose
 * turn it is, the status and the totals are not — the sheets say all three
 * (`game/session.ts`).
 *
 * v1 was a solo sheet, from before the CPU: it has no `cpuScores` and is not
 * a match, so it is not resumable as one — the validator refuses it outright
 * (§8). The web-beta title had been public for one day when the CPU replaced
 * it, so discarding a v1 save costs no real player a match in progress.
 */
export interface PersistedGame {
  schemaVersion: 2;
  seed: string;
  rollIndex: number;
  /** Five faces, 1..6. */
  dice: number[];
  /** Five flags: which dice the next throw leaves alone. */
  held: boolean[];
  rollsUsed: 0 | 1 | 2 | 3;
  /** The player's twelve boxes, in the sheet's order; null while open. */
  scores: (number | null)[];
  /** The CPU's twelve boxes, same order (§3, §5). */
  cpuScores: (number | null)[];
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
  version: 2,
  defaultValue: () => null,
  validate: (raw) => {
    // v1 (a solo sheet) is not a match and is discarded outright, not
    // migrated (§8) — see the type's doc comment.
    if (!isRecord(raw) || raw.schemaVersion !== 2) return null;
    const seed = asString(raw.seed);
    // rollIndex counts throws by both seats together, so its ceiling covers
    // three throws for every box on both sheets (§4, §8).
    const rollIndex = asInt(raw.rollIndex, 0, ROLLS_PER_TURN * CATEGORY_COUNT * 2);
    const dice = asArrayOf(raw.dice, DICE_COUNT, (value) => asInt(value, 1, FACES));
    const held = asArrayOf(raw.held, DICE_COUNT, asBool);
    const rollsUsed = asInt(raw.rollsUsed, 0, ROLLS_PER_TURN);
    const boxes = asArrayOf(raw.scores, CATEGORY_COUNT, asBox);
    const cpuBoxes = asArrayOf(raw.cpuScores, CATEGORY_COUNT, asBox);
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
      cpuBoxes === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }
    return {
      schemaVersion: 2,
      seed,
      rollIndex,
      dice,
      held,
      rollsUsed: rollsUsed as PersistedGame['rollsUsed'],
      scores: boxes.map((box) => box.points),
      cpuScores: cpuBoxes.map((box) => box.points),
      elapsedSeconds,
      savedAt,
    };
  },
};
