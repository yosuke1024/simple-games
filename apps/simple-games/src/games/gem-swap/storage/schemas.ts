/**
 * Gem Swap's own persisted records, under the `gs.` prefix declared in ./keys
 * (docs/GEM_SWAP_RULES.md §7). Isolated from the shared records and from every
 * other game: corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. Every record is `schemaVersion: 1`; while the game is in
 * early release the shapes may still change, and they freeze when it
 * graduates (§7).
 *
 * There is one saved-round slot and no daily, so the two-slot rule
 * (src/test/savedGameSlots.test.ts) does not apply here.
 *
 * The saved round is never a board: it is the replay triple (seed, gem count,
 * the valid swaps in order) and its play seconds, and the schema asks the
 * rules whether play could have produced it by replaying it
 * (`restoreSession`, game/session.ts) — at most 30 resolutions, the length
 * checked before any is attempted (§4.5). The schema is also all that Backup
 * & Restore runs on a record (docs/architecture/backup.md), so a backup
 * holding an impossible round is refused whole rather than "restored" and
 * then dropped when the game opens.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  DEFAULT_COLOR_COUNT,
  isColorCount,
  MAX_ELAPSED_SECONDS,
  MAX_ROUND_SCORE,
  MIN_COUNTED_SCORE,
  restoreSession,
  toSessionRecord,
  type ColorCount,
} from '../game';

import { GS_STORAGE_KEYS } from './keys';

export { GS_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: GS_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- preferences ----------

/**
 * The gem count last picked on the home (§2), and nothing else. It only
 * reaches the next new round — a round under way keeps the count it began
 * with. Six (Normal) until somebody picks.
 */
export interface Prefs {
  schemaVersion: 1;
  colors: ColorCount;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: GS_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, colors: DEFAULT_COLOR_COUNT }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    return isColorCount(raw.colors) ? { schemaVersion: 1, colors: raw.colors } : null;
  },
};

// ---------- statistics ----------

/**
 * Four numbers and no streak (§5, §7): rounds started (not split by gem
 * count), the best score for each gem count (0 = none yet), and play time.
 * No total cleared, no longest cascade, no Undo count.
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  best5: number;
  best6: number;
  totalPlaySeconds: number;
}

/**
 * A best play could have set: 0 (none yet), or a counted round's score —
 * at least three gems (game/records.ts MIN_COUNTED_SCORE), at most the bound
 * no round can pass.
 */
function asBest(raw: unknown): number | null {
  const best = asInt(raw, 0, MAX_ROUND_SCORE);
  if (best === null) return null;
  return best === 0 || best >= MIN_COUNTED_SCORE ? best : null;
}

export const statsSchema: SchemaDef<Stats> = {
  key: GS_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, played: 0, best5: 0, best6: 0, totalPlaySeconds: 0 }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const best5 = asBest(raw.best5);
    const best6 = asBest(raw.best6);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (played === null || best5 === null || best6 === null || totalPlaySeconds === null) {
      return null;
    }
    // A best is deliberately not held to `played`: a suspended round was
    // counted when it started, and if the statistics were lost since while
    // its save survived, finishing it sets a best on a record that never saw
    // it start — real play, which must not throw the record away.
    return { schemaVersion: 1, played, best5, best6, totalPlaySeconds };
  },
};

// ---------- the suspended round ----------

/**
 * Longer than any seed this game makes (`gem-swap-` and a base-36 token, about
 * 25 characters) by a wide margin. A seed past it is not one of ours, and is
 * refused before the replay hashes it.
 */
const MAX_SEED_LENGTH = 200;

/**
 * The one slot (§7): a round that has started and not ended, as the replay
 * triple plus its play seconds. Written after every valid swap and every
 * Undo, on every way off the game screen (unmount included) and on every
 * background; removed when the round ends.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  colors: ColorCount;
  /** The valid swaps made, oldest first, each normalised to [a, b] with a < b. */
  swaps: [number, number][];
  /** Whole play seconds already booked for this round (statistics only; never shown). */
  elapsedSeconds: number;
  /** When it was written (epoch ms). */
  savedAt: number;
}

/**
 * Fail-closed (§7): the triple is replayed from the seed's initial board
 * through the rules, so an unknown gem count, an empty seed, a cell that is
 * not 0–63, a non-adjacent or run-less swap, a 31st swap, a swap after the
 * round ended, and a round that replays to a finished one all come back as
 * null — and the player lands on the game's home with nothing restored. What
 * is returned is the record as the replay rebuilt it: pairs normalised to
 * a < b, unknown extra fields dropped.
 */
export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: GS_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    if (savedAt === null) return null;
    if (asInt(raw.elapsedSeconds, 0, MAX_ELAPSED_SECONDS) === null) return null;
    if (asString(raw.seed, MAX_SEED_LENGTH) === null) return null;
    const session = restoreSession(raw);
    if (session === null) return null;
    const record = toSessionRecord(session);
    if (record === null) return null;
    return {
      schemaVersion: 1,
      seed: record.seed,
      colors: record.colors,
      swaps: record.swaps.map(([a, b]) => [a, b]),
      elapsedSeconds: record.elapsedSeconds,
      savedAt,
    };
  },
};
