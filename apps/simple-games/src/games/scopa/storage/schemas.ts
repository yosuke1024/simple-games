/**
 * Scopa's own persisted records, under the `sc.` prefix declared in ./keys.
 * Isolated from the shared records and from every other game: corruption here
 * can never take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. Nothing here repairs anything.
 *
 * The saved match is checked in full **inside `validate`** (docs/SCOPA_RULES.md
 * §9.2「検証の置き場所」): `decodeSavedMatch` (game/serialize.ts) replays the
 * deal's public history from the seed through the same one rule the game is
 * played under, and refuses a capture the rules could not have produced, a
 * move count or a dealer that disagrees with the replay, a score no run of
 * deals could reach, and a match that is already decided. A backup carries a
 * record through its owner's `validate` only (docs/architecture/backup.md), so
 * the same refusals hold for a restored backup too.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import { decodeSavedMatch, type SavedMatch } from '../game';

import { SC_STORAGE_KEYS } from './keys';

export { SC_STORAGE_KEYS };
export type { SavedMatch };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: SC_STORAGE_KEYS.flags,
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
 * One record for the whole game — there is one strength (§8). No `draws`
 * field: eleven or more and ahead is always one side (§3.4), and a column of
 * permanent zeroes would be a promise the rules do not make. No deals are
 * booked either, and no best score or streak exists to book.
 *
 * Fields are never checked against each other: this record and the saved
 * match are separate keys, either can fall back to its default on its own, and
 * a match resumed after the statistics were reset can honestly end with
 * `wins > played` (§9.4).
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  wins: number;
  losses: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: SC_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, played: 0, wins: 0, losses: 0, totalPlaySeconds: 0 }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const wins = asInt(raw.wins, 0, 1e9);
    const losses = asInt(raw.losses, 0, 1e9);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    // One field out of range and the whole record goes back to its default:
    // nothing is rescued field by field (§9.4).
    if (played === null || wins === null || losses === null || totalPlaySeconds === null) {
      return null;
    }
    return { schemaVersion: 1, played, wins, losses, totalPlaySeconds };
  },
};

// ---------- saved match ----------

/**
 * One slot, holding the whole match mid-play (§9.1): the seed, the deal
 * number, the dealer, the score, the move count, the clock and the deal's
 * public history. The record handed back is rebuilt from the checked fields,
 * so nothing the decoder did not read survives into the store.
 */
export const gameSchema: SchemaDef<SavedMatch | null> = {
  key: SC_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    if (decodeSavedMatch(raw) === null) return null;
    const scores = raw.scores as readonly [number, number];
    return {
      schemaVersion: 1,
      seed: raw.seed as string,
      dealNumber: raw.dealNumber as number,
      dealer: raw.dealer as SavedMatch['dealer'],
      scores: [scores[0], scores[1]],
      moveCount: raw.moveCount as number,
      elapsedSeconds: raw.elapsedSeconds as number,
      deal: raw.deal as string,
      savedAt: raw.savedAt as number,
    };
  },
};
